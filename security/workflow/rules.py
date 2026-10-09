"""Rule registry for PipelineGuard's workflow security module.

Each Rule is a frozen dataclass with a unique identifier (``PG-WF-NNN``),
human-readable metadata, severity, default remediation action, and security
references.  The module-level ``REGISTRY`` is immutable after import; do not
mutate it at runtime.

Usage::

    from security.workflow.rules import lookup, REGISTRY, Severity, Action

    rule = lookup("PG-WF-001")
    print(rule.title, rule.severity)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Final

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class Severity(str, Enum):
    """Finding severity levels, ordered from highest to lowest."""

    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"

    def __lt__(self, other: object) -> bool:
        if not isinstance(other, Severity):
            return NotImplemented
        order = [
            Severity.CRITICAL,
            Severity.HIGH,
            Severity.MEDIUM,
            Severity.LOW,
            Severity.INFO,
        ]
        return order.index(self) > order.index(other)

    def __le__(self, other: object) -> bool:
        return self == other or self.__lt__(other)

    def __gt__(self, other: object) -> bool:
        if not isinstance(other, Severity):
            return NotImplemented
        return not self.__le__(other)

    def __ge__(self, other: object) -> bool:
        return self == other or self.__gt__(other)


class Action(str, Enum):
    """Default remediation action when a rule fires."""

    BLOCK = "BLOCK"
    WARN = "WARN"


# ---------------------------------------------------------------------------
# Rule dataclass
# ---------------------------------------------------------------------------

_RULE_ID_RE: Final[re.Pattern[str]] = re.compile(r"^PG-WF-\d{3}$")


@dataclass(frozen=True)
class Rule:
    """Immutable descriptor for a single security rule.

    Attributes:
        id: Unique rule identifier in the format ``PG-WF-NNN``.
        title: Short one-line title.
        description: Multi-sentence description of the risk.
        severity: Default severity when the rule fires.
        action: Default action (BLOCK or WARN).
        cwe: CWE identifier string, e.g. ``"CWE-78"``.
        remediation: Actionable fix guidance.
        references: Tuple of URL strings for further reading.
    """

    id: str
    title: str
    description: str
    severity: Severity
    action: Action
    cwe: str
    remediation: str
    references: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        """Validate the rule ID format."""
        if not _RULE_ID_RE.match(self.id):
            raise ValueError(
                f"Invalid rule ID {self.id!r}: must match PG-WF-NNN"
            )


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

_RULES: Final[list[Rule]] = [
    # ------------------------------------------------------------------
    # Script injection
    # ------------------------------------------------------------------
    Rule(
        id="PG-WF-001",
        title="Script injection via untrusted context in run:",
        description=(
            "An untrusted GitHub context value (e.g. github.event.issue.title, "
            "pull_request.body, head_commit.message) is interpolated directly "
            "inside a 'run:' step.  An attacker who controls that value can inject "
            "arbitrary shell commands."
        ),
        severity=Severity.CRITICAL,
        action=Action.BLOCK,
        cwe="CWE-78",
        remediation=(
            "Assign the context value to an environment variable first and reference "
            "the env var in the shell script.  Never inline ${{ github.event.* }} "
            "directly inside a run: block."
        ),
        references=(
            "https://securitylab.github.com/research/github-actions-preventing-pwn-requests/",
            "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#understanding-the-risk-of-script-injections",
        ),
    ),
    Rule(
        id="PG-WF-002",
        title="Script injection in actions/github-script",
        description=(
            "An untrusted context value is interpolated inside the 'script:' input "
            "of the actions/github-script action, enabling JavaScript code injection."
        ),
        severity=Severity.CRITICAL,
        action=Action.BLOCK,
        cwe="CWE-94",
        remediation=(
            "Pass untrusted values as environment variables and read them from "
            "process.env inside the script block."
        ),
        references=(
            "https://securitylab.github.com/research/github-actions-untrusted-input/",
        ),
    ),
    Rule(
        id="PG-WF-003",
        title="Script injection via GITHUB_ENV / GITHUB_OUTPUT / GITHUB_PATH write",
        description=(
            "An untrusted context value is written to GITHUB_ENV, GITHUB_OUTPUT, or "
            "GITHUB_PATH.  A downstream step that consumes that env var or output "
            "can be hijacked."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-78",
        remediation=(
            "Validate and sanitize values before writing to GITHUB_ENV/GITHUB_OUTPUT/"
            "GITHUB_PATH.  Prefer outputs with explicit type constraints."
        ),
        references=(
            "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-an-intermediate-environment-variable",
        ),
    ),
    # ------------------------------------------------------------------
    # Permissions
    # ------------------------------------------------------------------
    Rule(
        id="PG-WF-004",
        title="Missing top-level permissions block",
        description=(
            "No 'permissions:' block is defined at the workflow level.  GitHub "
            "Actions defaults to the maximum token scope (write to all scopes), "
            "violating the principle of least privilege."
        ),
        severity=Severity.MEDIUM,
        action=Action.WARN,
        cwe="CWE-272",
        remediation=(
            "Add 'permissions: {}' or an explicit minimal-scope block at the top of "
            "every workflow.  For most workflows 'contents: read' is sufficient."
        ),
        references=(
            "https://docs.github.com/en/actions/security-guides/automatic-token-authentication#modifying-the-permissions-for-the-github_token",
        ),
    ),
    Rule(
        id="PG-WF-005",
        title="Overly broad permissions (write-all or top-level write scope)",
        description=(
            "The workflow or a job grants write-all permissions or an explicit "
            "top-level write scope (e.g. contents: write) without a clear operational "
            "need, giving any compromised step write access to the repository."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-272",
        remediation=(
            "Restrict permissions to the minimum required.  Grant write scopes at "
            "the job level, not the workflow level, and only in the single job that "
            "needs them."
        ),
        references=(
            "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#considering-cross-repository-access",
        ),
    ),
    Rule(
        id="PG-WF-006",
        title="Pwn-request: pull_request_target with head-ref checkout",
        description=(
            "The workflow uses the 'pull_request_target' trigger (runs with write "
            "permissions) and checks out the pull-request head ref or head SHA, "
            "allowing an attacker to execute arbitrary code with write access."
        ),
        severity=Severity.CRITICAL,
        action=Action.BLOCK,
        cwe="CWE-829",
        remediation=(
            "Never check out PR head code under pull_request_target.  If you must "
            "run on PR code, use the 'pull_request' trigger, which runs with read-only "
            "permissions."
        ),
        references=(
            "https://securitylab.github.com/research/github-actions-preventing-pwn-requests/",
        ),
    ),
    Rule(
        id="PG-WF-007",
        title="secrets: inherit propagates all secrets to called workflow",
        description=(
            "'secrets: inherit' on a workflow_call job passes every secret from the "
            "calling workflow to the called workflow, violating least-privilege and "
            "risking secret leakage in untrusted reusable workflows."
        ),
        severity=Severity.HIGH,
        action=Action.WARN,
        cwe="CWE-272",
        remediation=(
            "Enumerate only the specific secrets the called workflow requires instead "
            "of using 'secrets: inherit'."
        ),
        references=(
            "https://docs.github.com/en/actions/using-workflows/reusing-workflows#passing-secrets-to-called-workflows",
        ),
    ),
    # ------------------------------------------------------------------
    # Dangerous commands
    # ------------------------------------------------------------------
    Rule(
        id="PG-WF-008",
        title="curl|bash or wget|sh pattern",
        description=(
            "A run: step pipes the output of a network fetch command directly into "
            "a shell interpreter (e.g. curl ... | bash).  Any MITM or compromised "
            "remote can execute arbitrary code."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-494",
        remediation=(
            "Download to a file, verify the checksum, then execute.  Prefer "
            "package-manager installs over piping to a shell."
        ),
        references=(
            "https://www.securityweek.com/the-dangers-of-piping-curl-into-bash/",
        ),
    ),
    Rule(
        id="PG-WF-009",
        title="base64 decode piped to shell",
        description=(
            "A run: step decodes a base64-encoded payload and pipes the result "
            "directly into a shell interpreter, a common obfuscation technique used "
            "by malicious workflows."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-116",
        remediation=(
            "Avoid executing dynamically decoded content.  If necessary, decode to a "
            "file, review, checksum-verify, then execute explicitly."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-010",
        title="eval of variable or expression",
        description=(
            "A run: step uses 'eval' on a variable or expression, enabling arbitrary "
            "code execution if any part of the evaluated string is attacker-controlled."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-78",
        remediation=(
            "Replace eval with explicit, typed operations.  Never eval data that "
            "originates from workflow inputs, env vars, or GitHub context values."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-011",
        title="Reverse-shell pattern",
        description=(
            "A run: step contains a recognisable reverse-shell pattern "
            "(e.g. bash -i >& /dev/tcp/..., nc -e, mkfifo).  This is a strong "
            "indicator of a supply-chain compromise or malicious workflow."
        ),
        severity=Severity.CRITICAL,
        action=Action.BLOCK,
        cwe="CWE-78",
        remediation=(
            "Remove the reverse-shell code.  Investigate how it was introduced and "
            "rotate all secrets accessible to the runner."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-021",
        title="Secret value echoed in run: step",
        description=(
            "A run: step directly echoes or prints a secret expression "
            "(e.g. echo ${{ secrets.TOKEN }}), which will expose the secret value "
            "in the workflow run log."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-312",
        remediation=(
            "Never echo or print secret values.  GitHub Actions automatically "
            "redacts known secrets in logs, but the redaction is not guaranteed "
            "for all output paths."
        ),
        references=(
            "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#redacting-secrets-in-logs",
        ),
    ),
    Rule(
        id="PG-WF-022",
        title="chmod +x on downloaded file before execution",
        description=(
            "A run: step downloads a file and immediately makes it executable "
            "without verifying its integrity, enabling execution of tampered "
            "binaries from a compromised source."
        ),
        severity=Severity.MEDIUM,
        action=Action.WARN,
        cwe="CWE-494",
        remediation=(
            "Verify the checksum or cryptographic signature of downloaded executables "
            "before marking them executable and running them."
        ),
        references=(),
    ),
    # ------------------------------------------------------------------
    # Network
    # ------------------------------------------------------------------
    Rule(
        id="PG-WF-012",
        title="HTTP download from raw IP address",
        description=(
            "A run: step downloads a resource from a raw IP address over HTTP, "
            "bypassing DNS-based controls and TLS hostname verification.  This is a "
            "common indicator of command-and-control or exfiltration."
        ),
        severity=Severity.MEDIUM,
        action=Action.WARN,
        cwe="CWE-829",
        remediation=(
            "Use named, allowlisted HTTPS endpoints.  Verify checksums of all "
            "downloaded artifacts."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-013",
        title="Known data exfiltration or C2 service",
        description=(
            "A run: step communicates with a known exfiltration or command-and-control "
            "service (e.g. pastebin, transfer.sh, ngrok, webhook.site, discord webhooks). "
            "This is a high-confidence indicator of a compromised or malicious workflow."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-200",
        remediation=(
            "Remove references to these services.  If legitimate use is needed, add "
            "the domain to the project allowlist and document the business reason."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-014",
        title="Plain HTTP (non-TLS) download",
        description=(
            "A run: step downloads a resource over plain HTTP, making it vulnerable "
            "to man-in-the-middle attacks that could substitute malicious content."
        ),
        severity=Severity.LOW,
        action=Action.WARN,
        cwe="CWE-319",
        remediation=(
            "Switch all downloads to HTTPS.  Verify checksums of downloaded artifacts."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-015",
        title="curl -k / --insecure (TLS verification disabled)",
        description=(
            "A run: step calls curl with -k or --insecure, disabling TLS certificate "
            "verification and making the connection vulnerable to MITM attacks."
        ),
        severity=Severity.MEDIUM,
        action=Action.WARN,
        cwe="CWE-295",
        remediation=(
            "Remove -k / --insecure flags.  Fix the underlying TLS issue (expired "
            "cert, missing CA bundle) instead of disabling verification."
        ),
        references=(),
    ),
    # ------------------------------------------------------------------
    # Modification / persistence
    # ------------------------------------------------------------------
    Rule(
        id="PG-WF-016",
        title="Workflow writes to .github/workflows/",
        description=(
            "A run: step writes files into .github/workflows/, which could add or "
            "modify workflow definitions and achieve persistent code execution on "
            "future pushes."
        ),
        severity=Severity.HIGH,
        action=Action.BLOCK,
        cwe="CWE-829",
        remediation=(
            "Workflow files should only be modified through pull requests, not at "
            "runtime by CI jobs.  Revoke write access to .github/workflows/ from "
            "automated steps."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-017",
        title="git push / commit using GITHUB_TOKEN in run:",
        description=(
            "A run: step performs a git push or commit using the GITHUB_TOKEN, "
            "potentially enabling workflow-file tampering or tag manipulation if "
            "permissions are not tightly scoped."
        ),
        severity=Severity.MEDIUM,
        action=Action.WARN,
        cwe="CWE-829",
        remediation=(
            "Ensure the GITHUB_TOKEN has 'contents: write' only when strictly "
            "necessary.  Prefer dedicated bot accounts with minimal permissions for "
            "automated commits."
        ),
        references=(),
    ),
    Rule(
        id="PG-WF-018",
        title="Cron schedule may enable persistence",
        description=(
            "The workflow uses a 'schedule:' trigger.  If the workflow file or its "
            "dependencies are tampered with, the cron schedule provides a persistence "
            "mechanism for repeated execution."
        ),
        severity=Severity.MEDIUM,
        action=Action.WARN,
        cwe="CWE-829",
        remediation=(
            "Review scheduled workflows carefully.  Pin all actions to commit SHAs, "
            "apply strict permissions, and audit the schedule regularly."
        ),
        references=(),
    ),
    # ------------------------------------------------------------------
    # Supply chain
    # ------------------------------------------------------------------
    Rule(
        id="PG-WF-019",
        title="Action not pinned to a full commit SHA",
        description=(
            "A 'uses:' step references an action by a mutable tag or branch name "
            "instead of a 40-character commit SHA.  The action author can silently "
            "change the code that runs in your workflow."
        ),
        severity=Severity.HIGH,
        action=Action.WARN,
        cwe="CWE-829",
        remediation=(
            "Pin every external action to its full 40-character commit SHA: "
            "'uses: actions/checkout@<full-sha>'.  Use tooling such as "
            "Dependabot or Renovate to keep pins up-to-date."
        ),
        references=(
            "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions",
            "https://github.com/step-security/harden-runner",
        ),
    ),
    Rule(
        id="PG-WF-020",
        title="actions/checkout without persist-credentials: false",
        description=(
            "The actions/checkout action is used without setting "
            "'persist-credentials: false'.  By default it stores the GITHUB_TOKEN "
            "in the git credential helper, making it available to any subsequent "
            "step or spawned process."
        ),
        severity=Severity.LOW,
        action=Action.WARN,
        cwe="CWE-312",
        remediation=(
            "Add 'with: { persist-credentials: false }' to every actions/checkout "
            "step unless a later step explicitly needs to push using the stored token."
        ),
        references=(
            "https://github.com/actions/checkout#usage",
        ),
    ),
]


def _build_registry(rules: list[Rule]) -> dict[str, Rule]:
    """Validate uniqueness and return an immutable-ready mapping."""
    registry: dict[str, Rule] = {}
    for rule in rules:
        if rule.id in registry:
            raise ValueError(
                f"Duplicate rule ID {rule.id!r} in registry; each ID must be unique."
            )
        registry[rule.id] = rule
    return registry


#: Central, read-only rule registry.  Keys are rule IDs (``PG-WF-NNN``).
REGISTRY: Final[dict[str, Rule]] = _build_registry(_RULES)


def lookup(rule_id: str) -> Rule:
    """Return the :class:`Rule` for *rule_id*, or raise :exc:`KeyError`.

    Args:
        rule_id: A rule identifier such as ``"PG-WF-001"``.

    Returns:
        The matching :class:`Rule`.

    Raises:
        KeyError: If *rule_id* is not in the registry.
    """
    try:
        return REGISTRY[rule_id]
    except KeyError:
        raise KeyError(
            f"Unknown rule ID {rule_id!r}. Available: {sorted(REGISTRY)}"
        ) from None


def rules_by_severity(severity: Severity) -> list[Rule]:
    """Return all rules whose default severity equals *severity*, sorted by ID.

    Args:
        severity: The :class:`Severity` level to filter by.

    Returns:
        List of matching :class:`Rule` objects ordered by rule ID.
    """
    return sorted(
        (r for r in REGISTRY.values() if r.severity == severity),
        key=lambda r: r.id,
    )
