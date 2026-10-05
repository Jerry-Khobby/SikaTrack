"""Reading parser output and writing the processed dataset to the local work dir.

The pipeline's publish step then copies the outputs into the processed zone of the lake.
"""

import json
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from src.transform.schema import to_table
from src.utils.fileio import atomic_path, atomic_write


def read_parsed(path: Path) -> pd.DataFrame:
    # json.load rather than pd.read_json: keeps transaction IDs as strings
    # instead of letting pandas turn them into numbers.
    with open(path, encoding="utf-8") as f:
        return pd.DataFrame(json.load(f))


def write_processed(df: pd.DataFrame, report: dict, output_dir: Path) -> Path:
    """Validate against the schema, then write Parquet + report atomically."""
    table = to_table(df)  # raises SchemaError before anything is written

    parquet_path = Path(output_dir) / "transactions.parquet"
    with atomic_path(parquet_path) as tmp:
        pq.write_table(table, tmp)

    with atomic_write(Path(output_dir) / "quality_report.json") as f:
        json.dump(report, f, indent=2, default=str)

    return parquet_path
