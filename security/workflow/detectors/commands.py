"""Dangerous-command detector for GitHub Actions workflows.

Detects shell anti-patterns and high-risk command invocations inside
``run:`` steps.  All regexes use bounded quantifiers to prevent ReDoS.

Rules fired:

* **PG-WF-008** — ``curl | bash`` / ``wget | sh`` pattern
* **PG-WF-009** — ``base64 -d | shell``
* **PG-WF-010** — ``eval`` of a variable or command substitution
* **PG-WF-011** — reverse-shell indicator
* **PG-WF-021** — secret value echoed in run step
* **PG-WF-022** — ``chmod +x`` on a downloaded file
* **PG-WF-023** — known cryptominer binary
"""

from __future__ import annotations

import re
from typing import Final

from security.workflow.detectors._base import make_finding
from security.workflow.finding import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, Finding
from security.workflow.models import Job, ParseResult, Step

# ---------------------------------------------------------------------------
# Compiled regexes — all bounded to prevent ReDoS
# ---------------------------------------------------------------------------

# PG-WF-008: curl/wget piped directly to a shell or executed via subshell.
# [^|#\n]{0,300} bounds the per-line scan.
_CURL_PIPE_SHELL_RE: Final[re.Pattern[str]] = re.compile(
    r"\bcurl\b[^|#\n]{0,300}\|[^|#\n]{0,80}\b(?:bash|sh|zsh|ash|dash|fish)\b",
    re.IGNORECASE,
)
_WGET_PIPE_SHELL_RE: Final[re.Pattern[str]] = re.compile(
    r"\bwget\b[^|#\n]{0,300}\|[^|#\n]{0,80}\b(?:bash|sh|zsh|ash|dash|fish)\b",
    re.IGNORECASE,
)
_DOWNLOAD_SUBSHELL_RE: Final[re.Pattern[str]] = re.compile(
    r"\b(?:bash|sh|zsh|ash|dash|fish)\b[^#\n]{0,80}-c\s+[\"']?\$\([^#\n]{0,300}\b(?:curl|wget)\b",
    re.IGNORECASE,
)
_DOWNLOAD_BACKTICK_RE: Final[re.Pattern[str]] = re.compile(
    r"\b(?:bash|sh|zsh|ash|dash|fish)\b[^#\n]{0,80}-c\s+[\"']?`[^#\n]{0,300}\b(?:curl|wget)\b",
    re.IGNORECASE,
)

# PG-WF-009: base64 decode piped to shell.
_BASE64_PIPE_SHELL_RE: Final[re.Pattern[str]] = re.compile(
    r"\bbase64\b[^|#\n]{0,150}(?:-d|--decode|-D)[^|#\n]{0,150}\|[^|#\n]{0,80}"
    r"\b(?:bash|sh|zsh|ash|dash|fish)\b",
    re.IGNORECASE,
)
# Alternate form: echo <blob> | base64 -d | bash
_ECHO_B64_PIPE_RE: Final[re.Pattern[str]] = re.compile(
    r"\becho\b[^|#\n]{0,200}\|[^|#\n]{0,80}\bbase64\b[^|#\n]{0,80}(?:-d|--decode|-D)"
    r"[^|#\n]{0,80}\|[^|#\n]{0,80}\b(?:bash|sh|zsh|ash|dash|fish)\b",
    re.IGNORECASE,
)

# PG-WF-010: eval of a variable or command substitution.
_EVAL_VAR_RE: Final[re.Pattern[str]] = re.compile(
    r"\beval\s+[\"']?\$",
    re.IGNORECASE,
)
_EVAL_SUBSHELL_RE: Final[re.Pattern[str]] = re.compile(
    r"\beval\s+[\"']?\$\(",
    re.IGNORECASE,
)
_EVAL_BACKTICK_RE: Final[re.Pattern[str]] = re.compile(
    r"\beval\s+[\"']?`",
    re.IGNORECASE,
)
_SHELL_EXEC_VAR_RE: Final[re.Pattern[str]] = re.compile(
    r"\b(?:bash|sh|zsh|ash|dash|fish)\b[^#\n]{0,80}-c\s+[\"']?\$[A-Za-z_][A-Za-z0-9_]*",
    re.IGNORECASE,
)

