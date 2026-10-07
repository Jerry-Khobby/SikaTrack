"""Watchdog that runs OUTSIDE Docker (Windows Task Scheduler), so it can report what Airflow can't:
the stack itself being down.

Checks Airflow, Postgres and RustFS answer from Windows, and that the pipeline heartbeat is
fresh. Emails only when something is wrong. Run by scripts/watchdog.cmd; manual run:
    python -m src.monitoring.watchdog
"""

import logging
import os
import socket
import sys
import urllib.request
from datetime import datetime, timezone

from src.monitoring.checks import MonitorSettings, check_heartbeat
from src.monitoring.notify import send_email
from src.utils.logging_config import setup_logging

log = logging.getLogger(__spec__.name if __spec__ else __name__)


def http_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.status < 500
    except Exception:
        return False


def port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=5):
            return True
    except OSError:
        return False


def problems() -> list[str]:
    found = []
    airflow = os.getenv("AIRFLOW_PUBLIC_URL", "http://localhost:8080").rstrip("/")
    if not http_ok(f"{airflow}/api/v2/version"):
        found.append(f"Airflow isn't answering at {airflow}")
    host, port = os.getenv("WAREHOUSE_HOST", "localhost"), int(os.getenv("WAREHOUSE_PORT", "5434"))
    if not port_open(host, port):
        found.append(f"Postgres isn't answering at {host}:{port}")
    s3 = os.getenv("S3_ENDPOINT", "http://localhost:9000").rstrip("/")
    if not http_ok(f"{s3}/health"):
        found.append(f"RustFS isn't answering at {s3}")
    else:
        try:
            from src.lake.store import get_store
            from src.orchestration.state import last_heartbeat

            now = datetime.now(timezone.utc)
            for f in check_heartbeat(last_heartbeat(get_store("PROCESSED_BUCKET")), now, MonitorSettings.from_env()):
                found.append(f"{f.title}: {f.detail}")
        except Exception as e:
            found.append(f"Couldn't read the pipeline heartbeat: {type(e).__name__}: {e}")
    return found


def main() -> int:
    setup_logging(log_file="watchdog.log")
    if os.getenv("WATCHDOG_ENABLED", "true").strip().lower() not in ("1", "true", "yes", "on"):
        log.info("WATCHDOG_ENABLED is off; skipping")
        return 0
    found = problems()
    if not found:
        log.info("Watchdog: all services answering, pipeline heartbeat fresh")
        return 0
    body = "\n".join(["The SikaTrack stack needs attention:", ""] + [f"  - {p}" for p in found] + [
        "", "If Docker Desktop is closed or E: is unplugged, start Docker Desktop, then in data-engineering:",
        "  docker compose up -d", "  docker compose ps",
        "", "To pause these emails (e.g. while the drive is out), set WATCHDOG_ENABLED=false in .env."])
    log.warning("Watchdog found %d problem(s)", len(found))
    send_email(f"ACTION NEEDED: stack down ({len(found)} problem(s))", body)
    return 1


if __name__ == "__main__":
    sys.exit(main())
