"""PipelineGuard GitHub Actions workflow-security analyzer.

Public surface re-exported for Member 2 / Member 3 integration::

    from security.workflow import analyze_path, analyze_text, to_events
    from security.workflow import Finding, Rule, Severity, Action, lookup, REGISTRY
    from security.workflow import AnalysisResult, SuppressedFinding, Config, ConfigError
    from security.workflow import RiskScore, calculate_risk
"""

from __future__ import annotations

from security.workflow.api import (
    REGISTRY,
    Action,
    AnalysisResult,
    Config,
    ConfigError,
    Finding,
    RiskScore,
    Rule,
    Severity,
    SuppressedFinding,
    analyze_path,
    analyze_text,
    calculate_risk,
    finding_to_event,
    load_config,
    lookup,
    to_events,
    validate_repository_name,
)

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
