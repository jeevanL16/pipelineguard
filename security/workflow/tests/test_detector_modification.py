"""Tests for modification & persistence detector (PG-WF-016..018)."""

from __future__ import annotations

from security.workflow.detectors.modification import detect
from security.workflow.models import ParseResult
from security.workflow.parser import parse_workflow_text
from security.workflow.rules import lookup


def test_empty_or_malformed_workflow_does_not_crash() -> None:
    """Empty or unparsed result must return an empty list without raising."""
    res_none = ParseResult(workflow=None, error="Failed to parse")
    assert detect(res_none) == []

    parsed_empty = parse_workflow_text("", path="dummy.yml")
    assert detect(parsed_empty) == []


def test_pg_wf_016_positive_workflow_writes() -> None:
    """Writing to .github/workflows/ via echo/redirect, cp, tee fires PG-WF-016."""
    yaml_text = """
name: Modify Workflows
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: 'echo "name: backdoor" > .github/workflows/pwn.yml'
      - run: cp ./templates/ci.yml .github/workflows/ci.yml
      - run: echo "data" | tee .github/workflows/extra.yml
"""
    result = parse_workflow_text(yaml_text, path="mod.yml")
    findings = detect(result)
    wf_016 = [f for f in findings if f.rule_id == "PG-WF-016"]
    assert len(wf_016) == 3
    rule = lookup("PG-WF-016")
    assert rule.severity.value == "HIGH"


def test_pg_wf_016_negative_safe_writes() -> None:
    """Writing to normal build or dist directories does not fire PG-WF-016."""
    yaml_text = """
name: Safe Writes
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo "build done" > dist/build.log
      - run: cp ./config.json ./build/config.json
"""
    result = parse_workflow_text(yaml_text, path="safe_mod.yml")
    wf_016 = [f for f in detect(result) if f.rule_id == "PG-WF-016"]
    assert wf_016 == []


def test_pg_wf_016_evasion_windows_path_separators() -> None:
    """Detect writes with backslashes .github\\workflows\\."""
    yaml_text = """
name: Windows Slash
on: push
jobs:
  j:
    runs-on: windows-latest
    steps:
      - run: echo "test" > .github\\workflows\\test.yml
"""
    result = parse_workflow_text(yaml_text, path="win.yml")
    findings = detect(result)
    wf_016 = [f for f in findings if f.rule_id == "PG-WF-016"]
    assert len(wf_016) == 1


def test_pg_wf_017_positive_git_push_with_token() -> None:
    """git push or git commit referencing GITHUB_TOKEN fires PG-WF-017."""
    yaml_text = """
name: Git Push Token
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: |
          git config user.name "bot"
          git commit -m "Auto-update"
          git push https://$GITHUB_TOKEN@github.com/org/repo.git
      - run: git push origin main --token ${{ secrets.GITHUB_TOKEN }}
"""
    result = parse_workflow_text(yaml_text, path="push_token.yml")
    findings = detect(result)
    wf_017 = [f for f in findings if f.rule_id == "PG-WF-017"]
    assert len(wf_017) >= 2
    rule = lookup("PG-WF-017")
    assert rule.severity.value == "MEDIUM"


def test_pg_wf_017_negative_git_operations_without_token() -> None:
    """Regular git checkout, status, or push with deploy key does not fire PG-WF-017."""
    yaml_text = """
name: Normal Git
on: push
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: git status
      - run: git checkout -b feature
"""
    result = parse_workflow_text(yaml_text, path="safe_git.yml")
    wf_017 = [f for f in detect(result) if f.rule_id == "PG-WF-017"]
    assert wf_017 == []


def test_pg_wf_018_positive_schedule_cron() -> None:
    """schedule: trigger fires PG-WF-018."""
    yaml_text = """
name: Scheduled Task
on:
  schedule:
    - cron: '0 0 * * *'
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo "cron run"
"""
    result = parse_workflow_text(yaml_text, path="cron.yml")
    findings = detect(result)
    wf_018 = [f for f in findings if f.rule_id == "PG-WF-018"]
    assert len(wf_018) == 1
    rule = lookup("PG-WF-018")
    assert rule.severity.value == "MEDIUM"


def test_pg_wf_018_negative_event_triggers() -> None:
    """Standard push / pull_request / workflow_dispatch triggers do not fire PG-WF-018."""
    yaml_text = """
name: Push Event
on: [push, pull_request]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo "event run"
"""
    result = parse_workflow_text(yaml_text, path="push_event.yml")
    wf_018 = [f for f in detect(result) if f.rule_id == "PG-WF-018"]
    assert wf_018 == []


def test_modification_findings_deterministic_fingerprint() -> None:
    """Modification findings produce deterministic fingerprints."""
    yaml_text = """
name: Deter Mod
on:
  schedule:
    - cron: '0 0 * * *'
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test" > .github/workflows/a.yml
"""
    f1 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    f2 = detect(parse_workflow_text(yaml_text, path="deter.yml"))
    assert len(f1) == 2 and len(f2) == 2
    assert [f.fingerprint() for f in f1] == [f.fingerprint() for f in f2]
