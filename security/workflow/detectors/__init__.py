"""Workflow security detectors."""

from security.workflow.detectors import (
    commands,
    injection,
    modification,
    network,
    permissions,
    supply_chain,
)

ALL_DETECTORS = [
    injection.detect,
    permissions.detect,
    commands.detect,
    network.detect,
    modification.detect,
    supply_chain.detect,
]

__all__ = [
    "ALL_DETECTORS",
    "commands",
    "injection",
    "modification",
    "network",
    "permissions",
    "supply_chain",
]
