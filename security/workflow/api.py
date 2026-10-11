"""Public programmatic API for the PipelineGuard workflow security module.

Provides frozen, fully-typed entry points for analyzing workflow files,
directories, or raw in-memory YAML strings, and converting findings to
standardized PipelineGuard events.

Example usage:
    from security.workflow import analyze_path, analyze_text, to_events

    # Analyze a file or directory
    result = analyze_path(".github/workflows/ci.yml")
    for finding in result.findings:
        print(finding.rule_id, finding.file, finding.line, finding.message)

    # Analyze raw workflow text
    text_result = analyze_text("on: push\\njobs: ...")

    # Convert to standard pipelineguard events
    events = to_events(result, repository="org/repo")
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from security.workflow.analyzer import (
    AnalysisResult,
    SuppressedFinding,
    analyze_paths,
    analyze_workflow,
)
from security.workflow.config import Config, ConfigError, load_config
from security.workflow.events import (
    finding_to_event,
    validate_repository_name,
)
from security.workflow.events import (
    to_events as _to_events,
)
from security.workflow.finding import Finding
from security.workflow.parser import parse_workflow_text
from security.workflow.risk import RiskScore, calculate_risk
from security.workflow.rules import (
    REGISTRY,
    Action,
    Rule,
    Severity,
    lookup,
)


def analyze_path(
    path: str | Path,
    config: Config | None = None,
) -> AnalysisResult:
    """Analyze a single workflow file or a directory tree.

    Args:
        path: Path to a workflow YAML file or a directory containing workflows
            (e.g., repository root or .github/workflows directory).
        config: Optional configuration overrides. If None, standard secure configuration is used.

    Returns:
        An :class:`~security.workflow.analyzer.AnalysisResult` containing active and
        suppressed findings, workflow counts, and error records.

    Example:
        >>> from security.workflow.api import analyze_path
        >>> result = analyze_path("tests/fixtures/sample.yml")
        >>> isinstance(result.findings, list)
        True
    """
    cfg = config if config is not None else Config()
    target_path = Path(path)
    return analyze_paths([target_path], config=cfg)


def analyze_text(
    text: str,
    filename: str = "<memory>",
    config: Config | None = None,
) -> AnalysisResult:
    """Analyze workflow content provided as a YAML string in memory.

    Args:
        text: Raw YAML workflow contents.
        filename: Optional label to use as the file path in findings (defaults to '<memory>').
        config: Optional configuration overrides. If None, standard secure configuration is used.

    Returns:
        An :class:`~security.workflow.analyzer.AnalysisResult` containing active and
        suppressed findings.

    Example:
        >>> from security.workflow.api import analyze_text
        >>> result = analyze_text("name: CI\\non: push\\njobs: {}\\n")
        >>> result.workflows_analyzed
        1
    """
    cfg = config if config is not None else Config()
    parse_result = parse_workflow_text(text, path=filename)
    return analyze_workflow(parse_result, config=cfg)


def to_events(
    result: AnalysisResult,
    repository: str,
    *,
    config: Config | None = None,
    timestamp: str | None = None,
) -> list[dict[str, Any]]:
    """Convert an AnalysisResult into standardized PipelineGuard security event dictionaries.

    Converts findings into dictionaries adhering strictly to the PipelineGuard
    JSON Schema draft 2020-12 (without timestamp by default for determinism).

    Args:
        result: The analysis result containing findings to convert.
        repository: Repository identifier (e.g. 'owner/repo'), validated.
        config: Optional configuration with severity/action overrides.
        timestamp: Optional ISO 8601 timestamp string.

    Returns:
        A list of dictionary objects compliant with the PipelineGuard event schema.

    Example:
        >>> from security.workflow.api import analyze_text, to_events
        >>> res = analyze_text("name: CI\\non: push\\njobs: {}\\n")
        >>> events = to_events(res, repository="org/repo")
        >>> isinstance(events, list)
        True
    """
    return _to_events(result, repository, config=config, timestamp=timestamp)


__all__ = [
    "REGISTRY",
    "Action",
    "AnalysisResult",
    "Config",
    "ConfigError",
    "Finding",
    "RiskScore",
    "Rule",
    "Severity",
    "SuppressedFinding",
    "analyze_path",
    "analyze_text",
    "calculate_risk",
    "finding_to_event",
    "load_config",
    "lookup",
    "to_events",
    "validate_repository_name",
]
