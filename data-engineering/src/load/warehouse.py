"""Load the processed dataset into the Postgres star schema (dw).

Idempotent: every write is an upsert on a natural key, all inside one database
transaction. A fact row is only touched when its data changed, so loading the same
Parquet twice inserts and updates nothing the second time. A failed load rolls back
completely and is recorded in dw.etl_run.

Schema changes are numbered SQL files in sql/migrations/; migrate() applies the ones the
database hasn't seen yet and records them in dw.schema_migration.
"""

import json
import logging
import os
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import Json, execute_values

log = logging.getLogger(__spec__.name if __spec__ else __name__)

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "sql" / "migrations"
BASELINE = "001_star_schema"  # databases created before migrations were tracked already have it

# Fact columns written by this loader (everything except keys and audit timestamps).
FACT_COLUMNS = [
    "transaction_nk", "provider_txn_id", "message_id", "sms_count", "reference",
    "date_key", "time_key", "provider_key", "transaction_type_key", "counterparty_key",
    "category_key", "category_rule",
    "amount", "signed_amount", "fee", "tax", "balance_after",
    "is_internal_transfer", "has_balance_gap", "balance_gap_amount", "balance_gap_reason",
    "is_recurring", "recurring_interval_days", "recurring_series",
    "occurred_at", "raw_text", "source_object",
]
_DATA_COLUMNS = [c for c in FACT_COLUMNS if c != "transaction_nk"]


def connect(dsn: str | None = None):
    """A DSN if given (tests), else the WAREHOUSE_* settings from .env."""
    if dsn:
        return psycopg2.connect(dsn)
    return psycopg2.connect(
        host=os.getenv("WAREHOUSE_HOST", "localhost"),
        port=os.getenv("WAREHOUSE_PORT", "5432"),
        dbname=os.getenv("WAREHOUSE_DB", "sikatrack_dw"),
        user=os.getenv("WAREHOUSE_USER", "sika"),
        password=os.getenv("WAREHOUSE_PASSWORD"),
    )


