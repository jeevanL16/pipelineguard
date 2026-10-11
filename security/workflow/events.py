"""Transform workflow security findings into common PipelineGuard security events.

Events adhere to the standardized PipelineGuard event schema (draft 2020-12)
shared across security modules (secret scanning, workflow detection, policy enforcement).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any

from security.workflow.finding import Finding
from security.workflow.rules import lookup

if TYPE_CHECKING:
    from security.workflow.analyzer import AnalysisResult
    from security.workflow.config import Config

_SCHEMA_PATH = Path(__file__).parent / "schemas" / "pipelineguard-event.schema.json"

_REPO_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?$")


def validate_repository_name(repository: str) -> str:
    """Validate repository name supplied by the caller or CLI.

    Repository names must follow GitHub / Git naming conventions (e.g., 'owner/repo'
    or 'repo-name') and must not originate from untrusted workflow content.

    Args:
        repository: The repository identifier string.

    Returns:
        The validated repository string.

    Raises:
        ValueError: If repository name is invalid, empty, or contains disallowed characters.
    """
    if not isinstance(repository, str) or not repository.strip():
        raise ValueError("Repository name must be a non-empty string")

    cleaned = repository.strip()
    if not _REPO_NAME_RE.match(cleaned):
        raise ValueError(
            f"Invalid repository name '{repository}'. "
            "Must be formatted as 'owner/repo' or 'name' using alphanumeric, dash, dot, or underscore."
        )

    return cleaned


def load_event_schema() -> dict[str, Any]:
    """Load the PipelineGuard event JSON Schema definition.

    Returns:
        A dict representation of the JSON Schema.
    """
    return json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def finding_to_event(
    finding: Finding,
    repository: str,
    *,
    config: Config | None = None,
    status: str = "active",
    timestamp: str | None = None,
    schema_version: str = "1.0.0",
    event_type: str = "workflow_finding",
) -> dict[str, Any]:
    """Convert a single Finding into a PipelineGuard security event dictionary.

    Deterministically generates events without timestamps unless explicitly provided.

    Args:
        finding: The :class:`~security.workflow.finding.Finding` to convert.
        repository: The validated repository name.
        config: Optional configuration providing severity/action overrides.
        status: Event status: 'active', 'suppressed', or 'baselined'.
        timestamp: Optional ISO 8601 timestamp string. If None, omitted for determinism.
        schema_version: Event schema version identifier.
        event_type: The event type name.

    Returns:
        A dictionary matching the PipelineGuard event schema.
    """
    repo = validate_repository_name(repository)

    if config is not None:
        severity = config.get_severity(finding.rule_id).name
        action = config.get_action(finding.rule_id).name
    else:
        rule = lookup(finding.rule_id)
        severity = rule.severity.name
        action = rule.action.name

    event: dict[str, Any] = {
        "schema_version": schema_version,
        "event_type": event_type,
        "source": "workflow-security",
        "severity": severity,
        "repository": repo,
        "file": finding.file,
        "line": finding.line,
        "rule": finding.rule_id,
        "action": action,
        "status": status,
        "fingerprint": finding.fingerprint(),
    }

    if timestamp is not None:
        event["timestamp"] = timestamp

    return event


def to_events(
    result: AnalysisResult,
    repository: str,
    *,
    config: Config | None = None,
    timestamp: str | None = None,
    schema_version: str = "1.0.0",
    event_type: str = "workflow_finding",
) -> list[dict[str, Any]]:
    """Convert an AnalysisResult into a list of PipelineGuard security events.

    Translates active findings to status 'active' and suppressed findings to 'suppressed'.

    Args:
        result: The :class:`~security.workflow.analyzer.AnalysisResult`.
        repository: The repository name.
        config: Optional configuration overrides.
        timestamp: Optional ISO timestamp to include in each event.
        schema_version: Event schema version identifier.
        event_type: The event type name.

    Returns:
        List of serialized event dictionaries.
    """
    repo = validate_repository_name(repository)
    events: list[dict[str, Any]] = []

    for f in result.findings:
        events.append(
            finding_to_event(
                f,
                repo,
                config=config,
                status="active",
                timestamp=timestamp,
                schema_version=schema_version,
                event_type=event_type,
            )
        )

    for sf in result.suppressed:
        events.append(
            finding_to_event(
                sf.finding,
                repo,
                config=config,
                status="suppressed",
                timestamp=timestamp,
                schema_version=schema_version,
                event_type=event_type,
            )
        )

    return events
