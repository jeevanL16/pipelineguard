"""Tests for security.workflow.finding: Finding dataclass, fingerprint, sanitization."""

from __future__ import annotations

import pytest

from security.workflow.finding import (
    CONFIDENCE_HIGH,
    CONFIDENCE_LOW,
    CONFIDENCE_MEDIUM,
    Finding,
    _redact,
    _safe_snippet,
    _sanitize,
)

# ---------------------------------------------------------------------------
# Helpers: _sanitize
# ---------------------------------------------------------------------------


class TestSanitize:
    def test_strips_ansi_escape(self) -> None:
        assert _sanitize("\x1b[31mred\x1b[0m") == "red"

    def test_strips_csi_sequence(self) -> None:
        # OSC title-set sequence — classic terminal injection
        assert "\x1b]0;" not in _sanitize("\x1b]0;injected\x07")

    def test_strips_c0_controls(self) -> None:
        # Null, SOH, BEL, BS — but NOT \t \n \r
        raw = "\x00hello\x07world\x08"
        result = _sanitize(raw)
        assert "\x00" not in result
        assert "\x07" not in result
        assert "\x08" not in result
        assert "hello" in result
        assert "world" in result

    def test_preserves_tab_newline_cr(self) -> None:
        s = "line1\nline2\r\ntab\there"
        assert _sanitize(s) == s

    def test_normalises_to_nfc(self) -> None:
        # Decomposed 'é' (e + combining acute) -> composed 'é'
        decomposed = "e\u0301"
        composed = "\u00e9"
        assert _sanitize(decomposed) == composed

    def test_plain_text_unchanged(self) -> None:
        plain = "echo hello world"
        assert _sanitize(plain) == plain


# ---------------------------------------------------------------------------
# Helpers: _redact
# ---------------------------------------------------------------------------


class TestRedact:
    def test_redacts_github_pat_classic(self) -> None:
        token = "ghp_" + "A" * 36
        assert _redact(token) == "[REDACTED]"

    def test_redacts_github_server_token(self) -> None:
        token = "ghs_" + "B" * 36
        result = _redact(f"Bearer {token}")
        assert token not in result
        assert "[REDACTED]" in result

    def test_redacts_40char_hex(self) -> None:
        sha = "a" * 40
        result = _redact(sha)
        assert sha not in result
        assert "[REDACTED]" in result

    def test_does_not_redact_short_hex(self) -> None:
        short = "deadbeef"  # Only 8 chars — not a token
        assert _redact(short) == short

    def test_plain_text_unchanged(self) -> None:
        assert _redact("echo hello") == "echo hello"


# ---------------------------------------------------------------------------
# Helpers: _safe_snippet
# ---------------------------------------------------------------------------


class TestSafeSnippet:
    def test_truncates_long_snippet(self) -> None:
        long = "x" * 1000
        result = _safe_snippet(long)
        assert len(result) <= 512
        assert result.endswith("...")

    def test_short_snippet_unchanged(self) -> None:
        short = "echo hello"
        assert _safe_snippet(short) == short

    def test_sanitizes_and_redacts(self) -> None:
        token = "ghp_" + "C" * 36
        raw = f"\x1b[31m{token}\x1b[0m"
        result = _safe_snippet(raw)
        assert token not in result
        assert "[REDACTED]" in result
        assert "\x1b" not in result


# ---------------------------------------------------------------------------
# Finding construction
# ---------------------------------------------------------------------------


class TestFindingConstruction:
    def _minimal(self, **kwargs: object) -> Finding:
        defaults: dict[str, object] = {
            "rule_id": "PG-WF-001",
            "file": ".github/workflows/ci.yml",
            "line": 10,
            "column": None,
            "job_id": "build",
            "step_name": "Checkout",
            "snippet": "run: echo hello",
            "message": "Test message",
            "confidence": CONFIDENCE_HIGH,
        }
        defaults.update(kwargs)
        return Finding(**defaults)  # type: ignore[arg-type]

    def test_basic_construction(self) -> None:
        f = self._minimal()
        assert f.rule_id == "PG-WF-001"
        assert f.line == 10

    def test_is_frozen(self) -> None:
        from dataclasses import FrozenInstanceError
        f = self._minimal()
        with pytest.raises(FrozenInstanceError):
            f.rule_id = "PG-WF-999"  # type: ignore[misc]

    def test_none_line_and_column(self) -> None:
        f = self._minimal(line=None, column=None)
        assert f.line is None
        assert f.column is None

    def test_none_job_and_step(self) -> None:
        f = self._minimal(job_id=None, step_name=None)
        assert f.job_id is None
        assert f.step_name is None

    def test_sanitizes_ansi_in_snippet(self) -> None:
        f = self._minimal(snippet="\x1b[31mevil\x1b[0m")
        assert "\x1b" not in f.snippet
        assert "evil" in f.snippet

    def test_sanitizes_ansi_in_message(self) -> None:
        f = self._minimal(message="\x1b[1mBold message\x1b[0m")
        assert "\x1b" not in f.message
        assert "Bold message" in f.message

    def test_sanitizes_ansi_in_file(self) -> None:
        f = self._minimal(file="\x1b[31m/path/to/ci.yml\x1b[0m")
        assert "\x1b" not in f.file

    def test_sanitizes_ansi_in_job_id(self) -> None:
        f = self._minimal(job_id="\x1b[0mbuild\x1b[0m")
        assert "\x1b" not in f.job_id  # type: ignore[operator]

    def test_sanitizes_ansi_in_step_name(self) -> None:
        f = self._minimal(step_name="\x1b[1mEvil Step\x1b[0m")
        assert "\x1b" not in f.step_name  # type: ignore[operator]

    def test_redacts_secret_in_snippet(self) -> None:
        token = "ghp_" + "D" * 36
        f = self._minimal(snippet=f"run: echo {token}")
        assert token not in f.snippet
        assert "[REDACTED]" in f.snippet

    def test_evidence_defaults_to_empty_dict(self) -> None:
        f = self._minimal()
        assert f.evidence == {}

    def test_evidence_stored(self) -> None:
        f = self._minimal(evidence={"context": "github.event.issue.title"})
        assert f.evidence["context"] == "github.event.issue.title"

    def test_confidence_constants(self) -> None:
        assert CONFIDENCE_HIGH == "HIGH"
        assert CONFIDENCE_MEDIUM == "MEDIUM"
        assert CONFIDENCE_LOW == "LOW"


