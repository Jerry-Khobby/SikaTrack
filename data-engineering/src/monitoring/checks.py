"""Health and quality checks. Pure functions over plain data, so they're easy to test.

Two levels:
    critical  something is broken or stuck: act now
    warning   still within the quality gates, but drifting toward them
"""

import os
from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True)
class Finding:
    level: str      # "critical" | "warning"
    title: str
    detail: str


def _env(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value not in (None, "") else default


@dataclass(frozen=True)
class MonitorSettings:
    max_hours_since_pipeline: float = 36     # the DAG runs daily; allow one missed run
    max_days_since_backup: float = 14        # time to export a fresh SMS backup
    max_days_backup_not_loaded: float = 2    # a staged backup should be loaded by the next run
    warn_min_parse_rate: float = 0.98        # gate: 0.95
    warn_min_category_coverage: float = 0.95  # gate: 0.90
    warn_min_balance_continuity: float = 0.99  # gate: 0.98
    warn_max_unexplained_gaps: float = 10    # gate: 20
    warn_max_coverage_drop: float = 0.02     # vs the previous load

    @classmethod
    def from_env(cls) -> "MonitorSettings":
        return cls(**{name: _env(f"MONITOR_{name.upper()}", default)
                      for name, default in cls().__dict__.items()})


def check_heartbeat(last: datetime | None, now: datetime, s: MonitorSettings) -> list[Finding]:
    if last is None:
        return [Finding("critical", "Pipeline has never run",
                        "No heartbeat found. Switch on sikatrack_pipeline in Airflow and trigger it.")]
    hours = (now - last).total_seconds() / 3600
    if hours > s.max_hours_since_pipeline:
        return [Finding("critical", "Pipeline has stopped running",
                        f"Last run {hours:.0f} hours ago ({last:%d %b %Y %H:%M} UTC); expected daily. "
                        "Check that sikatrack_pipeline is switched on and the scheduler is healthy.")]
    return []


def backup_dates(keys: list[str]) -> list[date]:
    """Ingest dates from raw-zone keys like sms_backup/ingest_date=2026-10-06/file-hash.xml."""
    dates = []
    for key in keys:
        for part in key.split("/"):
            if part.startswith("ingest_date="):
                dates.append(date.fromisoformat(part.split("=", 1)[1]))
    return dates


def check_backups(keys: list[str], last_load: datetime | None, today: date, s: MonitorSettings) -> list[Finding]:
    dates = backup_dates(keys)
    if not dates:
        return [Finding("critical", "No backups in the raw zone",
                        "Drop an SMS Backup & Restore export into data/inbox/.")]
    newest = max(dates)
    findings = []
    age = (today - newest).days
    if age > s.max_days_since_backup:
        findings.append(Finding("warning", "No new SMS backup recently",
                                f"Newest backup was staged {age} days ago ({newest}). Export a new one "
                                "into data/inbox/ to keep the dashboard current."))
    if (last_load is None or newest > last_load.date()) and age >= s.max_days_backup_not_loaded:
        findings.append(Finding("critical", "A staged backup hasn't been loaded",
                                f"Backup from {newest} is in the raw zone but no successful load since. "
                                "Check the latest sikatrack_pipeline run."))
    return findings


def check_last_run(runs: list[dict]) -> list[Finding]:
    """runs: dw.etl_run rows, newest first."""
    if runs and runs[0]["status"] == "failed":
        return [Finding("critical", "Last warehouse load failed",
                        f"Run {runs[0]['run_id']}: {runs[0].get('error') or 'no error recorded'}")]
    return []


def check_quality(latest: dict | None, previous: dict | None, s: MonitorSettings) -> list[Finding]:
    """latest / previous: quality reports of the two most recent successful loads."""
    if not latest:
        return []
    findings = []

    parse = latest.get("parse") or {}
    rate = parse.get("parse_success_rate")
    if rate is not None and rate < s.warn_min_parse_rate:
        findings.append(Finding("warning", "Parse rate is drifting down",
                                f"{rate:.1%} (warning below {s.warn_min_parse_rate:.0%}, gate fails below 95%). "
                                f"{parse.get('unparsed', '?')} SMS unparsed: probably a new SMS format."))

    coverage = (latest.get("categories") or {}).get("coverage")
    if coverage is not None and coverage < s.warn_min_category_coverage:
        findings.append(Finding("warning", "Category coverage is drifting down",
                                f"{coverage:.1%} of spending categorised (warning below "
                                f"{s.warn_min_category_coverage:.0%}). Add keywords in src/transform/categorise.py."))
    prev_coverage = ((previous or {}).get("categories") or {}).get("coverage")
    if coverage is not None and prev_coverage is not None and prev_coverage - coverage > s.warn_max_coverage_drop:
        findings.append(Finding("warning", "Category coverage dropped since the last load",
                                f"{prev_coverage:.1%} -> {coverage:.1%}."))

    for provider, stats in (latest.get("providers") or {}).items():
        rate = stats.get("continuity_rate")
        if stats.get("balance_checked") and rate is not None and rate < s.warn_min_balance_continuity:
            findings.append(Finding("warning", f"{provider} balance continuity is drifting down",
                                    f"{rate:.1%} (warning below {s.warn_min_balance_continuity:.0%}): "
                                    "more SMS are missing from the backups."))

    unexplained = (latest.get("balance_gap_reasons") or {}).get("unexplained", 0)
    if unexplained > s.warn_max_unexplained_gaps:
        findings.append(Finding("warning", "Unexplained balance gaps are piling up",
                                f"{unexplained} (warning above {s.warn_max_unexplained_gaps:.0f}, gate at 20)."))

    rows, prev_rows = latest.get("rows_out"), (previous or {}).get("rows_out")
    if rows is not None and prev_rows is not None and rows < prev_rows:
        findings.append(Finding("warning", "Fewer transactions than the previous load",
                                f"{prev_rows:,} -> {rows:,}. History should only grow: check the raw zone "
                                "still holds every backup."))
    return findings
