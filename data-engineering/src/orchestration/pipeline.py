"""Run the data layer end to end.

    stage     copy the SMS backup into the raw zone (no-op if already there)
    extract   MoMo SMS from EVERY staged backup -> CSV (history accumulates)
    parse     CSV -> parsed JSON, then the parse quality gate
    transform parsed JSON -> Parquet, then the transform quality gate
    publish   Parquet + this run's quality report -> processed zone
    load      Parquet -> Postgres warehouse (only with --load)

Run:  python -m src.orchestration.pipeline [path/to/backup.xml] [--load] [--data-dir DIR]

Each step is a plain function, so an Airflow DAG can later call the same functions as tasks.
"""

import argparse
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from src.extraction.filter_sms import DEFAULT_XML_FILE, filter_raw_zone
from src.extraction.momo_parser import parse_file
from src.lake.raw_zone import list_backups, stage_backup
from src.lake.store import ObjectStore, get_store
from src.orchestration.gates import Thresholds, check_parse, check_transform
from src.orchestration.run_id import new_run_id
from src.transform.config import BASE_DIR, Owner, TransformConfig
from src.transform.run import run as run_transform
from src.utils.logging_config import setup_logging

log = logging.getLogger(__spec__.name if __spec__ else __name__)


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


def stage(run: PipelineRun) -> dict:
    key = stage_backup(run.xml_path, run.raw) if run.xml_path else None
    return {"staged": key, "backups": len(list_backups(run.raw))}


def extract(run: PipelineRun) -> dict:
    return filter_raw_zone(run.raw, run.paths.filtered)


def parse(run: PipelineRun) -> dict:
    stats = parse_file(run.paths.filtered, run.paths.parsed, run.paths.unparsed)
    check_parse(stats, run.limits)
    return stats


def transform(run: PipelineRun) -> dict:
    config = TransformConfig(
        input_path=run.paths.parsed, output_dir=run.paths.processed, owner=run.owner, run_id=run.run_id,
    )
    report = run_transform(config)
    check_transform(report, run.limits)
    return report


def publish(run: PipelineRun) -> dict:
    """Latest dataset + a per-run report, so quality metrics keep their history."""
    dataset_key = "transactions/transactions.parquet"
    report_key = f"reports/run_id={run.run_id}/quality_report.json"
    run.processed.put_file(dataset_key, run.paths.processed / "transactions.parquet")
    run.processed.put_file(report_key, run.paths.processed / "quality_report.json")
    log.info("Published %s and %s to %s", dataset_key, report_key, run.processed.name)
    return {"dataset": dataset_key, "report": report_key}


def load(run: PipelineRun, report: dict) -> dict:
    from src.load.warehouse import apply_schema, connect, load_transactions  # needs psycopg2

    conn = connect(run.warehouse_dsn)
    try:
        apply_schema(conn)
        return load_transactions(conn, run.paths.processed / "transactions.parquet", run.run_id, report)
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


def run_pipeline(
    xml_path: Path | None = None,
    data_dir: Path = BASE_DIR / "data",
    owner: Owner | None = None,
    *,
    load: bool = False,
    warehouse_dsn: str | None = None,
    limits: Thresholds | None = None,
    run_id: str | None = None,
) -> dict[str, dict]:
    """Run every step in order; stop at the first failure. Returns each step's stats."""
    run = PipelineRun(
        run_id=run_id or new_run_id(),
        xml_path=Path(xml_path) if xml_path else None,
        paths=PipelinePaths(Path(data_dir)),
        owner=owner if owner is not None else Owner.from_env(),
        raw=get_store("RAW_BUCKET"),
        processed=get_store("PROCESSED_BUCKET"),
        limits=limits or Thresholds.from_env(),
        load=load,
        warehouse_dsn=warehouse_dsn,
    )
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
    if "load" in results:
        log.info("Warehouse:           %s", results["load"])


def main() -> None:
    log_file = setup_logging()
    log.info("Logging to %s", log_file)

    parser = argparse.ArgumentParser(description="Run stage -> extract -> parse -> transform -> publish [-> load].")
    parser.add_argument("xml_file", nargs="?", type=Path,
                        default=DEFAULT_XML_FILE if DEFAULT_XML_FILE.exists() else None,
                        help="Backup to stage first. Already-staged backups are skipped.")
    parser.add_argument("--data-dir", type=Path, default=BASE_DIR / "data")
    parser.add_argument("--load", action="store_true", help="Also load the warehouse (needs Postgres).")
    args = parser.parse_args()

    summarise(run_pipeline(args.xml_file, args.data_dir, load=args.load))


if __name__ == "__main__":
    main()
