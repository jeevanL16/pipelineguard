"""Tests for the public API contract (security.workflow.api and security.workflow)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import jsonschema  # type: ignore[import-untyped]
import pytest

import security.workflow as sw
from security.workflow.api import (
    REGISTRY,
    Action,
    AnalysisResult,
    Config,
    ConfigError,
    Finding,
    RiskScore,
    Rule,
    Severity,
    SuppressedFinding,
    analyze_path,
    analyze_text,
    calculate_risk,
    finding_to_event,
    load_config,
    lookup,
    to_events,
    validate_repository_name,
)
from security.workflow.events import load_event_schema

_LABS_VULNERABLE = Path(__file__).parent.parent / "labs" / "vulnerable"
_LABS_SECURE = Path(__file__).parent.parent / "labs" / "secure"


class TestPublicApiContract:
    """Validate that Member 2 and Member 3 can reliably import everything from security.workflow."""

    def test_reexports_in_root_package(self) -> None:
        assert sw.analyze_path is analyze_path
        assert sw.analyze_text is analyze_text
        assert sw.to_events is to_events
        assert sw.AnalysisResult is AnalysisResult
        assert sw.SuppressedFinding is SuppressedFinding
        assert sw.Config is Config
        assert sw.ConfigError is ConfigError
        assert sw.Finding is Finding
        assert sw.Rule is Rule
        assert sw.Severity is Severity
        assert sw.Action is Action
        assert sw.lookup is lookup
        assert sw.REGISTRY is REGISTRY
        assert sw.RiskScore is RiskScore
        assert sw.calculate_risk is calculate_risk
        assert sw.load_config is load_config
        assert sw.finding_to_event is finding_to_event
        assert sw.validate_repository_name is validate_repository_name

    def test_all_exports_present_in_dunder_all(self) -> None:
        for name in sw.__all__:
            assert hasattr(sw, name), f"Missing export: {name}"

    def test_docstrings_present(self) -> None:
        assert analyze_path.__doc__ is not None
        assert analyze_text.__doc__ is not None
        assert to_events.__doc__ is not None


class TestAnalyzePath:
    def test_analyze_single_file(self) -> None:
        target_file = _LABS_VULNERABLE / "script_injection.yml"
        assert target_file.exists()
        result = analyze_path(target_file)
        assert isinstance(result, AnalysisResult)
        assert result.workflows_analyzed == 1
        assert len(result.findings) >= 1
        rule_ids = {f.rule_id for f in result.findings}
        assert "PG-WF-001" in rule_ids

    def test_analyze_directory(self) -> None:
        result = analyze_path(_LABS_SECURE)
        assert isinstance(result, AnalysisResult)
        assert result.workflows_analyzed >= 1
        assert len(result.findings) == 0

    def test_analyze_with_config_overrides(self) -> None:
        target_file = _LABS_VULNERABLE / "script_injection.yml"
        cfg = Config(disabled_rules=frozenset({"PG-WF-001"}))
        result = analyze_path(target_file, config=cfg)
        assert isinstance(result, AnalysisResult)
        rule_ids = {f.rule_id for f in result.findings}
        assert "PG-WF-001" not in rule_ids


class TestAnalyzeText:
    def test_analyze_clean_text(self) -> None:
        workflow_yaml = """
name: Clean CI
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          persist-credentials: false
"""
        result = analyze_text(workflow_yaml, filename="ci.yml")
        assert isinstance(result, AnalysisResult)
        assert result.workflows_analyzed == 1
        assert len(result.findings) == 0

    def test_analyze_vulnerable_text(self) -> None:
        workflow_yaml = """
name: Issue Greeter
on:
  issues:
    types: [opened]
permissions:
  contents: read
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo Processing issue title ${{ github.event.issue.title }}
"""
        result = analyze_text(workflow_yaml, filename="issues.yml")
        assert isinstance(result, AnalysisResult)
        assert result.workflows_analyzed == 1
        assert len(result.findings) >= 1
        assert any(f.rule_id == "PG-WF-001" for f in result.findings)
        assert all(f.file == "issues.yml" for f in result.findings)

    def test_analyze_text_parse_error(self) -> None:
        bad_yaml = "name: Bad YAML\n  - broken: indentation:\n"
        result = analyze_text(bad_yaml, filename="bad.yml")
        assert isinstance(result, AnalysisResult)
        assert len(result.findings) == 1
        assert result.findings[0].rule_id == "PG-WF-900"
        assert result.findings[0].file == "bad.yml"

    def test_default_filename_memory(self) -> None:
        workflow_yaml = """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: ${{ github.event.issue.title }}
"""
        result = analyze_text(workflow_yaml)
        assert result.findings[0].file == "<memory>"


class TestToEvents:
    @pytest.fixture
    def schema(self) -> dict[str, Any]:
        return load_event_schema()

    def test_round_trip_to_events_and_schema_validation(self, schema: dict[str, Any]) -> None:
        workflow_yaml = """
name: CI
on:
  issue_comment:
    types: [created]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "${{ github.event.comment.body }}"
"""
        result = analyze_text(workflow_yaml, filename="comment.yml")
        assert len(result.findings) > 0

        events = to_events(result, repository="acme/pipeline")
        assert len(events) == len(result.findings)

        for event in events:
            # Must adhere to JSON Schema
            jsonschema.validate(instance=event, schema=schema)
            assert event["repository"] == "acme/pipeline"
            assert event["source"] == "workflow-security"
            assert event["status"] == "active"
            assert "timestamp" not in event  # deterministic by default

    def test_to_events_with_timestamp(self, schema: dict[str, Any]) -> None:
        result = analyze_text("on: push\njobs: {}\n", filename="empty.yml")
        events = to_events(result, repository="org/repo", timestamp="2026-10-11T12:00:00Z")
        assert isinstance(events, list)

    def test_to_events_with_suppression(self, schema: dict[str, Any]) -> None:
        workflow_yaml = """
name: Suppressed
on: push
permissions:
  contents: read
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      # pipelineguard-ignore: PG-WF-001 Legitimate dynamic build parameter
      - run: echo "${{ github.event.issue.title }}"
"""
        result = analyze_text(workflow_yaml, filename="suppressed.yml")
        assert len(result.suppressed) == 1

        events = to_events(result, repository="owner/repo")
        assert len(events) == 1
        ev = events[0]
        jsonschema.validate(instance=ev, schema=schema)
        assert ev["status"] == "suppressed"
        assert ev["rule"] == "PG-WF-001"

    def test_to_events_invalid_repository_raises(self) -> None:
        result = analyze_text("on: push\njobs: {}\n")
        with pytest.raises(ValueError, match="Invalid repository name"):
            to_events(result, repository="invalid repository name with spaces!")
