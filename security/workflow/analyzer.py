"""Workflow security analysis orchestrator and path scanner.

Orchestrates running registered detectors on parsed GitHub Actions workflows,
handles internal detector isolation, deduplicates findings, filters suppressions,
enforces security limits, and performs safe recursive filesystem scans.
"""

from __future__ import annotations

import fnmatch
import os
import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import NamedTuple

from security.workflow.config import Config
from security.workflow.detectors import ALL_DETECTORS
from security.workflow.finding import CONFIDENCE_HIGH, Finding
from security.workflow.models import ParseResult, Workflow
from security.workflow.parser import parse_workflow_text

_SUPPRESSION_DIRECTIVE_RE = re.compile(
    r"#\s*pipelineguard-ignore:\s*([A-Za-z0-9_-]+)(?:\s+([^\n\r#]+))?",
    re.IGNORECASE,
)


class SuppressedFinding(NamedTuple):
    """A finding that was suppressed by an explicit workflow comment."""

    finding: Finding
    reason: str


@dataclass(frozen=True)
class AnalysisResult:
    """Result of analyzing one or more workflow definitions.

    Attributes:
        findings: Active, unsuppressed security findings, sorted stably.
        suppressed: Suppressed findings paired with their justification reasons.
        workflows_analyzed: Count of distinct workflows analyzed during this scan.
    """

    findings: Sequence[Finding] = field(default_factory=tuple)
    suppressed: Sequence[SuppressedFinding] = field(default_factory=tuple)
    workflows_analyzed: int = 0

    def __post_init__(self) -> None:
        if not isinstance(self.findings, tuple):
            object.__setattr__(self, "findings", tuple(self.findings))
        if not isinstance(self.suppressed, tuple):
            object.__setattr__(self, "suppressed", tuple(self.suppressed))


def check_suppression(
    lines: list[str],
    line_number: int | None,
    rule_id: str,
    snippet: str = "",
) -> tuple[bool, str | None]:
    """Check if a finding at line_number is suppressed for the given rule_id.

    Looks on the same line and on immediately preceding comment lines.
    A suppression reason is mandatory.

    Returns:
        (matched, reason)
        - (False, None): No directive found for this rule.
        - (True, reason): Valid suppression directive with non-empty reason.
        - (True, None): Directive found but reason was empty or missing (rejected).
    """
    if not lines:
        return False, None

    candidate_indices: list[int] = []

    def _add_candidates(target_idx: int) -> None:
        if 0 <= target_idx < len(lines) and target_idx not in candidate_indices:
            candidate_indices.append(target_idx)
        # Check contiguous preceding comment lines
        idx = target_idx - 1
        while idx >= 0:
            line_text = lines[idx].strip()
            if line_text.startswith("#"):
                if idx not in candidate_indices:
                    candidate_indices.append(idx)
                idx -= 1
            else:
                if (
                    idx == target_idx - 1
                    and "#" in line_text
                    and idx not in candidate_indices
                ):
                    candidate_indices.append(idx)
                break

    if line_number is not None:
        _add_candidates(line_number - 1)

    # Also check around snippet line if snippet is present
    if snippet:
        first_snip_line = snippet.strip().splitlines()[0] if snippet.strip() else ""
        if len(first_snip_line) >= 4:
            for idx, line_text in enumerate(lines):
                if first_snip_line in line_text:
                    _add_candidates(idx)

    found_directive = False
    for c_idx in candidate_indices:
        if c_idx < 0 or c_idx >= len(lines):
            continue
        line_str = lines[c_idx]
        for match in _SUPPRESSION_DIRECTIVE_RE.finditer(line_str):
            matched_rule = match.group(1).upper()
            if matched_rule == rule_id.upper():
                found_directive = True
                raw_reason = match.group(2)
                reason = raw_reason.strip() if raw_reason else None
                if reason:
                    return True, reason

    if found_directive:
        return True, None

    return False, None


