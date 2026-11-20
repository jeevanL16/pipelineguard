"""Tests for artifact_hashing.py. All data is harmless and temporary."""

import hashlib
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import artifact_hashing  # noqa: E402
from artifact_hashing import calculate_sha256, ArtifactHashError  # noqa: E402

# Well-known SHA-256 test vectors.
SHA256_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
SHA256_HELLO_WORLD = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"


def write(path, data: bytes):
    path.write_bytes(data)
    return path


def test_known_vector_abc(tmp_path):
    assert calculate_sha256(write(tmp_path / "a.bin", b"abc")) == SHA256_ABC


def test_known_vector_hello_world(tmp_path):
    assert calculate_sha256(write(tmp_path / "h.txt", b"hello world")) == SHA256_HELLO_WORLD


def test_empty_file(tmp_path):
    assert calculate_sha256(write(tmp_path / "empty", b"")) == SHA256_EMPTY


def test_repeated_hash_is_consistent(tmp_path):
    f = write(tmp_path / "c.bin", b"consistent data")
    assert len({calculate_sha256(f) for _ in range(5)}) == 1


def test_output_is_64_char_lowercase_hex(tmp_path):
    h = calculate_sha256(write(tmp_path / "x", b"x"))
    assert len(h) == 64
    assert h == h.lower()
    assert all(c in "0123456789abcdef" for c in h)


def test_binary_file_matches_hashlib(tmp_path):
    data = bytes(range(256)) * 50  # every byte value, including NUL
    f = write(tmp_path / "bin.dat", data)
    assert calculate_sha256(f) == hashlib.sha256(data).hexdigest()


def test_different_content_gives_different_hash(tmp_path):
    a = write(tmp_path / "a", b"content-1")
    b = write(tmp_path / "b", b"content-2")
    assert calculate_sha256(a) != calculate_sha256(b)


def test_single_byte_change_changes_hash(tmp_path):
    original = write(tmp_path / "o", b"A" * 1000)
    changed = write(tmp_path / "c", b"A" * 999 + b"B")
    assert calculate_sha256(original) != calculate_sha256(changed)


def test_large_file_matches_hashlib(tmp_path):
    # ~5 MiB, larger than the default 1 MiB chunk.
    data = (b"pipelineguard-large-artifact-" * 200000)[: 5 * 1024 * 1024]
    f = write(tmp_path / "large.bin", data)
    assert calculate_sha256(f) == hashlib.sha256(data).hexdigest()


@pytest.mark.parametrize("chunk_size", [1, 7, 64, 4096, 10_000_000])
def test_result_independent_of_chunk_size(tmp_path, chunk_size):
    data = os.urandom(20_000)
    f = write(tmp_path / "r.bin", data)
    assert calculate_sha256(f, chunk_size=chunk_size) == hashlib.sha256(data).hexdigest()


def test_file_is_read_in_chunks(tmp_path, monkeypatch):
    """Prove the file is read piecewise, never with an unbounded read()."""
    f = write(tmp_path / "chunks.bin", b"x" * 1000)
    read_sizes = []
    real_open = open

    class Spy:
        def __init__(self, handle):
            self._h = handle

        def read(self, size=-1):
            read_sizes.append(size)
            return self._h.read(size)

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            self._h.close()

    monkeypatch.setattr(
        "builtins.open", lambda *a, **k: Spy(real_open(*a, **k))
    )
    calculate_sha256(f, chunk_size=100)

    assert read_sizes[:10] == [100] * 10        # 1000 bytes in 100-byte chunks
    assert all(size == 100 for size in read_sizes)  # never read(-1)
    assert len(read_sizes) == 11                # 10 data reads + 1 EOF read


def test_accepts_str_and_pathlike(tmp_path):
    f = write(tmp_path / "p", b"abc")
    assert calculate_sha256(str(f)) == calculate_sha256(f) == SHA256_ABC


def test_missing_file_raises(tmp_path):
    with pytest.raises(ArtifactHashError, match="not found"):
        calculate_sha256(tmp_path / "does_not_exist.bin")


def test_directory_raises(tmp_path):
    with pytest.raises(ArtifactHashError, match="not a regular file"):
        calculate_sha256(tmp_path)


def test_invalid_path_type_raises():
    with pytest.raises(ArtifactHashError):
        calculate_sha256(None)


@pytest.mark.parametrize("bad", [0, -1, 1.5, "1024", None, True])
def test_invalid_chunk_size_rejected(tmp_path, bad):
    f = write(tmp_path / "f", b"abc")
    with pytest.raises(ValueError):
        calculate_sha256(f, chunk_size=bad)


@pytest.mark.skipif(
    not hasattr(os, "geteuid") or os.geteuid() == 0,
    reason="permission checks are not enforced for root / non-POSIX",
)
def test_unreadable_file_raises(tmp_path):
    f = write(tmp_path / "secret.bin", b"abc")
    f.chmod(0o000)
    try:
        with pytest.raises(ArtifactHashError, match="Permission denied"):
            calculate_sha256(f)
    finally:
        f.chmod(0o600)


def test_os_error_during_read_is_wrapped(tmp_path, monkeypatch):
    f = write(tmp_path / "io.bin", b"abc")

    def boom(*args, **kwargs):
        raise OSError(5, "Input/output error")

    monkeypatch.setattr("builtins.open", boom)
    with pytest.raises(ArtifactHashError, match="Could not read"):
        calculate_sha256(f)


def test_hashing_never_executes_artifact(tmp_path):
    """A file that would do something visible if run is only read."""
    marker = tmp_path / "executed.marker"
    script = write(
        tmp_path / "evil.py",
        f"open({str(marker)!r}, 'w').write('ran')\n".encode(),
    )
    script.chmod(0o755)
    calculate_sha256(script)
    assert not marker.exists()
