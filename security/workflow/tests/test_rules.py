"""Tests for security.workflow.rules: Rule, Severity, Action, REGISTRY, lookup."""

from __future__ import annotations

import pytest

from security.workflow.rules import (
    REGISTRY,
    Action,
    Rule,
    Severity,
    lookup,
    rules_by_severity,
)

# ---------------------------------------------------------------------------
# Severity ordering
# ---------------------------------------------------------------------------


class TestSeverityOrdering:
    def test_critical_gt_high(self) -> None:
        assert Severity.CRITICAL > Severity.HIGH

    def test_high_gt_medium(self) -> None:
        assert Severity.HIGH > Severity.MEDIUM

    def test_medium_gt_low(self) -> None:
        assert Severity.MEDIUM > Severity.LOW

    def test_low_gt_info(self) -> None:
        assert Severity.LOW > Severity.INFO

    def test_equal(self) -> None:
        assert Severity.HIGH == Severity.HIGH

    def test_info_lt_critical(self) -> None:
        assert Severity.INFO < Severity.CRITICAL

    def test_ge(self) -> None:
        assert Severity.CRITICAL >= Severity.CRITICAL
        assert Severity.CRITICAL >= Severity.HIGH

    def test_le(self) -> None:
        assert Severity.INFO <= Severity.INFO
        assert Severity.INFO <= Severity.MEDIUM

    def test_sort_descending(self) -> None:
        severities = [Severity.LOW, Severity.CRITICAL, Severity.INFO, Severity.HIGH]
        ordered = sorted(severities, reverse=True)
        assert ordered == [
            Severity.CRITICAL,
            Severity.HIGH,
            Severity.LOW,
            Severity.INFO,
        ]

    def test_not_comparable_with_string(self) -> None:
        # __gt__ returns NotImplemented; Python does NOT raise TypeError
        # because the reflected operation on str may succeed.  We simply
        # assert that our method returns the sentinel value directly.
        result = Severity.HIGH.__gt__("HIGH")
        assert result is NotImplemented


# ---------------------------------------------------------------------------
# Action enum
# ---------------------------------------------------------------------------


class TestAction:
    def test_values(self) -> None:
        assert Action.BLOCK.value == "BLOCK"
        assert Action.WARN.value == "WARN"

    def test_string_value(self) -> None:
        # In Python 3.11, str(StrEnum-like) returns 'Action.BLOCK'.
        # Use .value to get the bare string.
        assert Action.BLOCK.value == "BLOCK"
        assert Action.WARN.value == "WARN"


# ---------------------------------------------------------------------------
# Rule dataclass
# ---------------------------------------------------------------------------


