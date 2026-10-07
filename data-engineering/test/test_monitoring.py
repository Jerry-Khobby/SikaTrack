from datetime import date, datetime, timedelta, timezone

import pytest

from src.lake.store import get_store
from src.monitoring import daily, watchdog
from src.monitoring.callbacks import failure_message, on_task_failure, task_url
from src.monitoring.checks import (
    MonitorSettings, backup_dates, check_backups, check_heartbeat, check_last_run, check_quality,
)
from src.monitoring.notify import recipients, send_email
from src.orchestration import state

NOW = datetime(2026, 10, 7, 6, 0, tzinfo=timezone.utc)
S = MonitorSettings()


@pytest.fixture
def email_on(monkeypatch):
    monkeypatch.setenv("ALERTS_ENABLED", "true")
    monkeypatch.setenv("EMAIL_USER", "me@gmail.com")
    monkeypatch.setenv("EMAIL_PASS", "abcd efgh ijkl mnop")


def report(coverage=0.999, continuity=0.996, unexplained=6, rows=1890, parse_rate=1.0, unparsed=0):
    return {
        "rows_out": rows, "categories": {"coverage": coverage},
        "providers": {"mtn_momo": {"continuity_rate": continuity, "balance_checked": 1813}},
        "balance_gap_reasons": {"unexplained": unexplained},
        "parse": {"total": 2583, "parsed": 1964, "ignored": 619, "unparsed": unparsed, "parse_success_rate": parse_rate},
        "recurring": {"series": 7, "active_series": 2, "active_monthly_cost": 235.0},
    }


def etl_run(run_id, status="succeeded", hours_ago=6, rep=None, error=None):
    finished = NOW - timedelta(hours=hours_ago)
    return {"run_id": run_id, "status": status, "started_at": finished, "finished_at": finished,
            "rows_in": 1890, "rows_inserted": 0, "rows_updated": 0, "rows_unchanged": 1890,
            "quality_report": rep if rep is not None else report(), "error": error}


# ---------------------------------------------------------------- email
def test_send_email(email_on, outbox):
    assert send_email("Test", "hello") is True
    msg = outbox[-1]
    assert msg["Subject"] == "[SikaTrack] Test"
    assert msg["To"] == "me@gmail.com" and msg.get_content().strip() == "hello"


def test_app_password_spaces_are_removed(email_on, outbox):
    from conftest import FakeSMTP
    send_email("Test", "x")
    assert FakeSMTP.last_login == ("me@gmail.com", "abcdefghijklmnop")


def test_recipients_override(email_on, monkeypatch):
    monkeypatch.setenv("ALERT_EMAIL_TO", "a@x.com, b@y.com")
    assert recipients() == ["a@x.com", "b@y.com"]


def test_alerts_can_be_switched_off(outbox):
    assert send_email("Test", "x") is False  # conftest sets ALERTS_ENABLED=false
    assert outbox == []


def test_missing_credentials_fail_loudly(monkeypatch):
    monkeypatch.setenv("ALERTS_ENABLED", "true")
    with pytest.raises(RuntimeError, match="EMAIL_USER"):
        send_email("Test", "x")


# ---------------------------------------------------------------- checks
@pytest.mark.parametrize("last, expected", [
    (None, ["Pipeline has never run"]),
    (NOW - timedelta(hours=40), ["Pipeline has stopped running"]),
    (NOW - timedelta(hours=10), []),
])
def test_heartbeat(last, expected):
    assert [f.title for f in check_heartbeat(last, NOW, S)] == expected


def test_backup_dates_from_keys():
    assert backup_dates(["sms_backup/ingest_date=2026-10-06/a-1.xml"]) == [date(2026, 10, 6)]


def test_backups_ok_when_recent_and_loaded():
    keys = ["sms_backup/ingest_date=2026-10-06/a-1.xml"]
    assert check_backups(keys, NOW - timedelta(hours=6), NOW.date(), S) == []


def test_old_backup_is_a_warning():
    keys = ["sms_backup/ingest_date=2026-09-01/a-1.xml"]
    findings = check_backups(keys, datetime(2026, 9, 2, tzinfo=timezone.utc), NOW.date(), S)
    assert [(f.level, f.title) for f in findings] == [("warning", "No new SMS backup recently")]


