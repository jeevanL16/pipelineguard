# PipelineGuard - Artifact Security Module (Week 5)

## What this module does

It checks that a build artifact (wheel, tarball, jar, container-layer
export, ...) is **exactly** the file you expect. It computes the
artifact's SHA-256 hash, compares it with a trusted expected hash, and
returns a **PASS** or **BLOCK** decision. If the hashes differ it also
creates a structured PipelineGuard security event (`artifact_tampering`,
severity `CRITICAL`).

## Why artifact integrity matters

CI/CD pipelines build, store and ship artifacts. If an attacker swaps or
edits an artifact between *build* and *deploy* (compromised storage,
cache poisoning, a hijacked runner, a tampered download), the pipeline
can deploy malicious code even though the source code was clean. Checking
the artifact's hash right before it is used catches that.

## What SHA-256 does

SHA-256 turns any file into a fixed 64-character hexadecimal
"fingerprint". The same bytes always give the same hash; changing even
one byte gives a completely different hash. It is a one-way function, so
the hash does not reveal the file's contents. Example:

```text
"abc" -> ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
```

## Files

| File | Purpose |
|---|---|
| `artifact_hashing.py` | Chunked SHA-256 of a file (`calculate_sha256`), safe error handling |
| `artifact_verifier.py` | Verification, PASS/BLOCK decision, trusted hashes-file lookup |
| `artifact_events.py` | Builds the `artifact_tampering` security event |
| `artifact_cli.py` | Command line for `hash` and `verify` |
| `tests/` | pytest suite (hashing, verification, events, CLI) |

Module names are prefixed `artifact_` on purpose: the Week 4 secrets
modules use flat imports (`events`, `severity`, ...), and unique names
avoid clashes when both modules are on `sys.path` in one pytest run.

## How to calculate an artifact hash

From `security/artifacts/`:

```bash
python3 artifact_cli.py hash build/app-1.0.tar.gz
```

```text
9cd30b488e72c2df7d2de0cadf301356fbcb53bb74a3075a3c45760375dc45b2  build/app-1.0.tar.gz
```

The output format matches `sha256sum`, so you can cross-check:
`sha256sum build/app-1.0.tar.gz`. The file is read in 1 MiB chunks, so
very large artifacts do not use much memory, and it is only read, never
executed.

From Python:

```python
from artifact_hashing import calculate_sha256
print(calculate_sha256("build/app-1.0.tar.gz"))
```

## How to verify an artifact

Always keep the **trusted expected hash somewhere separate from the
artifact** (see the next section). Two ways to supply it:

```bash
# 1. Expected hash passed directly (e.g. from a CI variable)
python3 artifact_cli.py verify build/app-1.0.tar.gz --expected <64-hex-sha256>

# 2. Entry in a separate trusted hashes file (sha256sum format)
python3 artifact_cli.py verify build/app-1.0.tar.gz --hashes-file trusted/hashes.sha256
```

The hashes file holds lines like `<hash>  <artifact file name>` (blank
lines and `#` comments are allowed). Create one with
`(cd build && sha256sum app-1.0.tar.gz) > trusted/hashes.sha256`.

From Python:

```python
from artifact_verifier import verify_artifact
result = verify_artifact("build/app-1.0.tar.gz", expected_hash, branch="main")
result.decision      # "PASS" or "BLOCK"
result.verified      # True only when the hashes match
result.event         # artifact_tampering event dict on a mismatch, else None
result.to_dict()     # JSON-serializable
```

## Why the expected hash must be stored separately

If the expected hash sits **next to the artifact** (same folder, same
download page, same storage bucket) then anyone who can replace the
artifact can replace the hash file as well, and verification will happily
pass for the malicious file. The hash only proves integrity relative to a
reference the attacker **cannot** also modify. Good places: a hashes file
committed to the repository under branch protection and code review, a
protected CI variable/secret, or a signed release record. Also note that a
hash proves the file is *unchanged*, not *who made it* - see Future work.

## How PASS / BLOCK decisions work

| Situation | `outcome` | `decision` | `verified` | Exit code | Event |
|---|---|---|---|---|---|
| Actual hash equals expected hash | `MATCH` | **PASS** | `True` | 0 | none |
| Hashes differ | `MISMATCH` | **BLOCK** | `False` | 1 | `artifact_tampering`, `CRITICAL` |
| Artifact missing/unreadable, or expected hash missing/malformed | `ERROR` | **BLOCK** | `False` | 2 | none |

The module **fails closed**: `verified` is `True` for exactly one case, a
real match. A verification error is never reported as success. Exit codes
follow the secrets scanner (0 / 1 / 2) so a CI step can fail the pipeline
on any non-zero code. Hash comparison uses a constant-time compare, and
expected hashes are validated as exactly 64 hex characters (case
insensitive).

## How to simulate tampering safely

Everything below uses a harmless text file in a scratch folder:

```bash
mkdir -p demo/build demo/trusted
echo "PipelineGuard demo build output v1.0" > demo/build/app-1.0.tar.gz
(cd demo/build && sha256sum app-1.0.tar.gz) > demo/trusted/hashes.sha256

# 1. Untouched artifact -> PASS
python3 artifact_cli.py verify demo/build/app-1.0.tar.gz --hashes-file demo/trusted/hashes.sha256
```

