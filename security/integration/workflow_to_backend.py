"""Safely adapt workflow scanner findings to PipelineGuard backend events."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

from dotenv import load_dotenv

load_dotenv(dotenv_path=REPO_ROOT / "backend" / ".env")
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from security.workflow.analyzer import analyze_paths
from security.workflow.rules import lookup


RISK_SCORES = {
    "CRITICAL": 95,
    "HIGH": 80,
    "MEDIUM": 60,
    "LOW": 30,
    "INFO": 10,
}


def finding_to_event(finding, pipeline_id: str) -> dict:
    """Convert one scanner finding without forwarding source snippets."""
    rule = lookup(finding.rule_id)
    severity = rule.severity.value
    fingerprint = finding.fingerprint()

    finding_path = Path(finding.file)
    try:
        location = finding_path.resolve().relative_to(REPO_ROOT).as_posix()
    except (OSError, ValueError):
        location = finding_path.name

    if finding.line is not None:
        location = f"{location}:{finding.line}"

    # Do not forward raw finding messages or source snippets: they may
    # contain untrusted expressions or sensitive workflow content.
    description = (
        f"[{finding.rule_id}] {rule.title}. "
        f"Location: {location}. "
        f"Recommended action: {rule.remediation}"
    )

    return {
        "event_id": f"WF-{fingerprint}",
        "pipeline_id": pipeline_id,
        "source": "workflow-security",
        "event_type": "workflow_finding",
        "severity": severity,
        "risk_score": RISK_SCORES.get(severity, 10),
        "status": "OPEN",
        "description": description[:4000],
    }


def submit_event(event: dict, api_url: str) -> tuple[str, str]:
    """Submit one event using the dedicated scanner bearer token."""
    token = os.environ.get("PIPELINEGUARD_SCANNER_API_TOKEN", "")
    if len(token) < 32:
        return "failed", "Scanner API token is missing or invalid; configure it in the environment"

    body = json.dumps(event).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/api/events",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return "created", "Event submitted successfully"
    except urllib.error.HTTPError as exc:
        if exc.code == 409:
            return "duplicate", "Event already exists"
        return "failed", f"Backend returned HTTP {exc.code}"
    except (urllib.error.URLError, TimeoutError, OSError):
        return "failed", "Could not reach the backend; check its URL and availability"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scan workflow files and preview or submit PipelineGuard events."
    )
    parser.add_argument(
        "paths",
        nargs="+",
        help="Workflow file(s) or directory/directories to scan",
    )
    parser.add_argument(
        "--pipeline-id",
        default="PIPE-001",
        help="Existing PipelineGuard pipeline ID (default: PIPE-001)",
    )
    parser.add_argument(
        "--api-url",
        default="http://127.0.0.1:8000",
        help="PipelineGuard backend base URL",
    )
    parser.add_argument(
        "--submit",
        action="store_true",
        help="Actually submit events; omitted by default for dry-run safety",
    )
    args = parser.parse_args()

    paths = [Path(p).resolve() for p in args.paths]
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        print("ERROR: These scan paths do not exist:")
        for path in missing:
            print(f"  - {path}")
        return 2

    result = analyze_paths(paths, scan_root=REPO_ROOT)

    print(f"Workflows analyzed: {result.workflows_analyzed}")
    print(f"Active findings: {len(result.findings)}")
    print(f"Suppressed findings (not submitted): {len(result.suppressed)}")
    print(f"Mode: {'LIVE SUBMISSION' if args.submit else 'DRY RUN'}")
    print()

    events = []
    for finding in result.findings:
        try:
            event = finding_to_event(finding, args.pipeline_id)
        except KeyError:
            print(f"SKIPPED unknown rule: {finding.rule_id}")
            continue
        events.append(event)
        print(
            f"{event['severity']:8} risk={event['risk_score']:2} "
            f"{finding.rule_id} "
            f"{event['description'].split('Location: ', 1)[1].split('. Recommended action:', 1)[0]}"
        )
        print(f"  {event['description']}")

    if not args.submit:
        print(f"\nDry run complete. {len(events)} event(s) were NOT submitted.")
        return 0

    if not events:
        print("\nNo events to submit.")
        return 0

    created = duplicate = failed = 0
    for event in events:
        status, detail = submit_event(event, args.api_url)
        if status == "created":
            created += 1
            print(f"CREATED {event['event_id']}")
        elif status == "duplicate":
            duplicate += 1
            print(f"DUPLICATE {event['event_id']} (already present)")
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
