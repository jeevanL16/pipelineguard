import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from masking import mask_secret


def test_empty_secret_returns_empty_string():
    assert mask_secret("") == ""
    assert mask_secret(None) == ""


def test_short_secret_is_fully_masked():
    # 7 characters, at or below the visible-prefix + visible-suffix
    # threshold (4 + 3 = 7), so it must be fully masked.
    assert mask_secret("abcdefg") == "****"


def test_long_secret_keeps_prefix_and_suffix_only():
    secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzX4mQ9pL3"
    masked = mask_secret(secret)

    assert masked.startswith("wJal")
    assert masked.endswith("pL3")
    assert "*" in masked


def test_masked_secret_never_contains_the_real_middle_section():
    secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzX4mQ9pL3"
    masked = mask_secret(secret)

    middle_section = secret[4:-3]
    assert middle_section not in masked


def test_masked_output_is_same_length_as_input():
    secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzX4mQ9pL3"
    assert len(mask_secret(secret)) == len(secret)
