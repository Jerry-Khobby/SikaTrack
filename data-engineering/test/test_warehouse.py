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
    assert migrate(conn) == [
        "001_star_schema", "002_categorisation", "003_recurring", "004_dashboard_views", "005_users",
        "006_api_views"]
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

    assert migrate(conn) == [
        "002_categorisation", "003_recurring", "004_dashboard_views", "005_users", "006_api_views"]
    assert query(conn, "SELECT version FROM dw.schema_migration ORDER BY version") == [
        ("001_star_schema",), ("002_categorisation",), ("003_recurring",), ("004_dashboard_views",),
        ("005_users",), ("006_api_views",)]


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


def test_dashboard_views_match_the_facts(conn, parquet):
    migrate(conn)
    load_transactions(conn, parquet, "run-1")

    facts = query(conn, """
        SELECT sum(amount) FILTER (WHERE signed_amount < 0 AND NOT is_internal_transfer),
               sum(amount) FILTER (WHERE signed_amount > 0 AND NOT is_internal_transfer)
        FROM dw.fact_transaction""")[0]
    assert query(conn, "SELECT sum(money_out), sum(money_in) FROM mart.transactions") == [facts]
    assert query(conn, "SELECT sum(money_out), sum(money_in) FROM mart.monthly_cashflow") == [facts]
    assert query(conn, "SELECT transactions FROM mart.data_quality") == [(4,)]
    assert len(query(conn, "SELECT insight FROM mart.insights")) == 4
    assert all(name.startswith("Person #") or kind != "person" for name, kind in query(
        conn, "SELECT counterparty, counterparty_kind FROM mart.transactions"))


def test_dashboard_reader_sees_marts_but_not_raw_tables(conn):
    migrate(conn)
    with conn.cursor() as cur:
        cur.execute("SET ROLE mart_reader")
        cur.execute("SELECT count(*) FROM mart.transactions")
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute("SELECT raw_text FROM dw.fact_transaction")
    conn.rollback()


def test_users_never_share_rows_and_dashboards_show_only_the_owner(conn, parquet):
    migrate(conn)
    other = "11111111-1111-1111-1111-111111111111"

    owner_counts = load_transactions(conn, parquet, "run-owner")
    other_counts = load_transactions(conn, parquet, "run-other", user_id=other, is_legacy_owner=False)

    # The same SMS on two phones: each user gets their own rows, nothing is overwritten
    assert owner_counts["rows_inserted"] == other_counts["rows_inserted"] == 4
    assert query(conn, "SELECT count(*), count(DISTINCT user_key) FROM dw.fact_transaction") == [(8, 2)]
    assert query(conn, """
        SELECT count(DISTINCT user_key) FROM dw.dim_counterparty WHERE counterparty_key > 0""") == [(2,)]
    # The dashboards are the owner's personal view
    assert query(conn, "SELECT count(*) FROM mart.transactions") == [(4,)]
    assert query(conn, "SELECT count(*) FROM dw.v_fact_transaction") == [(4,)]
    assert query(conn, "SELECT transactions FROM mart.data_quality") == [(4,)]


def test_linking_the_owner_to_their_account_keeps_their_history(conn, parquet):
    migrate(conn)
    account = "22222222-2222-2222-2222-222222222222"
    load_transactions(conn, parquet, "run-before")

    after = load_transactions(conn, parquet, "run-after", user_id=account, is_legacy_owner=True)

    assert (after["rows_inserted"], after["rows_unchanged"]) == (0, 4)
    assert query(conn, "SELECT user_id::text, is_legacy_owner FROM dw.dim_user") == [(account, True)]


def test_linking_refuses_an_account_that_already_has_its_own_rows(conn, parquet):
    migrate(conn)
    account = "33333333-3333-3333-3333-333333333333"
    load_transactions(conn, parquet, "run-own", user_id=account, is_legacy_owner=False)

    with pytest.raises(ValueError, match="LEGACY_OWNER_USER_ID"):
        load_transactions(conn, parquet, "run-link", user_id=account, is_legacy_owner=True)


def test_an_app_users_wallets_are_their_own_accounts(conn, test_db):
    from src.orchestration.users import wallet_owner

    user = "44444444-4444-4444-4444-444444444444"
    assert wallet_owner(user, _dsn(test_db)) == Owner()  # before the backend's tables exist
    with conn, conn.cursor() as cur:
        cur.execute("""
            CREATE SCHEMA app;
            CREATE TABLE app.wallet (user_id uuid, account_name text, phone_number text);
            INSERT INTO app.wallet VALUES
                (%s, 'KWAME OWUSU', '+233240000001'),
                (%s, NULL, '+233200000002'),
                ('55555555-5555-5555-5555-555555555555', 'SOMEONE ELSE', '+233550000003');
        """, (user, user))

    owner = wallet_owner(user, _dsn(test_db))

    assert owner == Owner(names=frozenset({"KWAME OWUSU"}), numbers=frozenset({"0240000001", "0200000002"}))


def test_api_views_show_only_the_user_in_the_session(conn, parquet):
    migrate(conn)
    first, second = "66666666-6666-6666-6666-666666666666", "77777777-7777-7777-7777-777777777777"
    load_transactions(conn, parquet, "run-1", user_id=first, is_legacy_owner=False)
    load_transactions(conn, parquet, "run-2", user_id=second, is_legacy_owner=False)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO dw.fact_transaction (user_key, transaction_nk, message_id, amount, signed_amount, "
                    "occurred_at, raw_text) SELECT user_key, 'only-second', 'x', 1, -1, now(), 'x' "
                    "FROM dw.dim_user WHERE user_id = %s", (second,))
        cur.execute("SET ROLE api_reader")

        assert query(conn, "SELECT count(*) FROM api.transaction") == [(0,)]  # no user set: nothing
        cur.execute("SELECT set_config('sikatrack.user_id', %s, false)", (first,))
        assert query(conn, "SELECT count(*) FROM api.transaction") == [(4,)]
        cur.execute("SELECT set_config('sikatrack.user_id', %s, false)", (second,))
        assert query(conn, "SELECT count(*) FROM api.transaction") == [(5,)]
        assert query(conn, "SELECT count(*) FROM api.counterparty") > [(0,)]
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute("SELECT count(*) FROM dw.fact_transaction")
    conn.rollback()


def test_the_users_category_choices_are_read_from_the_backend(conn, test_db):
    from src.orchestration.users import user_categories
    from src.transform.config import UserCategories

    user = "88888888-8888-8888-8888-888888888888"
    assert user_categories(user, _dsn(test_db)) == UserCategories()  # before the backend's tables exist
    with conn, conn.cursor() as cur:
        cur.execute("""
            CREATE SCHEMA app;
            CREATE TABLE app.category_override (user_id uuid, transaction_nk text, category_name text);
            CREATE TABLE app.counterparty_preference (user_id uuid, counterparty_name text, default_category text);
            INSERT INTO app.category_override VALUES (%s, 'mtn:1', 'Bills'), (%s, 'mtn:2', NULL);
            INSERT INTO app.counterparty_preference VALUES (%s, 'MUM', 'Giving'), (%s, 'SHOP', NULL);
        """, (user, user, user, user))

    choices = user_categories(user, _dsn(test_db))

    assert choices == UserCategories(overrides={"mtn:1": "Bills"}, counterparty_defaults={"MUM": "Giving"})

