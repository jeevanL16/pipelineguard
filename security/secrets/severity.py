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
    # Private keys
    "private-key": CRITICAL,
    # Cloud credentials
    "aws-access-token": HIGH,
    # Source control / VCS tokens
    "github-pat": HIGH,
    "github-fine-grained-pat": HIGH,
    # Third-party service tokens
    "stripe-access-token": HIGH,
    # Password / credential rules (Gitleaks ships a handful of
    # service-specific "password" rules; the catch-all for a plain
    # "password = ..." or "api_key = ..." line is generic-api-key
    # below, which already fires on password-style assignments once
    # the value looks sufficiently random).
    "hashicorp-tf-password": HIGH,
    "nuget-config-password": HIGH,
    "planetscale-password": HIGH,
    # Generic, keyword-based detection (access/auth/key/password/
    # secret/token followed by a high-entropy value). This is the
    # rule that catches most plain "password=..." and "api_key=..."
    # style lines that don't match a specific service's format.
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
