"""Tests for configuration parsing, validation, and loading."""

from __future__ import annotations

from pathlib import Path

import pytest

from security.workflow.config import Config, ConfigError, load_config, parse_config_dict
from security.workflow.rules import Action, Severity


class TestConfigDefaults:
    def test_default_config(self) -> None:
        cfg = Config()
        assert cfg.fail_on == "block"
        assert cfg.max_file_count == 1000
        assert cfg.max_file_size == 1_048_576
        assert cfg.is_rule_enabled("PG-WF-001") is True
        assert cfg.get_severity("PG-WF-001") == Severity.CRITICAL
        assert cfg.get_action("PG-WF-001") == Action.BLOCK

    def test_load_config_none_returns_defaults(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.chdir(tmp_path)
        cfg = load_config(None)
        assert cfg == Config()


class TestValidConfig:
    def test_full_valid_config(self, tmp_path: Path) -> None:
        yaml_content = """
rules:
  PG-WF-001:
    enabled: false
  PG-WF-002:
    severity: HIGH
    action: WARN
domain_allowlist:
  - internal.corp
fail_on: warn
path_excludes:
  - "*.test.yml"
limits:
  max_file_count: 50
  max_file_size: 50000
"""
        cfg_file = tmp_path / "pipelineguard.yml"
        cfg_file.write_text(yaml_content, encoding="utf-8")

        cfg = load_config(cfg_file)
        assert cfg.is_rule_enabled("PG-WF-001") is False
        assert cfg.is_rule_enabled("PG-WF-002") is True
        assert cfg.get_severity("PG-WF-002") == Severity.HIGH
        assert cfg.get_action("PG-WF-002") == Action.WARN
        assert cfg.domain_allowlist == ("internal.corp",)
        assert cfg.fail_on == "warn"
        assert cfg.path_excludes == ("*.test.yml",)
        assert cfg.max_file_count == 50
        assert cfg.max_file_size == 50000

    def test_network_mapping_format(self) -> None:
        data = {
            "network": {
                "domain_allowlist": ["safe.domain.com"],
            }
        }
        cfg = parse_config_dict(data)
        assert cfg.domain_allowlist == ("safe.domain.com",)

    def test_rule_shorthand_boolean(self) -> None:
        data = {
            "rules": {
                "PG-WF-001": False,
            }
        }
        cfg = parse_config_dict(data)
        assert cfg.is_rule_enabled("PG-WF-001") is False


class TestInvalidConfigCases:
    def test_unknown_top_level_key(self) -> None:
        with pytest.raises(ConfigError, match="Unknown configuration key: 'random_key'"):
            parse_config_dict({"random_key": 123})

    def test_non_mapping_root(self) -> None:
        with pytest.raises(ConfigError, match="Configuration root must be a mapping"):
            parse_config_dict(["not", "a", "dict"])

    def test_unknown_rule_id(self) -> None:
        with pytest.raises(ConfigError, match="Unknown rule ID in 'rules': 'UNKNOWN-RULE'"):
            parse_config_dict({"rules": {"UNKNOWN-RULE": {"enabled": False}}})

    def test_unknown_key_in_rule(self) -> None:
        with pytest.raises(ConfigError, match="Unknown key in rule 'PG-WF-001' configuration: 'bad_key'"):
            parse_config_dict({"rules": {"PG-WF-001": {"bad_key": 123}}})

    def test_invalid_rule_enabled_type(self) -> None:
        with pytest.raises(ConfigError, match="'enabled' in rule 'PG-WF-001' must be a boolean"):
            parse_config_dict({"rules": {"PG-WF-001": {"enabled": "yes"}}})

    def test_invalid_rule_severity_value(self) -> None:
        with pytest.raises(ConfigError, match="Invalid severity 'EXTREME' for rule 'PG-WF-001'"):
            parse_config_dict({"rules": {"PG-WF-001": {"severity": "EXTREME"}}})

    def test_invalid_rule_action_value(self) -> None:
        with pytest.raises(ConfigError, match="Invalid action 'IGNORE' for rule 'PG-WF-001'"):
            parse_config_dict({"rules": {"PG-WF-001": {"action": "IGNORE"}}})

    def test_invalid_fail_on_value(self) -> None:
        with pytest.raises(ConfigError, match="Invalid 'fail_on' value: 'always'"):
            parse_config_dict({"fail_on": "always"})

    def test_invalid_domain_allowlist_type(self) -> None:
        with pytest.raises(ConfigError, match="'domain_allowlist' must be a list of domain strings"):
            parse_config_dict({"domain_allowlist": "not-a-list"})

    def test_unknown_key_in_network(self) -> None:
        with pytest.raises(ConfigError, match="Unknown key in 'network': 'extra'"):
            parse_config_dict({"network": {"extra": 123}})

    def test_unknown_key_in_limits(self) -> None:
        with pytest.raises(ConfigError, match="Unknown key in 'limits': 'timeout'"):
            parse_config_dict({"limits": {"timeout": 30}})

    def test_invalid_max_file_count_type(self) -> None:
        with pytest.raises(ConfigError, match="'max_file_count' in 'limits' must be a positive integer"):
            parse_config_dict({"limits": {"max_file_count": -5}})

    def test_invalid_max_file_size_type(self) -> None:
        with pytest.raises(ConfigError, match="'max_file_size' must be a positive integer"):
            parse_config_dict({"max_file_size": 0})

    def test_invalid_path_excludes_type(self) -> None:
        with pytest.raises(ConfigError, match="'path_excludes' must be a list of non-empty glob strings"):
            parse_config_dict({"path_excludes": [123]})

    def test_config_file_not_found(self, tmp_path: Path) -> None:
        with pytest.raises(ConfigError, match="Configuration file not found"):
            load_config(tmp_path / "missing.yml")

    def test_oversized_config_file(self, tmp_path: Path) -> None:
        big_file = tmp_path / "big_config.yml"
        big_file.write_text("rules: {}\n" + "# padding\n" * 7000, encoding="utf-8")
        with pytest.raises(ConfigError, match="exceeds limit of 65536 bytes"):
            load_config(big_file)

    def test_non_utf8_config_file(self, tmp_path: Path) -> None:
        bad_file = tmp_path / "bad_encoding.yml"
        bad_file.write_bytes(b"\xff\xfe\x00\x00")
        with pytest.raises(ConfigError, match="not valid UTF-8"):
            load_config(bad_file)

    def test_malformed_yaml_config_file(self, tmp_path: Path) -> None:
        bad_yaml = tmp_path / "bad.yml"
        bad_yaml.write_text("rules: [ unclosed {", encoding="utf-8")
        with pytest.raises(ConfigError, match="Malformed YAML"):
            load_config(bad_yaml)

    def test_config_error_exit_code(self) -> None:
        assert ConfigError.exit_code == 3
        err = ConfigError("test")
        assert err.exit_code == 3

    def test_parse_config_dict_none(self) -> None:
        cfg = parse_config_dict(None)
        assert cfg == Config()

    def test_invalid_rules_type(self) -> None:
        with pytest.raises(ConfigError, match="'rules' must be a mapping"):
            parse_config_dict({"rules": "not-a-dict"})

    def test_invalid_rule_config_type(self) -> None:
        with pytest.raises(ConfigError, match="must be a mapping or boolean"):
            parse_config_dict({"rules": {"PG-WF-001": 123}})

    def test_invalid_rule_severity_type(self) -> None:
        with pytest.raises(ConfigError, match="'severity' in rule 'PG-WF-001' must be a string"):
            parse_config_dict({"rules": {"PG-WF-001": {"severity": 123}}})

    def test_invalid_rule_action_type(self) -> None:
        with pytest.raises(ConfigError, match="'action' in rule 'PG-WF-001' must be a string"):
            parse_config_dict({"rules": {"PG-WF-001": {"action": 123}}})

    def test_invalid_network_type(self) -> None:
        with pytest.raises(ConfigError, match="'network' must be a mapping"):
            parse_config_dict({"network": "invalid"})

    def test_invalid_network_domain_allowlist_type(self) -> None:
        with pytest.raises(ConfigError, match="'network.domain_allowlist' must be a list"):
            parse_config_dict({"network": {"domain_allowlist": "not-list"}})

    def test_invalid_limits_type(self) -> None:
        with pytest.raises(ConfigError, match="'limits' must be a mapping"):
            parse_config_dict({"limits": "invalid"})

    def test_invalid_limits_max_file_size(self) -> None:
        with pytest.raises(ConfigError, match="'max_file_size' in 'limits' must be a positive integer"):
            parse_config_dict({"limits": {"max_file_size": -10}})

    def test_invalid_top_level_max_file_count(self) -> None:
        with pytest.raises(ConfigError, match="'max_file_count' must be a positive integer"):
            parse_config_dict({"max_file_count": 0})

    def test_candidate_discovery_in_cwd(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.chdir(tmp_path)
        (tmp_path / "pipelineguard.yml").write_text("fail_on: warn\n", encoding="utf-8")
        cfg = load_config(None)
        assert cfg.fail_on == "warn"

