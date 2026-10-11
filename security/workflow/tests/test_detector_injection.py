"""Tests for the injection detector (PG-WF-001, PG-WF-002, PG-WF-003)."""

from __future__ import annotations

from security.workflow.detectors.injection import detect
from security.workflow.models import ParseResult
from security.workflow.parser import parse_workflow_text
from security.workflow.rules import lookup


def test_empty_or_malformed_workflow_does_not_crash() -> None:
    """Empty or unparsed result must return an empty list without raising."""
    res_none = ParseResult(workflow=None, error="Failed to parse")
    assert detect(res_none) == []

    parsed_empty = parse_workflow_text("", path="dummy.yml")
    assert detect(parsed_empty) == []


def test_pg_wf_001_positive_untrusted_context_in_run() -> None:
    """Detect direct interpolation of untrusted context in run."""
    yaml_text = """
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Greet
        run: echo "Issue title is ${{ github.event.issue.title }}"
"""
    result = parse_workflow_text(yaml_text, path=".github/workflows/ci.yml")
    findings = detect(result)
    assert len(findings) == 1
    f = findings[0]
    assert f.rule_id == "PG-WF-001"
    assert f.file == ".github/workflows/ci.yml"
    assert f.line is not None
    assert "github.event.issue.title" in f.snippet
    rule = lookup(f.rule_id)
    assert rule.severity.value == "CRITICAL"


def test_pg_wf_001_high_risk_trigger_confidence() -> None:
    """Triggering on pull_request_target flags high risk confidence."""
    yaml_text = """
name: PR Target
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo ${{ github.event.pull_request.title }}
"""
    result = parse_workflow_text(yaml_text, path="pr.yml")
    findings = detect(result)
    assert len(findings) == 1
    assert findings[0].confidence == "HIGH"
    assert "Trigger is high-risk" in findings[0].message


def test_pg_wf_001_negative_safe_context() -> None:
    """Trusted context values like github.sha or github.repository should not fire."""
    yaml_text = """
name: Safe
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Commit ${{ github.sha }} in ${{ github.repository }}"
"""
    result = parse_workflow_text(yaml_text, path="safe.yml")
    assert detect(result) == []


def test_pg_wf_001_negative_env_indirection() -> None:
    """Passing untrusted context via env: and using $ENV_VAR in run: is safe."""
    yaml_text = """
name: Safe Env
on: [issues]
jobs:
  safe:
    runs-on: ubuntu-latest
    steps:
      - name: Print Title
        env:
          TITLE: ${{ github.event.issue.title }}
        run: echo "$TITLE"
"""
    result = parse_workflow_text(yaml_text, path="safe_env.yml")
    assert detect(result) == []


def test_pg_wf_001_evasions_multiline_and_folded() -> None:
    """Detection must work across multiline pipe (|) and folded (>) blocks."""
    yaml_text = """
name: Multiline
on: push
jobs:
  pipe:
    runs-on: ubuntu-latest
    steps:
      - name: Pipe block
        run: |
          set -e
          echo "Processing"
          echo "${{ github.head_ref }}"
      - name: Folded block
        run: >
          echo "Title: ${{ github.event.pull_request.body }}"
"""
    result = parse_workflow_text(yaml_text, path="multiline.yml")
    findings = detect(result)
    assert len(findings) == 2
    rule_ids = [f.rule_id for f in findings]
    assert rule_ids == ["PG-WF-001", "PG-WF-001"]


def test_pg_wf_001_evasions_spacing_and_prefix_forms() -> None:
    """Detect untrusted prefixes like inputs. and github.event.inputs."""
    yaml_text = """
name: Inputs
on: workflow_dispatch
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo ${{   inputs.branch   }}
      - run: echo ${{ github.event.inputs.param }}
      - run: echo ${{ github.event.commits[0].message }}
"""
    result = parse_workflow_text(yaml_text, path="inputs.yml")
    findings = detect(result)
    assert len(findings) == 3
    assert all(f.rule_id == "PG-WF-001" for f in findings)


def test_pg_wf_002_positive_github_script() -> None:
    """Untrusted context inside actions/github-script fires PG-WF-002."""
    yaml_text = """
name: Script
on: issue_comment
jobs:
  comment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v6
        with:
          script: |
            const body = "${{ github.event.comment.body }}";
            console.log(body);
"""
    result = parse_workflow_text(yaml_text, path="script.yml")
    findings = detect(result)
    wf_002 = [f for f in findings if f.rule_id == "PG-WF-002"]
    assert len(wf_002) == 1
    assert wf_002[0].rule_id == "PG-WF-002"
    assert "actions/github-script" in wf_002[0].message


def test_pg_wf_002_negative_safe_github_script() -> None:
    """actions/github-script with no untrusted expressions should not fire."""
    yaml_text = """
name: Script Safe
on: push
jobs:
  comment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v6
        with:
          script: |
            console.log("Safe script");
"""
    result = parse_workflow_text(yaml_text, path="script_safe.yml")
    assert detect(result) == []


def test_pg_wf_003_positive_sink_writes() -> None:
    """Untrusted context written to GITHUB_ENV or GITHUB_OUTPUT fires PG-WF-003."""
    yaml_text = """
name: Env Sink
on: push
jobs:
  sink:
    runs-on: ubuntu-latest
    steps:
      - name: Write to env
        run: echo "TITLE=${{ github.event.issue.title }}" >> $GITHUB_ENV
      - name: Write to output
        run: printf "OUT=%s" "${{ github.event.issue.body }}" >> "$GITHUB_OUTPUT"
"""
    result = parse_workflow_text(yaml_text, path="sink.yml")
    findings = detect(result)
    wf_003 = [f for f in findings if f.rule_id == "PG-WF-003"]
    assert len(wf_003) == 2
    assert all(f.rule_id == "PG-WF-003" for f in wf_003)


def test_pg_wf_003_negative_safe_write() -> None:
    """Writing static strings or trusted context to GITHUB_ENV does not fire PG-WF-003."""
    yaml_text = """
name: Safe Sink
on: push
jobs:
  sink:
    runs-on: ubuntu-latest
    steps:
      - run: echo "COMMIT=${{ github.sha }}" >> $GITHUB_ENV
      - run: echo "BUILD=true" >> "$GITHUB_OUTPUT"
      - name: Untrusted in env only but safe sink
        env:
          TITLE: ${{ github.event.issue.title }}
        run: echo "STATIC=1" >> $GITHUB_ENV
"""
    result = parse_workflow_text(yaml_text, path="safe_sink.yml")
    wf_003 = [f for f in detect(result) if f.rule_id == "PG-WF-003"]
    assert wf_003 == []


def test_injection_findings_deterministic_fingerprint() -> None:
    """Fingerprints of findings must be stable across repeated runs."""
    yaml_text = """
name: Deter
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo ${{ github.event.issue.title }}
"""
    f1 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    f2 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    assert len(f1) == 1 and len(f2) == 1
    assert f1[0].fingerprint() == f2[0].fingerprint()
