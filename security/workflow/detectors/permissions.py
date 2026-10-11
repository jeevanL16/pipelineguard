"""Permissions detector for GitHub Actions workflows.

Detects missing, overly broad, or dangerous permission configurations.

Rules fired:

* **PG-WF-004** — no top-level ``permissions:`` block
* **PG-WF-005** — ``write-all`` or top-level write scope
* **PG-WF-006** — pwn-request: ``pull_request_target`` trigger + head-ref checkout
* **PG-WF-007** — ``secrets: inherit`` on a called workflow job
"""

from __future__ import annotations

import re
from typing import Any, Final

from security.workflow.detectors._base import make_finding, trigger_set
from security.workflow.finding import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, Finding
from security.workflow.models import Job, ParseResult, Step

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Write scopes that indicate excessive permissions.
_WRITE_SCOPES: Final[frozenset[str]] = frozenset(
    {
        "actions",
        "checks",
        "contents",
        "deployments",
        "discussions",
        "id-token",
        "issues",
        "packages",
        "pages",
        "pull-requests",
        "repository-projects",
        "security-events",
        "statuses",
    }
)

# Matches head-ref checkout patterns inside 'with:' inputs.
# E.g. ref: ${{ github.event.pull_request.head.ref }}
#      ref: ${{ github.head_ref }}
_HEAD_REF_EXPR_RE: Final[re.Pattern[str]] = re.compile(
    r"github\.(?:head_ref|event\.pull_request\.head\.(?:ref|sha))",
    re.IGNORECASE,
)

# 'uses: actions/checkout' at any version.
_CHECKOUT_USES_RE: Final[re.Pattern[str]] = re.compile(
    r"^actions/checkout(?:@[^\s]{1,80})?$",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _has_write_scope(permissions: Any) -> tuple[bool, str]:
    """Return (True, reason) if *permissions* grants broad write access.

    Args:
        permissions: The raw permissions value from the parsed workflow/job.

    Returns:
        Tuple of (is_overly_broad, reason_string).
    """
    if permissions is None:
        return False, ""
    if isinstance(permissions, str):
        if permissions.lower() in ("write-all", "write_all"):
            return True, f"permissions: {permissions}"
        return False, ""
    if isinstance(permissions, dict):
        for scope, level in permissions.items():
            if isinstance(level, str) and level.lower() == "write":
                scope_str = str(scope)
                if scope_str in _WRITE_SCOPES:
                    return True, f"{scope_str}: write"
    return False, ""


def _step_checks_out_head_ref(step: Step) -> bool:
    """Return True if the step is a checkout that fetches the PR head ref.

    Args:
        step: A parsed workflow step.

    Returns:
        ``True`` if the step performs a potentially dangerous PR-head checkout.
    """
    if step.uses is None or not _CHECKOUT_USES_RE.match(step.uses):
        return False
    # Check with_inputs for a ref that uses head_ref / pull_request.head.ref
    ref_val = step.with_inputs.get("ref", "")
    if isinstance(ref_val, str) and _HEAD_REF_EXPR_RE.search(ref_val):
        return True
    # Also check expressions captured on this step
    for expr in step.expressions:
        if _HEAD_REF_EXPR_RE.search(expr.text):
            return True
    return False


def _job_uses_external(job: Job) -> bool:
    """Return True if the job calls an external reusable workflow (uses:)."""
    # Jobs that call external workflows have a 'uses' key at the job level.
    # Our parser doesn't expose job.uses directly, but expressions would contain
    # any ${{ }} in that field. We detect by checking job.steps is empty and
    # job.secrets is set — a reliable heuristic for a reusable-workflow call job.
    return bool(job.secrets is not None and not job.steps)


# ---------------------------------------------------------------------------
# Public detector
# ---------------------------------------------------------------------------


def detect(result: ParseResult) -> list[Finding]:
    """Detect permissions-related security findings in a parsed workflow.

    Args:
        result: The :class:`~security.workflow.models.ParseResult` to scan.

    Returns:
        List of :class:`~security.workflow.finding.Finding` objects.
        Never raises.
    """
    if not result.ok or result.workflow is None:
        return []

    workflow = result.workflow
    file = workflow.path
    triggers = trigger_set(workflow)
    findings: list[Finding] = []

    # ------------------------------------------------------------------
    # PG-WF-004: Missing top-level permissions block
    # ------------------------------------------------------------------
    if workflow.permissions is None:
        findings.append(
            make_finding(
                rule_id="PG-WF-004",
                file=file,
                line=workflow.line,
                snippet="permissions: <not set>",
                message=(
                    "No top-level 'permissions:' block defined.  "
                    "GitHub Actions defaults to write access for all scopes."
                ),
                confidence=CONFIDENCE_HIGH,
            )
        )

    # ------------------------------------------------------------------
    # PG-WF-005: Overly broad permissions
    # ------------------------------------------------------------------
    is_broad, reason = _has_write_scope(workflow.permissions)
    if is_broad:
        findings.append(
            make_finding(
                rule_id="PG-WF-005",
                file=file,
                line=workflow.line,
                snippet=f"permissions:\n  {reason}",
                message=f"Workflow-level permission '{reason}' grants write access.",
                confidence=CONFIDENCE_HIGH,
                evidence={"permission": reason},
            )
        )

    for job in workflow.jobs:
        is_broad_job, reason_job = _has_write_scope(job.permissions)
        if is_broad_job:
            findings.append(
                make_finding(
                    rule_id="PG-WF-005",
                    file=file,
                    line=job.line,
                    job_id=job.id,
                    snippet=f"jobs.{job.id}.permissions:\n  {reason_job}",
                    message=(
                        f"Job '{job.id}' permission '{reason_job}' grants write access."
                    ),
                    confidence=CONFIDENCE_MEDIUM,
                    evidence={"permission": reason_job, "job": job.id},
                )
            )

        # ------------------------------------------------------------------
        # PG-WF-006: Pwn-request (pull_request_target + head-ref checkout)
        # ------------------------------------------------------------------
        if "pull_request_target" in triggers:
            for step in job.steps:
                if _step_checks_out_head_ref(step):
                    findings.append(
                        make_finding(
                            rule_id="PG-WF-006",
                            file=file,
                            line=step.line,
                            job_id=job.id,
                            step_name=step.name,
                            snippet=f"uses: {step.uses}",
                            message=(
                                "Pwn-request: workflow triggered by "
                                "'pull_request_target' checks out the PR head ref, "
                                "running untrusted code with write permissions."
                            ),
                            confidence=CONFIDENCE_HIGH,
                            evidence={
                                "trigger": "pull_request_target",
                                "uses": step.uses,
                                "ref": step.with_inputs.get("ref", ""),
                            },
                        )
                    )

        # ------------------------------------------------------------------
        # PG-WF-007: secrets: inherit
        # ------------------------------------------------------------------
        if isinstance(job.secrets, str) and job.secrets.lower() == "inherit":
            findings.append(
                make_finding(
                    rule_id="PG-WF-007",
                    file=file,
                    line=job.line,
                    job_id=job.id,
                    snippet=f"jobs.{job.id}:\n  secrets: inherit",
                    message=(
                        f"Job '{job.id}' uses 'secrets: inherit', passing all "
                        "caller secrets to the called workflow."
                    ),
                    confidence=CONFIDENCE_HIGH,
                    evidence={"job": job.id},
                )
            )

    return findings
