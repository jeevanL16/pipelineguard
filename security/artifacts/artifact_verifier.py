"""
PipelineGuard - Artifact Integrity Verification (Week 5)

Verifies a build artifact against a trusted, expected SHA-256 hash and
produces a PASS/BLOCK decision.

Outcomes
--------
| Situation                                  | outcome    | decision | verified | event            |
|--------------------------------------------|------------|----------|----------|------------------|
| actual hash == expected hash               | MATCH      | PASS     | True     | none             |
| actual hash != expected hash               | MISMATCH   | BLOCK    | False    | artifact_tampering (CRITICAL) |
| artifact missing/unreadable, expected hash | ERROR      | BLOCK    | False    | none             |
| missing or malformed                       |            |          |          |                  |

The module fails closed: `verified` is True ONLY for MATCH. Any error
produces decision BLOCK with verified False, so a verification error
can never be mistaken for a successful verification.

Where should the expected hash come from?
-----------------------------------------
The expected hash must come from a *trusted reference stored
separately from the artifact* - for example a hashes file committed
to the repository and protected by code review/branch protection, a
CI secret/variable, or a signed release record.

If the expected hash sits next to the artifact (same directory,
same download location, same storage bucket), an attacker who can
replace the artifact can replace the hash file too, and the check
passes for the malicious file. Hash verification only proves
integrity relative to a reference the attacker cannot also change.
(It also does not prove *who* built the artifact - that needs
signatures, see "Future work" in README.md.)

The artifact is only read as bytes; it is never executed.
"""

import hmac
import os
import re
from dataclasses import dataclass, field, asdict
from typing import Optional

from artifact_hashing import calculate_sha256, ArtifactHashError
from artifact_events import build_tamper_event

PASS = "PASS"
BLOCK = "BLOCK"

OUTCOME_MATCH = "MATCH"
OUTCOME_MISMATCH = "MISMATCH"
OUTCOME_ERROR = "ERROR"

# CLI/CI exit codes, consistent with the secrets scanner
# (0 = PASS, 1 = BLOCK on a finding, 2 = the check itself failed).
EXIT_PASS = 0
EXIT_BLOCK = 1
EXIT_ERROR = 2

_SHA256_HEX = re.compile(r"[0-9a-fA-F]{64}")


class InvalidExpectedHashError(ValueError):
    """Raised when an expected hash is missing or not a valid SHA-256
    hex digest."""
    pass


@dataclass
class VerificationResult:
    """Result of verifying one artifact."""

    decision: str                      # "PASS" or "BLOCK"
    outcome: str                       # "MATCH", "MISMATCH" or "ERROR"
    verified: bool                     # True only for MATCH
    artifact: str                      # path as supplied by the caller
    expected_hash: Optional[str] = None
    actual_hash: Optional[str] = None
    error: Optional[str] = None        # set only when outcome == "ERROR"
    event: Optional[dict] = field(default=None)  # set only on MISMATCH

    @property
    def exit_code(self) -> int:
        if self.outcome == OUTCOME_MATCH:
            return EXIT_PASS
        if self.outcome == OUTCOME_MISMATCH:
            return EXIT_BLOCK
        return EXIT_ERROR

    def to_dict(self) -> dict:
        """JSON-serializable form, convenient for a FastAPI response."""
        return asdict(self)


def normalize_expected_hash(expected_hash) -> str:
    """
    Validate an expected SHA-256 hash and return it normalised to
    lowercase hex. Surrounding whitespace is ignored.

    Raises InvalidExpectedHashError if it is None, not a string,
    empty, or not exactly 64 hexadecimal characters.
    """
    if expected_hash is None:
        raise InvalidExpectedHashError("Expected hash is missing.")
    if not isinstance(expected_hash, str):
        raise InvalidExpectedHashError("Expected hash must be a string.")

    candidate = expected_hash.strip()
    if not candidate:
        raise InvalidExpectedHashError("Expected hash is empty.")
    if not _SHA256_HEX.fullmatch(candidate):
        raise InvalidExpectedHashError(
            "Expected hash is malformed: a SHA-256 hash is exactly "
            "64 hexadecimal characters."
        )
    return candidate.lower()


