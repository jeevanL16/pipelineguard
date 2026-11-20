# PipelineGuard - Secrets Security Module (Week 3)

## What this module does

This module scans a directory for accidentally committed secrets
(API keys, tokens, passwords, private keys) using
[Gitleaks](https://github.com/gitleaks/gitleaks), then converts
whatever it finds into a PipelineGuard security event with a
PipelineGuard-assigned severity level.

## Why Gitleaks

Gitleaks is a widely used, open-source secret scanner with a large
built-in set of detection rules for cloud provider keys, common
token formats (GitHub, Stripe, etc.), and generic private keys. Using
an established tool means PipelineGuard does not have to invent its
own detection rules from scratch for Week 3; this module focuses on
what happens *after* Gitleaks finds something.

## How the scanner works

```text
Source Code / Build Logs
        |
        v
scanner.py runs Gitleaks (as a subprocess)
        |
        v
Gitleaks writes a temporary JSON report
        |
        v
scanner.py reads the report, then deletes it
        |
        v
For each finding:
    - severity.py assigns a PipelineGuard severity
    - events.py builds a PipelineGuard security event
        |
        v
Findings printed to the terminal (secret value never shown)
        |
        v
Result: PASS (exit code 0) or BLOCK (exit code 1)
```

`scanner.py` never reads or prints the `Secret` field from a
Gitleaks finding. `masking.py` provides a `mask_secret()` function
that hides all but a few characters of a secret, for future features
that may need to reference (not reveal) a secret value.

## How to run it

From `security/secrets/`:

```bash
python3 scanner.py
```

This scans the current directory (`.`) recursively.

**Exit codes:**

| Code | Meaning |
|---|---|
| 0 | No secrets found - PASS |
| 1 | One or more secrets found - BLOCK |
| 2 | The scan itself failed (Gitleaks missing or errored) |

These exit codes are what a future CI step (GitHub Actions) will
check to decide whether to fail the pipeline. That integration is
Week 4+ work and is not implemented yet.

## How dummy testing works

Sample files with clearly fake secrets live in
`security/secrets/test/samples/`:

| File | Category | Real fake secret used |
|---|---|---|
| `aws_credentials.txt` | AWS-style key | A made-up `AKIA...` key, not a real AWS example |
| `github_token.txt` | GitHub token | A made-up `ghp_...` token |
| `generic_api_key.txt` | Generic API key | A made-up `sk_test_...` value |
| `password_credential.txt` | Password pattern | Fake password strings |
| `private_key.txt` | Private key | A fake `BEGIN RSA PRIVATE KEY` block, no real key data |
| `clean_code.py` | Clean file | No secrets, used to confirm PASS |

**Actual results from running Gitleaks against these samples
(tested, not assumed):**

| File | Gitleaks result |
|---|---|
| `aws_credentials.txt` | Detected as `aws-access-token` |
| `github_token.txt` | Detected as `github-pat` |
| `generic_api_key.txt` | Detected as `stripe-access-token` (the key format happens to match Stripe's pattern) |
| `password_credential.txt` | **Not detected.** Gitleaks' default ruleset has no generic rule for a plain `password=` line. This is a real limitation to be aware of, not a bug in our scanner. |
| `private_key.txt` | Detected as `private-key` |
| `clean_code.py` | No findings, as expected |

One thing worth knowing: the well-known AWS documentation example
key (`AKIAIOSFODNN7EXAMPLE`) is specifically allowlisted by Gitleaks
and will **not** be flagged, since it appears throughout public docs
and would otherwise cause constant false positives. Our AWS sample
uses a different fake key so the detection test is meaningful.

Only clearly fake values are used anywhere in this project. No real
credentials are ever committed.

## What severity means in PipelineGuard

Gitleaks does not assign severity itself, only a rule ID. The
mapping from rule ID to severity is a PipelineGuard project decision,
defined in `severity.py`:

**PipelineGuard Secret Severity Policy**

| Gitleaks rule | PipelineGuard severity |
|---|---|
| `private-key` | CRITICAL |
| `aws-access-token` | HIGH |
| `github-pat` / `github-fine-grained-pat` | HIGH |
| `stripe-access-token` | HIGH |
| `generic-api-key` | HIGH |
| any other rule | MEDIUM (default) |

This table is intentionally simple for Week 3 and can be extended.

## What happens when a secret is detected

1. The scanner prints the rule, file, and line number (never the
   secret value) for every finding.
2. Each finding becomes a PipelineGuard security event, for example:

   ```json
   {
     "event_type": "secret_exposure",
     "source": "gitleaks",
     "severity": "HIGH",
     "repository": "pipelineguard",
     "file": "security/secrets/test/samples/github_token.txt",
     "line": 1,
     "rule": "github-pat",
     "action": "BLOCK",
     "status": "OPEN"
   }
   ```

3. The scanner exits with code 1 (BLOCK). Sending these events to
   the PipelineGuard backend, and actually pausing a real pipeline,
   are later-week tasks.

## Security precautions

- The Gitleaks JSON report is written to a temp file and deleted
  immediately after being read, on every code path (success,
  clean scan, and parse error).
- The raw `Secret` field from a Gitleaks finding is never read.
- All test fixtures use clearly fake values.
- The Gitleaks subprocess call uses a list of arguments (not a
  shell string), which avoids shell-injection risk.
- Errors from Gitleaks itself (missing binary, bad scan) are raised
  as a distinct `ScannerError` and exit with code 2, instead of being
  silently treated as "no secrets found."

## Example output

**Secret detected:**

```text
[*] PipelineGuard Secret Scanner
[*] Running Gitleaks...
[!] Secrets detected: 1

--- Secret Finding ---
Rule: github-pat
File: github_token.txt
Line: 1
Severity: HIGH
Action: BLOCK

[!] 1 PipelineGuard security event(s) created.
[!] Result: BLOCK
```
(exit code 1)

**Clean scan:**

```text
[*] PipelineGuard Secret Scanner
[*] Running Gitleaks...
[+] No secrets detected.
[+] Result: PASS
```
(exit code 0)

Both of the outputs above were captured from real runs against the
sample files in this repository, not written from memory.

## Running the tests

```bash
pip install pytest
cd security/secrets
python3 -m pytest tests/ -v
```

22 tests currently pass, covering masking, the severity policy,
event construction, and end-to-end scanner behavior (clean scan,
single finding, multiple findings, masking in output, and exit
codes) against the real Gitleaks binary and the dummy sample files.

## Week 4 updates

Week 4 built on the Week 3 scanner without restructuring it. Three
things changed:

**1. Secret classification**

The severity policy in `severity.py` now also recognizes a
Password/Credential category, mapped to HIGH:

| Gitleaks rule | PipelineGuard severity |
|---|---|
| `private-key` | CRITICAL |
| `aws-access-token` | HIGH |
| `github-pat` / `github-fine-grained-pat` | HIGH |
| `stripe-access-token` | HIGH |
| `hashicorp-tf-password` / `nuget-config-password` / `planetscale-password` | HIGH |
| `generic-api-key` | HIGH |
| any other rule | MEDIUM (default) |

In practice, most plain `password = ...` or `api_key = ...` style
lines are caught by `generic-api-key`, not a password-specific rule.
While testing this, the original `password_credential.txt` sample
was found to **not** be detected at all: Gitleaks' `generic-api-key`
rule only captures values made of letters, digits, `.`, `=`, and
`-`, and the original fake passwords used `#`, `$`, `!`, which broke
the match. The sample was fixed to use a value in that character
set, and detection was re-verified. This is a real limitation of the
rule, not a bug in PipelineGuard.

**2. Secret masking**

`masking.py` keeps a partial-masking approach (a few characters
visible at each end, full masking for short values) rather than a
flat `[REDACTED]` placeholder, so that two different findings in the
same log remain distinguishable from each other without exposing
enough of either value to reuse it. It was also hardened so a
non-string value passed in cannot crash the scanner.

**3. Safe security events**

`events.py` now builds the team's agreed common event schema:

```json
{
  "event_id": "3f462065-20d2-4b5f-a743-47264e32d417",
  "event_type": "secret_exposure",
  "source": "gitleaks",
  "severity": "HIGH",
  "repository": "pipelineguard",
  "branch": "feature/secrets-artifact",
  "file": "security/secrets/test/samples/generic_api_key.txt",
  "line": 1,
  "rule": "generic-api-key",
  "description": "Potential secret detected in source code (rule: generic-api-key, severity: HIGH)",
  "action": "BLOCK",
  "status": "OPEN",
  "metadata": {
    "module": "secrets-security",
    "detector": "gitleaks"
  }
}
```

`event_id` is a fresh UUID per finding, and `branch` is read from
the current git branch (`git rev-parse --abbrev-ref HEAD`), falling
back to `"unknown"` if that fails for any reason. As before, there
is no field containing the raw secret value, and this is checked by
a test.

**Testing:** the secrets module now has 33 passing pytest tests,
covering masking, severity classification (including the new
password/credential category), the event schema, multiple findings,
and the PASS / BLOCK / scanner-error exit codes.

## Out of scope for Week 4

Artifact hashing/signing is planned for Week 5 and was not started
here. Also still out of scope: SBOM, provenance, GitHub Actions
workflow integration, backend/database integration, dashboard,
Kubernetes, AWS deployment, ELK, HashiCorp Vault, Jenkins.
