"""Reporting formatters (text, json, sarif) and exit code evaluator.

Formats:
- Text: sanitized against terminal/ANSI injections, grouped by workflow file, severity-sorted.
- JSON: structured with summary counts, findings, suppressions, and per-workflow risk grades.
- SARIF: OASIS SARIF 2.1.0 output compatible with GitHub Code Scanning.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from typing import TYPE_CHECKING, Any

from security.workflow.finding import Finding
from security.workflow.risk import calculate_risk
from security.workflow.rules import REGISTRY, Action, Severity, lookup

if TYPE_CHECKING:
    from security.workflow.analyzer import AnalysisResult
    from security.workflow.config import Config

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

_SARIF_LEVEL_MAP = {
    Severity.CRITICAL: "error",
    Severity.HIGH: "error",
    Severity.MEDIUM: "warning",
    Severity.LOW: "note",
    Severity.INFO: "note",
}

_SEVERITY_ORDER: dict[Severity, int] = {
    Severity.CRITICAL: 5,
    Severity.HIGH: 4,
    Severity.MEDIUM: 3,
    Severity.LOW: 2,
    Severity.INFO: 1,
}


def sanitize_text(text: str) -> str:
    """Strip ANSI escape sequences and non-printable control characters."""
    without_ansi = _ANSI_RE.sub("", text)
    return _CONTROL_CHARS_RE.sub("", without_ansi)


def compute_exit_code(
    result: AnalysisResult,
    config: Config | None = None,
    fail_on: str | None = None,
    baselined_fingerprints: set[str] | frozenset[str] | None = None,
) -> int:
    """Compute the process exit code based on active findings and failure thresholds.

    Exit code policy:
    - 0: Clean scan (or fail_on=never, or all findings baselined)
    - 1: Any unbaselined BLOCK finding present (when fail_on is 'block' or 'warn')
    - 2: Only unbaselined WARN findings present (when fail_on is 'warn')
    - 3: Usage, configuration, or execution errors (handled by caller)

    Args:
        result: The :class:`~security.workflow.analyzer.AnalysisResult`.
        config: Optional analysis configuration.
        fail_on: Override threshold ('block', 'warn', 'never'); defaults to config.fail_on.
        baselined_fingerprints: Fingerprints of known findings to exclude from exit code.

    Returns:
        Integer exit code (0, 1, or 2).
    """
    threshold = (fail_on or (config.fail_on if config else "block")).lower()
    if threshold == "never":
        return 0

    base_set = baselined_fingerprints or set()
    active_findings = [f for f in result.findings if f.fingerprint() not in base_set]
    if not active_findings:
        return 0

    has_block = False
    has_warn = False

    for f in active_findings:
        action = config.get_action(f.rule_id) if config else lookup(f.rule_id).action
        if action == Action.BLOCK:
            has_block = True
            break
        if action == Action.WARN:
            has_warn = True

    if has_block:
        return 1

    if has_warn and threshold == "warn":
        return 2

    return 0


def report_text(
    result: AnalysisResult,
    repository: str = "",
    config: Config | None = None,
    baselined_fingerprints: set[str] | frozenset[str] | None = None,
) -> str:
    """Format analysis results as human-readable, ANSI-sanitized console text.

    Args:
        result: The analysis outcome.
        repository: Optional repository name for headers.
        config: Optional configuration for action/severity overrides.
        baselined_fingerprints: Set of fingerprints marked as baselined.

    Returns:
        Sanitized multi-line report string.
    """
    base_set = baselined_fingerprints or set()
    lines: list[str] = []

    repo_display = f" for repository '{repository}'" if repository else ""
    lines.append(f"PipelineGuard Workflow Security Report{repo_display}")
    lines.append("=" * 60)

    if not result.findings and not result.suppressed:
        lines.append("No security findings detected. Workflows are secure.")
        lines.append(f"Workflows scanned: {result.workflows_analyzed}")
        return "\n".join(lines)

    # Group findings by file
    findings_by_file: dict[str, list[Finding]] = defaultdict(list)
    for f in result.findings:
        findings_by_file[f.file].append(f)

    # Sort files alphabetically
    for file_path in sorted(findings_by_file):
        lines.append("")
        lines.append(f"File: {sanitize_text(file_path)}")
        lines.append("-" * 60)

        file_findings = findings_by_file[file_path]

        def _finding_sort_key(f: Finding) -> tuple[int, int, str]:
            sev = config.get_severity(f.rule_id) if config else lookup(f.rule_id).severity
            return (-_SEVERITY_ORDER.get(sev, 0), f.line or 0, f.rule_id)

        file_findings.sort(key=_finding_sort_key)

        for f in file_findings:
            rule = lookup(f.rule_id)
            sev = config.get_severity(f.rule_id) if config else rule.severity
            act = config.get_action(f.rule_id) if config else rule.action
            is_base = f.fingerprint() in base_set
            base_badge = " [BASELINED]" if is_base else ""

            loc_str = f"line {f.line}" if f.line is not None else "file level"
            header = (
                f"  [{sev.name}] ({act.name}){base_badge} {f.rule_id} "
                f"at {loc_str}: {rule.title}"
            )
            lines.append(sanitize_text(header))

            if f.message:
                lines.append(f"    Message:     {sanitize_text(f.message)}")
            if f.snippet:
                lines.append(f"    Snippet:     {sanitize_text(f.snippet)}")
            if rule.remediation:
                lines.append(f"    Remediation: {sanitize_text(rule.remediation)}")
            lines.append("")

    # Summary counts
    block_count = 0
    warn_count = 0
    sev_counts: dict[str, int] = defaultdict(int)

    for f in result.findings:
        act = config.get_action(f.rule_id) if config else lookup(f.rule_id).action
        sev = config.get_severity(f.rule_id) if config else lookup(f.rule_id).severity
        if act == Action.BLOCK:
            block_count += 1
        elif act == Action.WARN:
            warn_count += 1
        sev_counts[sev.name] += 1

    lines.append("=" * 60)
    lines.append(
        f"Summary: {len(result.findings)} finding(s) "
        f"({block_count} BLOCK, {warn_count} WARN) across {result.workflows_analyzed} workflow(s)"
    )
    sev_summary = ", ".join(
        f"{s.name}: {sev_counts[s.name]}" for s in Severity if sev_counts[s.name] > 0
    )
    if sev_summary:
        lines.append(f"Severities: {sev_summary}")
    if result.suppressed:
        lines.append(f"Suppressed: {len(result.suppressed)} finding(s) with documented rationale")

    return "\n".join(lines)


def report_json(
    result: AnalysisResult,
    repository: str = "",
    config: Config | None = None,
    baselined_fingerprints: set[str] | frozenset[str] | None = None,
) -> str:
    """Format analysis results as deterministic, structured JSON.

    Args:
        result: The analysis outcome.
        repository: Repository identifier.
        config: Optional configuration overrides.
        baselined_fingerprints: Set of fingerprints marked as baselined.

    Returns:
        Indented JSON string with stable key ordering.
    """
    base_set = baselined_fingerprints or set()

    # Per-workflow risk calculation
    findings_by_file: dict[str, list[Finding]] = defaultdict(list)
    for f in result.findings:
        findings_by_file[f.file].append(f)
    for sf in result.suppressed:
        findings_by_file[sf.finding.file].append(sf.finding)

    risk_per_workflow: dict[str, dict[str, Any]] = {}
    for f_path in sorted(findings_by_file):
        file_risk = calculate_risk(findings_by_file[f_path])
        risk_per_workflow[f_path] = {
            "score": file_risk.score,
            "grade": file_risk.grade,
        }

    # Summary counts
    block_count = 0
    warn_count = 0
    sev_counts = {s.name: 0 for s in Severity}

    for f in result.findings:
        act = config.get_action(f.rule_id) if config else lookup(f.rule_id).action
        sev = config.get_severity(f.rule_id) if config else lookup(f.rule_id).severity
        if act == Action.BLOCK:
            block_count += 1
        elif act == Action.WARN:
            warn_count += 1
        sev_counts[sev.name] += 1

    findings_json: list[dict[str, Any]] = []
    for f in result.findings:
        rule = lookup(f.rule_id)
        sev = config.get_severity(f.rule_id) if config else rule.severity
        act = config.get_action(f.rule_id) if config else rule.action
        findings_json.append(
            {
                "rule_id": f.rule_id,
                "title": rule.title,
                "file": f.file,
                "line": f.line,
                "column": f.column,
                "severity": sev.name,
                "action": act.name,
                "confidence": f.confidence,
                "message": sanitize_text(f.message),
                "snippet": sanitize_text(f.snippet),
                "fingerprint": f.fingerprint(),
                "baselined": f.fingerprint() in base_set,
            }
        )

    suppressed_json: list[dict[str, Any]] = []
    for sf in result.suppressed:
        f = sf.finding
        rule = lookup(f.rule_id)
        sev = config.get_severity(f.rule_id) if config else rule.severity
        act = config.get_action(f.rule_id) if config else rule.action
        suppressed_json.append(
            {
                "rule_id": f.rule_id,
                "title": rule.title,
                "file": f.file,
                "line": f.line,
                "severity": sev.name,
                "action": act.name,
                "reason": sanitize_text(sf.reason),
                "fingerprint": f.fingerprint(),
            }
        )

    payload: dict[str, Any] = {
        "schema_version": "1.0.0",
        "repository": repository,
        "workflows_analyzed": result.workflows_analyzed,
        "summary": {
            "total_findings": len(result.findings),
            "active_findings": sum(1 for f in result.findings if f.fingerprint() not in base_set),
            "baselined_findings": sum(1 for f in result.findings if f.fingerprint() in base_set),
            "suppressed_findings": len(result.suppressed),
            "block_count": block_count,
            "warn_count": warn_count,
            "by_severity": sev_counts,
        },
        "risk_per_workflow": risk_per_workflow,
        "findings": findings_json,
        "suppressed": suppressed_json,
    }

    return json.dumps(payload, indent=2)


def report_sarif(
    result: AnalysisResult,
    repository: str = "",
    config: Config | None = None,
    baselined_fingerprints: set[str] | frozenset[str] | None = None,
) -> str:
    """Format analysis results as SARIF 2.1.0 JSON.

    Adheres to the OASIS Static Analysis Results Interchange Format (SARIF) v2.1.0.

    Args:
        result: The analysis outcome.
        repository: Repository name.
        config: Optional configuration overrides.
        baselined_fingerprints: Set of fingerprints marked as baselined.

    Returns:
        Valid SARIF 2.1.0 JSON string.
    """
    base_set = baselined_fingerprints or set()

    # Build driver rules from REGISTRY
    sarif_rules: list[dict[str, Any]] = []
    for rule in sorted(REGISTRY.values(), key=lambda r: r.id):
        sev = config.get_severity(rule.id) if config else rule.severity
        level = _SARIF_LEVEL_MAP.get(sev, "warning")
        sarif_rules.append(
            {
                "id": rule.id,
                "name": rule.id.replace("-", "_"),
                "shortDescription": {"text": rule.title},
                "fullDescription": {"text": rule.description},
                "defaultConfiguration": {"level": level},
                "help": {
                    "text": f"{rule.description}\n\nRemediation:\n{rule.remediation}",
                },
                "properties": {
                    "cwe": rule.cwe,
                    "action": (config.get_action(rule.id) if config else rule.action).name,
                },
            }
        )

    # Build results list
    sarif_results: list[dict[str, Any]] = []
    for f in result.findings:
        sev = config.get_severity(f.rule_id) if config else lookup(f.rule_id).severity
        level = _SARIF_LEVEL_MAP.get(sev, "warning")
        norm_file = f.file.replace("\\", "/")
        start_line = f.line if f.line is not None and f.line > 0 else 1

        sarif_results.append(
            {
                "ruleId": f.rule_id,
                "level": level,
                "message": {"text": sanitize_text(f.message)},
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {
                                "uri": norm_file,
                            },
                            "region": {
                                "startLine": start_line,
                            },
                        }
                    }
                ],
                "partialFingerprints": {
                    "primaryLocationLineHash": f.fingerprint(),
                },
                "properties": {
                    "baselined": f.fingerprint() in base_set,
                },
            }
        )

    sarif_payload: dict[str, Any] = {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "PipelineGuard",
                        "informationUri": "https://pipelineguard.io",
                        "version": "1.0.0",
                        "rules": sarif_rules,
                    }
                },
                "results": sarif_results,
            }
        ],
    }

    return json.dumps(sarif_payload, indent=2)


def format_report(
    result: AnalysisResult,
    format_name: str,
    repository: str = "",
    config: Config | None = None,
    baselined_fingerprints: set[str] | frozenset[str] | None = None,
) -> str:
    """Format analysis result according to requested format ('text', 'json', 'sarif')."""
    fmt = format_name.lower().strip()
    if fmt == "json":
        return report_json(
            result,
            repository=repository,
            config=config,
            baselined_fingerprints=baselined_fingerprints,
        )
    if fmt == "sarif":
        return report_sarif(
            result,
            repository=repository,
            config=config,
            baselined_fingerprints=baselined_fingerprints,
        )
    if fmt == "text":
        return report_text(
            result,
            repository=repository,
            config=config,
            baselined_fingerprints=baselined_fingerprints,
        )
    raise ValueError(f"Unsupported format '{format_name}'. Must be 'text', 'json', or 'sarif'.")
