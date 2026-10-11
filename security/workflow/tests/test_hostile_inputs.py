"""Hostile-input test suite for PipelineGuard workflow security analyzer.

Tests security boundaries, parser resilience, denial-of-service protections,
encoding anomalies, hostile YAML tags, and output sanitization against untrusted content.
Every test asserts that inputs either produce structured PG-WF-900 findings or parse
safely, never crashing, hanging, executing arbitrary code, or exposing raw control chars.
"""

from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import patch

from security.workflow.__main__ import main
from security.workflow.analyzer import analyze_paths
from security.workflow.api import analyze_text
from security.workflow.config import Config
from security.workflow.reporter import format_report, sanitize_text


class TestHostileYamlStructures:
    """Tests resilience against hostile YAML structures (alias bombs, nesting, tags, etc.)."""

    def test_alias_bomb_billion_laughs(self) -> None:
        """YAML alias bomb must complete under time budget without memory exhaustion."""
        alias_bomb = """
a: &a ["lol","lol","lol","lol","lol","lol","lol","lol","lol"]
b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]
c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]
d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]
e: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]
name: Alias Bomb
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo *e
"""
        t0 = time.perf_counter()
        result = analyze_text(alias_bomb)
        elapsed = time.perf_counter() - t0

        assert elapsed < 3.0, f"Alias bomb parsing exceeded time limit: {elapsed:.2f}s"
        assert result.workflows_analyzed == 1

    def test_deeply_nested_mappings(self) -> None:
        """Deeply nested structures must not cause RecursionError or crash."""
        depth = 60
        nested_yaml = "name: Nested\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n"
        nested_yaml += "      - run: echo 'deep'\n        env:\n"
        curr_indent = "          "
        for i in range(depth):
            nested_yaml += f"{curr_indent}k{i}:\n"
            curr_indent += "  "
        nested_yaml += f"{curr_indent}val: safe\n"

        t0 = time.perf_counter()
        result = analyze_text(nested_yaml)
        elapsed = time.perf_counter() - t0

        assert elapsed < 2.0
        assert result.workflows_analyzed == 1

    def test_huge_node_count_and_long_lines(self) -> None:
        """Workflows with large counts of mapping keys or long lines must parse boundedly."""
        lines = ["name: Huge", "on: push", "jobs:", "  build:", "    runs-on: ubuntu-latest", "    env:"]
        for i in range(2000):
            lines.append(f"      VAR_{i}: 'value_{i}'")
        # Extremely long run command line
        lines.append("    steps:")
        lines.append("      - run: echo " + "A" * 20000)

        huge_yaml = "\n".join(lines)
        t0 = time.perf_counter()
        result = analyze_text(huge_yaml)
        elapsed = time.perf_counter() - t0

        assert elapsed < 3.0
        assert result.workflows_analyzed == 1

    def test_dangerous_yaml_tags_never_execute(self) -> None:
        """Hostile Python object instantiation tags must be rejected by SafeLoader."""
        hostile_yaml = """
name: Hostile Tags
on: push
jobs:
  exploit:
    runs-on: !!python/object/apply:os.system ["echo hacked"]
    steps:
      - run: !!python/name:subprocess.Popen ["calc"]
"""
        result = analyze_text(hostile_yaml)
        assert len(result.findings) == 1
        assert result.findings[0].rule_id == "PG-WF-900"
        assert "could not determine a constructor" in result.findings[0].message

    def test_duplicate_keys_and_merge_keys(self) -> None:
        """Duplicate mapping keys and merge keys (<<) parse safely without raising."""
        yaml_merge = """
base: &base
  runs-on: ubuntu-latest
  permissions:
    contents: read

name: Merge Keys
on: push
jobs:
  test:
    <<: *base
    dup_key: "first"
    dup_key: "second"
    steps:
      - run: echo "test"
"""
        result = analyze_text(yaml_merge)
        assert result.workflows_analyzed == 1

    def test_non_mapping_root_and_invalid_jobs(self) -> None:
        """Non-mapping root or invalid jobs types must yield structured PG-WF-900."""
        # Root is a sequence
        seq_yaml = "- item1\n- item2\n- item3\n"
        res_seq = analyze_text(seq_yaml)
        assert len(res_seq.findings) == 1
        assert res_seq.findings[0].rule_id == "PG-WF-900"
        assert "root document must be a mapping" in res_seq.findings[0].message

        # Root is scalar
        scalar_yaml = "just a plain string"
        res_scalar = analyze_text(scalar_yaml)
        assert len(res_scalar.findings) == 1
        assert res_scalar.findings[0].rule_id == "PG-WF-900"

        # Jobs is a sequence
        bad_jobs = "name: CI\non: push\njobs:\n  - job1\n  - job2\n"
        res_jobs = analyze_text(bad_jobs)
        assert len(res_jobs.findings) == 1
        assert res_jobs.findings[0].rule_id == "PG-WF-900"
        assert "'jobs' must be a mapping" in res_jobs.findings[0].message

    def test_null_values_and_steps_as_strings(self) -> None:
        """Malformed step items (nulls, raw strings) must not crash detector."""
        null_yaml = """
name: Nulls
on: null
permissions: null
env: null
jobs:
  empty_job: null
  string_steps:
    runs-on: ubuntu-latest
    steps:
      - null
      - "raw string instead of step mapping"
      - run: null
        name: null
"""
        result = analyze_text(null_yaml)
        assert result.workflows_analyzed == 1


