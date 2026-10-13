"""Run the data layer end to end.

    stage     copy backups from data/inbox/ into the raw zone (already-staged ones are skipped)
    extract   MoMo SMS from EVERY staged backup -> CSV (history accumulates)
    parse     CSV -> parsed JSON, then the parse quality gate
    transform parsed JSON -> categorised Parquet, then the transform quality gate
    publish   Parquet + this run's quality report -> processed zone
    load      migrate the warehouse schema, then upsert into Postgres

Each run is for one user. Without a user it's the legacy owner: the SMS backups in the raw
zone (the data from before the app), plus their app uploads once LEGACY_OWNER_USER_ID links
them to an app account. With a user ID it's that user's app uploads.

Airflow runs these steps as tasks (dags/sikatrack_pipeline.py). For a manual run inside Docker:
    docker compose exec airflow-scheduler python -m src.orchestration.pipeline
"""

import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from src.extraction.filter_sms import filter_raw_zone
from src.extraction.momo_parser import parse_file
from src.lake.raw_zone import list_sources, stage_backup, stage_inbox
from src.lake.store import ObjectStore, get_store
from src.orchestration.gates import Thresholds, check_parse, check_transform
from src.orchestration.run_id import new_run_id
from src.transform.config import BASE_DIR, Owner, TransformConfig, UserCategories
from src.transform.run import run as run_transform
from src.utils.fileio import atomic_write
from src.utils.logging_config import setup_logging

log = logging.getLogger(__spec__.name if __spec__ else __name__)

INBOX = BASE_DIR / "data" / "inbox"
WORK_DIR = BASE_DIR / "data" / "work"


@dataclass(frozen=True)
class PipelinePaths:
    data_dir: Path

    @property
    def filtered(self) -> Path:
        return self.data_dir / "momo_sms.csv"

    @property
    def parsed(self) -> Path:
        return self.data_dir / "parsed_transactions.json"

    @property
    def unparsed(self) -> Path:
        return self.data_dir / "unparsed_sms.csv"

    @property
    def processed(self) -> Path:
        return self.data_dir / "processed"


@dataclass(frozen=True)
class PipelineRun:
    run_id: str
    xml_path: Path | None
    paths: PipelinePaths
    owner: Owner
    raw: ObjectStore
    processed: ObjectStore
    limits: Thresholds
    load: bool
    warehouse_dsn: str | None
    user_id: str | None = None  # None: the legacy owner, before they're linked to an app account
    include_backups: bool = True  # the SMS backups belong to the legacy owner only
    user_categories: UserCategories = UserCategories()  # the user's corrections from the app

    @property
    def state_scope(self) -> str | None:
        """Where this run's outputs and state live: None for the legacy owner (the original keys,
        unchanged by linking an app account), else the user's ID (under users/<id>/)."""
        return None if self.include_backups else self.user_id

    def processed_key(self, key: str) -> str:
        return key if self.state_scope is None else f"users/{self.state_scope}/{key}"


def legacy_owner_user_id() -> str | None:
    """The app account the backups belong to, once the owner has signed up (else None)."""
    return os.getenv("LEGACY_OWNER_USER_ID") or None


def stage(run: PipelineRun) -> dict:
    from src.orchestration.state import save_heartbeat

    staged: list[str] = []
    if run.include_backups:  # the inbox holds the legacy owner's backups
        staged = [stage_backup(run.xml_path, run.raw)] if run.xml_path else stage_inbox(INBOX, run.raw)
    save_heartbeat(run.processed)  # proof of life for monitoring, even if the run then skips
    return {"staged": staged, "backups": len(list_sources(run.raw, run.user_id, run.include_backups))}


def extract(run: PipelineRun) -> dict:
    return filter_raw_zone(run.raw, run.paths.filtered, run.user_id, run.include_backups)


def parse(run: PipelineRun) -> dict:
    stats = parse_file(run.paths.filtered, run.paths.parsed, run.paths.unparsed)
    with atomic_write(run.paths.data_dir / "parse_stats.json") as f:  # picked up by transform's report
        json.dump(stats, f, indent=2)
    check_parse(stats, run.limits)
    return stats


def transform(run: PipelineRun) -> dict:
    config = TransformConfig(
        input_path=run.paths.parsed, output_dir=run.paths.processed, owner=run.owner, run_id=run.run_id,
        user_categories=run.user_categories,
    )
    report = run_transform(config)
    parse_stats = run.paths.data_dir / "parse_stats.json"
    if parse_stats.exists():
        # The run report (stored in dw.etl_run) then also carries the parse numbers monitoring needs.
        stats = json.loads(parse_stats.read_text(encoding="utf-8"))
        report["parse"] = {k: stats[k] for k in ("total", "parsed", "ignored", "unparsed", "parse_success_rate")}
        with atomic_write(run.paths.processed / "quality_report.json") as f:
            json.dump(report, f, indent=2, default=str)
    check_transform(report, run.limits)
    return report


def publish(run: PipelineRun) -> dict:
    """Latest dataset + a per-run report, so quality metrics keep their history."""
    dataset_key = run.processed_key("transactions/transactions.parquet")
    report_key = run.processed_key(f"reports/run_id={run.run_id}/quality_report.json")
    run.processed.put_file(dataset_key, run.paths.processed / "transactions.parquet")
    run.processed.put_file(report_key, run.paths.processed / "quality_report.json")
    log.info("Published %s and %s to %s", dataset_key, report_key, run.processed.name)
    return {"dataset": dataset_key, "report": report_key}


