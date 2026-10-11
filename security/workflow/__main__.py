"""Command line interface for PipelineGuard workflow security scanner."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import NoReturn

from security.workflow.analyzer import analyze_paths
from security.workflow.config import Config, ConfigError, load_config
from security.workflow.events import validate_repository_name
from security.workflow.reporter import compute_exit_code, format_report, sanitize_text


class PipelineGuardArgumentParser(argparse.ArgumentParser):
    """ArgumentParser that exits with code 3 on usage error, one line to stderr."""

    def error(self, message: str) -> NoReturn:
        sys.stderr.write(f"Error: {message}\n")
        sys.exit(3)


def _load_baseline(baseline_path: Path) -> set[str]:
    if not baseline_path.is_file():
        raise ConfigError(f"Baseline file not found: '{baseline_path}'")
    try:
        content = baseline_path.read_text(encoding="utf-8")
        data = json.loads(content)
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigError(f"Failed to parse baseline JSON file '{baseline_path}': {exc}") from None

    if isinstance(data, list):
        return {str(x) for x in data}
    if isinstance(data, dict):
        fps = data.get("fingerprints", [])
        if isinstance(fps, list):
            return {str(x) for x in fps}
    raise ConfigError(f"Invalid baseline file format in '{baseline_path}'")


def _write_atomic(output_path: Path, content: str) -> None:
    if output_path.is_symlink():
        raise ConfigError(f"Refusing to write output to a symlink: '{output_path}'")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = output_path.with_name(f".tmp_{os.getpid()}_{output_path.name}")
    try:
        tmp_path.write_text(content, encoding="utf-8")
        tmp_path.replace(output_path)
    except OSError as exc:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
        raise ConfigError(f"Failed to write output to '{output_path}': {exc}") from None


def build_parser() -> argparse.ArgumentParser:
    parser = PipelineGuardArgumentParser(
        prog="python -m security.workflow",
        description="PipelineGuard GitHub Actions Workflow Security Scanner",
    )
    subparsers = parser.add_subparsers(dest="command")

    scan_parser = subparsers.add_parser(
        "scan",
        help="Scan workflow files for security vulnerabilities",
    )
    scan_parser.add_argument(
        "paths",
        nargs="+",
        help="Workflow files or directories to scan",
    )
    scan_parser.add_argument(
        "--format",
        choices=["text", "json", "sarif"],
        default="text",
        help="Report output format (default: text)",
    )
    scan_parser.add_argument(
        "--config",
        help="Path to pipelineguard.yml configuration file",
    )
    scan_parser.add_argument(
        "--fail-on",
        choices=["block", "warn", "never"],
        help="Exit code threshold override ('block', 'warn', 'never')",
    )
    scan_parser.add_argument(
        "--output",
        help="Write report to file atomically",
    )
    scan_parser.add_argument(
        "--baseline",
        help="JSON file containing known findings fingerprints to exclude from exit code",
    )
    scan_parser.add_argument(
        "--write-baseline",
        help="Generate a baseline JSON file from current scan findings",
    )
    scan_parser.add_argument(
        "--repository",
        default="repository",
        help="Repository name for reporting and event attribution",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        sys.stderr.write("Error: Subcommand required. Use 'scan <paths...>'.\n")
        return 3

    try:
        # Validate repository
        repo = validate_repository_name(args.repository)

        # Load config
        config = load_config(args.config) if args.config else load_config(None)

        # Fail-on override
        if args.fail_on:
            config = Config(
                enabled_rules=config.enabled_rules,
                disabled_rules=config.disabled_rules,
                severity_overrides=config.severity_overrides,
                action_overrides=config.action_overrides,
                domain_allowlist=config.domain_allowlist,
                fail_on=args.fail_on,
                path_excludes=config.path_excludes,
                max_file_count=config.max_file_count,
                max_file_size=config.max_file_size,
            )

        # Load baseline if specified
        baseline_set: set[str] = set()
        if args.baseline:
            baseline_set = _load_baseline(Path(args.baseline))

        # Perform scan
        result = analyze_paths(args.paths, config=config)

        # Write baseline if requested
        if args.write_baseline:
            baseline_data = {
                "fingerprints": sorted(f.fingerprint() for f in result.findings)
            }
            _write_atomic(
                Path(args.write_baseline),
                json.dumps(baseline_data, indent=2) + "\n",
            )

        # Format report
        report_output = format_report(
            result,
            format_name=args.format,
            repository=repo,
            config=config,
            baselined_fingerprints=baseline_set,
        )

        # Output report
        if args.output:
            _write_atomic(Path(args.output), report_output + "\n")
        else:
            sys.stdout.write(report_output + "\n")

        # Determine exit code
        return compute_exit_code(
            result,
            config=config,
            fail_on=args.fail_on,
            baselined_fingerprints=baseline_set,
        )

    except ConfigError as exc:
        sys.stderr.write(f"Error: {sanitize_text(str(exc))}\n")
        return 3
    except ValueError as exc:
        sys.stderr.write(f"Error: {sanitize_text(str(exc))}\n")
        return 3
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"Error: {sanitize_text(str(exc))}\n")
        return 3


if __name__ == "__main__":
    sys.exit(main())
