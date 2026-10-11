"""
PipelineGuard - Artifact Security command line (Week 5)

Usage (run from security/artifacts/):

    python3 artifact_cli.py hash   <artifact>
    python3 artifact_cli.py verify <artifact> --expected <sha256>
    python3 artifact_cli.py verify <artifact> --hashes-file <file>

Exit codes (same convention as the secrets scanner):
    0  PASS   - hash matches the trusted expected hash
    1  BLOCK  - hash mismatch, possible tampering (event printed)
    2  ERROR  - the check itself failed (missing artifact, invalid or
                missing expected hash, ...). Treated as BLOCK; it is
                never reported as a successful verification.

Add --json to `verify` to print the result (including the security
event on a mismatch) as JSON, e.g. for the FastAPI backend.
"""

import argparse
import json
import sys

from artifact_hashing import calculate_sha256, ArtifactHashError
from artifact_verifier import (
    verify_artifact,
    verify_artifact_from_hashes_file,
    OUTCOME_MATCH,
    OUTCOME_MISMATCH,
    EXIT_ERROR,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="artifact_cli.py",
        description="PipelineGuard artifact integrity tools",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    hash_cmd = sub.add_parser("hash", help="print the SHA-256 of an artifact")
    hash_cmd.add_argument("artifact")

    verify_cmd = sub.add_parser("verify", help="verify an artifact against a trusted hash")
    verify_cmd.add_argument("artifact")
    source = verify_cmd.add_mutually_exclusive_group(required=True)
    source.add_argument("--expected", help="expected SHA-256 (64 hex characters)")
    source.add_argument(
        "--hashes-file",
        help="trusted hashes file (sha256sum format) stored separately from the artifact",
    )
    verify_cmd.add_argument("--json", action="store_true", help="print the result as JSON")
    return parser


def main(argv=None) -> int:
    args = _build_parser().parse_args(argv)

    if args.command == "hash":
        try:
            print(f"{calculate_sha256(args.artifact)}  {args.artifact}")
        except ArtifactHashError as error:
            print(f"[x] Hashing error: {error}")
            return EXIT_ERROR
        return 0

    if args.hashes_file:
        result = verify_artifact_from_hashes_file(args.artifact, args.hashes_file)
    else:
        result = verify_artifact(args.artifact, args.expected)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        return result.exit_code

    print("[*] PipelineGuard Artifact Verification")
    print(f"[*] Artifact: {result.artifact}")

    if result.outcome == OUTCOME_MATCH:
        print(f"[+] Expected: {result.expected_hash}")
        print(f"[+] Actual:   {result.actual_hash}")
        print("[+] Hashes match - artifact integrity verified.")
    elif result.outcome == OUTCOME_MISMATCH:
        print(f"[!] Expected: {result.expected_hash}")
        print(f"[!] Actual:   {result.actual_hash}")
        print("[!] Hash mismatch - possible artifact tampering detected.")
        print(
            f"[!] Security event created: {result.event['event_type']} "
            f"(severity {result.event['severity']}, rule {result.event['rule']})"
        )
    else:
        print(f"[x] Verification error: {result.error}")

    print(f"[{'+' if result.decision == 'PASS' else '!'}] Result: {result.decision}")
    return result.exit_code


if __name__ == "__main__":
    sys.exit(main())
