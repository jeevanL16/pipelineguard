"""
PipelineGuard - Security Event Builder

Converts a raw Gitleaks finding into a PipelineGuard security event:
a small, stable JSON-serializable dictionary. This is the shape that
will later be sent to the PipelineGuard backend/database, so it is
kept independent of Gitleaks' own field names.

The actual secret value is never included in the event.
"""

from severity import get_severity, get_action


def build_event(finding: dict, repository: str = "pipelineguard") -> dict:
    """
    Build a PipelineGuard security event dictionary from one
    Gitleaks finding.

    finding: a single item from Gitleaks' JSON report, e.g.
        {
            "RuleID": "generic-api-key",
            "File": "security/secrets/test/samples/generic_api_key.txt",
            "StartLine": 1,
            "Secret": "sk_test_..."   <- intentionally never read here
        }
    """
    rule_id = finding.get("RuleID")
    severity = get_severity(rule_id)
    action = get_action(severity)

    return {
        "event_type": "secret_exposure",
        "source": "gitleaks",
        "severity": severity,
        "repository": repository,
        "file": finding.get("File"),
        "line": finding.get("StartLine"),
        "rule": rule_id,
        "action": action,
        "status": "OPEN",
    }


def build_events(findings: list, repository: str = "pipelineguard") -> list:
    """
    Build a PipelineGuard security event for every finding in a
    Gitleaks report. Returns an empty list if there are no findings.
    """
    return [build_event(finding, repository) for finding in findings]
