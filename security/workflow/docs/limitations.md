# PipelineGuard Workflow Security — Detection Limitations

This document provides an honest, specific inventory of intentional boundaries, trade-offs, and out-of-scope scenarios for PipelineGuard's static workflow analysis engine.

---

## 1. Static YAML Scope vs. External Shell Scripts

* **In-Scope**: Inline shell commands inside `run:` blocks in workflows and composite action definitions (`action.yml`/`action.yaml`).
* **Limitation**: When a workflow step executes an external script (e.g., `run: ./scripts/deploy.sh` or `run: python -m tools.release`), PipelineGuard audits the invocation command itself, but does not parse or symbolically execute the contents of the referenced file.
* **Rationale**: PipelineGuard is designed to be lightweight, deterministic, and dependency-minimal (running on stdlib + PyYAML). Deep multi-language shell/script parsing is addressed by dedicated SAST tools.

---

## 2. Shell Indirection and Complex Dynamic Evaluation

* **In-Scope**: Common shell anti-patterns, line continuations (`\`), folded YAML scalars (`|`, `>`), mixed-case commands, extra whitespace, base64 decoding flags, direct subshell execution (`bash -c "$(curl ...)"`), and `eval` on variables/command substitutions.
* **Limitation**: Arbitrary multi-hop variable indirection within shell scripts (e.g., dynamic variable construction across multiple bash functions or subshells) cannot be fully resolved statically without a full runtime shell simulator.
* **Rationale**: Static regexes use bounded quantifiers to guarantee mathematical ReDoS immunity (< 0.15s per pattern on pathological 50,000-character inputs). Attempting unbounded semantic interpretation in regex would introduce denial-of-service risks.

---

## 3. External Action and Reusable Workflow Source Code

* **In-Scope**: Verifying that every action and reusable workflow `uses:` reference is pinned to a full 40-character hexadecimal commit SHA or Docker SHA-256 digest (PG-WF-019), and verifying that `actions/checkout` specifies `persist-credentials: false` (PG-WF-020).
* **Limitation**: PipelineGuard does not fetch or audit the internal source code or dependencies of third-party actions hosted in external repositories.
* **Rationale**: Offline determinism and zero network dependencies during scanning. Pinning to an immutable commit SHA ensures supply-chain immutability; external action auditing belongs to dedicated supply-chain scanners (e.g., OpenSSF Scorecard).

---

## 4. Encrypted Secrets and Runtime Payloads

* **In-Scope**: Detecting raw secret leaks in workflow YAML, echoes of secrets in `run:` blocks, and unsafe debug tracing flags (`set -x`).
* **Limitation**: Secrets that are passed via environment variables to legitimate compiled binaries or external network requests cannot be tracked beyond their point of entry. Obfuscated or encrypted payloads decoded entirely in-memory at runtime cannot be decrypted statically.
* **Rationale**: GitHub Actions runner secrets masking handles runtime redaction on standard output.

---

## 5. Self-Hosted Runner Infrastructure

* **In-Scope**: Tagging and flagging untrusted triggers (`pull_request_target`, `issue_comment`, `workflow_run`) that expose runners to hostile execution.
* **Limitation**: PipelineGuard cannot detect whether an underlying runner machine has persistent local state, an exposed Docker daemon socket (`/var/run/docker.sock`), or network access to cloud metadata endpoints (e.g., `169.254.169.254`).
* **Rationale**: Runner machine isolation is an infrastructure-level concern that must be enforced via ephemeral runner VMs and network policy.