def analyze_workflow(
    parse_result: ParseResult,
    config: Config | None = None,
) -> AnalysisResult:
    """Analyze a single parsed workflow with all enabled detectors.

    Catches individual detector exceptions and converts them to PG-WF-901 findings
    without interrupting the scan. If workflow parsing failed, yields a PG-WF-900 finding.

    Args:
        parse_result: The parsed workflow representation.
        config: Analysis configuration; defaults to standard secure configuration.

    Returns:
        An :class:`AnalysisResult` with deduplicated, stably sorted findings and suppressions.
    """
    cfg = config or Config()

    # Handle parse failure
    if not parse_result.ok:
        error_msg = parse_result.error or "Workflow parse error"
        file_path = parse_result.path or (
            parse_result.workflow.path if parse_result.workflow else None
        )
        if not file_path:
            m = re.search(r"in\s+([^\s:(]+)", error_msg)
            file_path = m.group(1) if m else "<unknown>"
        line_num: int | None = None
        line_match = re.search(r"\(line (\d+)\)", error_msg)
        if line_match:
            try:
                line_num = int(line_match.group(1))
            except ValueError:
                line_num = None

        return AnalysisResult(
            findings=(
                Finding(
                    rule_id="PG-WF-900",
                    file=file_path,
                    line=line_num,
                    column=None,
                    job_id=None,
                    step_name=None,
                    snippet="",
                    message=error_msg,
                    confidence=CONFIDENCE_HIGH,
                    evidence={"error": error_msg},
                ),
            ),
            suppressed=(),
            workflows_analyzed=1,
        )

    if parse_result.workflow is None:
        return AnalysisResult(workflows_analyzed=1)

    workflow: Workflow = parse_result.workflow
    file_path = workflow.path

    # Run detectors with crash isolation
    all_findings: list[Finding] = []
    for detector in ALL_DETECTORS:
        try:
            detected = detector(parse_result)
            all_findings.extend(detected)
        except Exception as exc:  # noqa: BLE001 - crash isolation requirement
            detector_name = getattr(detector, "__name__", "unknown_detector")
            # A crash yields a PG-WF-901 finding (no traceback, exception type only)
            all_findings.append(
                Finding(
                    rule_id="PG-WF-901",
                    file=file_path,
                    line=None,
                    column=None,
                    job_id=None,
                    step_name=None,
                    snippet="",
                    message=f"Internal detector error in {detector_name}: {type(exc).__name__}",
                    confidence=CONFIDENCE_HIGH,
                    evidence={"detector": detector_name, "exception_type": type(exc).__name__},
                )
            )

    # Filter findings by config
    filtered_findings: list[Finding] = []
    for f in all_findings:
        if not cfg.is_rule_enabled(f.rule_id):
            continue
        if (
            f.rule_id in ("PG-WF-012", "PG-WF-013", "PG-WF-014")
            and cfg.domain_allowlist
            and any(domain in f.snippet or domain in f.message for domain in cfg.domain_allowlist)
        ):
            continue
        filtered_findings.append(f)

    # Deduplicate findings by stable fingerprint
    seen_fingerprints: set[str] = set()
    deduped_findings: list[Finding] = []
    for f in filtered_findings:
        fp = f.fingerprint()
        if fp not in seen_fingerprints:
            seen_fingerprints.add(fp)
            deduped_findings.append(f)

    # Resolve workflow source lines for suppression checks
    raw_text = parse_result.raw_text
    if raw_text is None:
        try:
            p = Path(file_path)
            if p.is_file():
                raw_text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            raw_text = None
    lines = raw_text.splitlines() if raw_text is not None else []

    active_findings: list[Finding] = []
    suppressed_findings: list[SuppressedFinding] = []

    for f in deduped_findings:
        matched, reason = check_suppression(lines, f.line, f.rule_id, snippet=f.snippet)
        if matched and reason:
            suppressed_findings.append(SuppressedFinding(finding=f, reason=reason))
        else:
            # If suppression matched but reason was missing, it is rejected and reported
            active_findings.append(f)

    # Deterministic stable sorting
    active_findings.sort(key=lambda f: (f.sort_key(), f.fingerprint()))
    suppressed_findings.sort(key=lambda s: (s.finding.sort_key(), s.finding.fingerprint()))

    return AnalysisResult(
        findings=tuple(active_findings),
        suppressed=tuple(suppressed_findings),
        workflows_analyzed=1,
    )


def _is_symlink_escaping(entry: Path, root: Path) -> bool:
    """Return True if entry is a symlink pointing outside root."""
    if not entry.is_symlink():
        return False
    try:
        resolved = entry.resolve()
        resolved_root = root.resolve()
        return not resolved.is_relative_to(resolved_root)
    except (ValueError, OSError):
        return True