# PG-WF-011: Reverse-shell indicators.
_REVERSE_SHELL_RES: Final[tuple[re.Pattern[str], ...]] = (
    re.compile(r"\bbash\b[^#\n]{0,200}>&\s*/dev/tcp/", re.IGNORECASE),
    re.compile(r"\bbash\b[^#\n]{0,200}>&\s*/dev/udp/", re.IGNORECASE),
    re.compile(r"\bnc\b[^#\n]{0,100}-e\b[^#\n]{0,80}\b(?:bash|sh)\b", re.IGNORECASE),
    re.compile(r"\bncat\b[^#\n]{0,100}-e\b[^#\n]{0,80}\b(?:bash|sh)\b", re.IGNORECASE),
    re.compile(
        r"\bsocat\b[^#\n]{0,200}exec:[\"']?(?:bash|sh)\b", re.IGNORECASE
    ),
    re.compile(r"\bpython[23]?\b[^#\n]{0,200}socket\.connect\(", re.IGNORECASE),
    re.compile(r"\bperl\b[^#\n]{0,200}-e[^#\n]{0,200}socket\b", re.IGNORECASE),
    re.compile(r"\bruby\b[^#\n]{0,200}TCPSocket\b", re.IGNORECASE),
    # php reverse shell
    re.compile(r"\bphp\b[^#\n]{0,200}fsockopen\b", re.IGNORECASE),
)

# PG-WF-021: Echoing a secret expression.
# Matches: echo "${{ secrets.TOKEN }}" etc.
_ECHO_SECRET_RE: Final[re.Pattern[str]] = re.compile(
    r"\becho\b[^#\n]{0,200}\$\{\{[^}]{0,100}secrets\.",
    re.IGNORECASE,
)
# set -x / set -o xtrace while secrets are likely in scope (heuristic).
_SET_X_RE: Final[re.Pattern[str]] = re.compile(
    r"\bset\s+-[a-zA-Z]{0,8}x\b|\bset\s+-o\s+xtrace\b",
    re.IGNORECASE,
)

# PG-WF-022: Download followed by chmod +x (both in same run block).
_DOWNLOAD_RE: Final[re.Pattern[str]] = re.compile(
    r"\b(?:curl|wget)\b", re.IGNORECASE
)
_CHMOD_X_RE: Final[re.Pattern[str]] = re.compile(
    r"\bchmod\b[^#\n]{0,80}\+x\b", re.IGNORECASE
)

