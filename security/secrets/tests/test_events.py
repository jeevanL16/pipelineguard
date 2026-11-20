import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from events import build_event, build_events


SAMPLE_FINDING = {
    "RuleID": "generic-api-key",
    "File": "security/secrets/test/samples/generic_api_key.txt",
    "StartLine": 1,
    "Secret": "sk_test_4Q9m2Kx7Lp1Rw8Ny3Vb6Ht0Zc5J",
}


def test_event_has_expected_shape():
    event = build_event(SAMPLE_FINDING, branch="feature/secrets-artifact")

    assert event["event_type"] == "secret_exposure"
    assert event["source"] == "gitleaks"
    assert event["severity"] == "HIGH"
    assert event["repository"] == "pipelineguard"
    assert event["branch"] == "feature/secrets-artifact"
    assert event["file"] == SAMPLE_FINDING["File"]
    assert event["line"] == SAMPLE_FINDING["StartLine"]
    assert event["rule"] == "generic-api-key"
    assert event["action"] == "BLOCK"
    assert event["status"] == "OPEN"
    assert isinstance(event["description"], str) and event["description"]
    assert event["metadata"] == {
        "module": "secrets-security",
        "detector": "gitleaks",
    }


def test_event_id_is_present_and_unique():
    event_a = build_event(SAMPLE_FINDING, branch="main")
    event_b = build_event(SAMPLE_FINDING, branch="main")

    assert event_a["event_id"]
    assert event_b["event_id"]
    # Two separate findings must not share an event_id, even if
    # everything else about them is identical.
    assert event_a["event_id"] != event_b["event_id"]


def test_branch_defaults_to_detected_value_when_not_supplied():
    # When no branch is passed, build_event must still fill in a
    # non-empty string (either the real git branch or "unknown"),
    # never leave the field missing or None.
    event = build_event(SAMPLE_FINDING)
    assert isinstance(event["branch"], str)
    assert event["branch"] != ""


def test_event_never_contains_the_actual_secret():
    event = build_event(SAMPLE_FINDING, branch="main")

    assert "Secret" not in event
    assert "secret" not in event

    def assert_no_leak(value):
        if isinstance(value, str):
            assert SAMPLE_FINDING["Secret"] not in value
        elif isinstance(value, dict):
            for nested in value.values():
                assert_no_leak(nested)

    for value in event.values():
        assert_no_leak(value)


def test_build_events_handles_empty_list():
    assert build_events([]) == []


def test_build_events_handles_multiple_findings():
    findings = [
        {"RuleID": "private-key", "File": "a.txt", "StartLine": 1},
        {"RuleID": "aws-access-token", "File": "b.txt", "StartLine": 2},
        {"RuleID": "unknown-rule", "File": "c.txt", "StartLine": 3},
    ]

    events = build_events(findings, branch="main")

    assert len(events) == 3
    assert events[0]["severity"] == "CRITICAL"
    assert events[1]["severity"] == "HIGH"
    assert events[2]["severity"] == "MEDIUM"  # falls back to default
    # All events in the same batch share the branch that was
    # detected/passed once for the whole scan.
    assert {event["branch"] for event in events} == {"main"}
    # Every event in a batch must still get its own unique id.
    assert len({event["event_id"] for event in events}) == 3