def test_staged_but_never_loaded_is_critical():
    keys = ["sms_backup/ingest_date=2026-10-04/a-1.xml"]
    findings = check_backups(keys, datetime(2026, 10, 1, tzinfo=timezone.utc), NOW.date(), S)
    assert [(f.level, f.title) for f in findings] == [("critical", "A staged backup hasn't been loaded")]


def test_empty_raw_zone_is_critical():
    assert check_backups([], None, NOW.date(), S)[0].title == "No backups in the raw zone"


def test_failed_last_load_is_critical():
    findings = check_last_run([etl_run("r2", status="failed", error="boom"), etl_run("r1")])
    assert findings[0].level == "critical" and "boom" in findings[0].detail


def test_healthy_quality_has_no_findings():
    assert check_quality(report(), report(), S) == []


@pytest.mark.parametrize("latest, previous, title", [
    (report(parse_rate=0.96, unparsed=80), report(), "Parse rate is drifting down"),
    (report(coverage=0.93), report(coverage=0.93), "Category coverage is drifting down"),
    (report(coverage=0.96), report(coverage=0.999), "Category coverage dropped since the last load"),
    (report(continuity=0.985), report(), "mtn_momo balance continuity is drifting down"),
    (report(unexplained=12), report(), "Unexplained balance gaps are piling up"),
    (report(rows=1800), report(rows=1890), "Fewer transactions than the previous load"),
])
def test_quality_drift_warnings(latest, previous, title):
    findings = check_quality(latest, previous, S)
    assert title in [f.title for f in findings]
    assert all(f.level == "warning" for f in findings)


def test_settings_come_from_env(monkeypatch):
    monkeypatch.setenv("MONITOR_MAX_DAYS_SINCE_BACKUP", "30")
    monkeypatch.setenv("MONITOR_WARN_MIN_CATEGORY_COVERAGE", "0.97")
    s = MonitorSettings.from_env()
    assert (s.max_days_since_backup, s.warn_min_category_coverage, s.max_hours_since_pipeline) == (30, 0.97, 36)


# ---------------------------------------------------------------- daily digest
def test_digest_all_good():
    runs = [etl_run("r2"), etl_run("r1", hours_ago=30)]
    keys = ["sms_backup/ingest_date=2026-10-06/a-1.xml"]
    findings = daily.evaluate(runs, keys, NOW - timedelta(hours=6), NOW, S)
    subject, body = daily.compose(findings, runs, NOW - timedelta(hours=6), keys, NOW)

    assert findings == [] and subject == "Daily digest: all good"
    assert "Transactions: 1,890" in body and "0 unparsed (parse rate 100.0%)" in body
    assert "Category coverage: 99.9%" in body and "2 active (~GHS 235.00/month)" in body


def test_digest_with_problems_says_action_needed():
    runs = [etl_run("r2", status="failed", error="boom"), etl_run("r1", hours_ago=30)]
    findings = daily.evaluate(runs, [], None, NOW, S)
    subject, body = daily.compose(findings, runs, None, [], NOW)
    assert subject.startswith("ACTION NEEDED")
    assert "PROBLEMS (act now)" in body and "Pipeline has never run" in body


def test_daily_run_emails_the_digest(email_on, outbox, monkeypatch):
    raw, processed = get_store("RAW_BUCKET"), get_store("PROCESSED_BUCKET")
    state.save_heartbeat(processed, NOW - timedelta(hours=6))
    import tempfile, pathlib
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "b.xml"
        f.write_text("<smses/>")
        raw.put_file("sms_backup/ingest_date=2026-10-06/b-1.xml", f)
    monkeypatch.setattr(daily, "fetch_runs", lambda conn: [etl_run("r2"), etl_run("r1", hours_ago=30)])

    result = daily.run(conn=object(), now=NOW)

    assert result["subject"] == "Daily digest: all good" and result["sent"] is True
    assert outbox[-1]["Subject"] == "[SikaTrack] Daily digest: all good"


