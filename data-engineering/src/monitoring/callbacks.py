"""Airflow callbacks: email when a task fails for good (after its retries)."""

import logging
import os
from urllib.parse import quote

from src.monitoring.notify import send_email

log = logging.getLogger(__spec__.name if __spec__ else __name__)


def task_url(dag_id: str, run_id: str, task_id: str) -> str:
    base = os.getenv("AIRFLOW_PUBLIC_URL", "http://localhost:8080").rstrip("/")
    return f"{base}/dags/{quote(dag_id)}/runs/{quote(run_id, safe='')}/tasks/{quote(task_id)}"


def failure_message(dag_id: str, task_id: str, run_id: str, try_number, exception) -> tuple[str, str]:
    error = f"{type(exception).__name__}: {exception}" if exception else "no exception recorded"
    subject = f"FAILED: {dag_id}.{task_id}"
    body = "\n".join([
        f"Task {task_id} in {dag_id} failed after its retries.",
        "",
        f"Run:     {run_id}",
        f"Attempt: {try_number}",
        f"Error:   {error[:2000]}",
        "",
        f"Log: {task_url(dag_id, run_id, task_id)}",
        "",
        "What to do: open the log. A quality gate failure means new data needs attention "
        "(see docs/runbook.md); a connection error usually means a container is down.",
    ])
    return subject, body


def on_task_failure(context) -> None:
    """Airflow on_failure_callback. Never raises: a broken alert mustn't hide the real failure."""
    try:
        ti = context.get("ti") or context.get("task_instance")
        subject, body = failure_message(
            dag_id=getattr(ti, "dag_id", None) or context["dag"].dag_id,
            task_id=getattr(ti, "task_id", "?"),
            run_id=context.get("run_id") or getattr(ti, "run_id", "?"),
            try_number=getattr(ti, "try_number", "?"),
            exception=context.get("exception"),
        )
        send_email(subject, body)
    except Exception:
        log.exception("Could not send the failure alert")
