"""Atomic file writes: readers never see a half-written file, even if the process dies mid-write."""

import os
from contextlib import contextmanager
from pathlib import Path
from typing import IO, Iterator


@contextmanager
def atomic_path(path: Path) -> Iterator[Path]:
    """Yield a temp path to write to; it replaces `path` only if the block succeeds."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        yield tmp
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


@contextmanager
def atomic_write(path: Path, mode: str = "w", **open_kwargs) -> Iterator[IO]:
    """open() for writing, but atomic. Text mode defaults to UTF-8."""
    if "b" not in mode:
        open_kwargs.setdefault("encoding", "utf-8")
    with atomic_path(path) as tmp:
        with open(tmp, mode, **open_kwargs) as f:
            yield f
