"""Script-injection detector for GitHub Actions workflows.

Detects untrusted GitHub context values (e.g. ``github.event.issue.title``,
``github.head_ref``) used directly inside ``run:`` steps, ``actions/github-script``
scripts, or writes to ``GITHUB_ENV`` / ``GITHUB_OUTPUT`` / ``GITHUB_PATH``.

Rules fired:

* **PG-WF-001** — untrusted context in ``run:``
* **PG-WF-002** — untrusted context in ``actions/github-script``
* **PG-WF-003** — untrusted context written to ``GITHUB_ENV`` / ``GITHUB_OUTPUT`` /
  ``GITHUB_PATH``

Severity is recorded in findings evidence when the workflow trigger is a
high-risk event (``pull_request_target``, ``issue_comment``, ``workflow_run``).
"""

from __future__ import annotations

import re
from typing import Final

from security.workflow.detectors._base import make_finding, trigger_set
from security.workflow.finding import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, Finding
from security.workflow.models import ParseResult

# ---------------------------------------------------------------------------
# Untrusted context catalogues
# ---------------------------------------------------------------------------

#: Expression texts that are always untrusted (exact match after strip).
_UNTRUSTED_EXACT: Final[frozenset[str]] = frozenset(
    {
        "github.event.issue.title",
        "github.event.issue.body",
        "github.event.pull_request.title",
        "github.event.pull_request.body",
        "github.event.pull_request.head.ref",
        "github.event.pull_request.head.label",
        "github.event.comment.body",
        "github.event.review.body",
        "github.event.head_commit.message",
        "github.event.head_commit.author.name",
        "github.event.head_commit.author.email",
        "github.event.head_commit.author.username",
        "github.head_ref",
        "github.event.commits",
    }
)

#: Prefixes — any expression whose text starts with one of these is untrusted.
_UNTRUSTED_PREFIXES: Final[tuple[str, ...]] = (
    "github.event.commits[",   # array element access
    "github.event.inputs.",    # workflow_dispatch inputs via event
    "inputs.",                 # workflow_dispatch inputs shorthand
)

#: Triggers that significantly raise the exploitability of injection.
_HIGH_RISK_TRIGGERS: Final[frozenset[str]] = frozenset(
    {"pull_request_target", "issue_comment", "workflow_run"}
)

# Matches 'actions/github-script' with any version suffix.
_GITHUB_SCRIPT_RE: Final[re.Pattern[str]] = re.compile(
    r"^actions/github-script(?:@[^\s]{1,80})?$",
    re.IGNORECASE,
)

# Matches writes to GITHUB_ENV / GITHUB_OUTPUT / GITHUB_PATH.
# Uses bounded class [^#\n]{0,120} to prevent ReDoS.
_GITHUB_SINK_WRITE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?:>>|printf\b[^#\n]{0,120}>>)\s*[\"']?\$(?:GITHUB_ENV|GITHUB_OUTPUT|GITHUB_PATH)[\"']?",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_untrusted(text: str) -> bool:
    """Return True if *text* is a known untrusted GitHub context expression.

    Args:
        text: The expression text (the content inside ``${{ ... }}``).

    Returns:
        ``True`` if the expression is from an attacker-controllable source.
    """
    stripped = text.strip()
    if stripped in _UNTRUSTED_EXACT:
        return True
    for prefix in _UNTRUSTED_PREFIXES:
        if stripped.startswith(prefix):
            return True
    return False


def _is_github_script(uses: str) -> bool:
    """Return True if *uses* references ``actions/github-script``.

    Args:
        uses: The ``uses:`` field value from a workflow step.

    Returns:
        ``True`` if the action is ``actions/github-script`` at any version.
    """
    return bool(_GITHUB_SCRIPT_RE.match(uses.strip()))


# ---------------------------------------------------------------------------
# Public detector
# ---------------------------------------------------------------------------


def detect(result: ParseResult) -> list[Finding]:
    """Detect script-injection findings in a parsed workflow.

    Scans all jobs and steps for untrusted GitHub context expressions used
    in ``run:`` blocks, ``actions/github-script``, or ``GITHUB_ENV`` writes.

    Args:
        result: The :class:`~security.workflow.models.ParseResult` to scan.

    Returns:
        List of :class:`~security.workflow.finding.Finding` objects, possibly
        empty.  Never raises.
    """
    if not result.ok or result.workflow is None:
        return []

    workflow = result.workflow
    triggers = trigger_set(workflow)
    high_risk = bool(triggers & _HIGH_RISK_TRIGGERS)
    file = workflow.path
    findings: list[Finding] = []

    for job in workflow.jobs:
        for step in job.steps:
            untrusted = [e for e in step.expressions if _is_untrusted(e.text)]
            if not untrusted:
                continue

            expr_texts = [e.text for e in untrusted]
            evidence_base = {
                "contexts": expr_texts,
                "high_risk_trigger": high_risk,
                "triggers": sorted(triggers),
            }
            confidence = CONFIDENCE_HIGH if high_risk else CONFIDENCE_MEDIUM

            # PG-WF-001: run: injection
            if step.run is not None:
                for expr in untrusted:
                    snippet = step.run[:200] if step.run else ""
                    findings.append(
                        make_finding(
                            rule_id="PG-WF-001",
                            file=file,
                            line=expr.line or step.line,
                            job_id=job.id,
                            step_name=step.name,
                            snippet=snippet,
                            message=(
                                f"Untrusted expression '${{{{ {expr.text} }}}}' "
                                f"interpolated directly in run: step."
                                + (
                                    " Trigger is high-risk: "
                                    + ", ".join(sorted(triggers & _HIGH_RISK_TRIGGERS))
                                    if high_risk
                                    else ""
                                )
                            ),
                            confidence=confidence,
                            evidence={**evidence_base, "expression": expr.text},
                        )
                    )
                # PG-WF-003: GITHUB_ENV / GITHUB_OUTPUT / GITHUB_PATH write
                if _GITHUB_SINK_WRITE_RE.search(step.run):
                    for expr in untrusted:
                        findings.append(
                            make_finding(
                                rule_id="PG-WF-003",
                                file=file,
                                line=expr.line or step.line,
                                job_id=job.id,
                                step_name=step.name,
                                snippet=step.run[:200],
                                message=(
                                    f"Untrusted expression '${{{{ {expr.text} }}}}' "
                                    f"written to GITHUB_ENV/GITHUB_OUTPUT/GITHUB_PATH."
                                ),
                                confidence=confidence,
                                evidence={**evidence_base, "expression": expr.text},
                            )
                        )

            # PG-WF-002: github-script injection
            if step.uses is not None and _is_github_script(step.uses):
                for expr in untrusted:
                    findings.append(
                        make_finding(
                            rule_id="PG-WF-002",
                            file=file,
                            line=expr.line or step.line,
                            job_id=job.id,
                            step_name=step.name,
                            snippet=step.uses,
                            message=(
                                f"Untrusted expression '${{{{ {expr.text} }}}}' "
                                f"passed to actions/github-script."
                            ),
                            confidence=confidence,
                            evidence={**evidence_base, "expression": expr.text},
                        )
                    )

    return findings
