import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from severity import get_severity, get_action, CRITICAL, HIGH, DEFAULT_SEVERITY


def test_private_key_is_critical():
    assert get_severity("private-key") == CRITICAL


def test_aws_access_token_is_high():
    assert get_severity("aws-access-token") == HIGH


def test_github_pat_is_high():
    assert get_severity("github-pat") == HIGH


def test_generic_api_key_is_high():
    # generic-api-key is the catch-all rule that also matches plain
    # "password = ..." / "api_key = ..." style lines, so it is the
    # rule our Password/Credential category relies on.
    assert get_severity("generic-api-key") == HIGH


def test_known_password_rules_are_high():
    for rule_id in ("hashicorp-tf-password", "nuget-config-password", "planetscale-password"):
        assert get_severity(rule_id) == HIGH


def test_unknown_rule_falls_back_to_default_severity():
    assert get_severity("some-rule-not-in-policy") == DEFAULT_SEVERITY


def test_missing_rule_id_falls_back_to_default_severity():
    assert get_severity(None) == DEFAULT_SEVERITY
    assert get_severity("") == DEFAULT_SEVERITY


def test_every_severity_currently_maps_to_block():
    for severity in (CRITICAL, HIGH, DEFAULT_SEVERITY):
        assert get_action(severity) == "BLOCK"