def migrate(conn) -> list[str]:
    """Apply pending migrations in order, each in its own transaction. Returns those applied."""
    migrations = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migrations:  # e.g. sql/ not mounted into the container: never "succeed" silently
        raise FileNotFoundError(f"No schema migrations found in {MIGRATIONS_DIR}")

    with conn, conn.cursor() as cur:
        cur.execute("CREATE SCHEMA IF NOT EXISTS dw")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS dw.schema_migration (
                version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())
        """)
        cur.execute("SELECT version FROM dw.schema_migration")
        applied = {row[0] for row in cur.fetchall()}
        if not applied:
            cur.execute("SELECT to_regclass('dw.fact_transaction') IS NOT NULL")
            if cur.fetchone()[0]:
                cur.execute("INSERT INTO dw.schema_migration (version) VALUES (%s)", (BASELINE,))
                applied.add(BASELINE)

    done = []
    for path in migrations:
        if path.stem in applied:
            continue
        with conn, conn.cursor() as cur:
            cur.execute(path.read_text(encoding="utf-8"))
            cur.execute("INSERT INTO dw.schema_migration (version) VALUES (%s)", (path.stem,))
        log.info("Applied migration %s", path.stem)
        done.append(path.stem)
    return done


def _rows(df: pd.DataFrame, columns: list[str]) -> list[tuple]:
    """Plain Python values (psycopg2 can't adapt numpy scalars); NaN/NA -> None."""
    values = df[columns].astype(object)
    return list(values.where(values.notna(), None).itertuples(index=False, name=None))


def _key_map(cur, sql: str) -> dict:
    cur.execute(sql)
    return {tuple(row[:-1]) if len(row) > 2 else row[0]: row[-1] for row in cur.fetchall()}


def _upsert_dimensions(cur, df: pd.DataFrame) -> None:
    providers = sorted(df["provider"].unique())
    execute_values(cur, """
        INSERT INTO dw.dim_provider (provider_code, provider_name) VALUES %s
        ON CONFLICT (provider_code) DO NOTHING
    """, [(p, p.replace("_", " ").title()) for p in providers])

    types = df[["template", "transaction_type", "direction"]].drop_duplicates().sort_values(["template", "transaction_type"])
    types["flow_label"] = types["direction"].map({"credit": "Money In", "debit": "Money Out"})
    execute_values(cur, """
        INSERT INTO dw.dim_transaction_type AS t (template, transaction_type, direction, flow_label) VALUES %s
        ON CONFLICT (template, transaction_type) DO UPDATE
            SET direction = EXCLUDED.direction, flow_label = EXCLUDED.flow_label
            WHERE (t.direction, t.flow_label) IS DISTINCT FROM (EXCLUDED.direction, EXCLUDED.flow_label)
    """, _rows(types, ["template", "transaction_type", "direction", "flow_label"]))

    named = df[df["counterparty"].notna()].sort_values(["counterparty", "occurred_at"])
    if named.empty:
        return
    counterparties = named.groupby("counterparty").agg(
        phone=("counterparty_phone", "first"),
        kind=("counterparty_kind", lambda s: s.value_counts().sort_index().idxmax()),
        first_seen=("occurred_at", "min"),
        last_seen=("occurred_at", "max"),
    ).reset_index()
    execute_values(cur, """
        INSERT INTO dw.dim_counterparty AS c
            (counterparty_name, counterparty_phone, counterparty_kind, first_seen_at, last_seen_at)
        VALUES %s
        ON CONFLICT (counterparty_name) DO UPDATE SET
            counterparty_phone = COALESCE(EXCLUDED.counterparty_phone, c.counterparty_phone),
            counterparty_kind  = EXCLUDED.counterparty_kind,
            first_seen_at      = LEAST(c.first_seen_at, EXCLUDED.first_seen_at),
            last_seen_at       = GREATEST(c.last_seen_at, EXCLUDED.last_seen_at)
        WHERE (c.counterparty_phone, c.counterparty_kind, c.first_seen_at, c.last_seen_at)
              IS DISTINCT FROM
              (COALESCE(EXCLUDED.counterparty_phone, c.counterparty_phone), EXCLUDED.counterparty_kind,
               LEAST(c.first_seen_at, EXCLUDED.first_seen_at), GREATEST(c.last_seen_at, EXCLUDED.last_seen_at))
    """, _rows(counterparties, ["counterparty", "phone", "kind", "first_seen", "last_seen"]))


def _fact_frame(cur, df: pd.DataFrame) -> pd.DataFrame:
    """Swap natural values for dimension surrogate keys (-1 = Unknown member)."""
    providers = _key_map(cur, "SELECT provider_code, provider_key FROM dw.dim_provider")
    types = _key_map(cur, "SELECT template, transaction_type, transaction_type_key FROM dw.dim_transaction_type")
    counterparties = _key_map(cur, "SELECT counterparty_name, counterparty_key FROM dw.dim_counterparty")
    categories = _key_map(cur, "SELECT category_name, category_key FROM dw.dim_category")

    unknown = sorted(set(df["category"]) - set(categories))
    if unknown:  # the transform's categories and the migrations' seed list have drifted apart
        raise ValueError(f"Categories missing from dw.dim_category (add a migration): {unknown}")

    facts = df.rename(columns={"transaction_id": "provider_txn_id", "hour": "time_key"})
    facts["provider_key"] = facts["provider"].map(providers)
    facts["transaction_type_key"] = [types[k] for k in zip(facts["template"], facts["transaction_type"])]
    facts["counterparty_key"] = facts["counterparty"].map(counterparties).fillna(-1).astype(int)
    facts["category_key"] = facts["category"].map(categories)
    return facts


def _upsert_facts(cur, facts: pd.DataFrame, run_id: str) -> dict:
    columns = FACT_COLUMNS + ["pipeline_run_id"]
    rows = [row + (run_id,) for row in _rows(facts, FACT_COLUMNS)]
    returned = execute_values(cur, f"""
        INSERT INTO dw.fact_transaction AS f ({", ".join(columns)}) VALUES %s
        ON CONFLICT (transaction_nk) DO UPDATE SET
            {", ".join(f"{c} = EXCLUDED.{c}" for c in _DATA_COLUMNS)},
            pipeline_run_id = EXCLUDED.pipeline_run_id,
            updated_at = NOW()
        WHERE ({", ".join(f"f.{c}" for c in _DATA_COLUMNS)})
              IS DISTINCT FROM ({", ".join(f"EXCLUDED.{c}" for c in _DATA_COLUMNS)})
        RETURNING (xmax = 0) AS inserted
    """, rows, fetch=True)

    inserted = sum(1 for (is_new,) in returned if is_new)
    return {
        "rows_in": len(rows),
        "rows_inserted": inserted,
        "rows_updated": len(returned) - inserted,
        "rows_unchanged": len(rows) - len(returned),
    }


def _json(report: dict | None) -> Json | None:
    return Json(report, dumps=lambda o: json.dumps(o, default=str)) if report is not None else None


def load_transactions(conn, parquet_path: Path, run_id: str, report: dict | None = None) -> dict:
    """Upsert dimensions + facts in one transaction; returns row counts."""
    df = pd.read_parquet(parquet_path)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO dw.etl_run (run_id, status) VALUES (%s, 'running')
                ON CONFLICT (run_id) DO UPDATE SET status = 'running', started_at = NOW(), error = NULL
            """, (run_id,))
            _upsert_dimensions(cur, df)
            counts = _upsert_facts(cur, _fact_frame(cur, df), run_id)
            cur.execute("""
                UPDATE dw.etl_run SET status = 'succeeded', finished_at = NOW(), rows_in = %s,
                    rows_inserted = %s, rows_updated = %s, rows_unchanged = %s, quality_report = %s
                WHERE run_id = %s
            """, (counts["rows_in"], counts["rows_inserted"], counts["rows_updated"],
                  counts["rows_unchanged"], _json(report), run_id))
    except Exception as e:
        # Everything above was rolled back; record the failure in its own transaction.
        with conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO dw.etl_run (run_id, status, finished_at, error) VALUES (%s, 'failed', NOW(), %s)
                ON CONFLICT (run_id) DO UPDATE SET status = 'failed', finished_at = NOW(), error = EXCLUDED.error
            """, (run_id, f"{type(e).__name__}: {e}"))
        raise

    log.info("Loaded run %s: %d rows in, %d inserted, %d updated, %d unchanged",
             run_id, counts["rows_in"], counts["rows_inserted"], counts["rows_updated"], counts["rows_unchanged"])
    return counts

