"""Tests for artifact_verifier.py and artifact_cli.py. Harmless temp data only."""

import hashlib
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import artifact_cli  # noqa: E402
from artifact_verifier import (  # noqa: E402
    verify_artifact,
    verify_artifact_from_hashes_file,
    load_expected_hash,
    normalize_expected_hash,
    InvalidExpectedHashError,
    PASS,
    BLOCK,
)

SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
WRONG_HASH = "0" * 64


@pytest.fixture
def artifact(tmp_path):
    f = tmp_path / "app-1.0.tar.gz"
    f.write_bytes(b"abc")
    return f


# ---------- success ----------

def test_matching_hash_passes(artifact):
    result = verify_artifact(artifact, SHA256_ABC, branch="main")
    assert result.decision == PASS
    assert result.outcome == "MATCH"
    assert result.verified is True
    assert result.event is None
    assert result.error is None
    assert result.exit_code == 0
    assert result.actual_hash == result.expected_hash == SHA256_ABC


def test_uppercase_and_padded_expected_hash_accepted(artifact):
    result = verify_artifact(artifact, "  " + SHA256_ABC.upper() + "\n")
    assert result.verified is True and result.decision == PASS


# ---------- tampering ----------

def test_modified_artifact_is_blocked(artifact):
    expected = hashlib.sha256(artifact.read_bytes()).hexdigest()
    artifact.write_bytes(b"abc-tampered")

    result = verify_artifact(artifact, expected, branch="main")

    assert result.decision == BLOCK
    assert result.outcome == "MISMATCH"
    assert result.verified is False
    assert result.exit_code == 1
    assert result.expected_hash == expected
    assert result.actual_hash == hashlib.sha256(b"abc-tampered").hexdigest()
    assert result.event is not None


def test_wrong_expected_hash_is_blocked(artifact):
    result = verify_artifact(artifact, WRONG_HASH)
    assert result.decision == BLOCK and result.outcome == "MISMATCH"
    assert result.verified is False


def test_single_byte_modification_detected(artifact):
    expected = SHA256_ABC
    artifact.write_bytes(b"abd")
    assert verify_artifact(artifact, expected).decision == BLOCK


# ---------- fail-safe errors ----------

def test_missing_artifact_fails_safely(tmp_path):
    result = verify_artifact(tmp_path / "nope.bin", SHA256_ABC)
    assert result.decision == BLOCK
    assert result.outcome == "ERROR"
    assert result.verified is False
    assert result.exit_code == 2
    assert result.event is None
    assert "not found" in result.error


def test_directory_as_artifact_fails_safely(tmp_path):
    result = verify_artifact(tmp_path, SHA256_ABC)
    assert result.verified is False and result.decision == BLOCK
    assert result.outcome == "ERROR"


@pytest.mark.parametrize(
    "bad_hash",
    [
        None,
        "",
        "   ",
        "abc",                       # too short
        "g" * 64,                    # not hex
        SHA256_ABC + "00",           # too long
        SHA256_ABC[:-1],             # 63 chars
        "sha256:" + SHA256_ABC,      # prefix not accepted
        12345,
        b"abc",
    ],
)
def test_invalid_or_missing_expected_hash_never_verifies(artifact, bad_hash):
    result = verify_artifact(artifact, bad_hash)
    assert result.verified is False
    assert result.decision == BLOCK
    assert result.outcome == "ERROR"
    assert result.error
    assert result.event is None
    assert result.exit_code == 2


def test_normalize_expected_hash_rejects_bad_values():
    with pytest.raises(InvalidExpectedHashError):
        normalize_expected_hash("not-a-hash")
    assert normalize_expected_hash(SHA256_ABC.upper()) == SHA256_ABC


def test_only_match_is_ever_verified(tmp_path, artifact):
    """verified is True for exactly one situation: a real match."""
    cases = [
        verify_artifact(artifact, SHA256_ABC),             # match
        verify_artifact(artifact, WRONG_HASH),             # mismatch
        verify_artifact(tmp_path / "missing", SHA256_ABC),  # missing
        verify_artifact(artifact, None),                   # no expected hash
        verify_artifact(artifact, "zzz"),                  # malformed
        verify_artifact(None, SHA256_ABC),                 # bad path
    ]
    assert [c.verified for c in cases] == [True, False, False, False, False, False]
    assert [c.decision for c in cases] == [PASS, BLOCK, BLOCK, BLOCK, BLOCK, BLOCK]


