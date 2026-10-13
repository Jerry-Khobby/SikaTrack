from datetime import datetime, timezone

import samples as s
from src.lake.raw_zone import list_backups, stage_inbox
from src.lake.store import get_store
from src.orchestration import state
from src.orchestration.pipeline import make_run
from src.orchestration.run_id import run_id_for
from src.transform.config import Owner

STARTED = datetime(2026, 10, 6, 17, 0, tzinfo=timezone.utc)


def test_run_id_is_deterministic_and_safe():
    airflow_id = "manual__2026-10-06T17:00:00+00:00"
    run_id = run_id_for(airflow_id, STARTED)

    assert run_id == run_id_for(airflow_id, STARTED)               # retries reuse it
    assert run_id != run_id_for("scheduled__2026-10-06", STARTED)  # other runs don't
    assert run_id.startswith("20261006T170000Z-")
    assert len(run_id) <= 40 and ":" not in run_id and "+" not in run_id


def test_inbox_staging_is_idempotent(make_xml, tmp_path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    make_xml([(s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE)], name="inbox/a.xml")
    raw = get_store("RAW_BUCKET")

    first = stage_inbox(inbox, raw)
    again = stage_inbox(inbox, raw)

    assert first == again and len(list_backups(raw)) == 1
    assert (inbox / "a.xml").exists()  # files are left in place


def test_empty_inbox_is_created_and_stages_nothing(tmp_path):
    assert stage_inbox(tmp_path / "new-inbox", get_store("RAW_BUCKET")) == []
    assert (tmp_path / "new-inbox").is_dir()


def test_fingerprint_changes_with_backups_and_settings(make_xml, tmp_path):
    raw, processed = get_store("RAW_BUCKET"), get_store("PROCESSED_BUCKET")
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    make_xml([(s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE)], name="inbox/a.xml")
    stage_inbox(inbox, raw)

    before = state.fingerprint(raw, Owner())
    assert state.last_fingerprint(processed) is None
    state.save_fingerprint(processed, before)
    assert state.last_fingerprint(processed) == before

    assert state.fingerprint(raw, Owner(names=frozenset({"KWAME OWUSU"}))) != before  # settings changed
    make_xml([(s.MTN, "2026-02-01T10:00:00", s.PAYMENT_RECEIVED)], name="inbox/b.xml")
    stage_inbox(inbox, raw)
    assert state.fingerprint(raw, Owner()) != before                                   # new backup


def test_make_run_isolates_work_files_per_run():
    run = make_run("run-1", owner=Owner())
    assert run.paths.data_dir.parts[-3:] == ("data", "work", "run-1")
    assert run.paths.parsed == run.paths.data_dir / "parsed_transactions.json"
    assert run.load is True  # Postgres is always part of the Docker stack


def test_finished_runs_are_reported_to_the_backend(monkeypatch):
    import json
    import urllib.request

    from src.orchestration.backend_events import notify_run_finished

    sent = []

    class Reply:
        status = 204

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_urlopen(request, timeout):
        sent.append((request.full_url, request.headers["Authorization"], json.loads(request.data)))
        return Reply()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setenv("BACKEND_INTERNAL_URL", "http://api:8000/")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "token-123")
    started = datetime(2026, 10, 12, 9, tzinfo=timezone.utc)

    assert notify_run_finished("user-1", "manual__1", "succeeded", started) is True
    url, auth, body = sent[0]
    assert (url, auth) == ("http://api:8000/internal/pipeline-events", "Bearer token-123")
    assert (body["user_id"], body["status"], body["started_at"]) == ("user-1", "succeeded", started.isoformat())


def test_reporting_is_skipped_without_a_user_or_backend_and_never_raises(monkeypatch):
    import urllib.request

    from src.orchestration.backend_events import notify_run_finished

    def unreachable(request, timeout):
        raise ConnectionRefusedError("api:8000")

    monkeypatch.setattr(urllib.request, "urlopen", unreachable)
    started = datetime.now(timezone.utc)
    assert notify_run_finished("user-1", "r", "succeeded", started) is False  # no backend configured
    monkeypatch.setenv("BACKEND_INTERNAL_URL", "http://api:8000")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "token-123")
    assert notify_run_finished(None, "r", "succeeded", started) is False  # the unlinked legacy owner
    assert notify_run_finished("user-1", "r", "failed", started) is False  # backend down: logged only