class TestHostileFileEncodingAndLimits:
    """Tests file size limits, non-UTF-8 encodings, BOMs, NUL bytes, and line endings."""

    def test_file_over_size_limit_rejected(self, tmp_path: Path) -> None:
        """Files exceeding max_file_size trigger PG-WF-900 limit finding."""
        large_file = tmp_path / "oversized.yml"
        large_file.write_text("name: Large\n" + ("# comment\n" * 5000), encoding="utf-8")

        cfg = Config(max_file_size=1024)  # 1 KB limit
        res = analyze_paths([large_file], scan_root=tmp_path, config=cfg)

        assert len(res.findings) == 1
        f = res.findings[0]
        assert f.rule_id == "PG-WF-900"
        assert "exceeds maximum allowed limit" in f.message

    def test_non_utf8_binary_and_nul_bytes(self, tmp_path: Path) -> None:
        """Non-UTF-8, binary files, and NUL bytes yield PG-WF-900."""
        # Non-UTF8 file
        bin_file = tmp_path / "binary.yml"
        bin_file.write_bytes(b"\x7fELF\x02\x01\x01\x00\xff\xfe\x00\x00")

        res_bin = analyze_paths([bin_file], scan_root=tmp_path, config=Config())
        assert len(res_bin.findings) == 1
        assert res_bin.findings[0].rule_id == "PG-WF-900"
        assert "not valid UTF-8" in res_bin.findings[0].message

        # NUL byte inside YAML
        nul_file = tmp_path / "nul.yml"
        nul_file.write_bytes(b"name: Null\x00Byte\non: push\njobs: {}\n")

        res_nul = analyze_paths([nul_file], scan_root=tmp_path, config=Config())
        assert len(res_nul.findings) == 1
        assert res_nul.findings[0].rule_id == "PG-WF-900"

    def test_utf8_bom_and_mixed_crlf_line_endings(self, tmp_path: Path) -> None:
        """UTF-8 BOM and CRLF/CR mixed line endings parse without crashing."""
        bom_file = tmp_path / "bom.yml"
        bom_file.write_bytes(b"\xef\xbb\xbfname: BOM Test\r\non: push\r\njobs:\r\n  t:\r\n    steps:\r\n      - run: echo ok\r\n")

        res = analyze_paths([bom_file], scan_root=tmp_path, config=Config())
        assert res.workflows_analyzed == 1

    def test_file_count_limit_enforced(self, tmp_path: Path) -> None:
        """Scanning more files than max_file_count generates a PG-WF-900 limit finding."""
        for i in range(15):
            (tmp_path / f"wf_{i}.yml").write_text("name: T\non: push\njobs: {}\n", encoding="utf-8")

        cfg = Config(max_file_count=10)
        res = analyze_paths([tmp_path], scan_root=tmp_path, config=cfg)

        assert any(
            f.rule_id == "PG-WF-900" and "Workflow file count (15) exceeds maximum" in f.message
            for f in res.findings
        )


