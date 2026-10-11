"""Tests for artifact_events.py and the tampering event produced by verification."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from artifact_events import build_tamper_event  # noqa: E402
from artifact_verifier import verify_artifact  # noqa: E402

EXPECTED = "a" * 64
ACTUAL = "b" * 64

REQUIRED_FIELDS = {
    "event_id", "event_type", "source", "severity", "repository",
    "branch", "file", "line", "rule", "description", "action",
    "status", "metadata",
}

# Same field set as the Week 4 secrets event (security/secrets/events.py).
SECRETS_EVENT_FIELDS = REQUIRED_FIELDS


def test_event_has_all_schema_fields():
    event = build_tamper_event("dist/app.whl", EXPECTED, ACTUAL, branch="main")
    assert set(event) == SECRETS_EVENT_FIELDS


def test_event_fixed_values():
    event = build_tamper_event("dist/app.whl", EXPECTED, ACTUAL, branch="feature/x")
    assert event["event_type"] == "artifact_tampering"
    assert event["source"] == "artifact-security"
    assert event["severity"] == "CRITICAL"
    assert event["rule"] == "sha256-mismatch"
    assert event["action"] == "BLOCK"
    assert event["status"] == "OPEN"
    assert event["repository"] == "pipelineguard"
    assert event["branch"] == "feature/x"
    assert event["file"] == "dist/app.whl"
    assert event["line"] is None
    assert isinstance(event["description"], str) and event["description"]


def test_event_metadata():
    event = build_tamper_event("dist/app.whl", EXPECTED, ACTUAL, branch="main")
    assert event["metadata"] == {
        "module": "artifact-security",
        "artifact_name": "app.whl",
        "algorithm": "SHA-256",
        "expected_sha256": EXPECTED,
        "actual_sha256": ACTUAL,
        "verification_result": "MISMATCH",
    }


def test_event_ids_are_unique():
    a = build_tamper_event("f", EXPECTED, ACTUAL, branch="main")
    b = build_tamper_event("f", EXPECTED, ACTUAL, branch="main")
    assert a["event_id"] and b["event_id"] and a["event_id"] != b["event_id"]


def test_branch_autodetected_when_missing():
    event = build_tamper_event("f", EXPECTED, ACTUAL)
    assert isinstance(event["branch"], str) and event["branch"]


def test_event_is_json_serializable():
    import json
    json.dumps(build_tamper_event("f", EXPECTED, ACTUAL, branch="main"))


def test_event_from_real_verification(tmp_path):
    f = tmp_path / "release.tar.gz"
    f.write_bytes(b"original")
    expected = "0" * 64
    result = verify_artifact(f, expected, branch="main")
    event = result.event
    assert event["event_type"] == "artifact_tampering"
    assert event["severity"] == "CRITICAL"
    assert event["action"] == "BLOCK"
    assert event["metadata"]["expected_sha256"] == expected
    assert event["metadata"]["actual_sha256"] == result.actual_hash
    assert event["metadata"]["artifact_name"] == "release.tar.gz"


def test_event_never_contains_artifact_contents(tmp_path):
    # Harmless fake "secret-looking" marker, deliberately placed in the artifact.
    marker = "FAKE-CONTENT-MARKER-do-not-leak-0123456789"
    f = tmp_path / "leaky.bin"
    f.write_bytes(f"harmless artifact body {marker}\n".encode())

    event = verify_artifact(f, "0" * 64, branch="main").event

    def flatten(value):
        if isinstance(value, dict):
            for v in value.values():
                yield from flatten(v)
        else:
            yield value

    for value in flatten(event):
        if isinstance(value, str):
            assert marker not in value
            assert "harmless artifact body" not in value


def test_cli_json_and_result_do_not_leak_contents(tmp_path):
    marker = "FAKE-CONTENT-MARKER-abcdef"
    f = tmp_path / "x.bin"
    f.write_bytes(marker.encode())
    result = verify_artifact(f, "0" * 64, branch="main")
    assert marker not in str(result.to_dict())


def test_no_event_for_pass_or_error(tmp_path):
    f = tmp_path / "ok.bin"
    f.write_bytes(b"abc")
    ok = verify_artifact(
        f, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    err = verify_artifact(tmp_path / "missing", EXPECTED)
    assert ok.event is None and err.event is None


def test_tamper_event_matches_secrets_event_schema():
    """The artifact event must expose exactly the fields the Week 4
    secret_exposure event exposes, so the backend can treat them alike."""
    secrets_dir = os.path.join(os.path.dirname(__file__), "..", "..", "secrets")
    source = open(os.path.join(secrets_dir, "events.py"), encoding="utf-8").read()
    for field in REQUIRED_FIELDS:
        assert f'"{field}"' in source, f"secrets events.py lacks field {field}"
