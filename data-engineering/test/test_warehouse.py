"""Warehouse migrations + load, against the Postgres container from docker-compose.

Each test gets a throwaway database (sikatrack_test_<id>) that's dropped afterwards, so the
real sikatrack_dw is never touched. Locally they're skipped when the container isn't running;
in CI (REQUIRE_WAREHOUSE=1, Postgres service container) they must run, so they fail instead.

Connection settings: WAREHOUSE_* environment variables (CI), else data-engineering/.env.
"""

import os
import uuid
from pathlib import Path

import pandas as pd
import psycopg2
import pytest
from dotenv import dotenv_values
from psycopg2 import sql as pgsql

import samples as s
from src.load.warehouse import migrate, load_transactions
from src.orchestration.pipeline import run_pipeline
from src.transform.config import Owner

ENV = {
    **dotenv_values(Path(__file__).parents[1] / ".env"),
    **{k: v for k, v in os.environ.items() if k.startswith("WAREHOUSE_")},
}
REQUIRED = os.getenv("REQUIRE_WAREHOUSE") == "1"


def _dsn(dbname: str) -> str:
    return (f"host={ENV.get('WAREHOUSE_HOST', 'localhost')} port={ENV.get('WAREHOUSE_PORT', '5434')} "
            f"dbname={dbname} user={ENV.get('WAREHOUSE_USER')} password={ENV.get('WAREHOUSE_PASSWORD')} "
            "connect_timeout=3")


@pytest.fixture(scope="session")
def admin():
    """Autocommit connection to the warehouse server, for creating and dropping test databases."""
    try:
        connection = psycopg2.connect(_dsn(ENV.get("WAREHOUSE_DB", "sikatrack_dw")))
    except psycopg2.OperationalError as e:
        if REQUIRED:
            pytest.fail(f"REQUIRE_WAREHOUSE=1 but Postgres isn't reachable: {e}")
        pytest.skip(f"Postgres container not reachable (docker compose up -d): {e}")
    connection.autocommit = True
    yield connection
    connection.close()


@pytest.fixture
def test_db(admin):
    """Name of a fresh, empty database, dropped after the test."""
    name = f"sikatrack_test_{uuid.uuid4().hex[:8]}"
    with admin.cursor() as cur:
        cur.execute(pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(name)))
    yield name
    with admin.cursor() as cur:
        cur.execute(pgsql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(pgsql.Identifier(name)))


@pytest.fixture
def conn(test_db):
    connection = psycopg2.connect(_dsn(test_db))
    yield connection
    connection.close()


@pytest.fixture
def parquet(make_xml, tmp_path):
    xml = make_xml([
        (s.MTN, "2025-11-17T16:40:30", s.MERCHANT_PAID),
        (s.MTN, "2025-11-17T16:40:31", s.MERCHANT_CONFIRMED),
        (s.MTN, "2025-11-18T09:00:00", s.PAYMENT_RECEIVED),
        (s.GHANAPAY, "2026-01-28T07:21:34", s.BANK_IN),
        (s.GHANAPAY, "2026-01-27T12:27:00", s.SAVINGS_WITHDRAWAL),
    ])
    run_pipeline(xml, tmp_path / "data", owner=Owner(), load=False)
    return tmp_path / "data" / "processed" / "transactions.parquet"


def query(conn, sql):
    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def test_migrations_apply_once(conn):
    assert migrate(conn) == ["001_star_schema", "002_categorisation", "003_recurring"]
    assert migrate(conn) == []
    assert query(conn, "SELECT count(*) FROM dw.dim_date")[0][0] > 4000


def test_loading_twice_changes_nothing(conn, parquet):
    migrate(conn)

    first = load_transactions(conn, parquet, "run-1")
    second = load_transactions(conn, parquet, "run-2")

    assert first == {"rows_in": 4, "rows_inserted": 4, "rows_updated": 0, "rows_unchanged": 0}
    assert second == {"rows_in": 4, "rows_inserted": 0, "rows_updated": 0, "rows_unchanged": 4}
    assert query(conn, "SELECT count(*), min(pipeline_run_id) FROM dw.fact_transaction") == [(4, "run-1")]
    assert query(conn, "SELECT run_id, status FROM dw.etl_run ORDER BY run_id") == [
        ("run-1", "succeeded"), ("run-2", "succeeded")]


def test_changed_rows_are_updated_and_stamped(conn, parquet):
    migrate(conn)
    load_transactions(conn, parquet, "run-1")
    df = pd.read_parquet(parquet)
    df.loc[0, "reference"] = "edited"
    df.to_parquet(parquet, index=False)

    counts = load_transactions(conn, parquet, "run-2")

    assert (counts["rows_updated"], counts["rows_unchanged"]) == (1, 3)
    assert query(conn, "SELECT reference, pipeline_run_id, updated_at IS NOT NULL FROM dw.fact_transaction "
                       "WHERE pipeline_run_id = 'run-2'") == [("edited", "run-2", True)]


