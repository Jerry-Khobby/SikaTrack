"""Warehouse schema + load, against a real Postgres started by pgserver (no Docker needed)."""

import itertools

import pandas as pd
import pytest

pgserver = pytest.importorskip("pgserver")
psycopg2 = pytest.importorskip("psycopg2")

import samples as s  # noqa: E402
from src.load.warehouse import apply_schema, load_transactions  # noqa: E402
from src.orchestration.pipeline import run_pipeline  # noqa: E402
from src.transform.config import Owner  # noqa: E402

_db_names = (f"test_{i}" for i in itertools.count())


@pytest.fixture(scope="session")
def pg(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pg"), cleanup_mode="stop")
    yield server
    server.cleanup()


@pytest.fixture
def conn(pg):
    """A fresh, empty database per test."""
    name = next(_db_names)
    pg.psql(f"CREATE DATABASE {name};")
    connection = psycopg2.connect(pg.get_uri(name))
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
    run_pipeline(xml, tmp_path / "data", owner=Owner())
    return tmp_path / "data" / "processed" / "transactions.parquet"


def query(conn, sql):
    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def test_schema_is_created_once(conn):
    assert apply_schema(conn) is True
    assert apply_schema(conn) is False
    assert query(conn, "SELECT count(*) FROM dw.dim_date")[0][0] > 4000


def test_loading_twice_changes_nothing(conn, parquet):
    apply_schema(conn)

    first = load_transactions(conn, parquet, "run-1")
    second = load_transactions(conn, parquet, "run-2")

    assert first == {"rows_in": 4, "rows_inserted": 4, "rows_updated": 0, "rows_unchanged": 0}
    assert second == {"rows_in": 4, "rows_inserted": 0, "rows_updated": 0, "rows_unchanged": 4}
    assert query(conn, "SELECT count(*), min(pipeline_run_id) FROM dw.fact_transaction") == [(4, "run-1")]
    assert query(conn, "SELECT run_id, status FROM dw.etl_run ORDER BY run_id") == [
        ("run-1", "succeeded"), ("run-2", "succeeded")]


def test_changed_rows_are_updated_and_stamped(conn, parquet):
    apply_schema(conn)
    load_transactions(conn, parquet, "run-1")
    df = pd.read_parquet(parquet)
    df.loc[0, "reference"] = "edited"
    df.to_parquet(parquet, index=False)

    counts = load_transactions(conn, parquet, "run-2")

    assert (counts["rows_updated"], counts["rows_unchanged"]) == (1, 3)
    assert query(conn, "SELECT reference, pipeline_run_id, updated_at IS NOT NULL FROM dw.fact_transaction "
                       "WHERE pipeline_run_id = 'run-2'") == [("edited", "run-2", True)]


def test_reload_keeps_columns_owned_by_later_steps(conn, parquet):
    apply_schema(conn)
    load_transactions(conn, parquet, "run-1")
    query_sql = "UPDATE dw.fact_transaction SET category_key = 2, is_recurring = TRUE RETURNING 1"
    with conn, conn.cursor() as cur:
        cur.execute(query_sql)

    load_transactions(conn, parquet, "run-2")

    assert query(conn, "SELECT DISTINCT category_key, is_recurring FROM dw.fact_transaction") == [(2, True)]


def test_dimensions_are_filled(conn, parquet):
    apply_schema(conn)
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
    apply_schema(conn)
    columns = [r[0] for r in query(conn, """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'dw' AND table_name = 'v_fact_transaction'""")]
    assert "amount" in columns and "raw_text" not in columns


def test_failed_load_rolls_back_and_is_recorded(conn, parquet):
    apply_schema(conn)
    df = pd.read_parquet(parquet)
    df.loc[3, "date_key"] = 19000101  # not in dim_date: foreign key violation on the last row
    df.to_parquet(parquet, index=False)

    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        load_transactions(conn, parquet, "run-bad")

    assert query(conn, "SELECT count(*) FROM dw.fact_transaction") == [(0,)]
    assert query(conn, "SELECT count(*) FROM dw.dim_counterparty WHERE counterparty_key > 0") == [(0,)]
    status, error = query(conn, "SELECT status, error FROM dw.etl_run WHERE run_id = 'run-bad'")[0]
    assert status == "failed" and "ForeignKeyViolation" in error


def test_pipeline_loads_the_warehouse(pg, make_xml, tmp_path):
    pg.psql("CREATE DATABASE pipeline_load;")
    dsn = pg.get_uri("pipeline_load")
    xml = make_xml([(s.MTN, "2025-11-18T09:00:00", s.PAYMENT_RECEIVED)])

    first = run_pipeline(xml, tmp_path / "data", owner=Owner(), load=True, warehouse_dsn=dsn)
    second = run_pipeline(xml, tmp_path / "data", owner=Owner(), load=True, warehouse_dsn=dsn)

    assert first["load"]["rows_inserted"] == 1
    assert second["load"]["rows_unchanged"] == 1
