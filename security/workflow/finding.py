"""Finding model for PipelineGuard workflow security.

A :class:`Finding` represents one security issue detected in a GitHub Actions
workflow file.  Findings are immutable.  The :meth:`Finding.fingerprint`
method returns a stable SHA-256 hex digest that uniquely identifies a finding
independent of scan order or wall-clock time.

Usage::

    from security.workflow.finding import Finding
    from security.workflow.rules import lookup

    f = Finding(
        rule_id="PG-WF-001",
        file=".github/workflows/ci.yml",
        line=12,
        column=None,
        job_id="build",
        step_name="Run tests",
        snippet="run: echo ${{ github.event.issue.title }}",
        message="Untrusted context 'github.event.issue.title' used in run:",
        confidence="HIGH",
        evidence={"context": "github.event.issue.title"},
    )
    print(f.fingerprint())
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Final

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Confidence levels (not an enum — kept as literals for forwards compatibility).
CONFIDENCE_HIGH: Final[str] = "HIGH"
CONFIDENCE_MEDIUM: Final[str] = "MEDIUM"
CONFIDENCE_LOW: Final[str] = "LOW"

# Regex to detect ANSI escape sequences and other terminal-control characters.
_ANSI_ESC_RE: Final[re.Pattern[str]] = re.compile(
    r"""
    \x1b           # ESC character
    (?:
        [@-Z\\-_]  # Fe sequences
      | \[          # CSI
        [0-?]*      # parameter bytes
        [ -/]*      # intermediate bytes
        [@-~]       # final byte
    )
    | [\x00-\x08\x0b\x0c\x0e-\x1f\x7f]  # C0 controls (excl. \t \n \r)
    """,
    re.VERBOSE,
)

# Simple pattern for redacting secret-like tokens (40+ hex chars, or GitHub
# token prefix).  This is best-effort; the real guard is "never pass resolved
# secret values into findings".
_SECRET_LIKE_RE: Final[re.Pattern[str]] = re.compile(
    r"""
    (?:
        ghp_[A-Za-z0-9]{36}       # GitHub PAT classic
      | ghs_[A-Za-z0-9]{36}       # GitHub token
      | github_pat_[A-Za-z0-9_]{82} # Fine-grained PAT
      | \b[A-Fa-f0-9]{40}\b       # 40-char hex (SHA/token)
    )
    """,
    re.VERBOSE,
)

_REDACTED: Final[str] = "[REDACTED]"


# ---------------------------------------------------------------------------
# Sanitization helpers (module-level, pure functions)
# ---------------------------------------------------------------------------


def _sanitize(text: str) -> str:
    """Remove ANSI/control chars and normalise Unicode to NFC.

    Args:
        text: Raw text that may contain terminal-injection payloads.

    Returns:
        Sanitized string safe for output to terminals and log files.
    """
    normalised = unicodedata.normalize("NFC", text)
    return _ANSI_ESC_RE.sub("", normalised)


def _redact(text: str) -> str:
    """Replace token-like secrets in *text* with ``[REDACTED]``.

    Args:
        text: Text that may contain secret values.

    Returns:
        Text with recognisable secret patterns replaced.
    """
    return _SECRET_LIKE_RE.sub(_REDACTED, text)


def _safe_snippet(raw: str) -> str:
    """Sanitize and redact a code snippet for safe inclusion in a finding.

    Limits output length to 512 characters after sanitisation.

    Args:
        raw: Raw snippet text from a workflow file.

    Returns:
        Sanitized, redacted, length-bounded snippet.
    """
    cleaned = _redact(_sanitize(raw))
    if len(cleaned) > 512:
        cleaned = cleaned[:509] + "..."
    return cleaned


# ---------------------------------------------------------------------------
# Finding dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Finding:
    """One security issue detected in a GitHub Actions workflow file.

    Attributes:
        rule_id: The rule that fired, e.g. ``"PG-WF-001"``.
        file: Repository-relative path to the workflow file.
        line: 1-based line number where the issue was found, or ``None``.
        column: 1-based column number, or ``None``.
        job_id: The job ID in which the issue was found, or ``None``.
        step_name: Human-readable step name, or ``None``.
        snippet: Short code excerpt (sanitized, redacted).
        message: Human-readable description of this specific instance.
        confidence: ``"HIGH"``, ``"MEDIUM"``, or ``"LOW"``.
        evidence: Arbitrary structured evidence (rule-specific).
    """

    rule_id: str
    file: str
    line: int | None
    column: int | None
    job_id: str | None
    step_name: str | None
    snippet: str
    message: str
    confidence: str
    evidence: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Sanitize mutable string fields against terminal injection."""
        # Bypass frozen to sanitize — use object.__setattr__ only here.
        object.__setattr__(self, "file", _sanitize(self.file))
        object.__setattr__(self, "snippet", _safe_snippet(self.snippet))
        object.__setattr__(self, "message", _sanitize(self.message))
        if self.job_id is not None:
            object.__setattr__(self, "job_id", _sanitize(self.job_id))
        if self.step_name is not None:
            object.__setattr__(self, "step_name", _sanitize(self.step_name))

    # ------------------------------------------------------------------
    # Fingerprint
    # ------------------------------------------------------------------

    def fingerprint(self) -> str:
        """Return a stable SHA-256 hex fingerprint for this finding.

        The fingerprint is computed over:
        - ``rule_id``
        - ``file`` normalised to forward slashes and lowercased
        - ``line`` (as string; ``"none"`` if absent)
        - ``snippet`` lowercased and with runs of whitespace collapsed

        The fingerprint is deterministic: the same finding always produces
        the same digest regardless of when or in what order scanning runs.

        Returns:
            A 64-character lowercase hex string.
        """
        norm_file = self.file.replace("\\", "/").lower()
        norm_line = str(self.line) if self.line is not None else "none"
        norm_snippet = re.sub(r"\s+", " ", self.snippet.lower()).strip()

        payload = f"{self.rule_id}\x00{norm_file}\x00{norm_line}\x00{norm_snippet}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    # ------------------------------------------------------------------
    # Sorting key (for stable output)
    # ------------------------------------------------------------------

    def sort_key(self) -> tuple[str, int, str]:
        """Return a tuple suitable for stable deterministic sorting.

        Findings are ordered by file path, then line (0 if None), then rule_id.

        Returns:
            A 3-tuple ``(file, line, rule_id)``.
        """
        return (self.file, self.line or 0, self.rule_id)
