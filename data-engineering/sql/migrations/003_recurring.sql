-- Recurring-payment detection: the transform now fills is_recurring and
-- recurring_interval_days, and groups each repeat payment into a series.

SET search_path TO dw;

-- Stable ID of the series a recurring payment belongs to (same counterparty, amount band
-- and rhythm), so a dashboard can list each series even when one counterparty has several.
ALTER TABLE fact_transaction ADD COLUMN IF NOT EXISTS recurring_series VARCHAR(20);

CREATE INDEX IF NOT EXISTS ix_fact_txn_recurring_series
    ON fact_transaction (recurring_series) WHERE recurring_series IS NOT NULL;

-- New columns can only be appended to a view, so recurring_series goes last.
CREATE OR REPLACE VIEW v_fact_transaction AS
SELECT
    transaction_key, transaction_nk, provider_txn_id, reference,
    date_key, time_key, provider_key, transaction_type_key, counterparty_key, category_key,
    amount, signed_amount, fee, tax, total_cost, balance_after,
    is_internal_transfer, has_balance_gap, balance_gap_amount, balance_gap_reason,
    is_recurring, recurring_interval_days, sms_count,
    occurred_at, source_object, pipeline_run_id, loaded_at, updated_at,
    category_rule,
    recurring_series
FROM fact_transaction;
