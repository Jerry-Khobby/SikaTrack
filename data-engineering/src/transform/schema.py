"""The processed dataset's contract: column order, types and nullability.

Enforced on every write, so schema drift fails here instead of in the warehouse or Power BI.
Keep in sync with dw.fact_transaction in sql/warehouse_schema.sql.
"""

import pyarrow as pa
import pandas as pd


def _f(name: str, type_: pa.DataType, nullable: bool = False) -> pa.Field:
    return pa.field(name, type_, nullable=nullable)


SCHEMA = pa.schema([
    _f("transaction_nk", pa.string()),
    _f("message_id", pa.string()),
    _f("transaction_id", pa.string(), nullable=True),
    _f("provider", pa.string()),
    _f("template", pa.string()),
    _f("transaction_type", pa.string()),
    _f("direction", pa.string()),
    _f("occurred_at", pa.timestamp("ns", tz="UTC")),
    _f("date_key", pa.int32()),
    _f("hour", pa.int16()),
    _f("amount", pa.float64()),
    _f("signed_amount", pa.float64()),
    _f("fee", pa.float64()),
    _f("tax", pa.float64()),
    _f("total_cost", pa.float64()),
    _f("balance_after", pa.float64(), nullable=True),
    _f("counterparty", pa.string(), nullable=True),
    _f("counterparty_phone", pa.string(), nullable=True),
    _f("counterparty_kind", pa.string()),
    _f("counterparty_raw", pa.string(), nullable=True),
    _f("reference", pa.string(), nullable=True),
    _f("is_internal_transfer", pa.bool_()),
    _f("has_balance_gap", pa.bool_()),
    _f("balance_gap_amount", pa.float64(), nullable=True),
    _f("balance_gap_reason", pa.string(), nullable=True),
    _f("sms_count", pa.int16()),
    _f("raw_text", pa.string()),
    _f("source_object", pa.string(), nullable=True),
])

OUTPUT_COLUMNS = SCHEMA.names


class SchemaError(ValueError):
    pass


def to_table(df: pd.DataFrame) -> pa.Table:
    """DataFrame -> Arrow table matching SCHEMA exactly, or SchemaError."""
    missing = [c for c in OUTPUT_COLUMNS if c not in df.columns]
    if missing:
        raise SchemaError(f"Missing columns: {missing}")
    nulls = {f.name: int(df[f.name].isna().sum()) for f in SCHEMA if not f.nullable and df[f.name].isna().any()}
    if nulls:
        raise SchemaError(f"Nulls in non-nullable columns: {nulls}")
    try:
        return pa.Table.from_pandas(df[OUTPUT_COLUMNS], schema=SCHEMA, preserve_index=False)
    except (pa.ArrowInvalid, pa.ArrowTypeError) as e:
        raise SchemaError(f"Column types don't match the schema: {e}") from e
