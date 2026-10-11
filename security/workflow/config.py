"""Workflow security configuration models and defaults."""

from __future__ import annotations

from dataclasses import dataclass, field

from security.workflow.rules import Action, Severity


@dataclass(frozen=True)
class Config:
    """Configuration for workflow security analysis."""

    enabled_rules: frozenset[str] | None = None
    disabled_rules: frozenset[str] = field(default_factory=frozenset)
    severity_overrides: dict[str, Severity] = field(default_factory=dict)
    action_overrides: dict[str, Action] = field(default_factory=dict)
    domain_allowlist: tuple[str, ...] = field(default_factory=tuple)
    fail_on: str = "block"
    path_excludes: tuple[str, ...] = field(default_factory=tuple)
    max_file_count: int = 1000
    max_file_size: int = 1_048_576

    def is_rule_enabled(self, rule_id: str) -> bool:
        """Check whether a rule is enabled under this configuration."""
        if rule_id in self.disabled_rules:
            return False
        if self.enabled_rules is not None:
            return rule_id in self.enabled_rules
        return True

    def get_severity(self, rule_id: str) -> Severity:
        """Get the effective severity for a rule."""
        if rule_id in self.severity_overrides:
            return self.severity_overrides[rule_id]
        from security.workflow.rules import lookup

        return lookup(rule_id).severity

    def get_action(self, rule_id: str) -> Action:
        """Get the effective action for a rule."""
        if rule_id in self.action_overrides:
            return self.action_overrides[rule_id]
        from security.workflow.rules import lookup

        return lookup(rule_id).action
