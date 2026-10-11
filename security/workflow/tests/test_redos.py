"""Regular expression Denial of Service (ReDoS) audit and stress test suite.

Enumerates and stress-tests every compiled regular expression across the workflow package
using pathological inputs (50,000 to 100,000 characters of repeated tokens, incomplete patterns,
catastrophic backtracking triggers, and near-matches).

Invariants:
- All regex matches against 50k-100k character pathological inputs must complete
  strictly under 0.15 seconds per test.
- No polynomial or exponential backtracking.
"""

from __future__ import annotations

import re
import time
from typing import Final

from security.workflow.analyzer import _SUPPRESSION_DIRECTIVE_RE
from security.workflow.detectors import (
    commands,
    network,
    permissions,
    supply_chain,
)
from security.workflow.events import _REPO_NAME_RE
from security.workflow.finding import _SECRET_LIKE_RE
from security.workflow.parser import _CONTEXT_RE, _EXPRESSION_RE
from security.workflow.reporter import _ANSI_CSI_RE, _CONTROL_CHARS_RE, _OSC_RE
from security.workflow.rules import _RULE_ID_RE

_STRESS_LEN: Final[int] = 50_000
_BUDGET_SEC: Final[float] = 0.15


def _assert_safe(pattern: re.Pattern[str], text: str, search: bool = True) -> None:
    t0 = time.perf_counter()
    if search:
        pattern.search(text)
    else:
        pattern.match(text)
    elapsed = time.perf_counter() - t0
    assert elapsed < _BUDGET_SEC, (
        f"ReDoS vulnerability detected in pattern '{pattern.pattern}': "
        f"took {elapsed:.4f}s (budget: {_BUDGET_SEC}s)"
    )


class TestParserAndAnalyzerRegexes:
    def test_expression_re_unclosed_and_repeated(self) -> None:
        # ${{ with massive payload but no closing }}
        pathological = "${{ " + (" " * _STRESS_LEN)
        _assert_safe(_EXPRESSION_RE, pathological)

        # nested ${{ ${{ ${{ without closing
        pathological_nested = ("${{ " * 5_000)
        _assert_safe(_EXPRESSION_RE, pathological_nested)

    def test_context_re(self) -> None:
        pathological = "github" + ("_" * _STRESS_LEN) + "!"
        _assert_safe(_CONTEXT_RE, pathological, search=False)

    def test_suppression_directive_re(self) -> None:
        # Long spaces after directive, long reason
        pathological = "# pipelineguard-ignore: " + ("PG-WF-001 " * 2_000)
        _assert_safe(_SUPPRESSION_DIRECTIVE_RE, pathological)

        unclosed_reason = "# pipelineguard-ignore: PG-WF-001 " + ("a" * _STRESS_LEN)
        _assert_safe(_SUPPRESSION_DIRECTIVE_RE, unclosed_reason)


class TestReporterAndFindingRegexes:
    def test_ansi_and_osc_regexes(self) -> None:
        # Unclosed OSC sequence \x1b] ... without \x07 or \x1b\
        pathological_osc = "\x1b]" + ("A" * _STRESS_LEN)
        _assert_safe(_OSC_RE, pathological_osc)

        # Unclosed ANSI CSI
        pathological_csi = "\x1b[" + ("1;" * 10_000)
        _assert_safe(_ANSI_CSI_RE, pathological_csi)

        # Long control chars
        pathological_control = ("\x00\x01\x1b" * 10_000)
        _assert_safe(_CONTROL_CHARS_RE, pathological_control)

    def test_secret_like_re(self) -> None:
        # Almost a token: ghp_ with 35 chars repeated
        almost_ghp = ("ghp_" + ("A" * 35) + " ") * 1_000
        _assert_safe(_SECRET_LIKE_RE, almost_ghp)

        # Very long alphanumeric token
        long_token = "ghp_" + ("B" * _STRESS_LEN)
        _assert_safe(_SECRET_LIKE_RE, long_token)


class TestRulesAndEventsRegexes:
    def test_rule_id_re(self) -> None:
        pathological = "PG-WF-" + ("9" * _STRESS_LEN)
        _assert_safe(_RULE_ID_RE, pathological, search=False)

    def test_repo_name_re(self) -> None:
        pathological = ("owner" * 5_000) + "/" + ("repo" * 5_000) + "$"
        _assert_safe(_REPO_NAME_RE, pathological, search=False)


class TestCommandDetectorRegexes:
    def test_curl_wget_pipe_shell(self) -> None:
        pathological = "curl -sSL " + ("http://example.com/very/long/url/" * 1_000) + " | not_bash"
        _assert_safe(commands._CURL_PIPE_SHELL_RE, pathological)

        pathological_wget = "wget -qO- " + ("http://example.com/ " * 1_000) + " | not_sh"
        _assert_safe(commands._WGET_PIPE_SHELL_RE, pathological_wget)

    def test_base64_pipe_shell(self) -> None:
        pathological = "echo " + ("aGVsbG8=" * 2_000) + " | base64 -d | not_bash"
        _assert_safe(commands._BASE64_PIPE_SHELL_RE, pathological)
        _assert_safe(commands._ECHO_B64_PIPE_RE, pathological)

    def test_eval_regexes(self) -> None:
        pathological = "eval " + ("$VAR" * 5_000)
        _assert_safe(commands._EVAL_VAR_RE, pathological)

        pathological_sub = "eval $(" + ("echo hello; " * 2_000)
        _assert_safe(commands._EVAL_SUBSHELL_RE, pathological_sub)

    def test_reverse_shell_patterns(self) -> None:
        pathological = "bash -i " + (" " * 50_000) + ">& /dev/tcp/"
        for pat in commands._REVERSE_SHELL_RES:
            _assert_safe(pat, pathological)

    def test_miner_re(self) -> None:
        pathological = ("echo not_a_miner " * 2_000) + "xmrig_not"
        _assert_safe(commands._MINER_RE, pathological)


class TestNetworkDetectorRegexes:
    def test_raw_ip_url_re(self) -> None:
        pathological = "http://" + ("192.168.1." * 2_000) + "999/path"
        _assert_safe(network._RAW_IP_URL_RE, pathological)

    def test_exfil_domain_re(self) -> None:
        pathological = "https://" + ("subdomain." * 2_000) + "not_webhook.site"
        _assert_safe(network._EXFIL_DOMAIN_RE, pathological)
        _assert_safe(network._EXFIL_BARE_DOMAIN_RE, pathological)

    def test_http_download_re(self) -> None:
        pathological = "http://" + ("insecure.domain.com/" * 2_000)
        _assert_safe(network._HTTP_DOWNLOAD_RE, pathological)


class TestSupplyChainAndPermissionsRegexes:
    def test_commit_sha_re(self) -> None:
        pathological = ("a" * 39) + ("b" * _STRESS_LEN)
        _assert_safe(supply_chain._COMMIT_SHA_RE, pathological, search=False)

    def test_docker_digest_re(self) -> None:
        pathological = "docker://image@sha256:" + ("f" * _STRESS_LEN)
        _assert_safe(supply_chain._DOCKER_DIGEST_RE, pathological, search=False)

    def test_head_ref_expr_re(self) -> None:
        pathological = "github.event.pull_request." + ("head." * 1_000) + "not_ref"
        _assert_safe(permissions._HEAD_REF_EXPR_RE, pathological)
