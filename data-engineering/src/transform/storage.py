"""Reading parser output and writing the processed dataset.

Local files for now; swap these two functions for MinIO reads/writes later.
"""

import json
import os
from pathlib import Path

import pandas as pd


def read_parsed(path: Path) -> pd.DataFrame:
    # json.load rather than pd.read_json: keeps transaction IDs as strings
    # instead of letting pandas turn them into numbers.
    with open(path, encoding="utf-8") as f:
        return pd.DataFrame(json.load(f))


def write_processed(df: pd.DataFrame, report: dict, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    parquet_path = output_dir / "transactions.parquet"

    # Atomic writes: a crash never leaves a half-written file behind.
    tmp = parquet_path.with_suffix(".parquet.tmp")
    df.to_parquet(tmp, index=False)
    os.replace(tmp, parquet_path)

    report_path = output_dir / "quality_report.json"
    tmp = report_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    os.replace(tmp, report_path)

    return parquet_path
