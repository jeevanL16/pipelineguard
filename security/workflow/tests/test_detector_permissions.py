"""Tests for the permissions detector (PG-WF-004, PG-WF-005, PG-WF-006, PG-WF-007)."""

from __future__ import annotations

from security.workflow.detectors.permissions import detect
from security.workflow.models import ParseResult
from security.workflow.parser import parse_workflow_text
from security.workflow.rules import lookup


def test_empty_or_malformed_workflow_does_not_crash() -> None:
    """Empty or unparsed result must return an empty list without raising."""
    res_none = ParseResult(workflow=None, error="Failed to parse")
    assert detect(res_none) == []

    parsed_empty = parse_workflow_text("", path="dummy.yml")
    findings = detect(parsed_empty)
    # Empty workflow has no permissions: block, so PG-WF-004 is expected
    assert all(f.rule_id == "PG-WF-004" for f in findings)


def test_pg_wf_004_positive_missing_permissions() -> None:
    """Workflow without a top-level permissions block triggers PG-WF-004."""
    yaml_text = """
name: No Permissions
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "hello"
"""
    result = parse_workflow_text(yaml_text, path="no_perms.yml")
    findings = detect(result)
    wf_004 = [f for f in findings if f.rule_id == "PG-WF-004"]
    assert len(wf_004) == 1
    assert wf_004[0].rule_id == "PG-WF-004"
    assert "No top-level 'permissions:' block" in wf_004[0].message
    rule = lookup("PG-WF-004")
    assert rule.severity.value == "MEDIUM"


def test_pg_wf_004_negative_explicit_permissions() -> None:
    """Explicit top-level permissions block (e.g. read-all or contents: read) satisfies rule."""
    yaml_text = """
name: Explicit Permissions
on: push
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "safe"
"""
    result = parse_workflow_text(yaml_text, path="explicit_perms.yml")
    wf_004 = [f for f in detect(result) if f.rule_id == "PG-WF-004"]
    assert wf_004 == []

    yaml_text_read_all = """
name: Read All String
on: push
permissions: read-all
jobs:
  b:
    runs-on: ubuntu-latest
    steps:
      - run: echo "ok"
"""
    result2 = parse_workflow_text(yaml_text_read_all, path="read_all.yml")
    assert detect(result2) == []


def test_pg_wf_005_positive_workflow_and_job_write_permissions() -> None:
    """Detect write-all and explicit write scopes at workflow and job levels."""
    yaml_text = """
name: Broad Perms
on: push
permissions: write-all
jobs:
  job1:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
    steps:
      - run: echo "broad"
"""
    result = parse_workflow_text(yaml_text, path="broad.yml")
    findings = detect(result)
    wf_005 = [f for f in findings if f.rule_id == "PG-WF-005"]
    assert len(wf_005) == 2
    rule = lookup("PG-WF-005")
    assert rule.severity.value == "HIGH"


def test_pg_wf_005_negative_read_permissions() -> None:
    """Only read scopes should not trigger PG-WF-005."""
    yaml_text = """
name: Read Perms
on: push
permissions:
  contents: read
  issues: read
jobs:
  j:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - run: echo "ok"
"""
    result = parse_workflow_text(yaml_text, path="read_perms.yml")
    wf_005 = [f for f in detect(result) if f.rule_id == "PG-WF-005"]
    assert wf_005 == []


def test_pg_wf_005_evasion_casing_and_variants() -> None:
    """Detect write_all and uppercase WRITE-ALL."""
    yaml_text = """
name: Variants
on: push
permissions: WRITE_ALL
jobs:
  j:
    runs-on: ubuntu-latest
    permissions:
      deployments: WRITE
    steps:
      - run: echo "variants"
"""
    result = parse_workflow_text(yaml_text, path="variants.yml")
    findings = detect(result)
    wf_005 = [f for f in findings if f.rule_id == "PG-WF-005"]
    assert len(wf_005) == 2


