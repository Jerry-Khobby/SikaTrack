"""Transform step: parsed SMS transactions -> clean, deduplicated, enriched dataset."""

import logging

import pandas as pd

from src.transform.categorise import UNCATEGORIZED, categorise, category_report
from src.transform.clean import clean
from src.transform.config import TransformConfig
from src.transform.counterparty import normalise_counterparties
from src.transform.dedupe import drop_cross_provider_receipts, drop_duplicate_transactions
from src.transform.enrich import add_measures, add_natural_key, add_time_keys, flag_internal_transfers
from src.transform.quality import build_report, explain_balance_gaps, flag_balance_gaps
from src.transform.schema import OUTPUT_COLUMNS
from src.transform.storage import read_parsed, write_processed

# __spec__.name keeps the module path in log lines even when run with `python -m`.
log = logging.getLogger(__spec__.name if __spec__ else __name__)

def transform(raw: pd.DataFrame, config: TransformConfig) -> tuple[pd.DataFrame, dict]:
    df = clean(raw)
    log.info("Cleaned %d parsed rows", len(df))
    df, same_provider = drop_duplicate_transactions(df)
    log.info("Removed %d duplicate SMS (same transaction ID)", same_provider)
    df, cross_provider = drop_cross_provider_receipts(df)
    log.info("Removed %d receipts confirmed by a second provider", cross_provider)
    df = normalise_counterparties(df, config.owner)
    log.info("Counterparty kinds: %s", df["counterparty_kind"].value_counts().to_dict())
    df = add_natural_key(df)
    df = add_measures(df)
    df = add_time_keys(df)
    df = flag_internal_transfers(df)
    log.info("Flagged %d internal transfers", int(df["is_internal_transfer"].sum()))
    if not (config.owner.names or config.owner.numbers):
        log.warning("OWNER_NAMES / OWNER_NUMBERS not set: transfers between your own wallets count as income/spend")
    df = categorise(df)
    _log_categories(df)
    df = flag_balance_gaps(df, config.balance_tolerance)
    df = explain_balance_gaps(df, config.balance_tolerance)
    _log_balance_gaps(df)

    removed = {"duplicate_sms": same_provider, "cross_provider_receipts": cross_provider}
    report = {"config": config.describe(), **build_report(len(raw), removed, df),
              "categories": category_report(df)}
    return df[OUTPUT_COLUMNS], report


def _log_categories(df: pd.DataFrame) -> None:
    stats = category_report(df)
    log.info("Category coverage %.1f%% of spending; by rule: %s", stats["coverage"] * 100, stats["by_rule_layer"])
    for _, row in df[df["category"] == UNCATEGORIZED].iterrows():
        # Message ID and kind only: references can hold names and phone numbers.
        log.info("Uncategorized %s (%s %s, counterparty kind %s)",
                 row["message_id"], row["direction"], row["transaction_type"], row["counterparty_kind"])


def _log_balance_gaps(df: pd.DataFrame) -> None:
    for _, row in df[df["has_balance_gap"]].iterrows():
        log.warning(
            "Balance gap %+.2f on %s at %s (%s, %s)",
            row["balance_gap_amount"], row["provider"], row["occurred_at"].strftime("%Y-%m-%d %H:%M"),
            row["template"], row["balance_gap_reason"],
        )


def run(config: TransformConfig) -> dict:
    raw = read_parsed(config.input_path)
    df, report = transform(raw, config)
    path = write_processed(df, report, config.output_dir)
    log.info("Wrote %d transactions (from %d parsed rows) -> %s", len(df), report["rows_in"], path)
    for provider, stats in report["providers"].items():
        log.info("%s balance continuity %.1f%% (%d gaps / %d checked)",
                 provider, stats["continuity_rate"] * 100, stats["balance_gaps"], stats["balance_checked"])
    return report

