"""Tests for deterministic workflow risk scoring."""

from __future__ import annotations

from security.workflow.finding import (
    CONFIDENCE_HIGH,
    CONFIDENCE_LOW,
    Finding,
)
from security.workflow.models import Workflow
from security.workflow.risk import RiskScore, calculate_risk, score_to_grade


def _make_finding(rule_id: str, confidence: str = CONFIDENCE_HIGH) -> Finding:
    return Finding(
        rule_id=rule_id,
        file="workflow.yml",
        line=1,
        column=None,
        job_id="test",
        step_name="step",
        snippet="snippet",
        message="message",
        confidence=confidence,
    )


class TestRiskBoundaries:
    def test_zero_findings_score_zero_grade_a(self) -> None:
        result = calculate_risk([])
        assert result == RiskScore(score=0, grade="A")

    def test_single_low_finding_score_grade_a(self) -> None:
        # PG-WF-014 is LOW severity
        finding = _make_finding("PG-WF-014")
        result = calculate_risk([finding])
        assert 0 < result.score <= 15
        assert result.grade == "A"

    def test_capped_at_100_grade_f(self) -> None:
        # Many critical findings on pull_request_target
        findings = [_make_finding("PG-WF-001") for _ in range(10)]
        result = calculate_risk(findings, triggers=["pull_request_target"])
        assert result.score == 100
        assert result.grade == "F"

    def test_score_to_grade_thresholds(self) -> None:
        assert score_to_grade(0) == "A"
        assert score_to_grade(15) == "A"
        assert score_to_grade(16) == "B"
        assert score_to_grade(35) == "B"
        assert score_to_grade(36) == "C"
        assert score_to_grade(55) == "C"
        assert score_to_grade(56) == "D"
        assert score_to_grade(75) == "D"
        assert score_to_grade(76) == "F"
        assert score_to_grade(100) == "F"


class TestRiskMonotonicity:
    def test_monotonicity_adding_findings_never_decreases_score(self) -> None:
        """Adding any finding must never lower the score."""
        pool = [
            _make_finding("PG-WF-014", CONFIDENCE_LOW),      # LOW, low conf
            _make_finding("PG-WF-014", CONFIDENCE_HIGH),     # LOW, high conf
            _make_finding("PG-WF-002", CONFIDENCE_HIGH),     # MEDIUM
            _make_finding("PG-WF-008", CONFIDENCE_HIGH),     # HIGH
            _make_finding("PG-WF-001", CONFIDENCE_HIGH),     # CRITICAL
            _make_finding("PG-WF-001", CONFIDENCE_HIGH),     # Another CRITICAL
            _make_finding("PG-WF-001", CONFIDENCE_HIGH),     # Another CRITICAL
        ]

        active: list[Finding] = []
        last_score = 0
        for finding in pool:
            active.append(finding)
            current = calculate_risk(active)
            assert current.score >= last_score, (
                f"Monotonicity violated: adding {finding.rule_id} lowered score "
                f"from {last_score} to {current.score}"
            )
            last_score = current.score


class TestTriggerExposure:
    def test_pull_request_target_higher_than_push(self) -> None:
        finding = _make_finding("PG-WF-001")
        push_risk = calculate_risk([finding], triggers=["push"])
        prt_risk = calculate_risk([finding], triggers=["pull_request_target"])
        assert prt_risk.score > push_risk.score

    def test_issue_comment_higher_than_push(self) -> None:
        finding = _make_finding("PG-WF-001")
        push_risk = calculate_risk([finding], triggers=["push"])
        ic_risk = calculate_risk([finding], triggers=["issue_comment"])
        assert ic_risk.score > push_risk.score

    def test_workflow_run_higher_than_push(self) -> None:
        finding = _make_finding("PG-WF-001")
        push_risk = calculate_risk([finding], triggers=["push"])
        wr_risk = calculate_risk([finding], triggers=["workflow_run"])
        assert wr_risk.score > push_risk.score

    def test_workflow_model_trigger_extraction(self) -> None:
        wf = Workflow(
            path="ci.yml",
            name="CI",
            on=["push", "pull_request_target"],
            permissions=None,
            env={},
            jobs=[],
            expressions=[],
        )
        finding = _make_finding("PG-WF-001")
        model_risk = calculate_risk([finding], triggers=wf)
        list_risk = calculate_risk([finding], triggers=["pull_request_target"])
        assert model_risk.score == list_risk.score

    def test_workflow_dict_trigger_extraction(self) -> None:
        wf = Workflow(
            path="ci.yml",
            name="CI",
            on={"push": {}, "pull_request_target": {"types": ["opened"]}},
            permissions=None,
            env={},
            jobs=[],
            expressions=[],
        )
        finding = _make_finding("PG-WF-001")
        model_risk = calculate_risk([finding], triggers=wf)
        list_risk = calculate_risk([finding], triggers=["pull_request_target"])
        assert model_risk.score == list_risk.score

    def test_workflow_trigger_edge_cases(self) -> None:
        finding = _make_finding("PG-WF-001")
        # on is None
        wf_none = Workflow("c.yml", "C", None, None, {}, [], [])
        assert calculate_risk([finding], triggers=wf_none).score > 0

        # on is single string
        wf_str = Workflow("c.yml", "C", "pull_request_target", None, {}, [], [])
        assert calculate_risk([finding], triggers=wf_str).score == calculate_risk([finding], triggers=["pull_request_target"]).score

        # on is unexpected type (e.g. int)
        wf_int = Workflow("c.yml", "C", 12345, None, {}, [], [])
        assert calculate_risk([finding], triggers=wf_int).score > 0

        # triggers is None directly
        assert calculate_risk([finding], triggers=None).score > 0


class TestConfidenceImpact:
    def test_higher_confidence_yields_greater_or_equal_risk(self) -> None:
        low_conf = [_make_finding("PG-WF-001", CONFIDENCE_LOW)]
        high_conf = [_make_finding("PG-WF-001", CONFIDENCE_HIGH)]

        low_risk = calculate_risk(low_conf)
        high_risk = calculate_risk(high_conf)
        assert high_risk.score > low_risk.score


class TestDeterminism:
    def test_pure_function_deterministic(self) -> None:
        findings = [_make_finding("PG-WF-001"), _make_finding("PG-WF-004")]
        res1 = calculate_risk(findings, triggers=["pull_request_target"])
        res2 = calculate_risk(findings, triggers=["pull_request_target"])
        assert res1 == res2
        assert res1.score == res2.score
        assert res1.grade == res2.grade
