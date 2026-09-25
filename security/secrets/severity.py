"""
PipelineGuard - Secret Severity Policy

Gitleaks does not assign a severity level to its findings, only a
rule ID (for example "aws-access-token" or "private-key"). The
severity levels below are a PipelineGuard project decision, not an
official Gitleaks classification.

This mapping is intentionally simple and can be edited as the
project grows. If a rule is not in the table, it falls back to
DEFAULT_SEVERITY.
"""

CRITICAL = "CRITICAL"
HIGH = "HIGH"
MEDIUM = "MEDIUM"

# PipelineGuard Secret Severity Policy
# Rule ID (as reported by Gitleaks) -> PipelineGuard severity.
SEVERITY_POLICY = {
    "private-key": CRITICAL,
    "aws-access-token": HIGH,
    "github-pat": HIGH,
    "github-fine-grained-pat": HIGH,
    "stripe-access-token": HIGH,
    "generic-api-key": HIGH,
}

# Used when a Gitleaks rule ID is not listed in SEVERITY_POLICY above.
DEFAULT_SEVERITY = MEDIUM

# Every finding currently results in BLOCK. This is kept as a
# variable (not hard-coded in multiple places) so the action policy
# can be made more granular later without hunting through the code.
DEFAULT_ACTION = "BLOCK"


def get_severity(rule_id: str) -> str:
    """
    Return the PipelineGuard severity for a given Gitleaks rule ID.
    Falls back to DEFAULT_SEVERITY for any rule not explicitly listed.
    """
    if not rule_id:
        return DEFAULT_SEVERITY
    return SEVERITY_POLICY.get(rule_id, DEFAULT_SEVERITY)


def get_action(severity: str) -> str:
    """
    Return the PipelineGuard action for a given severity.
    Currently every severity level results in BLOCK; this function
    exists so that changing that decision later is a one-line edit.
    """
    return DEFAULT_ACTION
