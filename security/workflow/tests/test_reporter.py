"""Tests for reporter formatters (text, json, sarif) and exit code matrix."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from security.workflow.analyzer import AnalysisResult, analyze_paths
from security.workflow.finding import Finding
from security.workflow.reporter import (
    compute_exit_code,
    format_report,
    report_json,
    report_sarif,
    report_text,
    sanitize_text,
)


def _make_sample_finding(
    rule_id: str,
    snippet: str = "run: echo test",
    message: str = "Test message",
    line: int = 10,
) -> Finding:
    return Finding(
        rule_id=rule_id,
        file=".github/workflows/deploy.yml",
        line=line,
        column=None,
        job_id="job1",
        step_name="step1",
        snippet=snippet,
        message=message,
        confidence="HIGH",
    )


class TestTextReporter:
    def test_ansi_and_control_chars_stripped(self) -> None:
        malicious_snippet = "\x1b[31;1mINJECTED\x1b[0m\x00\x08secret"
        malicious_message = "\x1b[2JClear Screen\x1b[0m"
        finding = _make_sample_finding(
            "PG-WF-001",
            snippet=malicious_snippet,
            message=malicious_message,
        )
        res = AnalysisResult(findings=[finding])
        text_out = report_text(res, repository="test/repo")

        assert "\x1b[" not in text_out
        assert "\x00" not in text_out
        assert "INJECTED" in text_out
        assert "Clear Screen" in text_out

    def test_sanitize_text_direct(self) -> None:
        raw = "\x1b[32mOK\x1b[0m\x07\x01"
        sanitized = sanitize_text(raw)
        assert sanitized == "OK"

    def test_empty_findings_text_report(self) -> None:
        res = AnalysisResult(findings=[], suppressed=[], workflows_analyzed=3)
        text_out = report_text(res)
        assert "No security findings detected" in text_out
        assert "Workflows scanned: 3" in text_out


class TestJsonReporter:
    def test_json_golden_structure(self) -> None:
        labs_dir = Path("security/workflow/labs/vulnerable")
        assert labs_dir.is_dir()
        analysis = analyze_paths(labs_dir)

        json_out = report_json(analysis, repository="test/labs")
        parsed = json.loads(json_out)

        assert parsed["schema_version"] == "1.0.0"
        assert parsed["repository"] == "test/labs"
        assert parsed["workflows_analyzed"] >= 5
        assert "summary" in parsed
        assert parsed["summary"]["total_findings"] > 0
        assert parsed["summary"]["block_count"] > 0
        assert "risk_per_workflow" in parsed
        assert len(parsed["risk_per_workflow"]) > 0
        assert "findings" in parsed
        assert len(parsed["findings"]) == parsed["summary"]["total_findings"]

        # Verify stable deterministic output
        json_out_2 = report_json(analysis, repository="test/labs")
        assert json_out == json_out_2


class TestSarifReporter:
    def test_sarif_golden_structure(self) -> None:
        labs_dir = Path("security/workflow/labs/vulnerable")
        analysis = analyze_paths(labs_dir)

        sarif_out = report_sarif(analysis, repository="test/labs")
        parsed = json.loads(sarif_out)

        assert parsed["version"] == "2.1.0"
        assert "$schema" in parsed
        assert len(parsed["runs"]) == 1

        run = parsed["runs"][0]
        driver = run["tool"]["driver"]
        assert driver["name"] == "PipelineGuard"
        assert len(driver["rules"]) == 25  # 25 rules in REGISTRY

        results = run["results"]
        assert len(results) == len(analysis.findings)

        first_res = results[0]
        assert "ruleId" in first_res
        assert first_res["level"] in ("error", "warning", "note")
        assert "physicalLocation" in first_res["locations"][0]
        assert "partialFingerprints" in first_res

        # Determinism
        assert sarif_out == report_sarif(analysis, repository="test/labs")


class TestExitCodeMatrix:
    def test_clean_scan_exit_0(self) -> None:
        res = AnalysisResult(findings=[])
        assert compute_exit_code(res) == 0

    def test_block_finding_default_fail_on_exit_1(self) -> None:
        # PG-WF-001 default action is BLOCK
        finding = _make_sample_finding("PG-WF-001")
        res = AnalysisResult(findings=[finding])
        assert compute_exit_code(res) == 1

    def test_block_finding_fail_on_never_exit_0(self) -> None:
        finding = _make_sample_finding("PG-WF-001")
        res = AnalysisResult(findings=[finding])
        assert compute_exit_code(res, fail_on="never") == 0

    def test_warn_finding_fail_on_block_exit_0(self) -> None:
        # PG-WF-901 default action is WARN
        finding = _make_sample_finding("PG-WF-901")
        res = AnalysisResult(findings=[finding])
        assert compute_exit_code(res, fail_on="block") == 0

    def test_warn_finding_fail_on_warn_exit_2(self) -> None:
        finding = _make_sample_finding("PG-WF-901")
        res = AnalysisResult(findings=[finding])
        assert compute_exit_code(res, fail_on="warn") == 2

    def test_baselined_finding_excluded_from_exit_code(self) -> None:
        finding = _make_sample_finding("PG-WF-001")
        res = AnalysisResult(findings=[finding])
        base_set = {finding.fingerprint()}
        # Since the BLOCK finding is baselined, exit code is 0
        assert compute_exit_code(res, baselined_fingerprints=base_set) == 0

    def test_format_report_dispatcher(self) -> None:
        res = AnalysisResult(findings=[_make_sample_finding("PG-WF-001")])
        assert "PipelineGuard" in format_report(res, "text")
        assert "PipelineGuard" in format_report(res, "sarif")
        assert "schema_version" in format_report(res, "json")

        with pytest.raises(ValueError, match="Unsupported format"):
            format_report(res, "pdf")
