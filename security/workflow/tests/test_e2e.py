"""End-to-end integration tests for PipelineGuard workflow security CLI.

Validates that:
- Scanning labs/vulnerable produces exit code 1 and exactly the rule IDs specified in expected.json.
- Scanning labs/secure produces exit code 0 and zero findings across text, json, and sarif formats.
- Both direct main() invocation and subprocess 'python -m security.workflow' behave identically.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from security.workflow.__main__ import main

_LABS_DIR = Path(__file__).parent.parent / "labs"
_VULN_DIR = _LABS_DIR / "vulnerable"
_SECURE_DIR = _LABS_DIR / "secure"
_EXPECTED_FILE = _VULN_DIR / "expected.json"


@pytest.fixture
def expected_rules() -> set[str]:
    data = json.loads(_EXPECTED_FILE.read_text(encoding="utf-8"))
    all_rules: set[str] = set()
    for spec in data.values():
        all_rules.update(spec["rules"])
    return all_rules


class TestE2EVulnerableWorkflows:
    """Validate scan over labs/vulnerable across all formats."""

    def test_json_format_matches_expected_rules_and_exit_1(
        self,
        expected_rules: set[str],
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        exit_code = main(["scan", str(_VULN_DIR), "--format", "json", "--repository", "test/repo"])
        assert exit_code == 1

        captured = capsys.readouterr()
        data = json.loads(captured.out)

        assert "findings" in data
        findings = data["findings"]
        actual_rule_ids = {f["rule_id"] for f in findings}

        assert actual_rule_ids == expected_rules
        assert data["summary"]["block_count"] > 0
        assert data["summary"]["total_findings"] >= len(expected_rules)

    def test_text_format_exit_1(self, capsys: pytest.CaptureFixture[str]) -> None:
        exit_code = main(["scan", str(_VULN_DIR), "--format", "text", "--repository", "test/repo"])
        assert exit_code == 1

        captured = capsys.readouterr()
        assert "PipelineGuard Workflow Security Report" in captured.out
        assert "BLOCK" in captured.out
        assert "Summary:" in captured.out

    def test_sarif_format_exit_1(
        self,
        expected_rules: set[str],
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        exit_code = main(["scan", str(_VULN_DIR), "--format", "sarif", "--repository", "test/repo"])
        assert exit_code == 1

        captured = capsys.readouterr()
        sarif = json.loads(captured.out)
        runs = sarif.get("runs", [])
        assert len(runs) == 1
        results = runs[0].get("results", [])
        actual_rule_ids = {r["ruleId"] for r in results}
        assert actual_rule_ids == expected_rules


class TestE2ESecureWorkflows:
    """Validate scan over labs/secure produces exit 0 and zero findings across all formats."""

    def test_text_format_clean_exit_0(self, capsys: pytest.CaptureFixture[str]) -> None:
        exit_code = main(["scan", str(_SECURE_DIR), "--format", "text", "--repository", "test/repo"])
        assert exit_code == 0

        captured = capsys.readouterr()
        assert "No security findings detected. Workflows are secure." in captured.out
        assert "Workflows scanned: 2" in captured.out

    def test_json_format_clean_exit_0(self, capsys: pytest.CaptureFixture[str]) -> None:
        exit_code = main(["scan", str(_SECURE_DIR), "--format", "json", "--repository", "test/repo"])
        assert exit_code == 0

        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert data["findings"] == []
        assert data["summary"]["total_findings"] == 0
        assert data["summary"]["block_count"] == 0
        assert data["summary"]["warn_count"] == 0

    def test_sarif_format_clean_exit_0(self, capsys: pytest.CaptureFixture[str]) -> None:
        exit_code = main(["scan", str(_SECURE_DIR), "--format", "sarif", "--repository", "test/repo"])
        assert exit_code == 0

        captured = capsys.readouterr()
        sarif = json.loads(captured.out)
        runs = sarif.get("runs", [])
        assert len(runs) == 1
        results = runs[0].get("results", [])
        assert results == []


class TestE2ESubprocess:
    """Validate real command-line execution through python -m security.workflow."""

    def test_subprocess_vulnerable_exit_1(self, expected_rules: set[str]) -> None:
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "security.workflow",
                "scan",
                str(_VULN_DIR),
                "--format",
                "json",
                "--repository",
                "test/repo",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert proc.returncode == 1
        data = json.loads(proc.stdout)
        actual_rules = {f["rule_id"] for f in data["findings"]}
        assert actual_rules == expected_rules

    def test_subprocess_secure_exit_0(self) -> None:
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "security.workflow",
                "scan",
                str(_SECURE_DIR),
                "--format",
                "json",
                "--repository",
                "test/repo",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert proc.returncode == 0
        data = json.loads(proc.stdout)
        assert data["findings"] == []
