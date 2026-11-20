"""
PipelineGuard - Security Event Builder

Converts a raw Gitleaks finding into a PipelineGuard security event:
a small, stable JSON-serializable dictionary. This is the shape that
will later be sent to the PipelineGuard backend/database, so it is
kept independent of Gitleaks' own field names.

Week 4: updated to the team's agreed common event schema (adds
event_id, branch, description and a metadata block). The actual
secret value is never included in the event - this was true before
and remains true with the new fields.
"""

import subprocess
import uuid

from severity import get_severity, get_action

# Which module/detector produced this event. Constant for now; kept
# as named values (not inline strings) so the artifact-security
# module can reuse the same event shape later with its own values.
MODULE_NAME = "secrets-security"
DETECTOR_NAME = "gitleaks"


def get_current_branch() -> str:
    """
    Best-effort lookup of the current git branch name, for including
    in security events. Falls back to "unknown" if this is not a
    git repository, git is not installed, or the command fails for
    any other reason - this must never raise or block a scan.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except Exception:
        return "unknown"

    if result.returncode != 0:
        return "unknown"

    branch = result.stdout.strip()
    return branch or "unknown"


def _build_description(rule_id: str, severity: str) -> str:
    """Short, human-readable description for the event."""
    if rule_id:
        return f"Potential secret detected in source code (rule: {rule_id}, severity: {severity})"
    return f"Potential secret detected in source code (severity: {severity})"


def build_event(finding: dict, repository: str = "pipelineguard", branch: str = None) -> dict:
    """
    Build a PipelineGuard security event dictionary from one
    Gitleaks finding.

    finding: a single item from Gitleaks' JSON report, e.g.
        {
            "RuleID": "generic-api-key",
            "File": "security/secrets/test/samples/generic_api_key.txt",
            "StartLine": 1,
            "Secret": "sk_test_..."   <- intentionally never read here
        }

    branch: current git branch name. If not supplied, it is detected
    automatically via get_current_branch().
    """
    rule_id = finding.get("RuleID")
    severity = get_severity(rule_id)
    action = get_action(severity)

    if branch is None:
        branch = get_current_branch()

    return {
        "event_id": str(uuid.uuid4()),
        "event_type": "secret_exposure",
        "source": DETECTOR_NAME,
        "severity": severity,
        "repository": repository,
        "branch": branch,
        "file": finding.get("File"),
        "line": finding.get("StartLine"),
        "rule": rule_id,
        "description": _build_description(rule_id, severity),
        "action": action,
        "status": "OPEN",
        "metadata": {
            "module": MODULE_NAME,
            "detector": DETECTOR_NAME,
        },
    }


def build_events(findings: list, repository: str = "pipelineguard", branch: str = None) -> list:
    """
    Build a PipelineGuard security event for every finding in a
    Gitleaks report. Returns an empty list if there are no findings.

    The current git branch is detected once and reused for every
    event in the batch, rather than once per finding, so a single
    scan's events are not subject to the branch changing mid-run.
    """
    if branch is None:
        branch = get_current_branch()
    return [build_event(finding, repository, branch) for finding in findings]
