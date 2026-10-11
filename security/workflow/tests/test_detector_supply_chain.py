"""Tests for supply-chain detector (PG-WF-019, PG-WF-020)."""

from __future__ import annotations

from security.workflow.detectors.supply_chain import detect
from security.workflow.models import ParseResult
from security.workflow.parser import parse_workflow_text
from security.workflow.rules import lookup


def test_empty_or_malformed_workflow_does_not_crash() -> None:
    """Empty or unparsed result must return an empty list without raising."""
    res_none = ParseResult(workflow=None, error="Failed to parse")
    assert detect(res_none) == []

    parsed_empty = parse_workflow_text("", path="dummy.yml")
    assert detect(parsed_empty) == []


def test_pg_wf_019_positive_unpinned_actions() -> None:
    """Actions referencing tags, branches, or docker without digest fire PG-WF-019."""
    yaml_text = """
name: Unpinned
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-python@main
      - uses: docker://alpine:latest
      - uses: docker://node
      - uses: org/repo/.github/workflows/reusable.yml@v1
"""
    result = parse_workflow_text(yaml_text, path="unpinned.yml")
    findings = detect(result)
    wf_019 = [f for f in findings if f.rule_id == "PG-WF-019"]
    assert len(wf_019) == 5
    rule = lookup("PG-WF-019")
    assert rule.severity.value == "HIGH"


def test_pg_wf_019_negative_pinned_actions_and_local() -> None:
    """Actions pinned to 40-hex SHA, docker@sha256, or local paths do not fire PG-WF-019."""
    yaml_text = """
name: Pinned
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          persist-credentials: false
      - uses: docker://alpine@sha256:e7d88de73db3d3a94129e7171d79155a3089d7fa0218730b65a4430e3ac59f31
      - uses: ./.github/actions/custom
      - uses: ../relative/local
"""
    result = parse_workflow_text(yaml_text, path="pinned.yml")
    wf_019 = [f for f in detect(result) if f.rule_id == "PG-WF-019"]
    assert wf_019 == []


def test_pg_wf_020_positive_checkout_without_persist_credentials_false() -> None:
    """actions/checkout without persist-credentials: false fires PG-WF-020."""
    yaml_text = """
name: Persist Credentials
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - uses: actions/checkout@v4
        with:
          persist-credentials: true
      - uses: actions/checkout@v3
        with:
          fetch-depth: 1
"""
    result = parse_workflow_text(yaml_text, path="persist.yml")
    findings = detect(result)
    wf_020 = [f for f in findings if f.rule_id == "PG-WF-020"]
    assert len(wf_020) == 3
    rule = lookup("PG-WF-020")
    assert rule.severity.value == "LOW"


def test_pg_wf_020_negative_explicit_persist_credentials_false() -> None:
    """Setting persist-credentials: false (boolean or quoted string) satisfies PG-WF-020."""
    yaml_text = """
name: Safe Checkout
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          persist-credentials: false
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          persist-credentials: "false"
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          persist_credentials: false
"""
    result = parse_workflow_text(yaml_text, path="safe_checkout.yml")
    wf_020 = [f for f in detect(result) if f.rule_id == "PG-WF-020"]
    assert wf_020 == []


def test_supply_chain_findings_deterministic_fingerprint() -> None:
    """Supply chain detector findings produce deterministic fingerprints."""
    yaml_text = """
name: Deter Supply Chain
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
"""
    f1 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    f2 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    assert len(f1) == 2 and len(f2) == 2
    assert [f.fingerprint() for f in f1] == [f.fingerprint() for f in f2]