class TestRule:
    def test_valid_rule_id(self) -> None:
        r = Rule(
            id="PG-WF-099",
            title="Test rule",
            description="A test rule.",
            severity=Severity.LOW,
            action=Action.WARN,
            cwe="CWE-0",
            remediation="Fix it.",
        )
        assert r.id == "PG-WF-099"

    def test_invalid_rule_id_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid rule ID"):
            Rule(
                id="INVALID-001",
                title="Bad",
                description="Bad.",
                severity=Severity.LOW,
                action=Action.WARN,
                cwe="CWE-0",
                remediation="Fix it.",
            )

    def test_rule_is_frozen(self) -> None:
        from dataclasses import FrozenInstanceError
        r = lookup("PG-WF-001")
        with pytest.raises(FrozenInstanceError):
            r.title = "changed"  # type: ignore[misc]


    def test_references_default_empty(self) -> None:
        r = Rule(
            id="PG-WF-098",
            title="No refs",
            description="No refs.",
            severity=Severity.INFO,
            action=Action.WARN,
            cwe="CWE-0",
            remediation="Nothing.",
        )
        assert r.references == ()

    def test_references_stored_as_tuple(self) -> None:
        r = lookup("PG-WF-001")
        assert isinstance(r.references, tuple)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class TestRegistry:
    def test_registry_not_empty(self) -> None:
        assert len(REGISTRY) > 0

    def test_all_ids_unique(self) -> None:
        ids = list(REGISTRY.keys())
        assert len(ids) == len(set(ids))

    def test_all_ids_match_pattern(self) -> None:
        import re
        pattern = re.compile(r"^PG-WF-\d{3}$")
        for rule_id in REGISTRY:
            assert pattern.match(rule_id), f"{rule_id} does not match PG-WF-NNN"

    def test_registry_keys_match_rule_ids(self) -> None:
        for key, rule in REGISTRY.items():
            assert key == rule.id

    def test_known_rules_present(self) -> None:
        for expected_id in ["PG-WF-001", "PG-WF-019", "PG-WF-020"]:
            assert expected_id in REGISTRY, f"{expected_id} missing from registry"

    def test_all_rules_have_nonempty_fields(self) -> None:
        for rule in REGISTRY.values():
            assert rule.title.strip(), f"{rule.id} has empty title"
            assert rule.description.strip(), f"{rule.id} has empty description"
            assert rule.cwe.strip(), f"{rule.id} has empty CWE"
            assert rule.remediation.strip(), f"{rule.id} has empty remediation"

    def test_all_severity_values_valid(self) -> None:
        valid = set(Severity)
        for rule in REGISTRY.values():
            assert rule.severity in valid

    def test_all_action_values_valid(self) -> None:
        valid = set(Action)
        for rule in REGISTRY.values():
            assert rule.action in valid

    def test_duplicate_id_raises_on_construction(self) -> None:
        from security.workflow.rules import _build_registry

        dup_rule = Rule(
            id="PG-WF-001",
            title="Dup",
            description="Dup.",
            severity=Severity.LOW,
            action=Action.WARN,
            cwe="CWE-0",
            remediation="Fix.",
        )
        with pytest.raises(ValueError, match="Duplicate rule ID"):
            _build_registry([dup_rule, dup_rule])


# ---------------------------------------------------------------------------
# lookup()
# ---------------------------------------------------------------------------


class TestLookup:
    def test_lookup_known_id(self) -> None:
        rule = lookup("PG-WF-001")
        assert rule.id == "PG-WF-001"
        assert rule.severity == Severity.CRITICAL
        assert rule.action == Action.BLOCK

    def test_lookup_unknown_id_raises_key_error(self) -> None:
        with pytest.raises(KeyError, match="PG-WF-999"):
            lookup("PG-WF-999")

    def test_lookup_returns_same_object(self) -> None:
        assert lookup("PG-WF-001") is lookup("PG-WF-001")

    def test_lookup_all_registered_rules(self) -> None:
        for rule_id in REGISTRY:
            assert lookup(rule_id).id == rule_id


# ---------------------------------------------------------------------------
# rules_by_severity()
# ---------------------------------------------------------------------------


class TestRulesBySeverity:
    def test_returns_only_matching_severity(self) -> None:
        critical_rules = rules_by_severity(Severity.CRITICAL)
        assert all(r.severity == Severity.CRITICAL for r in critical_rules)

    def test_result_is_sorted_by_id(self) -> None:
        for sev in Severity:
            result = rules_by_severity(sev)
            ids = [r.id for r in result]
            assert ids == sorted(ids), f"Not sorted for severity {sev}"

    def test_no_duplicates(self) -> None:
        for sev in Severity:
            result = rules_by_severity(sev)
            ids = [r.id for r in result]
            assert len(ids) == len(set(ids))

    def test_union_covers_full_registry(self) -> None:
        all_found = {
            r.id
            for sev in Severity
            for r in rules_by_severity(sev)
        }
        assert all_found == set(REGISTRY.keys())

    def test_info_severity_empty_or_list(self) -> None:
        # INFO rules may or may not exist; result must be a list.
        result = rules_by_severity(Severity.INFO)
        assert isinstance(result, list)
