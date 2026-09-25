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
    event = build_event(SAMPLE_FINDING)

    assert event["event_type"] == "secret_exposure"
    assert event["source"] == "gitleaks"
    assert event["severity"] == "HIGH"
    assert event["repository"] == "pipelineguard"
    assert event["file"] == SAMPLE_FINDING["File"]
    assert event["line"] == SAMPLE_FINDING["StartLine"]
    assert event["rule"] == "generic-api-key"
    assert event["action"] == "BLOCK"
    assert event["status"] == "OPEN"


def test_event_never_contains_the_actual_secret():
    event = build_event(SAMPLE_FINDING)

    assert "Secret" not in event
    assert "secret" not in event
    for value in event.values():
        if isinstance(value, str):
            assert SAMPLE_FINDING["Secret"] not in value


def test_build_events_handles_empty_list():
    assert build_events([]) == []


def test_build_events_handles_multiple_findings():
    findings = [
        {"RuleID": "private-key", "File": "a.txt", "StartLine": 1},
        {"RuleID": "aws-access-token", "File": "b.txt", "StartLine": 2},
        {"RuleID": "unknown-rule", "File": "c.txt", "StartLine": 3},
    ]

    events = build_events(findings)

    assert len(events) == 3
    assert events[0]["severity"] == "CRITICAL"
    assert events[1]["severity"] == "HIGH"
    assert events[2]["severity"] == "MEDIUM"  # falls back to default
