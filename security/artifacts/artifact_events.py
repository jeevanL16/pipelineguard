"""
PipelineGuard - Artifact Tampering Event Builder (Week 5)

Builds a PipelineGuard security event, using the same shared event
schema as security/secrets/events.py (event_id, event_type, source,
severity, repository, branch, file, line, rule, description, action,
status, metadata), when an artifact's SHA-256 hash does not match its
trusted expected hash.

The event contains only the artifact's file name/path and the two
hashes. It never contains the artifact's contents.

Why get_current_branch() is repeated here instead of imported from
security/secrets/events.py: the Week 4 modules use flat imports
(`from severity import ...`) that resolve only when security/secrets/
itself is on sys.path. Importing across the two modules would make
them depend on each other's import setup and risk name collisions
(both modules would want to be called `events`). The helper is only a
few lines, so it is duplicated on purpose. The event *shape* is the
shared contract and is kept identical.
"""

import os
import subprocess
import uuid

# Fixed values for a detected tampering event (Week 5 spec).
MODULE_NAME = "artifact-security"
EVENT_TYPE = "artifact_tampering"
SOURCE = "artifact-security"
SEVERITY = "CRITICAL"
RULE = "sha256-mismatch"
ACTION = "BLOCK"
STATUS = "OPEN"


def get_current_branch() -> str:
    """Best-effort current git branch; "unknown" on any failure.
    Must never raise or block a verification."""
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

    return result.stdout.strip() or "unknown"


def build_tamper_event(
    artifact_path,
    expected_hash: str,
    actual_hash: str,
    repository: str = "pipelineguard",
    branch: str = None,
) -> dict:
    """
    Build the `artifact_tampering` security event for a hash mismatch.

    artifact_path: path of the artifact that failed verification.
    expected_hash / actual_hash: the two SHA-256 hex digests. Hashes
        are safe to record; they reveal nothing about file contents.
    branch: git branch name; auto-detected when not supplied.
    """
    if branch is None:
        branch = get_current_branch()

    path = os.fspath(artifact_path)
    artifact_name = os.path.basename(path)

    return {
        "event_id": str(uuid.uuid4()),
        "event_type": EVENT_TYPE,
        "source": SOURCE,
        "severity": SEVERITY,
        "repository": repository,
        "branch": branch,
        "file": path,
        "line": None,
        "rule": RULE,
        "description": (
            "Possible artifact tampering detected: SHA-256 hash of "
            f"'{artifact_name}' does not match the trusted expected hash "
            f"(rule: {RULE}, severity: {SEVERITY})"
        ),
        "action": ACTION,
        "status": STATUS,
        "metadata": {
            "module": MODULE_NAME,
            "artifact_name": artifact_name,
            "algorithm": "SHA-256",
            "expected_sha256": expected_hash,
            "actual_sha256": actual_hash,
            "verification_result": "MISMATCH",
        },
    }
