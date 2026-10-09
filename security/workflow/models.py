"""Parsed GitHub Actions workflow structures.

These types are filled by the YAML parser. They do not include
security findings; detection runs in a later phase.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Expression:
    """One `${{ ... }}` expression and the leading GitHub context name, if any."""

    text: str
    context: str | None
    line: int | None = None


@dataclass
class Step:
    name: str | None
    uses: str | None
    run: str | None
    env: dict[str, Any]
    line: int | None
    expressions: list[Expression] = field(default_factory=list)


@dataclass
class Job:
    id: str
    name: str | None
    runs_on: Any
    permissions: Any
    env: dict[str, Any]
    steps: list[Step]
    line: int | None
    expressions: list[Expression] = field(default_factory=list)


@dataclass
class Workflow:
    path: str
    name: str | None
    on: Any
    permissions: Any
    env: dict[str, Any]
    jobs: list[Job]
    expressions: list[Expression]
    line: int | None = None


@dataclass(frozen=True)
class ParseResult:
    """Outcome of parsing one workflow file. Never raised as an exception."""

    workflow: Workflow | None
    error: str | None

    @property
    def ok(self) -> bool:
        return self.error is None and self.workflow is not None
