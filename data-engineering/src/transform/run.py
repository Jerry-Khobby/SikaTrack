"""Transform step: parsed SMS transactions -> clean, deduplicated, enriched dataset.

Run:  python -m src.transform.run
"""

import logging

import pandas as pd
from dotenv import load_dotenv

from src.transform.clean import clean
from src.transform.config import TransformConfig
from src.transform.counterparty import normalise_counterparties
from src.transform.dedupe import drop_cross_provider_receipts, drop_duplicate_transactions
from src.transform.enrich import add_measures, add_natural_key, add_time_keys, flag_internal_transfers
from src.transform.quality import build_report, explain_balance_gaps, flag_balance_gaps
from src.transform.storage import read_parsed, write_processed

log = logging.getLogger(__name__)

OUTPUT_COLUMNS = [
    "transaction_nk", "message_id", "transaction_id", "provider", "template", "transaction_type", "direction",
    "occurred_at", "date_key", "hour",
    "amount", "signed_amount", "fee", "tax", "total_cost", "balance_after",
    "counterparty", "counterparty_phone", "counterparty_kind", "counterparty_raw",
    "reference", "is_internal_transfer", "has_balance_gap", "balance_gap_amount", "balance_gap_reason",
    "sms_count", "raw_text",
]


def transform(raw: pd.DataFrame, config: TransformConfig) -> tuple[pd.DataFrame, dict]:
    df = clean(raw)
    df, same_provider = drop_duplicate_transactions(df)
    df, cross_provider = drop_cross_provider_receipts(df)
    df = normalise_counterparties(df, config.owner)
    df = add_natural_key(df)
    df = add_measures(df)
    df = add_time_keys(df)
    df = flag_internal_transfers(df)
    df = flag_balance_gaps(df, config.balance_tolerance)
    df = explain_balance_gaps(df, config.balance_tolerance)

    removed = {"duplicate_sms": same_provider, "cross_provider_receipts": cross_provider}
    report = build_report(len(raw), removed, df)
    return df[OUTPUT_COLUMNS], report


def run(config: TransformConfig) -> dict:
    raw = read_parsed(config.input_path)
    df, report = transform(raw, config)
    path = write_processed(df, report, config.output_dir)
    log.info("Wrote %d transactions -> %s", len(df), path)
    return report


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    load_dotenv()
    report = run(TransformConfig.from_env())

    log.info("Rows in:            %d", report["rows_in"])
    for reason, count in report["removed"].items():
        log.info("Removed %-24s %d", reason + ":", count)
    log.info("Rows out:           %d", report["rows_out"])
    log.info("Internal transfers: %d", report["internal_transfers"])
    log.info("Balance gaps:       %s", report["balance_gap_reasons"] or "none")
    for provider, stats in report["providers"].items():
        log.info("%-10s balance continuity %.1f%% (%d gaps / %d checked)",
                 provider, stats["continuity_rate"] * 100, stats["balance_gaps"], stats["balance_checked"])


if __name__ == "__main__":
    main()
