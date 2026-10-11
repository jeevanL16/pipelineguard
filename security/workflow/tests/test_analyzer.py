"""Tests for workflow security analyzer and path scanner."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from security.workflow import detectors
from security.workflow.analyzer import (
    AnalysisResult,
    SuppressedFinding,
    analyze_paths,
    analyze_workflow,
    check_suppression,
)
from security.workflow.config import Config
from security.workflow.finding import Finding
from security.workflow.models import ParseResult
from security.workflow.parser import parse_workflow_text


class TestAnalyzerCrashIsolation:
    def test_crashing_detector_isolated(self) -> None:
        """A crashing detector yields a PG-WF-901 finding without traceback and scan continues."""
        wf_content = """
name: Crash Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
"""
        parsed = parse_workflow_text(wf_content, path="crash.yml")

        def buggy_detector(result: ParseResult) -> list[Finding]:
            raise RuntimeError("Unexpected failure in detector logic")

        original_detectors = list(detectors.ALL_DETECTORS)
        try:
            # Insert buggy detector alongside regular detectors
            detectors.ALL_DETECTORS.append(buggy_detector)
            res = analyze_workflow(parsed)

            rule_ids = [f.rule_id for f in res.findings]
            assert "PG-WF-901" in rule_ids

            error_finding = next(f for f in res.findings if f.rule_id == "PG-WF-901")
            assert "RuntimeError" in error_finding.message
            assert "Traceback" not in error_finding.message
            assert error_finding.evidence.get("exception_type") == "RuntimeError"
            assert "Traceback" not in str(error_finding.evidence)
        finally:
            detectors.ALL_DETECTORS[:] = original_detectors


class TestParseErrorHandling:
    def test_parse_error_yields_pg_wf_900(self) -> None:
        """Parse failure yields PG-WF-900 instead of an exception."""
        malformed = "jobs: [ invalid YAML {"
        parsed = parse_workflow_text(malformed, path="bad.yml")
        assert not parsed.ok

        res = analyze_workflow(parsed)
        assert len(res.findings) == 1
        assert res.findings[0].rule_id == "PG-WF-900"
        assert "bad.yml" in res.findings[0].file


class TestSuppressions:
    def test_suppression_with_reason_accepted(self) -> None:
        """Suppression directive with valid reason silences the finding and records it."""
        wf = """
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Download
        # pipelineguard-ignore: PG-WF-014 Approved legacy internal mirror
        run: curl http://archive.ubuntu.com/mirror
"""
        parsed = parse_workflow_text(wf, path="test.yml")
        res = analyze_workflow(parsed)

        assert not any(f.rule_id == "PG-WF-014" for f in res.findings)
        assert len(res.suppressed) == 1
        suppressed_finding, reason = res.suppressed[0]
        assert suppressed_finding.rule_id == "PG-WF-014"
        assert reason == "Approved legacy internal mirror"

    def test_suppression_without_reason_rejected(self) -> None:
        """Suppression directive without a reason is rejected and the finding is reported."""
        wf = """
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Download
        # pipelineguard-ignore: PG-WF-014
        run: curl http://archive.ubuntu.com/mirror
"""
        parsed = parse_workflow_text(wf, path="test.yml")
        res = analyze_workflow(parsed)

        reported_rules = [f.rule_id for f in res.findings]
        assert "PG-WF-014" in reported_rules
        assert len(res.suppressed) == 0

    def test_suppression_whitespace_reason_rejected(self) -> None:
        """Suppression directive with only whitespace reason is rejected."""
        wf = """
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Download
        # pipelineguard-ignore: PG-WF-014    
        run: curl http://archive.ubuntu.com/mirror