class TestSymlinkAndPathAttacks:
    """Tests symlink escaping, circular loops, and path traversal defenses."""

    def test_symlink_escaping_scan_root_is_skipped(self, tmp_path: Path) -> None:
        """Symlinks pointing outside scan root must be skipped."""
        scan_dir = tmp_path / "repo"
        scan_dir.mkdir()
        outside_file = tmp_path / "secret_outside.yml"
        outside_file.write_text("name: Outside\non: push\njobs: {}\n", encoding="utf-8")

        symlink_file = scan_dir / "link_to_outside.yml"
        symlink_file.write_text("dummy", encoding="utf-8")

        with patch("pathlib.Path.is_symlink", return_value=True), \
             patch("pathlib.Path.resolve", return_value=outside_file):
            res = analyze_paths([scan_dir], scan_root=scan_dir, config=Config())
            assert res.workflows_analyzed == 0

    def test_symlink_loop_defense(self, tmp_path: Path) -> None:
        """Symlink circular loops must not cause infinite recursion."""
        scan_dir = tmp_path / "repo"
        scan_dir.mkdir()
        loop_dir = scan_dir / "loop"
        loop_dir.mkdir()

        with patch("pathlib.Path.is_symlink", return_value=True), \
             patch("pathlib.Path.resolve", return_value=scan_dir):
            t0 = time.perf_counter()
            res = analyze_paths([scan_dir], scan_root=scan_dir, config=Config())
            elapsed = time.perf_counter() - t0

            assert elapsed < 2.0
            assert res.workflows_analyzed == 0


class TestSanitizationAndTerminalInjections:
    """Tests defense against ANSI escapes, bidi overrides, control characters, and newlines."""

    def test_terminal_control_and_ansi_escape_sanitization(self) -> None:
        """ANSI sequences, bidi overrides, and control characters must be completely stripped."""
        hostile_text = (
            "Clean \x1b[31;1mRED\x1b[0m \x07\x08BELL \u202eREVERSED\u202c "
            "\r\n\tCARRIAGE \x1b]0;Title\x07DONE"
        )
        sanitized = sanitize_text(hostile_text)

        # Must not contain raw escape char \x1b or bell \x07
        assert "\x1b" not in sanitized
        assert "\x07" not in sanitized
        assert "\x08" not in sanitized
        assert "\u202e" not in sanitized
        assert "\u202c" not in sanitized
        assert "RED" in sanitized
        assert "BELL" in sanitized
        assert "REVERSED" in sanitized

    def test_hostile_injections_inside_report_formats(self) -> None:
        """Hostile strings injected into run:, job name, file name are sanitized across formats."""
        hostile_yaml = """
name: "\x1b[31mHostile Name\x1b[0m"
on: push
permissions:
  contents: read
jobs:
  "\x1b[32mJob_Id\x1b[0m":
    runs-on: ubuntu-latest
    steps:
      - name: "\x1b[33mStep\x07Name\x1b[0m"
        run: echo "\x1b[34mProcessing\x07\x1b[0m ${{ github.event.issue.title }}"
"""
        res = analyze_text(hostile_yaml, filename="hostile_\x1b[35mfile\x1b[0m.yml")
        assert len(res.findings) >= 1

        for fmt in ("text", "json", "sarif"):
            report_out = format_report(res, format_name=fmt, repository="org/\x1b[31mrepo\x1b[0m")
            assert "\x1b" not in report_out
            assert "\x07" not in report_out


class TestCliOutputAttacks:
    """Tests CLI defenses against malicious --output paths."""

    def test_output_pointing_to_symlink_refused(self, tmp_path: Path) -> None:
        """--output pointing to a symlink is refused with exit code 3."""
        symlink_out = tmp_path / "symlink_out.txt"
        symlink_out.write_text("existing", encoding="utf-8")

        with patch("pathlib.Path.is_symlink", return_value=True):
            exit_code = main(["scan", str(tmp_path), "--output", str(symlink_out)])
            assert exit_code == 3

    def test_output_pointing_to_existing_directory_refused(self, tmp_path: Path) -> None:
        """--output pointing to an existing directory must be refused with exit code 3."""
        out_dir = tmp_path / "existing_dir"
        out_dir.mkdir()

        exit_code = main(["scan", str(tmp_path), "--output", str(out_dir)])
        assert exit_code == 3
