"""Dogfood test scanning PipelineGuard's own CI workflow file (Phase 7 Step 8).

Ensures .github/workflows/pipelineguard-ci.yml adheres to the highest hardening standards
and yields zero findings from PipelineGuard's detector suite.
"""

from __future__ import annotations

from pathlib import Path

from security.workflow.api import analyze_path
from security.workflow.parser import parse_workflow

CI_WORKFLOW_PATH = Path(".github/workflows/pipelineguard-ci.yml")


def test_pipelineguard_ci_workflow_exists() -> None:
    """The hardened repository CI workflow must exist."""
    assert CI_WORKFLOW_PATH.is_file(), f"Missing CI workflow at {CI_WORKFLOW_PATH}"


def test_pipelineguard_ci_workflow_yields_zero_findings() -> None:
    """Scanning .github/workflows/pipelineguard-ci.yml must produce zero findings."""
    assert CI_WORKFLOW_PATH.is_file(), f"Workflow not found: {CI_WORKFLOW_PATH}"
    result = analyze_path(CI_WORKFLOW_PATH)
    assert result.workflows_analyzed == 1
    assert result.findings == (), (
        f"PipelineGuard CI workflow produced unexpected findings: "
        f"{[f.rule_id for f in result.findings]}"
    )


def test_pipelineguard_ci_workflow_structure() -> None:
    """Verify hardening structural requirements: SHA pins, persist-credentials, timeout."""
    parsed = parse_workflow(CI_WORKFLOW_PATH)
    assert parsed.ok, f"Failed to parse CI workflow: {parsed.error}"
    assert parsed.workflow is not None

    wf = parsed.workflow
    # Top-level permissions
    assert wf.permissions == {"contents": "read"}

    # Ensure every checkout has persist-credentials: false
    # and every external action has a 40-character commit SHA
    for job in wf.jobs:
        for step in job.steps:
            if step.uses:
                assert "@" in step.uses, f"Action without ref pin in {step.name}: {step.uses}"
                _action, _, ref = step.uses.rpartition("@")
                assert len(ref.strip()) == 40, (
                    f"Action ref in {step.name} is not a 40-character SHA: {step.uses}"
                )
                if "actions/checkout" in step.uses:
                    assert step.with_inputs.get("persist-credentials") is False, (
                        f"Step {step.name} checkout does not set persist-credentials: false"
                    )
