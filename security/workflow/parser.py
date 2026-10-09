"""Load GitHub Actions workflow YAML into models.

Uses yaml.SafeLoader only. Workflow content is never executed.
PyYAML 1.1 would parse the trigger key `on:` as boolean True; this
loader keeps that key as the string "on" while still parsing
true/false as booleans.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml
from yaml.constructor import ConstructorError
from yaml.nodes import MappingNode

from security.workflow.models import Expression, Job, ParseResult, Step, Workflow

_EXPRESSION_RE = re.compile(r"\$\{\{([\s\S]*?)\}\}")
_CONTEXT_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)")


class WorkflowSafeLoader(yaml.SafeLoader):
    """SafeLoader that does not treat YAML 1.1 on/off/yes/no as booleans."""


# Copy before mutating so we do not change global SafeLoader behaviour.
WorkflowSafeLoader.yaml_implicit_resolvers = {
    first: list(mappings)
    for first, mappings in yaml.SafeLoader.yaml_implicit_resolvers.items()
}

for _first, _mappings in list(WorkflowSafeLoader.yaml_implicit_resolvers.items()):
    WorkflowSafeLoader.yaml_implicit_resolvers[_first] = [
        (tag, regexp)
        for tag, regexp in _mappings
        if tag != "tag:yaml.org,2002:bool"
    ]
    if not WorkflowSafeLoader.yaml_implicit_resolvers[_first]:
        del WorkflowSafeLoader.yaml_implicit_resolvers[_first]

WorkflowSafeLoader.add_implicit_resolver(
    "tag:yaml.org,2002:bool",
    re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"),
    list("tTfF"),
)


class LineCapturingLoader(WorkflowSafeLoader):
    """SafeLoader that records 1-based line numbers for mappings and their keys."""

    def __init__(self, stream: Any) -> None:
        super().__init__(stream)
        self.lines: dict[int, int] = {}
        self.key_lines: dict[int, dict[Any, int]] = {}

    def construct_mapping(self, node: MappingNode, deep: bool = False) -> dict[Any, Any]:
        if not isinstance(node, MappingNode):
            raise ConstructorError(
                None,
                None,
                f"expected a mapping node, but found {node.id}",
                node.start_mark,
            )
        self.flatten_mapping(node)
        mapping: dict[Any, Any] = {}
        key_lines: dict[Any, int] = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            value = self.construct_object(value_node, deep=deep)
            mapping[key] = value
            key_lines[key] = key_node.start_mark.line + 1
            if isinstance(value, dict):
                self.lines[id(value)] = value_node.start_mark.line + 1
        self.lines[id(mapping)] = node.start_mark.line + 1
        self.key_lines[id(mapping)] = key_lines
        return mapping


def parse_workflow(path: str | Path) -> ParseResult:
    """Read a workflow file from disk and parse it. Does not raise on bad YAML."""
    workflow_path = Path(path)
    try:
        text = workflow_path.read_text(encoding="utf-8")
    except OSError as exc:
        return ParseResult(
            workflow=None,
            error=f"Workflow file not found or unreadable: {workflow_path}: {exc}",
        )
    return parse_workflow_text(text, path=str(workflow_path))


def parse_workflow_text(text: str, path: str = "<string>") -> ParseResult:
    """Parse workflow YAML from a string. Does not raise on bad YAML."""
    try:
        data, lines, key_lines = _safe_load_with_lines(text)
    except yaml.YAMLError as exc:
        return ParseResult(workflow=None, error=_format_yaml_error(path, exc))

    if data is None:
        return ParseResult(
            workflow=Workflow(
                path=path,
                name=None,
                on=None,
                permissions=None,
                env={},
                jobs=[],
                expressions=[],
                line=None,
            ),
            error=None,
        )

    if not isinstance(data, dict):
        return ParseResult(
            workflow=None,
            error=f"Malformed workflow YAML in {path}: root document must be a mapping",
        )

    jobs_raw = data.get("jobs")
    if jobs_raw is None:
        jobs: list[Job] = []
    elif not isinstance(jobs_raw, dict):
        return ParseResult(
            workflow=None,
            error=f"Malformed workflow YAML in {path}: 'jobs' must be a mapping",
        )
    else:
        jobs = _parse_jobs(jobs_raw, key_lines.get(id(jobs_raw), {}), lines)

    expressions = _collect_expressions(data, lines.get(id(data)))
    workflow = Workflow(
        path=path,
        name=_optional_str(data.get("name")),
        on=_trigger_value(data),
        permissions=data.get("permissions"),
        env=_as_env(data.get("env")),
        jobs=jobs,
        expressions=expressions,
        line=lines.get(id(data)),
    )
    return ParseResult(workflow=workflow, error=None)


def _safe_load_with_lines(
    text: str,
) -> tuple[Any, dict[int, int], dict[int, dict[Any, int]]]:
    loader = LineCapturingLoader(text)
    try:
        node = loader.get_single_node()
        if node is None:
            return None, loader.lines, loader.key_lines
        data = loader.construct_document(node)
        return data, loader.lines, loader.key_lines
    finally:
        loader.dispose()


def _format_yaml_error(path: str, exc: yaml.YAMLError) -> str:
    line = None
    mark = getattr(exc, "problem_mark", None)
    if mark is not None:
        line = mark.line + 1
    message = f"Malformed workflow YAML in {path}"
    if line is not None:
        message += f" (line {line})"
    message += f": {exc}"
    return message


def _trigger_value(data: dict[Any, Any]) -> Any:
    """Return the GitHub Actions `on` mapping/value.

    After the SafeLoader fix this is keyed as "on". The True fallback is
    only defensive if another loader is used by mistake.
    """
    if "on" in data:
        return data["on"]
    if True in data:
        return data[True]
    return None


def _parse_jobs(
    jobs_raw: dict[Any, Any],
    job_key_lines: dict[Any, int],
    lines: dict[int, int],
) -> list[Job]:
    jobs: list[Job] = []
    for job_id, body in jobs_raw.items():
        job_id_str = str(job_id)
        line = job_key_lines.get(job_id)
        if body is None:
            jobs.append(
                Job(
                    id=job_id_str,
                    name=None,
                    runs_on=None,
                    permissions=None,
                    env={},
                    steps=[],
                    line=line,
                )
            )
            continue
        if not isinstance(body, dict):
            jobs.append(
                Job(
                    id=job_id_str,
                    name=None,
                    runs_on=None,
                    permissions=None,
                    env={},
                    steps=[],
                    line=line,
                )
            )
            continue
        jobs.append(
            Job(
                id=job_id_str,
                name=_optional_str(body.get("name")),
                runs_on=body.get("runs-on"),
                permissions=body.get("permissions"),
                env=_as_env(body.get("env")),
                steps=_parse_steps(body.get("steps"), lines),
                line=line if line is not None else lines.get(id(body)),
                expressions=_collect_expressions(body, line),
            )
        )
    return jobs


def _parse_steps(steps_raw: Any, lines: dict[int, int]) -> list[Step]:
    if steps_raw is None:
        return []
    if not isinstance(steps_raw, list):
        return []
    steps: list[Step] = []
    for item in steps_raw:
        if not isinstance(item, dict):
            continue
        step_line = lines.get(id(item))
        steps.append(
            Step(
                name=_optional_str(item.get("name")),
                uses=_optional_str(item.get("uses")),
                run=_optional_str(item.get("run")),
                env=_as_env(item.get("env")),
                line=step_line,
                expressions=_collect_expressions(item, step_line),
            )
        )
    return steps


def _as_env(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    return {}


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


def _collect_expressions(value: Any, default_line: int | None) -> list[Expression]:
    found: list[Expression] = []
    _walk_expressions(value, default_line, found)
    return found


def _walk_expressions(
    value: Any, line: int | None, found: list[Expression]
) -> None:
    if isinstance(value, str):
        for match in _EXPRESSION_RE.finditer(value):
            inner = match.group(1).strip()
            context_match = _CONTEXT_RE.match(inner)
            context = context_match.group(1) if context_match else None
            found.append(Expression(text=inner, context=context, line=line))
        return
    if isinstance(value, dict):
        for nested in value.values():
            _walk_expressions(nested, line, found)
        return
    if isinstance(value, list):
        for nested in value:
            _walk_expressions(nested, line, found)
