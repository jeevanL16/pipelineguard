"""
PipelineGuard - Artifact Hashing (Week 5)

Calculates the SHA-256 hash of a file (a build artifact such as a
wheel, jar, tarball, or container-layer export).

Design notes:
  - The file is opened read-only in binary mode and read in fixed-size
    chunks, so a multi-gigabyte artifact never has to fit in memory.
  - The artifact is only ever *read as bytes*. It is never imported,
    executed, unpacked, or parsed, so hashing a malicious artifact is
    safe.
  - Output is always a 64-character lowercase hexadecimal string.
  - Every problem (missing file, directory, permission error, I/O
    error) is raised as ArtifactHashError. Callers never get a
    partial or placeholder hash back, so an error can never be
    mistaken for a valid hash.
"""

import hashlib
import os

# 1 MiB per read: large enough to be efficient, small enough to keep
# memory use flat regardless of artifact size.
DEFAULT_CHUNK_SIZE = 1024 * 1024

HASH_ALGORITHM = "sha256"


class ArtifactHashError(Exception):
    """Raised when an artifact could not be hashed (missing,
    unreadable, not a regular file, or an I/O error)."""
    pass


def calculate_sha256(file_path, chunk_size: int = DEFAULT_CHUNK_SIZE) -> str:
    """
    Return the SHA-256 hash of the file at `file_path` as a
    64-character lowercase hex string.

    Raises ArtifactHashError if the file does not exist, is not a
    regular file, cannot be read, or an I/O error occurs while
    reading. Raises ValueError if `chunk_size` is not a positive int
    (a programming error, not an artifact problem).
    """
    if (
        not isinstance(chunk_size, int)
        or isinstance(chunk_size, bool)
        or chunk_size <= 0
    ):
        raise ValueError("chunk_size must be a positive integer")

    try:
        path = os.fspath(file_path)
    except TypeError as error:
        raise ArtifactHashError(
            "Artifact path must be a string or path-like object."
        ) from error

    if not os.path.exists(path):
        raise ArtifactHashError(f"Artifact not found: {path}")
    if not os.path.isfile(path):
        raise ArtifactHashError(f"Artifact is not a regular file: {path}")

    digest = hashlib.sha256()
    try:
        with open(path, "rb") as artifact:
            while True:
                chunk = artifact.read(chunk_size)
                if not chunk:
                    break
                digest.update(chunk)
    except PermissionError as error:
        raise ArtifactHashError(
            f"Permission denied reading artifact: {path}"
        ) from error
    except OSError as error:
        raise ArtifactHashError(
            f"Could not read artifact {path}: {error.strerror or error}"
        ) from error

    return digest.hexdigest()
