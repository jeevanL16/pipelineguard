"""
Integration tests for scanner.py.

These tests run the *real* Gitleaks binary against the dummy sample
files in security/secrets/test/samples/. They require Gitleaks to be
installed and on PATH. If Gitleaks is not available, these tests are
skipped rather than failed, since scanner.py itself needs the real
binary to function - this is by design, not something to mock away.
"""

import shutil
import subprocess
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import scanner  # noqa: E402

SAMPLES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "test", "samples"
)

GITLEAKS_AVAILABLE = shutil.which("gitleaks") is not None

pytestmark = pytest.mark.skipif(
    not GITLEAKS_AVAILABLE, reason="gitleaks is not installed on PATH"
)


def copy_sample(sample_filename, tmp_path):
    source = os.path.join(SAMPLES_DIR, sample_filename)
    destination = tmp_path / sample_filename
    shutil.copyfile(source, destination)
    return tmp_path


def test_clean_source_has_no_findings(tmp_path):
    target = copy_sample("clean_code.py", tmp_path)

    findings, events = scanner.scan(str(target))

    assert findings == []
    assert events == []


def test_dummy_secret_is_detected(tmp_path):
    target = copy_sample("github_token.txt", tmp_path)

    findings, events = scanner.scan(str(target))

    assert len(findings) == 1
    assert findings[0]["RuleID"] == "github-pat"


def test_finding_is_masked_in_output(tmp_path, capsys):
    target = copy_sample("private_key.txt", tmp_path)

    findings, _ = scanner.scan(str(target))
    scanner.print_finding(findings[0])

    captured = capsys.readouterr()
    # The scanner's printed output must never contain the raw
    # secret text from the sample file.
    with open(os.path.join(SAMPLES_DIR, "private_key.txt")) as file:
        secret_line = file.readlines()[1].strip()
    assert secret_line not in captured.out


def test_finding_produces_correct_pipelineguard_event(tmp_path):
    target = copy_sample("private_key.txt", tmp_path)

    findings, events = scanner.scan(str(target))

    assert len(events) == 1
    event = events[0]
    assert event["event_type"] == "secret_exposure"
    assert event["severity"] == "CRITICAL"
    assert event["action"] == "BLOCK"
    assert event["status"] == "OPEN"


def test_multiple_findings_are_all_processed(tmp_path):
    """
    Scans several dummy-secret sample files at once and checks that
    every finding Gitleaks reports is processed into an event.

    This does NOT assume exactly one finding per file: depending on
    the installed Gitleaks version/ruleset, a single sample can
    legitimately match more than one rule (for example, a value that
    matches both "aws-access-token" and the generic high-entropy
    "generic-api-key" rule on the same line). The test instead checks
    the behavior PipelineGuard actually depends on:
      - every sample file produced at least one finding
      - findings and events are 1:1 and never dropped
      - more than one finding is supported (not just a single one)
      - a finding from the same file more than once is accepted
      - both a CRITICAL and a HIGH severity are represented
    """
    sample_filenames = (
        "aws_credentials.txt",
        "github_token.txt",
        "generic_api_key.txt",
        "private_key.txt",
    )
    for filename in sample_filenames:
        copy_sample(filename, tmp_path)

    findings, events = scanner.scan(str(tmp_path))

    # Every finding must become exactly one event - none dropped,
    # none invented.
    assert len(events) == len(findings)

    # We must support more than one finding per scan.
    assert len(findings) > 1

    # Every sample file we planted must be represented by at least
    # one finding - none silently skipped by the scanner.
    files_with_findings = {finding.get("File") for finding in findings}
    for filename in sample_filenames:
        assert any(
            filename in file_path for file_path in files_with_findings
        ), f"expected at least one finding for {filename}"

    # It is fine, and expected to be supported, if one file produces
    # more than one finding (e.g. aws_credentials.txt matching both
    # aws-access-token and generic-api-key).
    file_counts = {}
    for finding in findings:
        file_counts[finding.get("File")] = file_counts.get(finding.get("File"), 0) + 1
    assert max(file_counts.values()) >= 1

    severities = {event["severity"] for event in events}
    assert "CRITICAL" in severities
    assert "HIGH" in severities


def test_secret_finding_blocks_with_exit_code_1(tmp_path):
    copy_sample("github_token.txt", tmp_path)

    result = subprocess.run(
        [sys.executable, os.path.join(os.path.dirname(__file__), "..", "scanner.py")],
        cwd=str(tmp_path),
        env={**os.environ, "PYTHONPATH": os.path.join(os.path.dirname(__file__), "..")},
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "BLOCK" in result.stdout


def test_clean_scan_passes_with_exit_code_0(tmp_path):
    copy_sample("clean_code.py", tmp_path)

    result = subprocess.run(
        [sys.executable, os.path.join(os.path.dirname(__file__), "..", "scanner.py")],
        cwd=str(tmp_path),
        env={**os.environ, "PYTHONPATH": os.path.join(os.path.dirname(__file__), "..")},
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert "PASS" in result.stdout
