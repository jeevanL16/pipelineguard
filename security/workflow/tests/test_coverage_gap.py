"""Tests targeting remaining edge-case lines across all modules to ensure >= 90% per module."""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import patch

from security.workflow.analyzer import AnalysisResult, SuppressedFinding, analyze_paths
from security.workflow.config import Config
from security.workflow.detectors._base import trigger_set
from security.workflow.detectors.commands import _first_line
from security.workflow.detectors.permissions import detect as detect_permissions
from security.workflow.detectors.supply_chain import detect as detect_supply_chain
from security.workflow.finding import Finding
from security.workflow.models import Expression, Workflow
from security.workflow.parser import parse_workflow_text
from security.workflow.reporter import report_json, report_text
from security.workflow.risk import calculate_risk
from security.workflow.rules import Severity


class TestCoverageEdgeCases:
    def test_analyzer_stat_and_read_oserror(self, tmp_path: Path) -> None:
        """Cover lines 387-402 and 442-457 in analyzer.py."""
        wf_file = tmp_path / "dummy.yml"
        wf_file.write_text("name: Test\non: push\njobs: {}\n", encoding="utf-8")

        # Test stat OSError
        orig_stat = Path.stat
        call_count = 0

        def failing_stat(self: Path, *args: object, **kwargs: object) -> os.stat_result:
            nonlocal call_count
            follow_symlinks = bool(kwargs.get("follow_symlinks", True))
            if self.name == "dummy.yml" and follow_symlinks:
                call_count += 1
                if call_count >= 3:
                    raise OSError("Disk read fault")
            return orig_stat(self, follow_symlinks=follow_symlinks)

        with patch.object(Path, "stat", autospec=True, side_effect=failing_stat):
            res = analyze_paths([wf_file], scan_root=tmp_path, config=Config())
            assert len(res.findings) == 1
            assert res.findings[0].rule_id == "PG-WF-900"
            assert "Failed to access workflow file" in res.findings[0].message

        # Test read_text OSError
        orig_read = Path.read_text

        def failing_read(self: Path, *args: object, **kwargs: object) -> str:
            if self.name == "dummy.yml":
                raise OSError("Permission denied")
            return orig_read(self, *args, **kwargs)  # type: ignore[arg-type]

        with patch.object(Path, "read_text", autospec=True, side_effect=failing_read):
            res = analyze_paths([wf_file], scan_root=tmp_path, config=Config())
            assert len(res.findings) == 1
            assert res.findings[0].rule_id == "PG-WF-900"
            assert "Failed to read workflow file" in res.findings[0].message

    def test_parser_job_body_none_and_non_dict(self) -> None:
        """Cover parser lines 203-227."""
        # Body is None
        yaml_none = """
name: None Job
on: push
jobs:
  job1:
"""
        parsed_none = parse_workflow_text(yaml_none)
        assert parsed_none.ok
        assert parsed_none.workflow is not None
        assert len(parsed_none.workflow.jobs) == 1
        assert parsed_none.workflow.jobs[0].id == "job1"
        assert parsed_none.workflow.jobs[0].steps == []

        # Body is not dict (string)
        yaml_str = """
name: Non Dict Job
on: push
jobs:
  job2: "this is a string, not a dict"
"""
        parsed_str = parse_workflow_text(yaml_str)
        assert parsed_str.ok
        assert parsed_str.workflow is not None
        assert len(parsed_str.workflow.jobs) == 1
        assert parsed_str.workflow.jobs[0].id == "job2"
        assert parsed_str.workflow.jobs[0].steps == []

    def test_supply_chain_empty_uses_and_no_at_and_invalid_persist_val(self) -> None:
        """Cover supply_chain.py lines 76, 88, 115."""
        yaml_text = """
name: Edge Uses
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: "   "
      - uses: actions/checkout
        with:
          persist-credentials: 12345
"""
        parsed = parse_workflow_text(yaml_text)
        findings = detect_supply_chain(parsed)
        rule_ids = {f.rule_id for f in findings}
        assert "PG-WF-019" in rule_ids
        assert "PG-WF-020" in rule_ids

    def test_permissions_checkout_head_ref_expression(self) -> None:
        """Cover permissions.py lines 106-107."""
        yaml_text = """
name: Checkout PR Head Expr
on: pull_request_target
jobs:
  checkout:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        env:
          HEAD_REF: ${{ github.head_ref }}
"""
        parsed = parse_workflow_text(yaml_text)
        assert parsed.workflow is not None
        # Add head ref expression directly to step expressions without putting in with_inputs.ref
        step = parsed.workflow.jobs[0].steps[0]
        step.expressions.append(Expression(text="github.head_ref", context="github", line=10))
        findings = detect_permissions(parsed)
        assert any(f.rule_id == "PG-WF-006" for f in findings)

    def test_trigger_set_and_risk_extract_triggers_edge_types(self) -> None:
        """Cover _base.py line 82 and risk.py lines 108, 110, 115."""
        # Non-standard 'on' value (e.g. integer)
        wf_int = Workflow(
            path="wf.yml",
            name="Int On",
            on=123,
            permissions=None,
            env={},
            jobs=[],
            expressions=[],
            line=1,
        )
        assert trigger_set(wf_int) == frozenset()
        risk_int = calculate_risk([], triggers=wf_int)
        assert risk_int.score == 0

        # String on
        wf_str = Workflow(
            path="wf.yml",
            name="Str On",
            on="pull_request_target",
            permissions=None,
            env={},
            jobs=[],
            expressions=[],
            line=1,
        )
        assert trigger_set(wf_str) == frozenset({"pull_request_target"})
        risk_str = calculate_risk([], triggers=wf_str)
        assert risk_str.score == 0

        # None on
        wf_none = Workflow(
            path="wf.yml",
            name="None On",
            on=None,
            permissions=None,
            env={},
            jobs=[],
            expressions=[],
            line=1,
        )
        assert trigger_set(wf_none) == frozenset()
        risk_none = calculate_risk([], triggers=wf_none)
        assert risk_none.score == 0

    def test_commands_first_line_whitespace(self) -> None:
        """Cover commands.py line 180."""
        assert _first_line("   \n\n\t  ") == "   \n\n\t  "

    def test_rules_severity_not_implemented(self) -> None:
        """Cover rules.py line 39."""
        assert Severity.HIGH.__lt__("NOT_A_SEVERITY") is NotImplemented

    def test_reporter_with_suppressed_findings(self) -> None:
        """Cover reporter.py lines 197 and 274-278."""
        finding = Finding(
            rule_id="PG-WF-001",
            file="ci.yml",
            line=10,
            column=1,
            job_id="test",
            step_name="run",
            snippet="echo $VAR",
            message="Test finding",
            confidence="HIGH",
        )
        suppressed = SuppressedFinding(finding=finding, reason="Allowed for test")
        res = AnalysisResult(
            findings=(),
            suppressed=(suppressed,),
            workflows_analyzed=1,
        )

        text_out = report_text(res, repository="org/repo")
        assert "Suppressed: 1 finding(s) with documented rationale" in text_out

        json_out = report_json(res, repository="org/repo")
        data = json.loads(json_out)
        assert len(data["suppressed"]) == 1
        assert data["suppressed"][0]["rule_id"] == "PG-WF-001"
        assert data["suppressed"][0]["reason"] == "Allowed for test"