def _error_result(artifact_path, message, expected=None, actual=None):
    return VerificationResult(
        decision=BLOCK,
        outcome=OUTCOME_ERROR,
        verified=False,
        artifact=os.fspath(artifact_path) if _is_pathlike(artifact_path) else str(artifact_path),
        expected_hash=expected,
        actual_hash=actual,
        error=message,
    )


def _is_pathlike(value) -> bool:
    return isinstance(value, (str, bytes, os.PathLike))


def verify_artifact(
    artifact_path,
    expected_hash,
    repository: str = "pipelineguard",
    branch: str = None,
) -> VerificationResult:
    """
    Verify `artifact_path` against `expected_hash`.

    Never raises for artifact/hash problems; they are returned as an
    ERROR result (decision BLOCK, verified False). On a mismatch the
    result carries a structured `artifact_tampering` security event.
    """
    # 1. Validate the trusted reference first. Without a usable
    #    expected hash nothing can be verified, so fail closed.
    try:
        expected = normalize_expected_hash(expected_hash)
    except InvalidExpectedHashError as error:
        return _error_result(artifact_path, str(error))

    # 2. Hash the artifact (read-only, chunked, never executed).
    try:
        actual = calculate_sha256(artifact_path)
    except ArtifactHashError as error:
        return _error_result(artifact_path, str(error), expected=expected)

    # 3. Constant-time comparison of the two digests.
    if hmac.compare_digest(actual, expected):
        return VerificationResult(
            decision=PASS,
            outcome=OUTCOME_MATCH,
            verified=True,
            artifact=os.fspath(artifact_path),
            expected_hash=expected,
            actual_hash=actual,
        )

    event = build_tamper_event(
        artifact_path, expected, actual, repository=repository, branch=branch
    )
    return VerificationResult(
        decision=BLOCK,
        outcome=OUTCOME_MISMATCH,
        verified=False,
        artifact=os.fspath(artifact_path),
        expected_hash=expected,
        actual_hash=actual,
        event=event,
    )


def load_expected_hash(hashes_file, artifact_name: str) -> str:
    """
    Look up the expected hash for `artifact_name` in a trusted hashes
    file kept SEPARATE from the artifact.

    The file uses the standard `sha256sum` format, one entry per line:

        <64 hex chars>  <artifact file name>

    Blank lines and lines starting with '#' are ignored. Raises
    InvalidExpectedHashError if the file cannot be read, the artifact
    has no entry, or the entry is malformed.
    """
    try:
        with open(hashes_file, "r", encoding="utf-8") as handle:
            lines = handle.read().splitlines()
    except OSError as error:
        raise InvalidExpectedHashError(
            f"Could not read trusted hashes file: {error.strerror or error}"
        ) from error
    except UnicodeDecodeError as error:
        raise InvalidExpectedHashError(
            "Trusted hashes file is not valid UTF-8 text."
        ) from error

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) != 2:
            continue
        hash_part, name_part = parts
        name_part = name_part.lstrip("*").strip()  # '*' = binary-mode marker
        if name_part == artifact_name:
            return normalize_expected_hash(hash_part)

    raise InvalidExpectedHashError(
        f"No expected hash found for '{artifact_name}' in trusted hashes file."
    )


def verify_artifact_from_hashes_file(
    artifact_path,
    hashes_file,
    repository: str = "pipelineguard",
    branch: str = None,
) -> VerificationResult:
    """Verify an artifact against an entry in a separate trusted
    hashes file (matched by the artifact's file name)."""
    if not _is_pathlike(artifact_path):
        return _error_result(artifact_path, "Artifact path must be a string or path-like object.")
    try:
        expected = load_expected_hash(hashes_file, os.path.basename(os.fspath(artifact_path)))
    except InvalidExpectedHashError as error:
        return _error_result(artifact_path, str(error))
    return verify_artifact(artifact_path, expected, repository=repository, branch=branch)