# PG-WF-023: Known cryptominer binaries.
_MINER_RE: Final[re.Pattern[str]] = re.compile(
    r"\b(?:xmrig|xmr-stak|cpuminer|minerd|ethminer|cgminer|bfgminer"
    r"|t-rex|gminer|nbminer|lolminer|phoenixminer|nanominer)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Per-rule helpers (pure, stateless)
# ---------------------------------------------------------------------------


def _find_curl_pipe(run: str) -> str | None:
    """Return the first matching line for curl/wget-pipe-shell or subshell exec, or None."""
    m = (
        _CURL_PIPE_SHELL_RE.search(run)
        or _WGET_PIPE_SHELL_RE.search(run)
        or _DOWNLOAD_SUBSHELL_RE.search(run)
        or _DOWNLOAD_BACKTICK_RE.search(run)
    )
    return m.group(0)[:200] if m else None


def _find_base64_pipe(run: str) -> str | None:
    """Return the first matching snippet for base64-decode-pipe-shell, or None."""
    m = _BASE64_PIPE_SHELL_RE.search(run) or _ECHO_B64_PIPE_RE.search(run)
    return m.group(0)[:200] if m else None


def _find_eval(run: str) -> str | None:
    """Return the first eval or unsafe shell execution of variable snippet, or None."""
    m = (
        _EVAL_VAR_RE.search(run)
        or _EVAL_SUBSHELL_RE.search(run)
        or _EVAL_BACKTICK_RE.search(run)
        or _SHELL_EXEC_VAR_RE.search(run)
    )
    return m.group(0)[:200] if m else None


def _find_reverse_shell(run: str) -> str | None:
    """Return the first reverse-shell snippet, or None."""
    for pattern in _REVERSE_SHELL_RES:
        m = pattern.search(run)
        if m:
            return m.group(0)[:200]
    return None


def _find_echo_secret(run: str) -> str | None:
    """Return the first echo-secret snippet, or None."""
    m = _ECHO_SECRET_RE.search(run)
    return m.group(0)[:200] if m else None


def _has_set_x(run: str) -> bool:
    """Return True if the run block enables shell trace mode (set -x)."""
    return bool(_SET_X_RE.search(run))


def _find_chmod_download(run: str) -> str | None:
    """Return a snippet if the run block downloads and chmod +x's a file."""
    if _DOWNLOAD_RE.search(run) and _CHMOD_X_RE.search(run):
        # Return the chmod match as the representative snippet.
        m = _CHMOD_X_RE.search(run)
        return m.group(0)[:200] if m else "chmod +x"
    return None


def _find_miner(run: str) -> str | None:
    """Return the first cryptominer tool match, or None."""
    m = _MINER_RE.search(run)
    return m.group(0)[:200] if m else None


def _first_line(text: str) -> str:
    """Return at most the first 200 characters of the first non-empty line."""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped[:200]
    return text[:200]


def _emit_finding(
    findings: list[Finding],
    *,
    file: str,
    job: Job,
    step: Step,
    rule_id: str,
    snippet: str,
    msg: str,
    conf: str = CONFIDENCE_HIGH,
) -> None:
    findings.append(
        make_finding(
            rule_id=rule_id,
            file=file,
            line=step.line,
            job_id=job.id,
            step_name=step.name,
            snippet=snippet,
            message=msg,
            confidence=conf,
        )
    )


# ---------------------------------------------------------------------------
# Public detector
# ---------------------------------------------------------------------------


def detect(result: ParseResult) -> list[Finding]:
    """Detect dangerous command patterns in a parsed workflow.

    Scans every ``run:`` block in every step.  Each finding corresponds to one
    specific dangerous pattern; a single step may produce multiple findings.

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
        for step in job.steps:
            if not step.run:
                continue
            run = re.sub(r"\\\r?\n\s*", " ", step.run)

            # PG-WF-008
            snip = _find_curl_pipe(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-008",
                    snippet=snip,
                    msg="Network fetch result piped directly to a shell interpreter.",
                )

            # PG-WF-009
            snip = _find_base64_pipe(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-009",
                    snippet=snip,
                    msg="Base64-decoded payload piped to a shell interpreter.",
                )

            # PG-WF-010
            snip = _find_eval(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-010",
                    snippet=snip,
                    msg="eval() of a variable or command substitution — arbitrary code execution risk.",
                )

            # PG-WF-011
            snip = _find_reverse_shell(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-011",
                    snippet=snip,
                    msg="Reverse-shell indicator detected — strong sign of supply-chain compromise.",
                )

            # PG-WF-021
            snip = _find_echo_secret(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-021",
                    snippet=snip,
                    msg="Secret context expression echoed in run: step — value will appear in logs.",
                )

            # set -x with likely secrets is a sub-case of PG-WF-021
            if _has_set_x(run) and any(e.context == "secrets" for e in step.expressions):
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-021",
                    snippet=_first_line(run),
                    msg="set -x enables shell trace while secrets expressions are in scope.",
                    conf=CONFIDENCE_MEDIUM,
                )

            # PG-WF-022
            snip = _find_chmod_download(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-022",
                    snippet=snip,
                    msg="Downloaded file made executable (chmod +x) without integrity verification.",
                    conf=CONFIDENCE_MEDIUM,
                )

            # PG-WF-023
            snip = _find_miner(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-023",
                    snippet=snip,
                    msg=f"Known cryptominer binary '{snip}' invoked in run: step.",
                )

    return findings