def analyze_paths(
    paths: Sequence[str | Path] | str | Path,
    config: Config | None = None,
    scan_root: Path | None = None,
) -> AnalysisResult:
    """Recursively scan and analyze GitHub Actions workflow files.

    Safely resolves files against scan root, rejects symlinks escaping root,
    enforces file count and size limits, flags non-UTF-8 files with PG-WF-900,
    and returns aggregated, deduplicated results.

    Args:
        paths: File path, directory path, or sequence of paths to scan.
        config: Optional configuration overrides and limits.
        scan_root: Optional directory boundary for symlink escaping checks.

    Returns:
        An :class:`AnalysisResult` with all findings across scanned workflows.
    """
    cfg = config or Config()

    if isinstance(paths, (str, Path)):
        paths_list = [Path(paths)]
    else:
        paths_list = [Path(p) for p in paths]

    default_root = scan_root or (paths_list[0].resolve() if paths_list else Path.cwd().resolve())
    if default_root.is_file():
        default_root = default_root.parent

    files_to_scan: list[Path] = []
    limit_findings: list[Finding] = []

    for input_path in paths_list:
        resolved_input = input_path.resolve()
        root_for_item = default_root if scan_root is not None else (
            resolved_input if resolved_input.is_dir() else resolved_input.parent
        )

        if resolved_input.is_file():
            if _is_symlink_escaping(input_path, root_for_item):
                continue
            files_to_scan.append(input_path)
            continue

        if not resolved_input.is_dir():
            continue

        workflows_dir = resolved_input / ".github" / "workflows"
        scan_target = workflows_dir if workflows_dir.is_dir() else resolved_input

        for dirpath, dirnames, filenames in os.walk(scan_target, followlinks=False):
            # Prune directories that are symlinks escaping root
            valid_dirs: list[str] = []
            for d in sorted(dirnames):
                sub_p = Path(dirpath) / d
                if _is_symlink_escaping(sub_p, root_for_item):
                    continue
                valid_dirs.append(d)
            dirnames[:] = valid_dirs

            for fn in sorted(filenames):
                if not fn.endswith((".yml", ".yaml")):
                    continue
                file_p = Path(dirpath) / fn
                if _is_symlink_escaping(file_p, root_for_item):
                    continue
                if cfg.path_excludes:
                    str_path = str(file_p)
                    if any(
                        file_p.match(pat) or fnmatch.fnmatch(str_path, pat)
                        for pat in cfg.path_excludes
                    ):
                        continue
                files_to_scan.append(file_p)

    # Enforce max file count
    if len(files_to_scan) > cfg.max_file_count:
        limit_findings.append(
            Finding(
                rule_id="PG-WF-900",
                file=str(default_root),
                line=None,
                column=None,
                job_id=None,
                step_name=None,
                snippet="",
                message=(
                    f"Workflow file count ({len(files_to_scan)}) exceeds maximum "
                    f"limit of {cfg.max_file_count} files"
                ),
                confidence=CONFIDENCE_HIGH,
                evidence={"limit": cfg.max_file_count, "found": len(files_to_scan)},
            )
        )
        files_to_scan = files_to_scan[: cfg.max_file_count]

    all_findings: list[Finding] = list(limit_findings)
    all_suppressed: list[SuppressedFinding] = []
    workflows_analyzed = 0

    for file_path in files_to_scan:
        str_file = str(file_path)
        try:
            stat_res = file_path.stat()
        except OSError as exc:
            all_findings.append(
                Finding(
                    rule_id="PG-WF-900",
                    file=str_file,
                    line=None,
                    column=None,
                    job_id=None,
                    step_name=None,
                    snippet="",
                    message=f"Failed to access workflow file '{str_file}': {exc}",
                    confidence=CONFIDENCE_HIGH,
                    evidence={"path": str_file},
                )
            )
            continue

        if stat_res.st_size > cfg.max_file_size:
            all_findings.append(
                Finding(
                    rule_id="PG-WF-900",
                    file=str_file,
                    line=None,
                    column=None,
                    job_id=None,
                    step_name=None,
                    snippet="",
                    message=(
                        f"Workflow file '{str_file}' size ({stat_res.st_size} bytes) "
                        f"exceeds maximum allowed limit of {cfg.max_file_size} bytes"
                    ),
                    confidence=CONFIDENCE_HIGH,
                    evidence={"size": stat_res.st_size, "limit": cfg.max_file_size},
                )
            )
            continue

        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            all_findings.append(
                Finding(
                    rule_id="PG-WF-900",
                    file=str_file,
                    line=None,
                    column=None,
                    job_id=None,
                    step_name=None,
                    snippet="",
                    message=f"Workflow file '{str_file}' is not valid UTF-8: {exc}",
                    confidence=CONFIDENCE_HIGH,
                    evidence={"path": str_file},
                )
            )
            continue
        except OSError as exc:
            all_findings.append(
                Finding(
                    rule_id="PG-WF-900",
                    file=str_file,
                    line=None,
                    column=None,
                    job_id=None,
                    step_name=None,
                    snippet="",
                    message=f"Failed to read workflow file '{str_file}': {exc}",
                    confidence=CONFIDENCE_HIGH,
                    evidence={"path": str_file},
                )
            )
            continue

        parsed = parse_workflow_text(content, path=str_file)
        result = analyze_workflow(parsed, config=cfg)
        all_findings.extend(result.findings)
        all_suppressed.extend(result.suppressed)
        workflows_analyzed += 1

    # Deduplicate findings across scanned files by fingerprint
    seen_fps: set[str] = set()
    deduped_findings: list[Finding] = []
    for f in all_findings:
        fp = f.fingerprint()
        if fp not in seen_fps:
            seen_fps.add(fp)
            deduped_findings.append(f)

    deduped_findings.sort(key=lambda f: (f.sort_key(), f.fingerprint()))
    all_suppressed.sort(key=lambda s: (s.finding.sort_key(), s.finding.fingerprint()))

    return AnalysisResult(
        findings=tuple(deduped_findings),
        suppressed=tuple(all_suppressed),
        workflows_analyzed=workflows_analyzed,
    )
