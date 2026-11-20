"""Adapt secrets and artifact security findings to PipelineGuard backend events.

Dry-run is the default. Use --submit to send events to the backend.
Secret values and artifact contents are never included in submitted events.
"""

from __future__ import annotations

import argparse
import importlib
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from security.integration.workflow_to_backend import submit_event

RISK_SCORES = {
    "CRITICAL": 95,
    "HIGH": 80,
    "MEDIUM": 60,
    "LOW": 30,
    "INFO": 10,
}


def safe_location(file_path, line=None):
    """Return a repository-relative location without source contents."""
    if not file_path:
        location = "unknown"
    else:
        path = Path(str(file_path))
        try:
            location = path.resolve().relative_to(REPO_ROOT).as_posix()
        except (OSError, ValueError):
            location = path.name or "unknown"

    if line is not None:
        location = f"{location}:{line}"

    return location


def secrets_to_backend_event(event, pipeline_id):
    """Map a Member 2 secret event to the backend schema."""
    severity = str(event.get("severity", "MEDIUM")).upper()
    rule = str(event.get("rule") or "unknown-rule")
    location = safe_location(event.get("file"), event.get("line"))

    description = (
        f"Potential secret detected. Rule: {rule}. "
        f"Location: {location}. "
        "Review the affected file and rotate any exposed credentials."
    )

    return {
        "event_id": str(event["event_id"]),
        "pipeline_id": pipeline_id,
        "source": "secrets-security",
        "event_type": "secret_exposure",
        "severity": severity,
        "risk_score": RISK_SCORES.get(severity, 60),
        "status": "OPEN",
        "description": description[:4000],
    }


def artifact_to_backend_event(event, pipeline_id):
    """Map a Member 2 artifact-tampering event to the backend schema."""
    severity = str(event.get("severity", "CRITICAL")).upper()
    rule = str(event.get("rule") or "sha256-mismatch")
    location = safe_location(event.get("file"), event.get("line"))

    description = (
        f"Possible artifact tampering detected. Rule: {rule}. "
        f"Location: {location}. "
        "Verify the artifact against a trusted SHA-256 reference."
    )

    return {
        "event_id": str(event["event_id"]),
        "pipeline_id": pipeline_id,
        "source": "artifact-security",
        "event_type": "artifact_tampering",
        "severity": severity,
        "risk_score": RISK_SCORES.get(severity, 95),
        "status": "OPEN",
        "description": description[:4000],
    }


def load_secret_events(target):
    """Run the existing secrets scanner and return safe events."""
    secrets_dir = str(REPO_ROOT / "security" / "secrets")
    if secrets_dir not in sys.path:
        sys.path.insert(0, secrets_dir)

    scanner_module = importlib.import_module("scanner")
    scan = scanner_module.scan

    previous_dir = os.getcwd()
    try:
        os.chdir(REPO_ROOT)
        target_path = Path(target)
        if not target_path.is_absolute():
            target_path = REPO_ROOT / target_path
        _, events = scan(str(target_path.resolve()))
    finally:
        os.chdir(previous_dir)

    return events


def load_artifact_event(artifact, expected_hash=None, hashes_file=None):
    """Verify an artifact and return its event only on a hash mismatch."""
    artifacts_dir = str(REPO_ROOT / "security" / "artifacts")
    if artifacts_dir not in sys.path:
        sys.path.insert(0, artifacts_dir)

    verifier_module = importlib.import_module("artifact_verifier")
    verify_artifact = verifier_module.verify_artifact
    verify_artifact_from_hashes_file = (
        verifier_module.verify_artifact_from_hashes_file
    )

    if hashes_file:
        result = verify_artifact_from_hashes_file(
            artifact, hashes_file, repository="pipelineguard"
        )
    else:
        result = verify_artifact(
            artifact, expected_hash, repository="pipelineguard"
        )

    if result.event:
        return result.event

    if result.outcome == "ERROR":
        raise RuntimeError(f"Artifact verification error: {result.error}")

    if result.outcome == "MATCH":
        print(f"Artifact verified: {result.artifact}")

    return None


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Adapt secrets/artifact findings to PipelineGuard backend events."
        )
    )
    subparsers = parser.add_subparsers(dest="module", required=True)

    secrets_parser = subparsers.add_parser(
        "secrets", help="Scan a directory for potential exposed secrets"
    )
    secrets_parser.add_argument("target", help="Directory to scan")
    secrets_parser.add_argument("--pipeline-id", default="PIPE-001")
    secrets_parser.add_argument(
        "--api-url", default="http://127.0.0.1:8000"
    )
    secrets_parser.add_argument("--submit", action="store_true")

    artifact_parser = subparsers.add_parser(
        "artifact", help="Verify an artifact against a trusted SHA-256 hash"
    )
    artifact_parser.add_argument("artifact", help="Artifact file to verify")
    expected_group = artifact_parser.add_mutually_exclusive_group(required=True)
    expected_group.add_argument("--expected", help="Trusted expected SHA-256 hash")
    expected_group.add_argument(
        "--hashes-file", help="Separate trusted sha256sum-format file"
    )
    artifact_parser.add_argument("--pipeline-id", default="PIPE-001")
    artifact_parser.add_argument(
        "--api-url", default="http://127.0.0.1:8000"
    )
    artifact_parser.add_argument("--submit", action="store_true")

    args = parser.parse_args()

    try:
        if args.module == "secrets":
            events = [
                secrets_to_backend_event(event, args.pipeline_id)
                for event in load_secret_events(args.target)
            ]
        else:
            event = load_artifact_event(
                args.artifact,
                expected_hash=args.expected,
                hashes_file=args.hashes_file,
            )
            events = (
                [artifact_to_backend_event(event, args.pipeline_id)]
                if event
                else []
            )
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    print(f"Module: {args.module}")
    print(f"Events prepared: {len(events)}")
    print(f"Mode: {'LIVE SUBMISSION' if args.submit else 'DRY RUN'}")

    for event in events:
        print(
            f"{event['severity']:8} risk={event['risk_score']:2} "
            f"{event['event_type']} | {event['description']}"
        )

    if not args.submit:
        print(f"\nDry run complete. {len(events)} event(s) NOT submitted.")
        return 0

    created = duplicate = failed = 0

    for event in events:
        status, detail = submit_event(event, args.api_url)
        if status == "created":
            created += 1
            print(f"CREATED {event['event_id']}")
        elif status == "duplicate":
            duplicate += 1
            print(f"DUPLICATE {event['event_id']}")
        else:
            failed += 1
            print(f"FAILED {event['event_id']}: {detail}")

    print(
        f"\nSubmission summary: created={created}, "
        f"duplicates={duplicate}, failed={failed}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