def test_daily_run_reports_an_unreachable_warehouse(email_on, outbox, monkeypatch):
    def broken(conn):
        raise ConnectionError("no route to host")
    monkeypatch.setattr(daily, "fetch_runs", broken)

    result = daily.run(conn=object(), now=NOW)

    assert result["subject"].startswith("ACTION NEEDED")
    assert "Warehouse (Postgres) unreachable" in [f["title"] for f in result["findings"]]


def test_digest_can_be_failures_only(email_on, outbox, monkeypatch):
    monkeypatch.setenv("DIGEST_ENABLED", "false")
    state.save_heartbeat(get_store("PROCESSED_BUCKET"), NOW - timedelta(hours=6))
    monkeypatch.setattr(daily, "fetch_runs", lambda conn: [etl_run("r1")])
    monkeypatch.setattr("src.lake.raw_zone.list_backups", lambda store: ["sms_backup/ingest_date=2026-10-06/a-1.xml"])

    result = daily.run(conn=object(), now=NOW)
    assert result["findings"] == [] and result["sent"] is False and outbox == []


# ---------------------------------------------------------------- failure callback
class FakeTI:
    dag_id, task_id, run_id, try_number = "sikatrack_pipeline", "parse", "manual__2026-10-07T00:00:00+00:00", 1


def test_failure_message_has_everything_needed():
    subject, body = failure_message("sikatrack_pipeline", "parse", "manual__2026-10-07T00:00:00+00:00", 3,
                                    ValueError("parse rate 50.0% < 95.0%"))
    assert subject == "FAILED: sikatrack_pipeline.parse"
    assert "ValueError: parse rate 50.0% < 95.0%" in body and "Attempt: 3" in body
    assert "http://localhost:8080/dags/sikatrack_pipeline/runs/manual__2026-10-07T00%3A00%3A00%2B00%3A00/tasks/parse" in body


def test_task_url_uses_public_url(monkeypatch):
    monkeypatch.setenv("AIRFLOW_PUBLIC_URL", "http://myhost:9999/")
    assert task_url("d", "r", "t") == "http://myhost:9999/dags/d/runs/r/tasks/t"


def test_failure_callback_sends_an_email(email_on, outbox):
    on_task_failure({"ti": FakeTI(), "run_id": FakeTI.run_id, "exception": RuntimeError("db down")})
    assert outbox[-1]["Subject"] == "[SikaTrack] FAILED: sikatrack_pipeline.parse"
    assert "RuntimeError: db down" in outbox[-1].get_content()


def test_failure_callback_never_raises(monkeypatch):
    monkeypatch.setenv("ALERTS_ENABLED", "true")  # but no credentials: send_email raises inside
    on_task_failure({"ti": FakeTI(), "run_id": FakeTI.run_id, "exception": None})


# ---------------------------------------------------------------- heartbeat + watchdog
def test_heartbeat_round_trip():
    processed = get_store("PROCESSED_BUCKET")
    assert state.last_heartbeat(processed) is None
    state.save_heartbeat(processed, NOW)
    assert state.last_heartbeat(processed) == NOW


def test_watchdog_reports_every_service_down(email_on, outbox, monkeypatch):
    monkeypatch.setattr(watchdog, "http_ok", lambda url: False)
    monkeypatch.setattr(watchdog, "port_open", lambda host, port: False)
    monkeypatch.setattr(watchdog, "setup_logging", lambda **kw: None)

    assert watchdog.main() == 1
    body = outbox[-1].get_content()
    assert "Airflow isn't answering" in body and "Postgres isn't answering" in body and "RustFS" in body


def test_watchdog_quiet_when_healthy(email_on, outbox, monkeypatch):
    monkeypatch.setattr(watchdog, "http_ok", lambda url: True)
    monkeypatch.setattr(watchdog, "port_open", lambda host, port: True)
    monkeypatch.setattr(watchdog, "setup_logging", lambda **kw: None)
    state.save_heartbeat(get_store("PROCESSED_BUCKET"))

    assert watchdog.main() == 0 and outbox == []


def test_watchdog_can_be_paused(monkeypatch, outbox):
    monkeypatch.setenv("WATCHDOG_ENABLED", "false")
    monkeypatch.setattr(watchdog, "setup_logging", lambda **kw: None)
    assert watchdog.main() == 0 and outbox == []
