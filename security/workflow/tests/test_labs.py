"""Integration test running all detectors against vulnerable and secure labs fixtures."""

from __future__ import annotations

import json
from pathlib import Path

from security.workflow.detectors import ALL_DETECTORS
from security.workflow.finding import Finding
from security.workflow.parser import parse_workflow
from security.workflow.rules import REGISTRY, lookup

LABS_DIR = Path("security/workflow/labs")
VULN_DIR = LABS_DIR / "vulnerable"
SECURE_DIR = LABS_DIR / "secure"
BENIGN_DIR = LABS_DIR / "benign"
EVASION_DIR = LABS_DIR / "evasion"
EXPECTED_FILE = VULN_DIR / "expected.json"
EVASION_EXPECTED_FILE = EVASION_DIR / "expected.json"


def _run_all_detectors(file_path: Path) -> list[Finding]:
    """Parse workflow and run every registered detector, returning sorted findings."""
    parsed = parse_workflow(file_path)
    assert parsed.ok, f"Failed to parse lab fixture {file_path}: {parsed.error}"
    findings: list[Finding] = []
    for detector in ALL_DETECTORS:
        findings.extend(detector(parsed))
    findings.sort(key=lambda f: f.sort_key())
    return findings


def test_vulnerable_fixtures_match_expected_rules() -> None:
    """Each vulnerable fixture must trigger exactly its expected set of rule IDs."""
    assert EXPECTED_FILE.is_file(), f"Expected mapping missing at {EXPECTED_FILE}"
    expected_data = json.loads(EXPECTED_FILE.read_text(encoding="utf-8"))

    exercised_rules: set[str] = set()

    for file_name, spec in expected_data.items():
        fixture_path = VULN_DIR / file_name
        assert fixture_path.is_file(), f"Referenced fixture {file_name} does not exist"

        findings = _run_all_detectors(fixture_path)
        actual_rule_ids = sorted({f.rule_id for f in findings})
        expected_rule_ids = sorted(set(spec["rules"]))

        assert actual_rule_ids == expected_rule_ids, (
            f"Rule mismatch in {file_name}:\n"
            f"  Expected: {expected_rule_ids}\n"
            f"  Actual:   {actual_rule_ids}"
        )

        for f in findings:
            rule = lookup(f.rule_id)
            assert rule.id == f.rule_id
            assert f.fingerprint() == f.fingerprint()
            assert "[REDACTED]" in f.snippet or "ghp_" not in f.snippet

        exercised_rules.update(actual_rule_ids)

    # Every rule registered in REGISTRY (excluding reserved system rules PG-WF-9*) must be tested by at least one vulnerable fixture
    all_registered_rules = {r for r in REGISTRY if not r.startswith("PG-WF-9")}
    missing_coverage = all_registered_rules - exercised_rules
    assert not missing_coverage, (
        f"The following registered rules have no vulnerable lab fixture coverage: {sorted(missing_coverage)}"
    )


def test_secure_fixtures_produce_zero_findings() -> None:
    """Hardened workflows in labs/secure/ must produce zero security findings."""
    secure_files = list(SECURE_DIR.glob("*.yml")) + list(SECURE_DIR.glob("*.yaml"))
    assert len(secure_files) >= 2, "Must test at least 2 secure workflow fixtures"

    for secure_file in secure_files:
        findings = _run_all_detectors(secure_file)
        assert findings == [], (
            f"Secure fixture {secure_file.name} produced unexpected findings: "
            f"{[f.rule_id for f in findings]}"
        )


def test_benign_fixtures_produce_zero_findings() -> None:
    """Legitimate workflows in labs/benign/ must produce zero security findings."""
    benign_files = sorted(list(BENIGN_DIR.glob("*.yml")) + list(BENIGN_DIR.glob("*.yaml")))
    assert len(benign_files) >= 15, f"Must have at least 15 benign fixtures, found {len(benign_files)}"

    for benign_file in benign_files:
        findings = _run_all_detectors(benign_file)
        assert findings == [], (
            f"Benign fixture {benign_file.name} produced unexpected false-positive findings: "
            f"{[f.rule_id for f in findings]}"
        )


def test_evasion_fixtures_match_expected_rules() -> None:
    """Evasion workflows in labs/evasion/ must trigger exact expected rule sets."""
    assert EVASION_EXPECTED_FILE.is_file(), f"Expected mapping missing at {EVASION_EXPECTED_FILE}"
    expected_data = json.loads(EVASION_EXPECTED_FILE.read_text(encoding="utf-8"))
    assert len(expected_data) >= 10, f"Must have at least 10 evasion fixtures, found {len(expected_data)}"

    for file_name, spec in expected_data.items():
        fixture_path = EVASION_DIR / file_name
        assert fixture_path.is_file(), f"Referenced evasion fixture {file_name} does not exist"

        findings = _run_all_detectors(fixture_path)
        actual_rule_ids = sorted({f.rule_id for f in findings})
        expected_rule_ids = sorted(set(spec["rules"]))

        assert actual_rule_ids == expected_rule_ids, (
            f"Rule mismatch in evasion fixture {file_name}:\n"
            f"  Expected: {expected_rule_ids}\n"
            f"  Actual:   {actual_rule_ids}"
        )