```text
[*] PipelineGuard Artifact Verification
[*] Artifact: demo/build/app-1.0.tar.gz
[+] Expected: 9cd30b488e72c2df7d2de0cadf301356fbcb53bb74a3075a3c45760375dc45b2
[+] Actual:   9cd30b488e72c2df7d2de0cadf301356fbcb53bb74a3075a3c45760375dc45b2
[+] Hashes match - artifact integrity verified.
[+] Result: PASS
```

```bash
# 2. "Tamper": append one line to the artifact, then verify again -> BLOCK
echo "malicious change" >> demo/build/app-1.0.tar.gz
python3 artifact_cli.py verify demo/build/app-1.0.tar.gz --hashes-file demo/trusted/hashes.sha256
echo "exit code: $?"
```

```text
[*] PipelineGuard Artifact Verification
[*] Artifact: demo/build/app-1.0.tar.gz
[!] Expected: 9cd30b488e72c2df7d2de0cadf301356fbcb53bb74a3075a3c45760375dc45b2
[!] Actual:   b8705799ba8cc35df4fe945bc964a63545c86863f1dd46ec108195707d8abdd5
[!] Hash mismatch - possible artifact tampering detected.
[!] Security event created: artifact_tampering (severity CRITICAL, rule sha256-mismatch)
[!] Result: BLOCK
exit code: 1
```

(The `Actual` hash in step 2 depends on the exact bytes you append.)

```bash
# 3. Errors fail safely -> BLOCK, exit code 2
python3 artifact_cli.py verify demo/build/missing.tar.gz --expected aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
python3 artifact_cli.py verify demo/build/app-1.0.tar.gz --expected abc123
```

```text
[x] Verification error: Artifact not found: demo/build/missing.tar.gz
[!] Result: BLOCK
[x] Verification error: Expected hash is malformed: a SHA-256 hash is exactly 64 hexadecimal characters.
[!] Result: BLOCK
```

## How the module integrates with PipelineGuard security events

On a mismatch `verify_artifact()` returns a normal PipelineGuard event
using the **same field set** as the Week 4 `secret_exposure` event, so
the FastAPI backend and dashboard can store and display both the same way.
Add `--json` to the CLI to get the result as JSON:

```json
{
  "event_id": "38658e73-85c6-4e5c-8029-847bb880590f",
  "event_type": "artifact_tampering",
  "source": "artifact-security",
  "severity": "CRITICAL",
  "repository": "pipelineguard",
  "branch": "feature/secrets-artifact",
  "file": "build/app-1.0.tar.gz",
  "line": null,
  "rule": "sha256-mismatch",
  "description": "Possible artifact tampering detected: SHA-256 hash of 'app-1.0.tar.gz' does not match the trusted expected hash (rule: sha256-mismatch, severity: CRITICAL)",
  "action": "BLOCK",
  "status": "OPEN",
  "metadata": {
    "module": "artifact-security",
    "artifact_name": "app-1.0.tar.gz",
    "algorithm": "SHA-256",
    "expected_sha256": "9cd30b48...",
    "actual_sha256": "b8705799...",
    "verification_result": "MISMATCH"
  }
}
```

(`branch` is auto-detected from git and is `"unknown"` outside a git
repository; hashes are shortened here for readability.)

Artifact contents are never included in the event, the description, the
metadata or CLI output. Only the file path/name and the two hashes appear.

Integration hint for a backend teammate: import `verify_artifact` (or
`verify_artifact_from_hashes_file`), call it with the artifact path and
trusted hash, then `result.to_dict()` is ready to return from an endpoint,
and `result.event` (when not `None`) is ready to store.

## How to run the tests

From the project root:

```bash
pip install pytest
pytest security -v            # secrets + artifacts
pytest security/artifacts -v  # artifacts only
```

The tests use only temporary files and harmless data. The Week 4 secrets
tests that call the real Gitleaks binary are skipped automatically when
`gitleaks` is not on `PATH`. One artifact test (unreadable file via
`chmod 000`) is skipped when run as root, because root can read any file.

## Current limitations

- A hash proves a file is **unchanged**, not **who produced it**. It is
  only as trustworthy as where the expected hash comes from.
- The tool does not store or manage the trusted hashes; the pipeline must
  provide them from a protected location.
- Verification errors (missing artifact, bad expected hash) block but do
  not currently create a security event; only a hash mismatch does.
- Symbolic links are followed when hashing; a symlink is hashed as the
  file it points to.
- `get_current_branch()` is duplicated from the secrets module on purpose
  (see `artifact_events.py` for the reason).
- There is no FastAPI endpoint or dashboard widget yet; the module returns
  JSON-ready data for a teammate to wire in.

## Future work: Cosign

[Sigstore Cosign](https://github.com/sigstore/cosign) can **sign**
artifacts and container images and verify the signature, proving *who*
signed them, not just that the bytes are unchanged. Planned approach: keep
SHA-256 verification as the fast integrity check, then add a Cosign
signature verification step (keyless or key-based) and emit a similar
security event when a signature is missing or invalid. Not implemented in
Week 5.