def test_pg_wf_006_positive_pwn_request() -> None:
    """pull_request_target with checkout of PR head ref fires PG-WF-006."""
    yaml_text = """
name: Pwn Request
on: pull_request_target
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
"""
    result = parse_workflow_text(yaml_text, path="pwn.yml")
    findings = detect(result)
    wf_006 = [f for f in findings if f.rule_id == "PG-WF-006"]
    assert len(wf_006) == 1
    assert wf_006[0].rule_id == "PG-WF-006"
    assert "Pwn-request" in wf_006[0].message
    rule = lookup("PG-WF-006")
    assert rule.severity.value == "CRITICAL"


def test_pg_wf_006_evasion_head_ref_and_sha() -> None:
    """Detect ${{ github.head_ref }} and pull_request.head.sha under pull_request_target."""
    yaml_text = """
name: Pwn Variants
on:
  pull_request_target:
permissions: {}
jobs:
  j1:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          ref: "${{ github.head_ref }}"
  j2:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout
        with:
          ref: ${{ github.event.pull_request.head.sha }}
"""
    result = parse_workflow_text(yaml_text, path="pwn_variants.yml")
    findings = detect(result)
    wf_006 = [f for f in findings if f.rule_id == "PG-WF-006"]
    assert len(wf_006) == 2


def test_pg_wf_006_negative_pull_request_trigger() -> None:
    """Normal pull_request trigger checking out head ref is NOT pwn-request."""
    yaml_text = """
name: Normal PR
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}
"""
    result = parse_workflow_text(yaml_text, path="normal_pr.yml")
    wf_006 = [f for f in detect(result) if f.rule_id == "PG-WF-006"]
    assert wf_006 == []


def test_pg_wf_006_negative_target_without_head_checkout() -> None:
    """pull_request_target checking out base branch (default) is safe from pwn-request."""
    yaml_text = """
name: Safe Target
on: pull_request_target
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
"""
    result = parse_workflow_text(yaml_text, path="safe_target.yml")
    wf_006 = [f for f in detect(result) if f.rule_id == "PG-WF-006"]
    assert wf_006 == []


def test_pg_wf_007_positive_secrets_inherit() -> None:
    """secrets: inherit on workflow_call job fires PG-WF-007."""
    yaml_text = """
name: Secrets Inherit
on: push
permissions:
  contents: read
jobs:
  call-workflow:
    uses: org/repo/.github/workflows/reusable.yml@main
    secrets: inherit
"""
    result = parse_workflow_text(yaml_text, path="inherit.yml")
    findings = detect(result)
    wf_007 = [f for f in findings if f.rule_id == "PG-WF-007"]
    assert len(wf_007) == 1
    assert wf_007[0].rule_id == "PG-WF-007"
    assert "secrets: inherit" in wf_007[0].message
    rule = lookup("PG-WF-007")
    assert rule.severity.value == "HIGH"


def test_pg_wf_007_negative_explicit_secrets() -> None:
    """Explicitly mapped secrets or no secrets does not fire PG-WF-007."""
    yaml_text = """
name: Explicit Secrets
on: push
permissions:
  contents: read
jobs:
  call-workflow:
    uses: org/repo/.github/workflows/reusable.yml@main
    secrets:
      token: ${{ secrets.MY_TOKEN }}
"""
    result = parse_workflow_text(yaml_text, path="explicit_secrets.yml")
    wf_007 = [f for f in detect(result) if f.rule_id == "PG-WF-007"]
    assert wf_007 == []


def test_permissions_findings_deterministic_fingerprint() -> None:
    """Permissions findings must generate deterministic fingerprints."""
    yaml_text = """
name: Deter Perms
on: push
permissions: write-all
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo 1
"""
    f1 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    f2 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    assert len(f1) == 1 and len(f2) == 1
    assert f1[0].fingerprint() == f2[0].fingerprint()
