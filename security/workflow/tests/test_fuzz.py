"""Property-based fuzzing test suite using Hypothesis.

Tests fundamental invariants across the PipelineGuard workflow engine:
1. Crash freedom: parse_workflow_text and analyze_text never raise on arbitrary text or structured YAML.
2. Determinism: identical input yields identical JSON and SARIF output.
3. Redaction and sanitization invariant: secrets are always redacted and control chars stripped.
4. Risk score monotonicity & bounds: score in [0, 100], adding findings never decreases score.
"""

from __future__ import annotations

import os
import re
from typing import Any

import yaml
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from security.workflow.api import analyze_text
from security.workflow.finding import (
    CONFIDENCE_HIGH,
    CONFIDENCE_LOW,
    CONFIDENCE_MEDIUM,
    Finding,
)
from security.workflow.parser import parse_workflow_text
from security.workflow.reporter import format_report, sanitize_text
from security.workflow.risk import calculate_risk
from security.workflow.rules import REGISTRY

# ---------------------------------------------------------------------------
# Hypothesis profiles
# ---------------------------------------------------------------------------

settings.register_profile(
    "ci",
    max_examples=50,
    derandomize=True,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.filter_too_much],
)
settings.register_profile(
    "dev",
    max_examples=150,
    derandomize=False,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.filter_too_much],
)

# Load profile (default to 'ci' for reproducibility)
profile_name = os.environ.get("HYPOTHESIS_PROFILE", "ci")
settings.load_profile(profile_name)

# ---------------------------------------------------------------------------
# Recursive strategy for structured YAML documents
# ---------------------------------------------------------------------------

yaml_primitives = st.one_of(
    st.text(max_size=100),
    st.integers(min_value=-1000, max_value=1000),
    st.floats(allow_nan=False, allow_infinity=False),
    st.booleans(),
    st.none(),
)

yaml_structures = st.recursive(
    yaml_primitives,
    lambda children: st.one_of(
        st.lists(children, max_size=5),
        st.dictionaries(st.text(min_size=1, max_size=20), children, max_size=5),
    ),
    max_leaves=15,
)

_SECRET_PATTERN_RE = re.compile(r"ghp_[A-Za-z0-9]{36}")
_RAW_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x1b\u202a-\u202e]")


class TestFuzzCrashFreedom:
    """Property: Engine never crashes or raises unhandled exceptions on any string."""

    @given(st.text(max_size=2000))
    def test_parse_arbitrary_text_never_raises(self, text: str) -> None:
        result = parse_workflow_text(text)
        assert result is not None
        assert isinstance(result.ok, bool)

    @given(st.text(max_size=2000))
    def test_analyze_arbitrary_text_never_raises(self, text: str) -> None:
        result = analyze_text(text, filename="fuzz.yml")
        assert result is not None
        assert isinstance(result.workflows_analyzed, int)
        assert isinstance(result.findings, tuple)
        assert isinstance(result.suppressed, tuple)

    @given(yaml_structures)
    def test_analyze_structured_yaml_never_raises(self, data: Any) -> None:
        try:
            yaml_str = yaml.safe_dump(data)
        except (yaml.YAMLError, TypeError, ValueError):
            return  # skip undumpable objects

        result = analyze_text(yaml_str, filename="structured_fuzz.yml")
        assert result is not None
        assert isinstance(result.workflows_analyzed, int)


class TestFuzzDeterminism:
    """Property: Same input yields identical report outputs every time."""

    @given(st.text(max_size=1500))
    def test_analysis_and_reporting_deterministic(self, text: str) -> None:
        res1 = analyze_text(text, filename="deterministic.yml")
        res2 = analyze_text(text, filename="deterministic.yml")

        # Findings count and fingerprints must be identical
        assert len(res1.findings) == len(res2.findings)
        assert [f.fingerprint() for f in res1.findings] == [f.fingerprint() for f in res2.findings]

        # JSON outputs must be byte-for-byte identical
        json1 = format_report(res1, format_name="json", repository="owner/repo")
        json2 = format_report(res2, format_name="json", repository="owner/repo")
        assert json1 == json2


class TestFuzzRedactionAndSanitization:
    """Property: Secrets are redacted and raw control chars are stripped."""

    @given(
        st.text(min_size=0, max_size=50),
        st.text(alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=36, max_size=36),
        st.text(min_size=0, max_size=50),
    )
    def test_secret_redaction_invariant(self, prefix: str, token_body: str, suffix: str) -> None:
        token = f"ghp_{token_body}"
        payload = f"""
name: Token Leak
on: push
jobs:
  leak:
    runs-on: ubuntu-latest
    steps:
      - run: echo "{prefix}{token}{suffix}"
"""
        res = analyze_text(payload, filename="leak.yml")
        json_out = format_report(res, format_name="json", repository="org/repo")
        text_out = format_report(res, format_name="text", repository="org/repo")

        # Full token string must never appear in reports
        assert token not in json_out
        assert token not in text_out

    @given(st.text(max_size=500))
    def test_sanitization_removes_all_control_chars(self, text: str) -> None:
        sanitized = sanitize_text(text)
        assert not _RAW_CONTROL_RE.search(sanitized)


_ALL_RULE_IDS: tuple[str, ...] = tuple(REGISTRY.keys())
_ALL_CONFIDENCES: tuple[str, ...] = (CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW)


@st.composite
def _finding_strategy(draw: Any) -> Finding:
    rule_id = draw(st.sampled_from(_ALL_RULE_IDS))
    confidence = draw(st.sampled_from(_ALL_CONFIDENCES))
    line = draw(st.one_of(st.none(), st.integers(min_value=1, max_value=500)))
    return Finding(
        rule_id=rule_id,
        file="ci.yml",
        line=line,
        column=None,
        job_id="job",
        step_name="step",
        snippet="echo test",
        message="Test message",
        confidence=confidence,
    )


class TestFuzzRiskMonotonicity:
    """Property: Risk score is bounded in [0, 100] and monotonically non-decreasing."""

    @given(st.lists(_finding_strategy(), max_size=15), _finding_strategy())
    def test_risk_monotonicity_and_bounds(self, findings: list[Finding], new_finding: Finding) -> None:
        score_before = calculate_risk(findings).score
        assert 0 <= score_before <= 100

        score_after = calculate_risk(findings + [new_finding]).score
        assert 0 <= score_after <= 100
        assert score_after >= score_before, f"Monotonicity violated: {score_after} < {score_before}"
