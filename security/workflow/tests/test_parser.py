"""Phase 3: YAML parser only. No detector behavior."""

from pathlib import Path

import yaml

from security.workflow.parser import (
    _safe_load_with_lines,
    parse_workflow,
    parse_workflow_text,
)

VALID_WORKFLOW = """
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
env:
  APP_ENV: test
jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    permissions:
      packages: write
    env:
      JOB_ENV: 1
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Echo
        run: echo hello
        env:
          STEP_ENV: x
"""


def test_valid_workflow():
    result = parse_workflow_text(VALID_WORKFLOW, path=".github/workflows/ci.yml")
    assert result.ok
    workflow = result.workflow
    assert workflow is not None
    assert workflow.path == ".github/workflows/ci.yml"
    assert workflow.name == "CI"
    assert workflow.on == {
        "push": {"branches": ["main"]},
        "pull_request": None,
    }
    assert workflow.permissions == {"contents": "read"}
    assert workflow.env == {"APP_ENV": "test"}
    assert len(workflow.jobs) == 1
    job = workflow.jobs[0]
    assert job.id == "build"
    assert job.name == "Build"
    assert job.runs_on == "ubuntu-latest"
    assert job.permissions == {"packages": "write"}
    assert job.env == {"JOB_ENV": 1}
    assert len(job.steps) == 2
    assert job.steps[0].uses == "actions/checkout@v4"
    assert job.steps[0].run is None
    assert job.steps[1].run == "echo hello"
    assert job.steps[1].env == {"STEP_ENV": "x"}
    assert job.line is not None
    assert job.steps[0].line is not None


def test_empty_workflow():
    result = parse_workflow_text("", path="empty.yml")
    assert result.ok
    workflow = result.workflow
    assert workflow is not None
    assert workflow.name is None
    assert workflow.on is None
    assert workflow.jobs == []
    assert workflow.expressions == []


def test_malformed_yaml():
    result = parse_workflow_text("jobs:\n  build: [\n", path="bad.yml")
    assert not result.ok
    assert result.workflow is None
    assert result.error is not None
    assert "Malformed workflow YAML" in result.error
    assert "bad.yml" in result.error


def test_malformed_yaml_does_not_raise():
    result = parse_workflow_text(": : :", path="broken.yml")
    assert not result.ok
    assert result.error is not None


def test_missing_fields():
    result = parse_workflow_text("jobs:\n  only-job:\n    steps:\n      - run: echo\n")
    assert result.ok
    workflow = result.workflow
    assert workflow is not None
    assert workflow.name is None
    assert workflow.on is None
    assert workflow.permissions is None
    assert workflow.env == {}
    job = workflow.jobs[0]
    assert job.runs_on is None
    assert job.name is None
    assert job.steps[0].name is None
    assert job.steps[0].uses is None


def test_multiple_jobs():
    text = """
on: push
jobs:
  first:
    runs-on: ubuntu-latest
    steps:
      - run: echo first
  second:
    runs-on: windows-latest
    steps:
      - run: echo second
"""
    result = parse_workflow_text(text)
    assert result.ok
    assert [job.id for job in result.workflow.jobs] == ["first", "second"]
    assert result.workflow.jobs[0].runs_on == "ubuntu-latest"
    assert result.workflow.jobs[1].runs_on == "windows-latest"


def test_multiple_steps():
    text = """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: pytest
"""
    result = parse_workflow_text(text)
    assert result.ok
    steps = result.workflow.jobs[0].steps
    assert len(steps) == 3
    assert steps[0].uses == "actions/checkout@v4"
    assert steps[1].run == "pip install -r requirements.txt"
    assert steps[2].run == "pytest"


def test_multiline_run_commands():
    text = """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Script
        run: |
          echo line1
          echo line2
"""
    result = parse_workflow_text(text)
    assert result.ok
    run = result.workflow.jobs[0].steps[0].run
    assert run is not None
    assert "echo line1" in run
    assert "echo line2" in run
    assert "\n" in run


def test_permissions_blocks():
    text = """
on: push
permissions: read-all
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - run: echo
"""
    result = parse_workflow_text(text)
    assert result.ok
    assert result.workflow.permissions == "read-all"
    assert result.workflow.jobs[0].permissions == {
        "contents": "read",
        "pull-requests": "write",
    }


def test_expressions_and_contexts():
    text = """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      ACTOR: ${{ github.actor }}
    steps:
      - run: echo "${{ secrets.TOKEN }} ${{ env.ACTOR }}"
      - run: echo ${{ fromJSON(inputs.config) }}
"""
    result = parse_workflow_text(text)
    assert result.ok
    workflow = result.workflow
    contexts = {expr.context for expr in workflow.expressions}
    texts = {expr.text for expr in workflow.expressions}
    assert "github" in contexts
    assert "secrets" in contexts
    assert "env" in contexts
    assert "github.actor" in texts
    assert "secrets.TOKEN" in texts
    assert "env.ACTOR" in texts
    assert any(expr.context == "fromJSON" for expr in workflow.expressions)
    step_contexts = {expr.context for expr in workflow.jobs[0].steps[0].expressions}
    assert step_contexts == {"secrets", "env"}


def test_on_key_not_coerced_to_boolean():
    """GitHub Actions `on:` must stay the key 'on', not YAML 1.1 boolean True."""
    text = """
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
"""
    vanilla = yaml.safe_load(text)
    assert True in vanilla
    assert "on" not in vanilla

    result = parse_workflow_text(text, path="triggers.yml")
    assert result.ok
    workflow = result.workflow
    assert workflow.on == {"push": {"branches": ["main"]}}
    assert workflow.on is not True
    raw, _, _ = _safe_load_with_lines(text)
    assert "on" in raw
    assert True not in raw


def test_true_false_still_parse_as_booleans():
    raw, _, _ = _safe_load_with_lines("continue-on-error: true\n")
    assert raw["continue-on-error"] is True
    raw_false, _, _ = _safe_load_with_lines("continue-on-error: false\n")
    assert raw_false["continue-on-error"] is False


def test_parse_workflow_records_file_path(tmp_path: Path):
    path = tmp_path / "ci.yml"
    path.write_text(VALID_WORKFLOW, encoding="utf-8")
    result = parse_workflow(path)
    assert result.ok
    assert result.workflow.path == str(path)


def test_missing_file_returns_error(tmp_path: Path):
    result = parse_workflow(tmp_path / "missing.yml")
    assert not result.ok
    assert result.workflow is None
    assert "not found" in result.error.lower() or "unreadable" in result.error.lower()


def test_parser_does_not_use_unsafe_yaml_loaders():
    source = Path("security/workflow/parser.py").read_text(encoding="utf-8")
    assert "unsafe_load" not in source
    assert "FullLoader" not in source
    assert "UnsafeLoader" not in source
    assert "yaml.load(" not in source