def load(run: PipelineRun, report: dict) -> dict:
    from src.load.warehouse import connect, load_transactions, migrate

    conn = connect(run.warehouse_dsn)
    try:
        migrate(conn)
        return load_transactions(
            conn, run.paths.processed / "transactions.parquet", run.run_id, report,
            user_id=run.user_id, is_legacy_owner=run.include_backups,
        )
    finally:
        conn.close()


def build_steps(run: PipelineRun, results: dict) -> list[tuple[str, Callable[[], dict]]]:
    steps = [
        ("stage", lambda: stage(run)),
        ("extract", lambda: extract(run)),
        ("parse", lambda: parse(run)),
        ("transform", lambda: transform(run)),
        ("publish", lambda: publish(run)),
    ]
    if run.load:
        steps.append(("load", lambda: load(run, results["transform"])))
    return steps


def make_run(
    run_id: str,
    data_dir: Path | None = None,
    *,
    xml_path: Path | None = None,
    owner: Owner | None = None,
    load: bool = True,
    warehouse_dsn: str | None = None,
    limits: Thresholds | None = None,
    user_id: str | None = None,
) -> PipelineRun:
    """Everything a step needs. Settings not passed in come from the environment.

    user_id: whose data to process; None (or LEGACY_OWNER_USER_ID) is the legacy owner.
    """
    legacy = legacy_owner_user_id()
    user_id = user_id or legacy
    include_backups = user_id is None or user_id == legacy
    choices = UserCategories()
    if owner is None:
        from src.orchestration.users import merge, user_categories, wallet_owner

        # The legacy owner: .env (plus their wallets once linked); an app user: their wallets
        owner = Owner.from_env() if include_backups else Owner()
        if user_id is not None:
            owner = merge(owner, wallet_owner(user_id, warehouse_dsn))
            choices = user_categories(user_id, warehouse_dsn)
    return PipelineRun(
        run_id=run_id,
        xml_path=Path(xml_path) if xml_path else None,
        paths=PipelinePaths(Path(data_dir) if data_dir else WORK_DIR / run_id),
        owner=owner,
        raw=get_store("RAW_BUCKET"),
        processed=get_store("PROCESSED_BUCKET"),
        limits=limits or Thresholds.from_env(),
        load=load,
        warehouse_dsn=warehouse_dsn,
        user_id=user_id,
        include_backups=include_backups,
        user_categories=choices,
    )


def run_pipeline(
    xml_path: Path | None = None,
    data_dir: Path | None = None,
    owner: Owner | None = None,
    *,
    load: bool = True,
    warehouse_dsn: str | None = None,
    limits: Thresholds | None = None,
    run_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, dict]:
    """Run every step in order; stop at the first failure. Returns each step's stats."""
    run = make_run(run_id or new_run_id(), data_dir, xml_path=xml_path, owner=owner, load=load,
                   warehouse_dsn=warehouse_dsn, limits=limits, user_id=user_id)
    log.info("Pipeline run %s", run.run_id)

    results: dict[str, dict] = {}
    steps = build_steps(run, results)
    for number, (name, step) in enumerate(steps, start=1):
        log.info("[%d/%d] %s", number, len(steps), name)
        started = time.perf_counter()
        try:
            results[name] = step()
        except Exception:
            log.exception("Pipeline run %s failed at step '%s'", run.run_id, name)
            raise
        log.info("[%d/%d] %s done in %.2fs", number, len(steps), name, time.perf_counter() - started)

    results["run_id"] = run.run_id
    return results


def summarise(results: dict) -> None:
    extract_, parse_, transform_ = results["extract"], results["parse"], results["transform"]
    log.info("Pipeline summary (run %s)", results["run_id"])
    log.info("Backups in raw zone: %d", results["stage"]["backups"])
    log.info("SMS scanned:         %d", extract_["scanned"])
    log.info("MoMo SMS kept:       %d", extract_["kept"])
    log.info("Parsed:              %d  (ignored %d, unparsed %d, success rate %s)",
             parse_["parsed"], parse_["ignored"], parse_["unparsed"],
             f"{parse_['parse_success_rate']:.1%}" if parse_["parse_success_rate"] is not None else "n/a")
    log.info("Transactions out:    %d  (removed %s)", transform_["rows_out"], transform_["removed"])
    log.info("Internal transfers:  %d", transform_["internal_transfers"])
    log.info("Balance gaps:        %s", transform_["balance_gap_reasons"] or "none")
    log.info("Category coverage:   %.1f%% of spending", transform_["categories"]["coverage"] * 100)
    recurring = transform_["recurring"]
    log.info("Recurring payments:  %d series (%d active, ~GHS %.2f/month)",
             recurring["series"], recurring["active_series"], recurring["active_monthly_cost"])
    if "load" in results:
        log.info("Warehouse:           %s", results["load"])


def main() -> None:
    import shutil

    log_file = setup_logging()
    log.info("Logging to %s", log_file)
    results = run_pipeline()
    summarise(results)
    shutil.rmtree(WORK_DIR / results["run_id"], ignore_errors=True)  # kept only if the run failed


if __name__ == "__main__":
    main()