# ---------------------------------------------------------------------------
# Fingerprint
# ---------------------------------------------------------------------------


class TestFingerprint:
    def _finding(self, **kwargs: object) -> Finding:
        defaults: dict[str, object] = {
            "rule_id": "PG-WF-001",
            "file": ".github/workflows/ci.yml",
            "line": 12,
            "column": None,
            "job_id": "build",
            "step_name": "Run",
            "snippet": "run: echo hello",
            "message": "msg",
            "confidence": CONFIDENCE_HIGH,
        }
        defaults.update(kwargs)
        return Finding(**defaults)  # type: ignore[arg-type]

    def test_fingerprint_is_64_hex_chars(self) -> None:
        fp = self._finding().fingerprint()
        assert len(fp) == 64
        assert all(c in "0123456789abcdef" for c in fp)

    def test_fingerprint_deterministic(self) -> None:
        f = self._finding()
        assert f.fingerprint() == f.fingerprint()

    def test_same_finding_same_fingerprint(self) -> None:
        f1 = self._finding()
        f2 = self._finding()
        assert f1.fingerprint() == f2.fingerprint()

    def test_different_rule_different_fingerprint(self) -> None:
        f1 = self._finding(rule_id="PG-WF-001")
        f2 = self._finding(rule_id="PG-WF-002")
        assert f1.fingerprint() != f2.fingerprint()

    def test_different_file_different_fingerprint(self) -> None:
        f1 = self._finding(file="a.yml")
        f2 = self._finding(file="b.yml")
        assert f1.fingerprint() != f2.fingerprint()

    def test_different_line_different_fingerprint(self) -> None:
        f1 = self._finding(line=1)
        f2 = self._finding(line=2)
        assert f1.fingerprint() != f2.fingerprint()

    def test_different_snippet_different_fingerprint(self) -> None:
        f1 = self._finding(snippet="echo a")
        f2 = self._finding(snippet="echo b")
        assert f1.fingerprint() != f2.fingerprint()

    def test_file_path_normalised_for_fingerprint(self) -> None:
        # Windows backslash vs forward slash must give same fingerprint.
        f1 = self._finding(file=".github/workflows/ci.yml")
        f2 = self._finding(file=".github\\workflows\\ci.yml")
        assert f1.fingerprint() == f2.fingerprint()

    def test_file_path_case_normalised(self) -> None:
        f1 = self._finding(file=".github/workflows/CI.yml")
        f2 = self._finding(file=".github/workflows/ci.yml")
        assert f1.fingerprint() == f2.fingerprint()

    def test_snippet_whitespace_normalised(self) -> None:
        f1 = self._finding(snippet="echo   hello")
        f2 = self._finding(snippet="echo hello")
        assert f1.fingerprint() == f2.fingerprint()

    def test_none_line_fingerprint_stable(self) -> None:
        f1 = self._finding(line=None)
        f2 = self._finding(line=None)
        assert f1.fingerprint() == f2.fingerprint()

    def test_none_vs_nonone_line_different(self) -> None:
        f1 = self._finding(line=None)
        f2 = self._finding(line=1)
        assert f1.fingerprint() != f2.fingerprint()


# ---------------------------------------------------------------------------
# sort_key
# ---------------------------------------------------------------------------


class TestSortKey:
    def test_sort_key_is_tuple(self) -> None:
        f = Finding(
            rule_id="PG-WF-001",
            file="a.yml",
            line=5,
            column=None,
            job_id=None,
            step_name=None,
            snippet="x",
            message="m",
            confidence=CONFIDENCE_HIGH,
        )
        key = f.sort_key()
        assert isinstance(key, tuple)
        assert len(key) == 3

    def test_sort_key_uses_zero_for_none_line(self) -> None:
        f = Finding(
            rule_id="PG-WF-001",
            file="a.yml",
            line=None,
            column=None,
            job_id=None,
            step_name=None,
            snippet="x",
            message="m",
            confidence=CONFIDENCE_HIGH,
        )
        assert f.sort_key()[1] == 0

    def test_findings_sort_by_file_then_line_then_rule(self) -> None:
        f1 = Finding(
            rule_id="PG-WF-002",
            file="a.yml",
            line=1,
            column=None,
            job_id=None,
            step_name=None,
            snippet="x",
            message="m",
            confidence=CONFIDENCE_HIGH,
        )
        f2 = Finding(
            rule_id="PG-WF-001",
            file="a.yml",
            line=2,
            column=None,
            job_id=None,
            step_name=None,
            snippet="x",
            message="m",
            confidence=CONFIDENCE_HIGH,
        )
        f3 = Finding(
            rule_id="PG-WF-001",
            file="b.yml",
            line=1,
            column=None,
            job_id=None,
            step_name=None,
            snippet="x",
            message="m",
            confidence=CONFIDENCE_HIGH,
        )
        ordered = sorted([f3, f2, f1], key=lambda f: f.sort_key())
        assert ordered == [f1, f2, f3]
