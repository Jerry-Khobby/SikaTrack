"""Run the data layer end to end: SMS backup XML -> MoMo CSV -> parsed JSON -> processed Parquet.

Run:  python -m src.orchestration.pipeline [path/to/backup.xml] [--data-dir DIR]

Each step is a plain function, so an Airflow DAG can later call the same functions as tasks.
"""

import argparse
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from dotenv import load_dotenv

from src.extraction.filter_sms import DEFAULT_XML_FILE, filter_momo_sms
from src.extraction.momo_parser import parse_file
from src.transform.config import BASE_DIR, Owner, TransformConfig
from src.transform.run import run as run_transform
from src.utils.logging_config import setup_logging

# __spec__.name keeps the module path in log lines even when run with `python -m`.
log = logging.getLogger(__spec__.name if __spec__ else __name__)


@dataclass(frozen=True)
class PipelinePaths:
    xml: Path
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


def build_steps(paths: PipelinePaths, owner: Owner) -> list[tuple[str, Callable[[], dict]]]:
    transform_config = TransformConfig(
        input_path=paths.parsed, output_dir=paths.processed, owner=owner
    )
    return [
        ("extract", lambda: filter_momo_sms(paths.xml, paths.filtered)),
        ("parse", lambda: parse_file(paths.filtered, paths.parsed, paths.unparsed)),
        ("transform", lambda: run_transform(transform_config)),
    ]


def run_pipeline(
    xml_path: Path = DEFAULT_XML_FILE,
    data_dir: Path = BASE_DIR / "data",
    owner: Owner | None = None,
) -> dict[str, dict]:
    """Run every step in order; stop at the first failure. Returns each step's stats."""
    paths = PipelinePaths(Path(xml_path), Path(data_dir))
    steps = build_steps(paths, owner if owner is not None else Owner.from_env())

    results = {}
    for number, (name, step) in enumerate(steps, start=1):
        log.info("[%d/%d] %s", number, len(steps), name)
        started = time.perf_counter()
        try:
            results[name] = step()
        except Exception:
            log.exception("Pipeline failed at step '%s'", name)
            raise
        log.info("[%d/%d] %s done in %.2fs", number, len(steps), name, time.perf_counter() - started)
    return results


def summarise(results: dict[str, dict]) -> None:
    extract, parse, transform = results["extract"], results["parse"], results["transform"]
    log.info("Pipeline summary")
    log.info("SMS scanned:        %d", extract["scanned"])
    log.info("MoMo SMS kept:      %d", extract["kept"])
    log.info("Parsed:             %d  (ignored %d, unparsed %d, success rate %s)",
             parse["parsed"], parse["ignored"], parse["unparsed"],
             f"{parse['parse_success_rate']:.1%}" if parse["parse_success_rate"] is not None else "n/a")
    log.info("Transactions out:   %d  (removed %s)", transform["rows_out"], transform["removed"])
    log.info("Internal transfers: %d", transform["internal_transfers"])
    log.info("Balance gaps:       %s", transform["balance_gap_reasons"] or "none")


def main() -> None:
    load_dotenv()
    log_file = setup_logging()
    log.info("Logging to %s", log_file)

    parser = argparse.ArgumentParser(description="Run extraction -> parsing -> transform.")
    parser.add_argument("xml_file", nargs="?", type=Path, default=DEFAULT_XML_FILE)
    parser.add_argument("--data-dir", type=Path, default=BASE_DIR / "data")
    args = parser.parse_args()

    summarise(run_pipeline(args.xml_file, args.data_dir))


if __name__ == "__main__":
    main()