def test_to_dict_is_json_serializable(artifact):
    artifact.write_bytes(b"changed")
    result = verify_artifact(artifact, SHA256_ABC, branch="main")
    assert json.loads(json.dumps(result.to_dict()))["decision"] == "BLOCK"


# ---------- trusted hashes file (stored separately) ----------

def test_hashes_file_pass_and_block(tmp_path, artifact):
    trusted = tmp_path / "trusted" / "hashes.sha256"
    trusted.parent.mkdir()
    trusted.write_text(
        "# trusted reference hashes\n"
        f"{WRONG_HASH}  other-artifact.zip\n"
        f"{SHA256_ABC}  {artifact.name}\n"
    )
    assert verify_artifact_from_hashes_file(artifact, trusted).decision == PASS

    artifact.write_bytes(b"tampered")
    result = verify_artifact_from_hashes_file(artifact, trusted)
    assert result.decision == BLOCK and result.outcome == "MISMATCH"


def test_hashes_file_binary_marker_supported(tmp_path, artifact):
    trusted = tmp_path / "h.sha256"
    trusted.write_text(f"{SHA256_ABC} *{artifact.name}\n")
    assert load_expected_hash(trusted, artifact.name) == SHA256_ABC


def test_hashes_file_missing_entry_fails_safely(tmp_path, artifact):
    trusted = tmp_path / "h.sha256"
    trusted.write_text(f"{SHA256_ABC}  something-else.bin\n")
    result = verify_artifact_from_hashes_file(artifact, trusted)
    assert result.verified is False and result.outcome == "ERROR"


def test_hashes_file_missing_fails_safely(tmp_path, artifact):
    result = verify_artifact_from_hashes_file(artifact, tmp_path / "absent.sha256")
    assert result.verified is False and result.outcome == "ERROR"


def test_hashes_file_malformed_entry_fails_safely(tmp_path, artifact):
    trusted = tmp_path / "h.sha256"
    trusted.write_text(f"deadbeef  {artifact.name}\n")
    result = verify_artifact_from_hashes_file(artifact, trusted)
    assert result.verified is False and result.outcome == "ERROR"


# ---------- CLI ----------

def test_cli_hash(artifact, capsys):
    assert artifact_cli.main(["hash", str(artifact)]) == 0
    assert SHA256_ABC in capsys.readouterr().out


def test_cli_hash_missing_file_exit_2(tmp_path, capsys):
    assert artifact_cli.main(["hash", str(tmp_path / "nope")]) == 2


def test_cli_verify_pass_exit_0(artifact, capsys):
    code = artifact_cli.main(["verify", str(artifact), "--expected", SHA256_ABC])
    out = capsys.readouterr().out
    assert code == 0 and "Result: PASS" in out


def test_cli_verify_mismatch_exit_1(artifact, capsys):
    artifact.write_bytes(b"tampered")
    code = artifact_cli.main(["verify", str(artifact), "--expected", SHA256_ABC])
    out = capsys.readouterr().out
    assert code == 1
    assert "Result: BLOCK" in out and "artifact_tampering" in out
    assert "tampered" not in out.replace("artifact_tampering", "")


def test_cli_verify_error_exit_2(tmp_path, capsys):
    code = artifact_cli.main(["verify", str(tmp_path / "nope"), "--expected", SHA256_ABC])
    out = capsys.readouterr().out
    assert code == 2 and "Result: BLOCK" in out


def test_cli_json_output(artifact, capsys):
    artifact.write_bytes(b"tampered")
    code = artifact_cli.main(["verify", str(artifact), "--expected", SHA256_ABC, "--json"])
    payload = json.loads(capsys.readouterr().out)
    assert code == 1
    assert payload["decision"] == "BLOCK"
    assert payload["event"]["event_type"] == "artifact_tampering"
