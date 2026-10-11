"""Tests for PipelineGuard event generation and JSON Schema compliance."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import jsonschema  # type: ignore[import-untyped]
import pytest

from security.workflow.analyzer import analyze_paths
from security.workflow.events import (
    finding_to_event,
    load_event_schema,
    to_events,
    validate_repository_name,
)
from security.workflow.finding import Finding


@pytest.fixture
def event_schema() -> dict[str, Any]:
    return load_event_schema()


class TestRepositoryValidation:
    def test_valid_repository_names(self) -> None:
        assert validate_repository_name("org/repo") == "org/repo"
        assert validate_repository_name("my-repo") == "my-repo"
        assert validate_repository_name("owner/repo.git") == "owner/repo.git"
        assert validate_repository_name("PipelineGuard_123") == "PipelineGuard_123"

    def test_invalid_repository_names(self) -> None:
        with pytest.raises(ValueError, match="non-empty string"):
            validate_repository_name("")

        with pytest.raises(ValueError, match="non-empty string"):
            validate_repository_name("   ")

        with pytest.raises(ValueError, match="Invalid repository name"):
            validate_repository_name("invalid;injection")

        with pytest.raises(ValueError, match="Invalid repository name"):
            validate_repository_name("owner/repo/subpath")

        with pytest.raises(ValueError, match="Invalid repository name"):
            validate_repository_name("owner repo")


class TestEventStructure:
    def test_finding_to_event_structure(self, event_schema: dict[str, Any]) -> None:
        finding = Finding(
            rule_id="PG-WF-001",
            file=".github/workflows/ci.yml",
            line=42,
            column=None,
            job_id="test",
            step_name="run-step",
            snippet="echo injection",
            message="Script injection",
            confidence="HIGH",
        )
        event = finding_to_event(finding, repository="acme/service")

        # Validate against JSON Schema Draft 2020-12
        jsonschema.validate(instance=event, schema=event_schema)

        # Check required fields
        assert event["source"] == "workflow-security"
        assert event["repository"] == "acme/service"
        assert event["file"] == ".github/workflows/ci.yml"
        assert event["line"] == 42
        assert event["rule"] == "PG-WF-001"
        assert event["severity"] == "CRITICAL"
        assert event["action"] == "BLOCK"
        assert event["status"] == "active"
        assert "timestamp" not in event  # Timestamp-free by default

    def test_event_with_timestamp(self, event_schema: dict[str, Any]) -> None:
        finding = Finding(
            rule_id="PG-WF-001",
            file=".github/workflows/ci.yml",
            line=42,
            column=None,
            job_id="test",
            step_name="run-step",
            snippet="echo injection",
            message="Script injection",
            confidence="HIGH",
        )
        ts = "2026-10-11T12:00:00Z"
        event = finding_to_event(finding, repository="acme/service", timestamp=ts)

        jsonschema.validate(instance=event, schema=event_schema)
        assert event["timestamp"] == ts

    def test_rejects_additional_properties(self, event_schema: dict[str, Any]) -> None:
        finding = Finding(
            rule_id="PG-WF-001",
            file=".github/workflows/ci.yml",
            line=42,
            column=None,
            job_id="test",
            step_name="run-step",
            snippet="echo injection",
            message="Script injection",
            confidence="HIGH",
        )
        event = finding_to_event(finding, repository="acme/service")
        event["extra_unauthorized_key"] = "forbidden"

        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(instance=event, schema=event_schema)


class TestLabsValidationAgainstSchema:
    def test_all_vulnerable_lab_events_conform_to_schema(
        self, event_schema: dict[str, Any]
    ) -> None:
        """Every single event produced from scanning labs/vulnerable must validate against schema."""
        labs_path = Path("security/workflow/labs/vulnerable")
        assert labs_path.is_dir()

        analysis = analyze_paths(labs_path)
        assert len(analysis.findings) > 0

        events = to_events(analysis, repository="pipelineguard/labs")
        assert len(events) == len(analysis.findings) + len(analysis.suppressed)

        validator = jsonschema.Draft202012Validator(event_schema)
        for ev in events:
            errors = list(validator.iter_errors(ev))
            assert not errors, f"Event failed schema validation: {errors}\nEvent: {ev}"

    def test_config_overrides_and_suppressed_events(self, event_schema: dict[str, Any]) -> None:
        from security.workflow.analyzer import AnalysisResult, SuppressedFinding
        from security.workflow.config import Config
        from security.workflow.rules import Action, Severity

        finding = Finding(
            rule_id="PG-WF-001",
            file=".github/workflows/ci.yml",
            line=42,
            column=None,
            job_id="test",
            step_name="run-step",
            snippet="echo injection",
            message="Script injection",
            confidence="HIGH",
        )
        cfg = Config(
            severity_overrides={"PG-WF-001": Severity.LOW},
            action_overrides={"PG-WF-001": Action.WARN},
        )
        suppressed = SuppressedFinding(finding=finding, reason="risk accepted")
        res = AnalysisResult(findings=[finding], suppressed=[suppressed])

        events = to_events(res, repository="my-org/my-repo", config=cfg)
        assert len(events) == 2
        active_ev, supp_ev = events[0], events[1]

        assert active_ev["severity"] == "LOW"
        assert active_ev["action"] == "WARN"
        assert active_ev["status"] == "active"

        assert supp_ev["status"] == "suppressed"
        assert supp_ev["severity"] == "LOW"

        for ev in events:
            jsonschema.validate(instance=ev, schema=event_schema)
