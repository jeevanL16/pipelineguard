"""Workflow-modification and persistence detector for GitHub Actions.

Detects patterns where a workflow modifies itself or the repo in ways that
could achieve persistent code execution.

Rules fired:

* **PG-WF-016** — write to ``.github/workflows/``
* **PG-WF-017** — ``git push`` / ``git commit`` using ``GITHUB_TOKEN``
* **PG-WF-018** — ``schedule:`` trigger (cron persistence vector)
"""

from __future__ import annotations

import re
from typing import Final

from security.workflow.detectors._base import make_finding, trigger_set
from security.workflow.finding import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, Finding
from security.workflow.models import ParseResult

# ---------------------------------------------------------------------------
# Compiled regexes
# ---------------------------------------------------------------------------

# PG-WF-016: write to .github/workflows/ (redirect, cp, mv, tee, install).
# Uses [^#\n]{0,200} to bound the per-line scan.
_WORKFLOW_WRITE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?:"
    r"(?:>>?|tee\b[^#\n]{0,200})\s*[\"']?[^\s\"']{0,200}\.github[/\\]workflows[/\\]"
    r"|"
    r"\b(?:cp|mv|install)\b[^#\n]{0,200}\.github[/\\]workflows[/\\]"
    r"|"
    r"\bcat\b[^#\n]{0,200}>>[^#\n]{0,100}\.github[/\\]workflows[/\\]"
    r")",
    re.IGNORECASE,
)

# PG-WF-017: git push/commit combined with GITHUB_TOKEN usage.
# We detect git push or git commit in a step that also references GITHUB_TOKEN.
_GIT_PUSH_RE: Final[re.Pattern[str]] = re.compile(
    r"\bgit\b[^#\n]{0,100}(?:push|commit)\b",
    re.IGNORECASE,
)
_GITHUB_TOKEN_ENV_RE: Final[re.Pattern[str]] = re.compile(
    r"\$(?:GITHUB_TOKEN|\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}|\{\{\s*github\.token\s*\}\})",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _find_workflow_write(run: str) -> str | None:
    """Return the first .github/workflows write match in *run*, or None."""
    m = _WORKFLOW_WRITE_RE.search(run)
    return m.group(0)[:200] if m else None


def _has_git_push_with_token(run: str) -> bool:
    """Return True if *run* performs a git push/commit with GITHUB_TOKEN."""
    return bool(_GIT_PUSH_RE.search(run) and _GITHUB_TOKEN_ENV_RE.search(run))


def _is_git_push_step(run: str) -> str | None:
    """Return snippet if git push/commit is in the run block, else None."""
    m = _GIT_PUSH_RE.search(run)
    return m.group(0)[:200] if m else None


# ---------------------------------------------------------------------------
# Public detector
# ---------------------------------------------------------------------------


def detect(result: ParseResult) -> list[Finding]:
    """Detect workflow-modification and persistence patterns.

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
    # PG-WF-018: schedule: trigger as persistence vector
    # ------------------------------------------------------------------
    if "schedule" in triggers:
        findings.append(
            make_finding(
                rule_id="PG-WF-018",
                file=file,
                line=workflow.line,
                snippet="on:\n  schedule:",
                message=(
                    "Workflow uses a 'schedule:' trigger.  If workflow files are "
                    "tampered with, the cron schedule provides a persistence mechanism."
                ),
                confidence=CONFIDENCE_MEDIUM,
                evidence={"triggers": sorted(triggers)},
            )
        )

    for job in workflow.jobs:
        for step in job.steps:
            if not step.run:
                continue
            run = step.run

            # PG-WF-016
            snip = _find_workflow_write(run)
            if snip:
                findings.append(
                    make_finding(
                        rule_id="PG-WF-016",
                        file=file,
                        line=step.line,
                        job_id=job.id,
                        step_name=step.name,
                        snippet=snip,
                        message=(
                            "Run step writes to .github/workflows/ — "
                            "enables persistent code execution on future pushes."
                        ),
                        confidence=CONFIDENCE_HIGH,
                    )
                )

            # PG-WF-017
            if _has_git_push_with_token(run):
                snip2 = _is_git_push_step(run) or "git push"
                findings.append(
                    make_finding(
                        rule_id="PG-WF-017",
                        file=file,
                        line=step.line,
                        job_id=job.id,
                        step_name=step.name,
                        snippet=snip2,
                        message=(
                            "Run step uses git push/commit with GITHUB_TOKEN — "
                            "could modify repository history or workflow files."
                        ),
                        confidence=CONFIDENCE_MEDIUM,
                    )
                )

    return findings
