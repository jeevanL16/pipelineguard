"""Supply-chain security detector for GitHub Actions workflows.

Detects supply-chain anti-patterns in workflow steps:
* Actions referenced by mutable tag or branch instead of a full 40-hex commit SHA.
* ``actions/checkout`` used without ``persist-credentials: false``.

Rules fired:

* **PG-WF-019** — action not pinned to a full 40-character commit SHA
* **PG-WF-020** — ``actions/checkout`` without ``persist-credentials: false``
"""

from __future__ import annotations

import re
from typing import Final

from security.workflow.detectors._base import make_finding
from security.workflow.finding import CONFIDENCE_HIGH, Finding
from security.workflow.models import Job, ParseResult, Step

# ---------------------------------------------------------------------------
# Compiled regexes (bounded, ReDoS-safe)
# ---------------------------------------------------------------------------

# Full 40-character git commit SHA (hexadecimal).
_COMMIT_SHA_RE: Final[re.Pattern[str]] = re.compile(
    r"^[0-9a-fA-F]{40}$"
)

# Docker digest reference: docker://image@sha256:<64 hex>
_DOCKER_DIGEST_RE: Final[re.Pattern[str]] = re.compile(
    r"^docker://[^\s@]{1,250}@sha256:[0-9a-fA-F]{64}$",
    re.IGNORECASE,
)

# Docker action prefix without digest.
_DOCKER_PREFIX_RE: Final[re.Pattern[str]] = re.compile(
    r"^docker://",
    re.IGNORECASE,
)

# Local action references: ./path or ../path
_LOCAL_ACTION_RE: Final[re.Pattern[str]] = re.compile(
    r"^\.{1,2}/"
)

# actions/checkout action name at any version or pin.
_CHECKOUT_ACTION_RE: Final[re.Pattern[str]] = re.compile(
    r"^actions/checkout(?:@[^\s]{1,80})?$",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_pinned(uses: str) -> bool:
    """Return True if the action or reusable workflow is securely pinned.

    Pinned criteria:
    * Local action starting with ``./`` or ``../``
    * Docker action pinned to a 64-hex SHA-256 digest: ``docker://...@sha256:<64hex>``
    * External repository action or reusable workflow pinned to a 40-hex commit SHA.

    Args:
        uses: Raw string from ``step.uses``.

    Returns:
        ``True`` if pinned to an immutable commit SHA or digest, or local.
    """
    stripped = uses.strip()
    if not stripped:
        return False

    if _LOCAL_ACTION_RE.match(stripped):
        return True

    if _DOCKER_PREFIX_RE.match(stripped):
        return bool(_DOCKER_DIGEST_RE.match(stripped))

    if "@" in stripped:
        _action, _, ref = stripped.rpartition("@")
        return bool(_COMMIT_SHA_RE.match(ref.strip()))

    return False


def _has_persist_credentials_false(step: Step) -> bool:
    """Return True if step explicitly sets persist-credentials: false.

    Args:
        step: Parsed workflow step.

    Returns:
        ``True`` if ``with.persist-credentials`` is explicitly false.
    """
    # Check both kebab-case and snake-case representations
    val = step.with_inputs.get("persist-credentials")
    if val is None:
        val = step.with_inputs.get("persist_credentials")

    if val is None:
        return False

    if isinstance(val, bool):
        return val is False

    if isinstance(val, str):
        cleaned = val.strip().lower()
        return cleaned in ("false", "'false'", '"false"')

    return False


def _emit_finding(
    findings: list[Finding],
    *,
    file: str,
    job: Job,
    step: Step | None = None,
    rule_id: str,
    snippet: str,
    msg: str,
    conf: str = CONFIDENCE_HIGH,
) -> None:
    findings.append(
        make_finding(
            rule_id=rule_id,
            file=file,
            line=step.line if step is not None else job.line,
            job_id=job.id,
            step_name=step.name if step is not None else None,
            snippet=snippet,
            message=msg,
            confidence=conf,
        )
    )


# ---------------------------------------------------------------------------
# Public detector
# ---------------------------------------------------------------------------


def detect(result: ParseResult) -> list[Finding]:
    """Detect supply-chain security findings in a parsed workflow.

    Scans every step for:
    * Action references not pinned to a 40-character commit SHA (PG-WF-019).
    * ``actions/checkout`` invocations without ``persist-credentials: false`` (PG-WF-020).

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
    findings: list[Finding] = []

    for job in workflow.jobs:
        if job.uses:
            job_uses = job.uses.strip()
            if not _is_pinned(job_uses):
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=None,
                    rule_id="PG-WF-019",
                    snippet=f"uses: {job_uses}",
                    msg=(
                        f"Reusable workflow '{job_uses}' is not pinned to a 40-character commit SHA. "
                        "Mutable tags or branches can allow supply-chain compromise."
                    ),
                    conf=CONFIDENCE_HIGH,
                )

        for step in job.steps:
            if not step.uses:
                continue

            uses = step.uses.strip()

            # PG-WF-019: Action not pinned to a full commit SHA
            if not _is_pinned(uses):
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-019",
                    snippet=f"uses: {uses}",
                    msg=(
                        f"Action '{uses}' is not pinned to a 40-character commit SHA. "
                        "Mutable tags or branches can allow supply-chain compromise."
                    ),
                    conf=CONFIDENCE_HIGH,
                )

            # PG-WF-020: actions/checkout without persist-credentials: false
            if _CHECKOUT_ACTION_RE.match(uses) and not _has_persist_credentials_false(step):
                    _emit_finding(
                        findings,
                        file=file,
                        job=job,
                        step=step,
                        rule_id="PG-WF-020",
                        snippet=f"uses: {uses}",
                        msg=(
                            "actions/checkout does not set 'persist-credentials: false'. "
                            "GITHUB_TOKEN remains in git config for subsequent steps."
                        ),
                        conf=CONFIDENCE_HIGH,
                    )

    return findings
