"""One logging setup for every entry point: console + a rotating file in logs/.

Call setup_logging() only from a __main__ entry point, never at import time;
otherwise importing a module locks in its config and later setup is ignored.
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv

LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
FILE_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
CONSOLE_FORMAT = "%(asctime)s %(levelname)-7s %(message)s"


def setup_logging(level: str | None = None, log_dir: Path = LOG_DIR, log_file: str = "pipeline.log") -> Path:
    """Level comes from the argument, else LOG_LEVEL in the environment / .env, else INFO."""
    load_dotenv()
    level = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / log_file

    file_handler = RotatingFileHandler(path, maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter(FILE_FORMAT))

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter(CONSOLE_FORMAT, datefmt="%H:%M:%S"))

    # force=True replaces any handlers configured earlier in the process.
    logging.basicConfig(level=level, handlers=[console, file_handler], force=True)
    return path
