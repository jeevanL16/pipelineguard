"""
PipelineGuard - Secret Scanner (Week 3)

Runs Gitleaks against a target directory, turns any findings into
PipelineGuard security events, and reports a simple PASS/BLOCK
result.

The actual secret value reported by Gitleaks is never read or
printed by this script.
"""

import subprocess
import json
import os
import sys

from severity import get_severity
from events import build_events


class ScannerError(Exception):
    """Raised when Gitleaks itself could not be run successfully.
    This is different from Gitleaks running fine and finding secrets."""
    pass


def run_gitleaks(target="."):
    """
    Run Gitleaks against `target` and return the list of findings
    (an empty list if no secrets were found).

    Raises ScannerError if Gitleaks could not be run at all (for
    example, the binary is missing, or Gitleaks reports a real
    execution error rather than "leaks found").
    """
    report_file = "gitleaks-report.json"

    command = [
        "gitleaks",
        "dir",
        target,
        "--report-format",
        "json",
        "--report-path",
        report_file,
        # We force exit-code 0 so that "leaks found" never looks
        # like a crashed process. We still check result.returncode
        # below: if Gitleaks hits a real error (bad path, bad
        # config, etc.) it can still return non-zero even with
        # --exit-code 0, and we want to catch that separately from
        # "no secrets" or "secrets found".
        "--exit-code",
        "0",
        "--no-banner",
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        # Gitleaks is not installed / not on PATH.
        raise ScannerError(
            "Could not run Gitleaks. Is it installed and on PATH?"
        ) from error

    if result.returncode != 0:
        # With --exit-code 0, a non-zero return here means Gitleaks
        # itself failed to run properly, not that it found secrets.
        raise ScannerError(
            "Gitleaks reported an error while scanning.\n"
            f"stderr: {result.stderr.strip()}"
        )

    if not os.path.exists(report_file):
        # No report file and a clean exit code means no findings.
        return []

    try:
        with open(report_file, "r") as file:
            findings = json.load(file)
    except json.JSONDecodeError as error:
        # Do not silently swallow this: a report file that exists
        # but cannot be parsed is a real problem, not "no secrets".
        os.remove(report_file)
        raise ScannerError(
            "Gitleaks report file was not valid JSON."
        ) from error

    os.remove(report_file)

    # Gitleaks writes `null` (parsed as None) to the report file
    # when there are no findings, rather than an empty list.
    return findings or []


def print_finding(finding: dict) -> None:
    """Print one finding's safe (non-secret) details to the terminal."""
    rule_id = finding.get("RuleID")
    severity = get_severity(rule_id)

    print("\n--- Secret Finding ---")
    print("Rule:", rule_id)
    print("File:", finding.get("File"))
    print("Line:", finding.get("StartLine"))
    print("Severity:", severity)
    print("Action: BLOCK")


def scan(target=".") -> tuple:
    """
    Run a full scan and return (findings, events).
    Kept separate from main() so tests can call it directly.
    """
    findings = run_gitleaks(target)
    events = build_events(findings)
    return findings, events


def main():
    print("[*] PipelineGuard Secret Scanner")
    print("[*] Running Gitleaks...")

    try:
        findings, events = scan(".")
    except ScannerError as error:
        print(f"[x] Scanner error: {error}")
        # Exit code 2: the scan itself did not complete. This is
        # different from "clean" (0) or "secrets found" (1), so a
        # CI pipeline can tell the difference later.
        sys.exit(2)

    if not findings:
        print("[+] No secrets detected.")
        print("[+] Result: PASS")
        sys.exit(0)

    print(f"[!] Secrets detected: {len(findings)}")

    for finding in findings:
        print_finding(finding)

    print(f"\n[!] {len(events)} PipelineGuard security event(s) created.")
    print("[!] Result: BLOCK")
    # Exit code 1: secrets were found. A CI step can check this
    # exit code to fail the pipeline.
    sys.exit(1)


if __name__ == "__main__":
    main()
