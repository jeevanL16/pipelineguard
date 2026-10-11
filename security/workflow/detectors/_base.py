"""Internal shared helpers for PipelineGuard workflow detectors.

Not part of the public API.  Import only within the detectors sub-package.
"""

from __future__ import annotations

from typing import Any

from security.workflow.finding import CONFIDENCE_HIGH, Finding
from security.workflow.models import Workflow


def make_finding(
    *,
    rule_id: str,
    file: str,
    line: int | None,
    column: int | None = None,
    job_id: str | None = None,
    step_name: str | None = None,
    snippet: str,
    message: str,
    confidence: str = CONFIDENCE_HIGH,
    evidence: dict[str, Any] | None = None,
) -> Finding:
    """Construct a :class:`~security.workflow.finding.Finding` with minimal boilerplate.

    Args:
        rule_id: Rule identifier, e.g. ``"PG-WF-001"``.
        file: Workflow file path (repository-relative).
        line: 1-based line number, or ``None``.
        column: 1-based column number, or ``None``.
        job_id: Job ID string, or ``None``.
        step_name: Step name, or ``None``.
        snippet: Short code excerpt.
        message: Human-readable description of this specific instance.
        confidence: ``"HIGH"``, ``"MEDIUM"``, or ``"LOW"``.
        evidence: Rule-specific structured evidence dict.

    Returns:
        A new :class:`~security.workflow.finding.Finding`.
    """
    return Finding(
        rule_id=rule_id,
        file=file,
        line=line,
        column=column,
        job_id=job_id,
        step_name=step_name,
        snippet=snippet,
        message=message,
        confidence=confidence,
        evidence=evidence or {},
    )


def trigger_set(workflow: Workflow) -> frozenset[str]:
    """Extract the set of trigger event names from ``workflow.on``.

    Handles all three YAML forms:

    * ``on: push`` (string)
    * ``on: [push, pull_request]`` (list)
    * ``on: {push: ..., pull_request_target: ...}`` (mapping)

    Args:
        workflow: Parsed :class:`~security.workflow.models.Workflow`.

    Returns:
        Frozen set of trigger name strings (lower-cased).
    """
    on = workflow.on
    if on is None:
        return frozenset()
    if isinstance(on, str):
        return frozenset({on.lower()})
    if isinstance(on, list):
        return frozenset(str(t).lower() for t in on if t is not None)
    if isinstance(on, dict):
        return frozenset(str(k).lower() for k in on)
    return frozenset()
