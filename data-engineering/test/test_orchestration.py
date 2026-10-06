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


def test_make_run_isolates_work_files_per_run(tmp_path):
    run = make_run("run-1", tmp_path / "work" / "run-1", owner=Owner())
    assert run.paths.parsed == tmp_path / "work" / "run-1" / "parsed_transactions.json"
    assert run.run_id == "run-1" and run.load is False
