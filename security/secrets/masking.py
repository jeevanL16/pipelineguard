"""
PipelineGuard - Secret Masking

This module hides the middle of a secret value so that a secret can
be referenced (for logs, events, or debugging) without ever showing
its full value.

Example:
    Original:  wJalrXUtnFEMI/K7MDENG/bPxRfiCYzX4mQ9pL3
    Masked:    wJal********************************pL3

This is defensive: scanner.py currently never reads or prints the
raw "Secret" field from a Gitleaks finding, so nothing is exposed
today. mask_secret() exists so that if that ever changes (for
example, a future debug mode), there is a single, tested function
that must be used, instead of ad-hoc string slicing scattered
around the codebase.
"""

# How many characters to keep visible at the start and end of a
# secret. Kept small on purpose so the visible part is not enough
# to reconstruct or use the real secret.
VISIBLE_PREFIX = 4
VISIBLE_SUFFIX = 3

# Placeholder used when a secret is too short to safely show any
# characters at all.
FULLY_MASKED = "****"


def mask_secret(secret: str) -> str:
    """
    Return a masked version of a secret string.

    Rules:
    - Empty or missing value -> return an empty string.
    - Very short secrets (<= VISIBLE_PREFIX + VISIBLE_SUFFIX) are
      fully masked, since showing any real characters of a short
      secret could reveal most of it.
    - Otherwise, keep the first VISIBLE_PREFIX and last
      VISIBLE_SUFFIX characters, and replace everything in between
      with '*' (one '*' per hidden character, so the masked output
      still hints at the original length without revealing it).
    """
    if not secret:
        return ""

    length = len(secret)
    min_length_to_partially_mask = VISIBLE_PREFIX + VISIBLE_SUFFIX

    if length <= min_length_to_partially_mask:
        return FULLY_MASKED

    prefix = secret[:VISIBLE_PREFIX]
    suffix = secret[-VISIBLE_SUFFIX:]
    hidden_length = length - VISIBLE_PREFIX - VISIBLE_SUFFIX

    return f"{prefix}{'*' * hidden_length}{suffix}"