"""
        parsed = parse_workflow_text(wf, path="test.yml")
        res = analyze_workflow(parsed)

        reported_rules = [f.rule_id for f in res.findings]
        assert "PG-WF-014" in reported_rules
        assert len(res.suppressed) == 0

    def test_check_suppression_helper_direct(self) -> None:
        lines = [
            "# Header",
            "# pipelineguard-ignore: PG-WF-001 valid reason",
            "run: something",
        ]
        matched, reason = check_suppression(lines, line_number=3, rule_id="PG-WF-001")
        assert matched is True
        assert reason == "valid reason"

        matched_none, reason_none = check_suppression(lines, line_number=3, rule_id="PG-WF-002")
        assert matched_none is False
        assert reason_none is None


class TestSafePathScanning:
    def test_oversized_file_reported_as_900(self, tmp_path: Path) -> None:
        """Files exceeding max_file_size limit produce PG-WF-900 findings."""
        wf_file = tmp_path / "big_workflow.yml"
        wf_file.write_text("name: Big\non: push\njobs: {}\n", encoding="utf-8")

        config = Config(max_file_size=10)  # Very small threshold
        res = analyze_paths(wf_file, config=config)

        assert len(res.findings) == 1
        assert res.findings[0].rule_id == "PG-WF-900"
        assert "exceeds maximum allowed limit" in res.findings[0].message

    def test_non_utf8_file_reported_as_900(self, tmp_path: Path) -> None:
        """Non-UTF8 workflow file produces a PG-WF-900 finding."""
        wf_file = tmp_path / "binary_workflow.yml"
        wf_file.write_bytes(b"\xff\xfe\x00\x00\x12\x34")

        res = analyze_paths(wf_file)
        assert len(res.findings) == 1
        assert res.findings[0].rule_id == "PG-WF-900"
        assert "not valid UTF-8" in res.findings[0].message

    def test_symlink_escape_not_scanned(self, tmp_path: Path) -> None:
        """Symlinks pointing outside scan root are not followed."""
        repo_dir = tmp_path / "repo"
        repo_dir.mkdir()
        safe_wf = repo_dir / "safe.yml"
        safe_wf.write_text("name: Safe\non: push\njobs: {}\n", encoding="utf-8")

        outside_dir = tmp_path / "outside"
        outside_dir.mkdir()
        evil_wf = outside_dir / "evil.yml"
        evil_wf.write_text("name: Evil\non: push\njobs: {}\n", encoding="utf-8")

        fake_symlink = repo_dir / "escaped.yml"
        fake_symlink.write_text("name: Escaped\non: push\njobs: {}\n", encoding="utf-8")

        # Mock is_symlink and resolve to test safe escaping logic regardless of OS symlink privileges
        with patch.object(Path, "is_symlink", autospec=True) as mock_is_symlink:
            def side_effect_is_symlink(self: Path) -> bool:
                return self.name == "escaped.yml"

            mock_is_symlink.side_effect = side_effect_is_symlink
            with patch.object(Path, "resolve", autospec=True) as mock_resolve:
                def side_effect_resolve(self: Path) -> Path:
                    if self.name == "escaped.yml":
                        return evil_wf
                    return self

                mock_resolve.side_effect = side_effect_resolve
                res = analyze_paths(repo_dir, scan_root=repo_dir)

                scanned_files = [f.file for f in res.findings]
                assert str(evil_wf) not in scanned_files
                assert res.workflows_analyzed == 1  # Only safe.yml

    def test_max_file_count_enforced(self, tmp_path: Path) -> None:
        """Enforcing max_file_count caps scanned files and emits PG-WF-900."""
        for i in range(5):
            f = tmp_path / f"wf_{i}.yml"
            f.write_text("name: Test\non: push\njobs: {}\n", encoding="utf-8")

        config = Config(max_file_count=2)
        res = analyze_paths(tmp_path, config=config)

        rule_ids = [f.rule_id for f in res.findings]
        assert "PG-WF-900" in rule_ids
        assert res.workflows_analyzed == 2


class TestDeterminism:
    def test_determinism_run_twice_identical(self) -> None:
        """Scanning the same workflow multiple times yields strictly identical results."""
        labs_vulnerable = Path("security/workflow/labs/vulnerable")
        assert labs_vulnerable.is_dir()

        res1 = analyze_paths(labs_vulnerable)
        res2 = analyze_paths(labs_vulnerable)

        assert res1 == res2
        assert len(res1.findings) == len(res2.findings)
        assert [f.fingerprint() for f in res1.findings] == [f.fingerprint() for f in res2.findings]
        assert [f.sort_key() for f in res1.findings] == [f.sort_key() for f in res2.findings]


class TestAnalyzerEdgeCases:
    def test_analysis_result_coercion(self) -> None:
        finding = Finding(
            rule_id="PG-WF-001",
            file="a.yml",
            line=1,
            column=None,
            job_id=None,
            step_name=None,
            snippet="",
            message="m",
            confidence="HIGH",
        )
        suppressed = SuppressedFinding(finding=finding, reason="r")
        res = AnalysisResult(findings=[finding], suppressed=[suppressed])
        assert isinstance(res.findings, tuple)
        assert isinstance(res.suppressed, tuple)

    def test_empty_parse_result_workflow(self) -> None:
        empty = ParseResult(workflow=None, error=None)
        res = analyze_workflow(empty)
        assert len(res.findings) == 1
        assert res.findings[0].rule_id == "PG-WF-900"

    def test_check_suppression_empty_lines(self) -> None:
        matched, reason = check_suppression([], 1, "PG-WF-001")
        assert matched is False
        assert reason is None

    def test_disabled_rules_filtering(self) -> None:
        wf = """
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: curl http://archive.ubuntu.com/mirror
"""
        parsed = parse_workflow_text(wf, path="test.yml")
        cfg = Config(disabled_rules=frozenset({"PG-WF-014"}))
        res = analyze_workflow(parsed, config=cfg)
        assert not any(f.rule_id == "PG-WF-014" for f in res.findings)

    def test_domain_allowlist_filtering(self) -> None:
        wf = """
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: curl http://archive.ubuntu.com/mirror
"""
        parsed = parse_workflow_text(wf, path="test.yml")
        cfg = Config(domain_allowlist=("archive.ubuntu.com",))
        res = analyze_workflow(parsed, config=cfg)
        assert not any(f.rule_id == "PG-WF-014" for f in res.findings)

    def test_raw_text_disk_fallback(self, tmp_path: Path) -> None:
        wf_file = tmp_path / "test.yml"
        wf_file.write_text(
            """name: Test\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - # pipelineguard-ignore: PG-WF-014 legacy mirror\n        run: curl http://archive.ubuntu.com/mirror\n""",
            encoding="utf-8",
        )
        parsed = parse_workflow_text(wf_file.read_text(encoding="utf-8"), path=str(wf_file))
        # Clear raw_text to force reading from disk
        parsed_no_raw = ParseResult(workflow=parsed.workflow, error=None, raw_text=None, path=str(wf_file))
        res = analyze_workflow(parsed_no_raw)
        assert len(res.suppressed) == 1
        assert res.suppressed[0].reason == "legacy mirror"

    def test_github_workflows_subdir_scan(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my_repo"
        wf_dir = repo_dir / ".github" / "workflows"
        wf_dir.mkdir(parents=True)
        wf_file = wf_dir / "ci.yml"
        wf_file.write_text("name: CI\non: push\njobs: {}\n", encoding="utf-8")

        res = analyze_paths(repo_dir)
        assert res.workflows_analyzed == 1

    def test_path_excludes(self, tmp_path: Path) -> None:
        wf1 = tmp_path / "ci.yml"
        wf1.write_text("name: CI\non: push\njobs: {}\n", encoding="utf-8")
        wf2 = tmp_path / "ci_template.yml"
        wf2.write_text("name: Template\non: push\njobs: {}\n", encoding="utf-8")

        cfg = Config(path_excludes=("*template*",))
        res = analyze_paths(tmp_path, config=cfg)
        assert res.workflows_analyzed == 1

    def test_nonexistent_path(self, tmp_path: Path) -> None:
        nonexistent = tmp_path / "does_not_exist.yml"
        res = analyze_paths(nonexistent)
        assert res.workflows_analyzed == 0

    def test_config_methods(self) -> None:
        from security.workflow.rules import Action, Severity

        cfg = Config(
            enabled_rules=frozenset({"PG-WF-001"}),
            severity_overrides={"PG-WF-001": Severity.LOW},
            action_overrides={"PG-WF-001": Action.WARN},
        )
        assert cfg.is_rule_enabled("PG-WF-001") is True
        assert cfg.is_rule_enabled("PG-WF-002") is False
        assert cfg.get_severity("PG-WF-001") == Severity.LOW
        assert cfg.get_severity("PG-WF-002") == Severity.CRITICAL
        assert cfg.get_action("PG-WF-001") == Action.WARN
        assert cfg.get_action("PG-WF-002") == Action.BLOCK

