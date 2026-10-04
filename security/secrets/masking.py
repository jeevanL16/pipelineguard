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

Design choice (Week 4): partial masking (keep a few characters at
each end) instead of a flat "[REDACTED]" placeholder. Reasoning:
  - A developer who sees an alert can still recognise *which*
    credential was flagged (e.g. to match it against a known key in
    their own notes) without the output containing anything close to
    enough of the value to reuse it.
  - A flat "[REDACTED]" for every finding gives no way to tell two
    different findings apart in a log, which makes debugging harder.
  - Short secrets are always fully masked (see FULLY_MASKED below),
    so this does not weaken protection for short values - the
    trade-off only applies to values long enough that a few visible
    characters at each end are not meaningful on their own.
"""

# How many characters to keep visible at the start and end of a
# secret. Kept small on purpose so the visible part is not enough
# to reconstruct or use the real secret.
VISIBLE_PREFIX = 4
VISIBLE_SUFFIX = 3

# Placeholder used when a secret is too short to safely show any
# characters at all.
FULLY_MASKED = "****"


def mask_secret(secret) -> str:
    """
    Return a masked version of a secret string.

    Rules:
    - Empty or missing value (None, "", etc.) -> return an empty
      string. This is checked with `not secret`, so it also safely
      covers falsy values rather than raising an error.
    - A non-string value is converted with str() first, so a caller
      passing something unexpected (an int, for example) cannot
      crash the scanner - it is still masked rather than printed
      as-is.
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

    secret = str(secret)
    length = len(secret)
    min_length_to_partially_mask = VISIBLE_PREFIX + VISIBLE_SUFFIX

    if length <= min_length_to_partially_mask:
        return FULLY_MASKED

    prefix = secret[:VISIBLE_PREFIX]
    suffix = secret[-VISIBLE_SUFFIX:]
    hidden_length = length - VISIBLE_PREFIX - VISIBLE_SUFFIX

    return f"{prefix}{'*' * hidden_length}{suffix}"
