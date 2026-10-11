"""Tests for detection gap review (Phase 7 Step 6).

Covers:
* Composite actions (action.yml / action.yaml) scanning runs.steps
* workflow_call inputs treated as untrusted in injection detector
* env: untrusted expression usage in shell context vs safe assignment
* actions/github-script with script: containing untrusted expressions
* Reusable workflow uses: pinning (PG-WF-019) at job level
"""

from __future__ import annotations

from security.workflow.detectors import commands, injection, supply_chain
from security.workflow.parser import parse_workflow_text


def test_composite_action_injection_and_commands() -> None:
    """Composite action files with runs.steps are parsed and scanned by detectors."""
    composite_yaml = """
name: "Composite Action"
description: "Demonstrates composite action scanning"
inputs:
  username:
    description: "Untrusted user name"
    required: true
runs:
  using: "composite"
  steps:
    - name: Print greeting
      shell: bash
      run: echo "${{ inputs.username }}"
    - name: Fetch helper
      shell: bash
      run: curl https://example.com/helper.sh | bash
    - name: Unpinned step action
      uses: actions/setup-node@v4
"""
    result = parse_workflow_text(composite_yaml, path="action.yml")
    assert result.ok, f"Failed to parse composite action: {result.error}"
    assert result.workflow is not None
    assert len(result.workflow.jobs) == 1
    assert result.workflow.jobs[0].id == "composite-action"

    inj_findings = injection.detect(result)
    cmd_findings = commands.detect(result)
    sc_findings = supply_chain.detect(result)

    assert any(f.rule_id == "PG-WF-001" for f in inj_findings)
    assert any(f.rule_id == "PG-WF-008" for f in cmd_findings)
    assert any(f.rule_id == "PG-WF-019" for f in sc_findings)


def test_workflow_call_inputs_untrusted() -> None:
    """workflow_call inputs accessed via inputs.name or inputs['name'] are untrusted."""
    workflow_yaml = """
name: Reusable Callee
on:
  workflow_call:
    inputs:
      branch:
        required: true
        type: string
permissions:
  contents: read
jobs:
  run-callee:
    runs-on: ubuntu-latest
    steps:
      - name: Dot notation
        run: echo "${{ inputs.branch }}"
      - name: Bracket notation
        run: echo "${{ inputs['branch'] }}"
"""
    result = parse_workflow_text(workflow_yaml, path=".github/workflows/reusable.yml")
    assert result.ok and result.workflow is not None

    findings = injection.detect(result)
    rule_ids = [f.rule_id for f in findings]
    assert rule_ids == ["PG-WF-001", "PG-WF-001"]


def test_env_assigned_vs_unsafe_shell_execution() -> None:
    """Untrusted context assigned to env: is safe; unsafe execution in shell is flagged."""
    safe_yaml = """
name: Safe Env Assignment
on:
  issues:
    types: [opened]
permissions:
  issues: read
jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Safe echo
        env:
          TITLE: ${{ github.event.issue.title }}
        run: |
          echo "Title is: $TITLE"
"""
    result_safe = parse_workflow_text(safe_yaml)
    assert injection.detect(result_safe) == []
    assert commands.detect(result_safe) == []

    unsafe_yaml = """
name: Unsafe Env Execution
on:
  issues:
    types: [opened]
permissions:
  issues: read
jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe subshell execution of env var
        env:
          TITLE: ${{ github.event.issue.title }}
        run: |
          bash -c "$TITLE"
      - name: Unsafe eval of env var
        env:
          BODY: ${{ github.event.issue.body }}
        run: |
          eval "$BODY"
"""
    result_unsafe = parse_workflow_text(unsafe_yaml)
    cmd_findings = commands.detect(result_unsafe)
    assert any(f.rule_id == "PG-WF-010" for f in cmd_findings)


def test_github_script_untrusted_expressions() -> None:
    """actions/github-script script: containing untrusted expressions triggers PG-WF-002."""
    script_yaml = """
name: GitHub Script
on:
  issue_comment:
    types: [created]
permissions:
  issues: read
jobs:
  run-script:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea
        with:
          script: |
            const comment = "${{ github.event.comment.body }}";
            console.log(comment);
"""
    result = parse_workflow_text(script_yaml)
    findings = injection.detect(result)
    assert any(f.rule_id == "PG-WF-002" for f in findings)


def test_reusable_workflow_uses_pinning() -> None:
    """Reusable workflow uses: at job level is checked for 40-char SHA pinning (PG-WF-019)."""
    unpinned_yaml = """
name: Caller Unpinned
on: [push]
permissions:
  contents: read
jobs:
  call:
    uses: octocat/repo/.github/workflows/reusable.yml@main
"""
    res_unpinned = parse_workflow_text(unpinned_yaml)
    findings = supply_chain.detect(res_unpinned)
    assert len(findings) == 1
    assert findings[0].rule_id == "PG-WF-019"
    assert "Reusable workflow" in findings[0].message

    pinned_yaml = """
name: Caller Pinned
on: [push]
permissions:
  contents: read
jobs:
  call:
    uses: octocat/repo/.github/workflows/reusable.yml@b4ffde65f46336ab88eb53be808477a3936bae11
"""
    res_pinned = parse_workflow_text(pinned_yaml)
    assert supply_chain.detect(res_pinned) == []
