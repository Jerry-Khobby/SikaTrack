"""The daily check: gather state, run every check, email the digest (or the problems).

Runs as the sikatrack_monitoring DAG every morning. Manual run inside Docker:
    docker compose exec airflow-scheduler python -m src.monitoring.daily
"""

import json
import logging
import os
from datetime import datetime, timezone

from src.monitoring.checks import (
    Finding, MonitorSettings, check_backups, check_heartbeat, check_last_run, check_quality,
)
from src.monitoring.notify import send_email

log = logging.getLogger(__spec__.name if __spec__ else __name__)

AIRFLOW_URL = os.getenv("AIRFLOW_PUBLIC_URL", "http://localhost:8080")


def fetch_runs(conn, limit: int = 20) -> list[dict]:
    """Recent dw.etl_run rows, newest first, with the quality report parsed."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT run_id, status, started_at, finished_at, rows_in, rows_inserted, rows_updated,
                   rows_unchanged, quality_report, error
            FROM dw.etl_run ORDER BY started_at DESC LIMIT %s""", (limit,))
        columns = [c.name for c in cur.description]
        rows = [dict(zip(columns, r)) for r in cur.fetchall()]
    for row in rows:
        report = row["quality_report"]
        row["quality_report"] = json.loads(report) if isinstance(report, str) else report
    return rows


def evaluate(runs: list[dict], backup_keys: list[str], heartbeat: datetime | None, now: datetime,
             settings: MonitorSettings) -> list[Finding]:
    succeeded = [r for r in runs if r["status"] == "succeeded" and r.get("quality_report")]
    latest = succeeded[0] if succeeded else None
    previous = succeeded[1] if len(succeeded) > 1 else None
    return (
        check_heartbeat(heartbeat, now, settings)
        + check_last_run(runs)
        + check_backups(backup_keys, latest["finished_at"] if latest else None, now.date(), settings)
        + check_quality(latest["quality_report"] if latest else None,
                        previous["quality_report"] if previous else None, settings)
    )


def _summary_lines(run: dict | None) -> list[str]:
    if not run:
        return ["No successful warehouse load yet."]
    r = run["quality_report"]
    lines = [f"Latest load: run {run['run_id']}, finished {run['finished_at']:%d %b %Y %H:%M} UTC",
             f"  Transactions: {r.get('rows_out', 0):,} (inserted {run['rows_inserted'] or 0:,}, "
             f"updated {run['rows_updated'] or 0:,}, unchanged {run['rows_unchanged'] or 0:,})"]
    parse = r.get("parse")
    if parse:
        lines.append(f"  Parsed: {parse['parsed']:,} of {parse['total']:,} SMS, {parse['unparsed']} unparsed "
                     f"(parse rate {parse['parse_success_rate']:.1%})")
    if r.get("categories"):
        lines.append(f"  Category coverage: {r['categories']['coverage']:.1%} of spending")
    if r.get("providers"):
        lines.append("  Balance continuity: " + ", ".join(
            f"{p} {s['continuity_rate']:.1%}" for p, s in r["providers"].items()))
    lines.append(f"  Unexplained balance gaps: {(r.get('balance_gap_reasons') or {}).get('unexplained', 0)}")
    rec = r.get("recurring")
    if rec:
        lines.append(f"  Recurring payments: {rec['series']} series, {rec['active_series']} active "
                     f"(~GHS {rec['active_monthly_cost']:,.2f}/month)")
    return lines


def compose(findings: list[Finding], runs: list[dict], heartbeat: datetime | None, backup_keys: list[str],
            now: datetime) -> tuple[str, str]:
    critical = [f for f in findings if f.level == "critical"]
    warnings = [f for f in findings if f.level == "warning"]
    if critical:
        subject = f"ACTION NEEDED: {len(critical)} problem(s)"
    elif warnings:
        subject = f"Daily digest: {len(warnings)} warning(s)"
    else:
        subject = "Daily digest: all good"

    lines = [f"SikaTrack daily digest, {now:%d %b %Y %H:%M} UTC", ""]
    for label, group in (("PROBLEMS (act now)", critical), ("WARNINGS (drifting toward a quality gate)", warnings)):
        if group:
            lines.append(label)
            lines += [f"  - {f.title}: {f.detail}" for f in group]
            lines.append("")
    if not findings:
        lines += ["Everything looks healthy.", ""]

    succeeded = [r for r in runs if r["status"] == "succeeded" and r.get("quality_report")]
    lines += _summary_lines(succeeded[0] if succeeded else None)
    lines.append("")
    lines.append(f"Pipeline last ran: {heartbeat:%d %b %Y %H:%M} UTC" if heartbeat else "Pipeline last ran: never")
    lines.append(f"Backups in the raw zone: {len(backup_keys)}")
    lines.append(f"Airflow: {AIRFLOW_URL}/dags/sikatrack_pipeline")
    return subject, "\n".join(lines)


def run(conn=None, now: datetime | None = None, send: bool = True) -> dict:
    """Gather everything, evaluate, and email. Unreachable services become findings, not crashes."""
    from src.lake.raw_zone import list_backups
    from src.lake.store import get_store
    from src.orchestration.state import last_heartbeat

    now = now or datetime.now(timezone.utc)
    settings = MonitorSettings.from_env()
    problems: list[Finding] = []

    heartbeat, backup_keys = None, []
    try:
        heartbeat = last_heartbeat(get_store("PROCESSED_BUCKET"))
        backup_keys = list_backups(get_store("RAW_BUCKET"))
    except Exception as e:
        problems.append(Finding("critical", "Data lake (RustFS) unreachable", f"{type(e).__name__}: {e}"))

    runs: list[dict] = []
    own_conn = conn is None
    try:
        if own_conn:
            from src.load.warehouse import connect
            conn = connect()
        runs = fetch_runs(conn)
    except Exception as e:
        problems.append(Finding("critical", "Warehouse (Postgres) unreachable", f"{type(e).__name__}: {e}"))
    finally:
        if own_conn and conn is not None:
            conn.close()

    findings = problems + evaluate(runs, backup_keys, heartbeat, now, settings)
    subject, body = compose(findings, runs, heartbeat, backup_keys, now)
    log.info("%s\n%s", subject, body)

    digest_on = os.getenv("DIGEST_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")
    sent = False
    if send and (findings or digest_on):
        sent = send_email(subject, body)
    return {"subject": subject, "findings": [f.__dict__ for f in findings], "sent": sent}


if __name__ == "__main__":
    from src.utils.logging_config import setup_logging

    setup_logging()
    run()