def test_recurring_flags_are_loaded(conn, make_xml, tmp_path):
    weekly = [(s.MTN, f"2026-01-{day:02d}T09:00:00", s.PAYMENT_MADE.replace("69065381661", f"7{day:010d}"))
              for day in (1, 8, 15, 22, 29)]
    run_pipeline(make_xml(weekly), tmp_path / "data", owner=Owner(), load=False)
    migrate(conn)
    load_transactions(conn, tmp_path / "data" / "processed" / "transactions.parquet", "run-1")

    assert query(conn, """
        SELECT count(*), count(DISTINCT recurring_series), min(recurring_interval_days)
        FROM dw.v_fact_transaction WHERE is_recurring""") == [(5, 1, 7)]


def test_dimensions_are_filled(conn, parquet):
    migrate(conn)
    load_transactions(conn, parquet, "run-1")

    assert query(conn, """
        SELECT c.counterparty_name, c.counterparty_kind, t.template, p.provider_code
        FROM dw.fact_transaction f
        JOIN dw.dim_counterparty c USING (counterparty_key)
        JOIN dw.dim_transaction_type t USING (transaction_type_key)
        JOIN dw.dim_provider p USING (provider_key)
        WHERE t.template = 'merchant_payment'
    """) == [("SUNSHINE LAUNDRY", "merchant", "merchant_payment", "mtn_momo")]
    assert query(conn, "SELECT count(*) FROM dw.fact_transaction WHERE counterparty_key = -1") == [(0,)]


def test_power_bi_view_hides_raw_sms_text(conn):
    migrate(conn)
    columns = [r[0] for r in query(conn, """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'dw' AND table_name = 'v_fact_transaction'""")]
    assert "amount" in columns and "raw_text" not in columns


def test_failed_load_rolls_back_and_is_recorded(conn, parquet):
    migrate(conn)
    df = pd.read_parquet(parquet)
    df.loc[3, "date_key"] = 19000101  # not in dim_date: foreign key violation on the last row
    df.to_parquet(parquet, index=False)

    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        load_transactions(conn, parquet, "run-bad")

    assert query(conn, "SELECT count(*) FROM dw.fact_transaction") == [(0,)]
    assert query(conn, "SELECT count(*) FROM dw.dim_counterparty WHERE counterparty_key > 0") == [(0,)]
    status, error = query(conn, "SELECT status, error FROM dw.etl_run WHERE run_id = 'run-bad'")[0]
    assert status == "failed" and "ForeignKeyViolation" in error


def test_migrations_upgrade_a_database_created_before_they_were_tracked(conn):
    """The Docker warehouse was first created from the base schema alone, with no tracking table."""
    with conn, conn.cursor() as cur:
        cur.execute((Path(__file__).parents[1] / "sql/migrations/001_star_schema.sql").read_text(encoding="utf-8"))

    assert migrate(conn) == ["002_categorisation", "003_recurring"]
    assert query(conn, "SELECT version FROM dw.schema_migration ORDER BY version") == [
        ("001_star_schema",), ("002_categorisation",), ("003_recurring",)]


def test_missing_migrations_folder_fails_loudly(conn, monkeypatch, tmp_path):
    import src.load.warehouse as warehouse

    monkeypatch.setattr(warehouse, "MIGRATIONS_DIR", tmp_path / "missing")
    with pytest.raises(FileNotFoundError, match="No schema migrations"):
        migrate(conn)


def test_categories_are_loaded(conn, parquet):
    migrate(conn)
    load_transactions(conn, parquet, "run-1")

    rows = query(conn, """
        SELECT c.category_name, c.category_group, f.category_rule
        FROM dw.fact_transaction f JOIN dw.dim_category c USING (category_key)
        ORDER BY f.occurred_at""")
    assert ("Income", "Money In", "money_in:transfer") in rows
    assert all(category != "Uncategorized" for category, _, _ in rows)
    assert "category_rule" in [r[0] for r in query(conn, """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'dw' AND table_name = 'v_fact_transaction'""")]


def test_unknown_category_fails_the_load(conn, parquet):
    migrate(conn)
    df = pd.read_parquet(parquet)
    df.loc[0, "category"] = "Crypto"
    df.to_parquet(parquet, index=False)

    with pytest.raises(ValueError, match="Crypto"):
        load_transactions(conn, parquet, "run-1")
    assert query(conn, "SELECT count(*) FROM dw.fact_transaction") == [(0,)]


def test_pipeline_loads_the_warehouse(test_db, make_xml, tmp_path):
    xml = make_xml([(s.MTN, "2025-11-18T09:00:00", s.PAYMENT_RECEIVED)])
    dsn = _dsn(test_db)

    first = run_pipeline(xml, tmp_path / "data", owner=Owner(), warehouse_dsn=dsn)
    second = run_pipeline(xml, tmp_path / "data", owner=Owner(), warehouse_dsn=dsn)

    assert first["load"]["rows_inserted"] == 1
    assert second["load"]["rows_unchanged"] == 1

def test_monitoring_reads_load_history(conn, parquet):
    from src.monitoring.daily import fetch_runs
    migrate(conn)
    load_transactions(conn, parquet, "run-1", {"rows_out": 4, "categories": {"coverage": 1.0}})

    runs = fetch_runs(conn)

    assert [r["run_id"] for r in runs] == ["run-1"]
    assert runs[0]["status"] == "succeeded" and runs[0]["quality_report"]["rows_out"] == 4
