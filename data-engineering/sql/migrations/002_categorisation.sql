-- Categorisation: the transform now assigns every transaction a category and records the
-- rule that chose it, so each category is explainable.

SET search_path TO dw;

-- Lets Power BI split categories into spending, money in and moves of your own money.
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS category_group VARCHAR(20) NOT NULL DEFAULT 'Spending';

INSERT INTO dim_category (category_name) VALUES
    ('Health'),
    ('Giving'),
    ('Personal Care'),
    ('Shopping'),
    ('Education'),
    ('Cash Deposit'),
    ('Refunds'),
    ('Own Transfers')
ON CONFLICT (category_name) DO NOTHING;

UPDATE dim_category SET category_group = CASE
    WHEN category_name IN ('Income', 'Cash Deposit', 'Refunds') THEN 'Money In'
    WHEN category_name IN ('Savings', 'Own Transfers')          THEN 'Own Money'
    WHEN category_name = 'Uncategorized'                        THEN 'Unknown'
    ELSE 'Spending'
END;

-- e.g. "reference:food", "type:airtime", "counterparty:pharmacy", "default:person"
ALTER TABLE fact_transaction ADD COLUMN IF NOT EXISTS category_rule VARCHAR(60);

-- New columns can only be appended to a view, so category_rule goes last.
CREATE OR REPLACE VIEW v_fact_transaction AS
SELECT
    transaction_key, transaction_nk, provider_txn_id, reference,
    date_key, time_key, provider_key, transaction_type_key, counterparty_key, category_key,
    amount, signed_amount, fee, tax, total_cost, balance_after,
    is_internal_transfer, has_balance_gap, balance_gap_amount, balance_gap_reason,
    is_recurring, recurring_interval_days, sms_count,
    occurred_at, source_object, pipeline_run_id, loaded_at, updated_at,
    category_rule
FROM fact_transaction;
