"""See the whole pipeline work end to end with no Docker and no Postgres install.

Starts a real Postgres from the `pgserver` pip package (database files in data/warehouse_pg,
gitignored), runs every step including the load, then queries the warehouse.

Run:  python -m src.orchestration.local_warehouse            # run, show results, stop Postgres
      python -m src.orchestration.local_warehouse --serve    # keep Postgres up for Power BI
"""

import argparse
import contextlib
import io
import logging
import time
from pathlib import Path

import pandas as pd
import psycopg2

from src.extraction.filter_sms import DEFAULT_XML_FILE
from src.orchestration.pipeline import run_pipeline, summarise
from src.transform.config import BASE_DIR
from src.utils.logging_config import setup_logging

log = logging.getLogger(__spec__.name if __spec__ else __name__)

PGDATA = BASE_DIR / "data" / "warehouse_pg"
DATABASE = "sikatrack_dw"

# Dashboard-style questions, all answered from the Power BI view.
QUERIES = {
    "Money in and out per month (own-wallet transfers excluded)": """
        SELECT d.year_month AS month,
               SUM(f.amount) FILTER (WHERE f.signed_amount > 0) AS money_in,
               SUM(f.amount) FILTER (WHERE f.signed_amount < 0) AS money_out,
               SUM(f.signed_amount) AS net,
               SUM(f.total_cost) AS fees_and_tax
        FROM dw.v_fact_transaction f JOIN dw.dim_date d USING (date_key)
        WHERE NOT f.is_internal_transfer
        GROUP BY d.year_month ORDER BY d.year_month""",
    "Spending by transaction type": """
        SELECT t.transaction_type, COUNT(*) AS transactions, SUM(f.amount) AS total
        FROM dw.v_fact_transaction f JOIN dw.dim_transaction_type t USING (transaction_type_key)
        WHERE t.direction = 'debit' AND NOT f.is_internal_transfer
        GROUP BY t.transaction_type ORDER BY total DESC""",
    "Spending by counterparty kind": """
        SELECT c.counterparty_kind, COUNT(*) AS transactions, SUM(f.amount) AS total
        FROM dw.v_fact_transaction f JOIN dw.dim_counterparty c USING (counterparty_key)
        WHERE f.signed_amount < 0 AND NOT f.is_internal_transfer
        GROUP BY c.counterparty_kind ORDER BY total DESC""",
    "When money moves (by part of day)": """
        SELECT t.day_part, COUNT(*) AS transactions, SUM(f.amount) AS total
        FROM dw.v_fact_transaction f JOIN dw.dim_time t USING (time_key)
        WHERE NOT f.is_internal_transfer
        GROUP BY t.day_part ORDER BY transactions DESC""",
    "Warehouse loads (dw.etl_run)": """
        SELECT run_id, status, rows_inserted, rows_updated, rows_unchanged
        FROM dw.etl_run ORDER BY started_at DESC LIMIT 5""",
}


def start_postgres(pgdata: Path = PGDATA, keep_running: bool = False):
    """Start (or reuse) a local Postgres; returns (server, connection URL for the warehouse DB)."""
    import pgserver

    logging.getLogger("pgserver").setLevel(logging.WARNING)  # its startup/shutdown chatter
    pgdata.mkdir(parents=True, exist_ok=True)
    with contextlib.redirect_stdout(io.StringIO()):  # pgserver prints its whole startup log
        server = pgserver.get_server(pgdata, cleanup_mode=None if keep_running else "stop")
        server.psql(f"SELECT 'CREATE DATABASE {DATABASE}' "
                    f"WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '{DATABASE}')\\gexec")
    return server, server.get_uri(DATABASE)


def show_results(dsn: str) -> None:
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        for title, sql in QUERIES.items():
            cur.execute(sql)
            df = pd.DataFrame(cur.fetchall(), columns=[c.name for c in cur.description])
            print(f"\n{title}\n{df.to_string(index=False)}")


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description="Run the full pipeline against a local Postgres.")
    parser.add_argument("xml_file", nargs="?", type=Path,
                        default=DEFAULT_XML_FILE if DEFAULT_XML_FILE.exists() else None)
    parser.add_argument("--serve", action="store_true", help="Keep Postgres running afterwards (Ctrl+C to stop).")
    args = parser.parse_args()

    server, dsn = start_postgres(keep_running=args.serve)
    log.info("Local Postgres ready (data in %s)", PGDATA)

    summarise(run_pipeline(args.xml_file, load=True, warehouse_dsn=dsn))
    show_results(dsn)

    if args.serve:
        port = dsn.rsplit(":", 1)[1].split("/")[0]
        print(f"\nPostgres is running for Power BI: server 127.0.0.1:{port}, database {DATABASE}, "
              f"user postgres, no password. Use the view dw.v_fact_transaction. Ctrl+C to stop.")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
        finally:
            with contextlib.redirect_stdout(io.StringIO()):
                server.cleanup()


if __name__ == "__main__":
    main()
