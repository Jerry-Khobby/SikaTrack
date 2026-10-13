-- Users: the warehouse becomes multi-user, for the app.
--
-- Every fact, counterparty and run now belongs to a user (dw.dim_user). The data loaded so far
-- belongs to the "legacy owner": the person whose SMS backups built the warehouse, before the
-- app existed. When they sign up in the app, the loader links that row to their account
-- (LEGACY_OWNER_USER_ID), so their history needs no reload.
--
-- The dashboards (Metabase's mart views, Power BI's v_fact_transaction) stay the legacy owner's
-- personal view: other users' data never appears in them.

SET search_path TO dw;

CREATE TABLE dim_user (
    user_key        SERIAL PRIMARY KEY,
    user_id         UUID UNIQUE,                     -- app.user.id; NULL = legacy owner not linked yet
    is_legacy_owner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- At most one legacy owner
CREATE UNIQUE INDEX ux_dim_user_legacy_owner ON dim_user (is_legacy_owner) WHERE is_legacy_owner;
INSERT INTO dim_user (is_legacy_owner) VALUES (TRUE);

-- ---------------------------------------------------------------------
-- Facts: per user. One transfer is in both the sender's and the receiver's SMS, with the same
-- provider transaction ID, so uniqueness is per user.
-- ---------------------------------------------------------------------
ALTER TABLE fact_transaction ADD COLUMN user_key INTEGER REFERENCES dim_user (user_key);
UPDATE fact_transaction SET user_key = (SELECT user_key FROM dim_user WHERE is_legacy_owner);
ALTER TABLE fact_transaction ALTER COLUMN user_key SET NOT NULL;

ALTER TABLE fact_transaction DROP CONSTRAINT fact_transaction_transaction_nk_key;
ALTER TABLE fact_transaction ADD CONSTRAINT ux_fact_txn_user_nk UNIQUE (user_key, transaction_nk);
DROP INDEX ux_fact_txn_provider_txn;
CREATE UNIQUE INDEX ux_fact_txn_user_provider_txn
    ON fact_transaction (user_key, provider_key, provider_txn_id) WHERE provider_txn_id IS NOT NULL;
CREATE INDEX ix_fact_txn_user_occurred_at ON fact_transaction (user_key, occurred_at);

-- ---------------------------------------------------------------------
-- Counterparties: per user (who "KOFI MENSAH" is depends on whose phone it's on).
-- The Unknown member (-1) stays shared, with no user.
-- ---------------------------------------------------------------------
ALTER TABLE dim_counterparty ADD COLUMN user_key INTEGER REFERENCES dim_user (user_key);
UPDATE dim_counterparty SET user_key = (SELECT user_key FROM dim_user WHERE is_legacy_owner)
WHERE counterparty_key <> -1;
ALTER TABLE dim_counterparty DROP CONSTRAINT dim_counterparty_counterparty_name_key;
ALTER TABLE dim_counterparty ADD CONSTRAINT ux_dim_counterparty_user_name UNIQUE (user_key, counterparty_name);

-- ---------------------------------------------------------------------
-- Runs: per user
-- ---------------------------------------------------------------------
ALTER TABLE etl_run ADD COLUMN user_key INTEGER REFERENCES dim_user (user_key);
UPDATE etl_run SET user_key = (SELECT user_key FROM dim_user WHERE is_legacy_owner);

-- Power BI's view: new columns can only be appended
CREATE OR REPLACE VIEW v_fact_transaction AS
SELECT
    transaction_key, transaction_nk, provider_txn_id, reference,
    date_key, time_key, provider_key, transaction_type_key, counterparty_key, category_key,
    amount, signed_amount, fee, tax, total_cost, balance_after,
    is_internal_transfer, has_balance_gap, balance_gap_amount, balance_gap_reason,
    is_recurring, recurring_interval_days, sms_count,
    occurred_at, source_object, pipeline_run_id, loaded_at, updated_at,
    category_rule,
    recurring_series,
    user_key
FROM fact_transaction
WHERE user_key = (SELECT user_key FROM dim_user WHERE is_legacy_owner);

-- ---------------------------------------------------------------------
-- The legacy owner's rows, for the dashboard views. In dw, not mart: they carry raw SMS text,
-- which the read-only dashboard login must never see (it can read mart only).
-- ---------------------------------------------------------------------
CREATE VIEW owner_fact AS
SELECT * FROM fact_transaction
WHERE user_key = (SELECT user_key FROM dim_user WHERE is_legacy_owner);

CREATE VIEW owner_etl_run AS
SELECT * FROM etl_run
WHERE user_key = (SELECT user_key FROM dim_user WHERE is_legacy_owner);

-- The dashboard views from 004, now reading only the legacy owner's rows. Same columns, so
-- CREATE OR REPLACE keeps them (and Metabase's questions) in place.

CREATE OR REPLACE VIEW mart.transactions AS
WITH spend_rank AS (
    -- Five biggest spending categories over all time; the rest fold into 'Other' in category_top5
    SELECT f.category_key,
           RANK() OVER (ORDER BY SUM(f.amount) DESC) AS rnk
    FROM dw.owner_fact f
    JOIN dw.dim_category c USING (category_key)
    WHERE f.signed_amount < 0 AND NOT f.is_internal_transfer AND c.category_group = 'Spending'
    GROUP BY f.category_key
)
SELECT
    f.transaction_key                                   AS transaction_id,
    f.occurred_at,
    d.full_date                                         AS date,
    date_trunc('month', d.full_date)::date              AS month,
    d.year_month,
    d.day_name                                          AS weekday,
    d.day_of_week                                       AS weekday_number,     -- 1 = Monday
    d.is_weekend,
    tm.time_key                                         AS hour,
    tm.hour_label,
    tm.day_part,
    CASE tm.day_part WHEN 'Morning' THEN 1 WHEN 'Afternoon' THEN 2
                     WHEN 'Evening' THEN 3 WHEN 'Night' THEN 4 ELSE 5 END AS day_part_order,
    p.provider_name                                     AS provider,
    tt.transaction_type,
    CASE WHEN f.is_internal_transfer THEN 'Own transfer'
         WHEN f.signed_amount < 0     THEN 'Money out'
         ELSE 'Money in' END                            AS flow,
    CASE WHEN f.signed_amount < 0 THEN 'Out' ELSE 'In' END AS direction,
    f.amount,
    CASE WHEN f.signed_amount < 0 AND NOT f.is_internal_transfer THEN f.amount ELSE 0 END AS money_out,
    CASE WHEN f.signed_amount > 0 AND NOT f.is_internal_transfer THEN f.amount ELSE 0 END AS money_in,
    CASE WHEN f.is_internal_transfer THEN 0 ELSE f.signed_amount END                      AS net_amount,
    f.fee,
    f.tax,
    f.total_cost                                        AS fees,
    f.balance_after,
    c.category_name                                     AS category,
    c.category_group,
    CASE WHEN c.category_group = 'Spending' AND COALESCE(r.rnk, 99) > 5 THEN 'Other'
         ELSE c.category_name END                       AS category_top5,
    split_part(f.category_rule, ':', 1)                 AS rule_layer,
    f.category_rule,
    -- People are shown by number, never by name: safe to screenshot
    CASE cp.counterparty_kind
        WHEN 'person'     THEN 'Person #' || cp.counterparty_key
        WHEN 'own_wallet' THEN 'Own wallet'
        ELSE initcap(cp.counterparty_name) END          AS counterparty,
    cp.counterparty_kind,
    f.is_recurring,
    f.recurring_series,
    f.recurring_interval_days,
    CASE f.recurring_interval_days WHEN 1 THEN 'Daily' WHEN 7 THEN 'Weekly'
         WHEN 14 THEN 'Fortnightly' WHEN 30 THEN 'Monthly' END AS rhythm,
    CASE WHEN f.signed_amount >= 0 OR f.is_internal_transfer THEN NULL
         WHEN f.amount < 5   THEN '1. Under 5'
         WHEN f.amount < 20  THEN '2. 5-20'
         WHEN f.amount < 50  THEN '3. 20-50'
         WHEN f.amount < 100 THEN '4. 50-100'
         ELSE '5. 100+' END                             AS size_band,
    f.is_internal_transfer                              AS is_own_transfer,
    f.has_balance_gap,
    f.sms_count
FROM dw.owner_fact f
JOIN dw.dim_date d                  USING (date_key)
JOIN dw.dim_time tm                 USING (time_key)
JOIN dw.dim_provider p              USING (provider_key)
JOIN dw.dim_transaction_type tt     USING (transaction_type_key)
JOIN dw.dim_category c              USING (category_key)
JOIN dw.dim_counterparty cp         USING (counterparty_key)
LEFT JOIN spend_rank r              USING (category_key);

CREATE OR REPLACE VIEW mart.recurring_series AS
WITH data_end AS (SELECT max(occurred_at) AS ts FROM dw.owner_fact),
series AS (
    SELECT recurring_series,
           max(rhythm)                                              AS rhythm,
           max(recurring_interval_days)                             AS interval_days,
           mode() WITHIN GROUP (ORDER BY category)                  AS category,
           mode() WITHIN GROUP (ORDER BY counterparty)              AS counterparty,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)      AS typical_amount,
           count(*)                                                 AS payments,
           sum(money_out)                                           AS total_paid,
           min(occurred_at)                                         AS first_paid_at,
           max(occurred_at)                                         AS last_paid_at
    FROM mart.transactions
    WHERE recurring_series IS NOT NULL
    GROUP BY recurring_series
)
SELECT
    s.recurring_series                                              AS series_id,
    s.rhythm || ' GHS ' || round(s.typical_amount::numeric) || ' (' || left(s.recurring_series, 6) || ')' AS series_label,
    s.rhythm,
    s.interval_days,
    s.category,
    s.counterparty,
    round(s.typical_amount::numeric, 2)                             AS typical_amount,
    s.payments,
    s.total_paid,
    s.first_paid_at,
    s.last_paid_at,
    -- Pipeline rule: still active if paid within two rhythm-lengths of the latest data
    CASE WHEN e.ts - s.last_paid_at <= make_interval(days => CASE s.interval_days
              WHEN 1 THEN 4 WHEN 7 THEN 18 WHEN 14 THEN 34 ELSE 70 END)
         THEN 'Active' ELSE 'Stopped' END                           AS status,
    CASE WHEN e.ts - s.last_paid_at <= make_interval(days => CASE s.interval_days
              WHEN 1 THEN 4 WHEN 7 THEN 18 WHEN 14 THEN 34 ELSE 70 END)
         THEN round((s.typical_amount * 30 / s.interval_days)::numeric, 2) ELSE 0 END AS monthly_cost
FROM series s CROSS JOIN data_end e;

CREATE OR REPLACE VIEW mart.wallet_daily_balance AS
WITH bounds AS (
    SELECT min(occurred_at)::date AS first_day, max(occurred_at)::date AS last_day FROM dw.owner_fact
),
days AS (
    SELECT generate_series(first_day, last_day, '1 day')::date AS date FROM bounds
),
wallets AS (
    SELECT DISTINCT provider_key FROM dw.owner_fact WHERE balance_after IS NOT NULL
)
SELECT
    d.date,
    p.provider_name AS provider,
    b.balance_after AS balance
FROM days d
CROSS JOIN wallets w
JOIN dw.dim_provider p USING (provider_key)
CROSS JOIN LATERAL (
    SELECT f.balance_after
    FROM dw.owner_fact f
    WHERE f.provider_key = w.provider_key
      AND f.balance_after IS NOT NULL
      AND f.occurred_at < d.date + 1
    ORDER BY f.occurred_at DESC
    LIMIT 1
) b;

CREATE OR REPLACE VIEW mart.pipeline_runs AS
SELECT
    run_id,
    status,
    started_at,
    finished_at,
    round(extract(epoch FROM finished_at - started_at)::numeric, 1)            AS duration_seconds,
    rows_in,
    rows_inserted,
    rows_updated,
    rows_unchanged,
    (quality_report ->> 'rows_out')::int                                        AS rows_out,
    (quality_report -> 'parse' ->> 'parse_success_rate')::numeric               AS parse_rate,
    (quality_report -> 'categories' ->> 'coverage')::numeric                    AS category_coverage,
    (quality_report -> 'removed' ->> 'duplicate_sms')::int                      AS duplicate_sms_merged,
    (quality_report ->> 'balance_gaps')::int                                    AS balance_gaps,
    (quality_report -> 'recurring' ->> 'series')::int                           AS recurring_series,
    error
FROM dw.owner_etl_run;

CREATE OR REPLACE VIEW mart.data_quality AS
SELECT
    count(*)                                                                    AS transactions,
    sum(sms_count) - count(*)                                                   AS duplicate_sms_merged,
    count(*) FILTER (WHERE has_balance_gap)                                     AS balance_gaps,
    round(1 - count(*) FILTER (WHERE has_balance_gap)::numeric
            / NULLIF(count(*) FILTER (WHERE balance_gap_amount IS NOT NULL), 0), 4) AS balance_continuity,
    round(count(*) FILTER (WHERE signed_amount < 0 AND NOT is_internal_transfer
                             AND category_key <> -1)::numeric
          / NULLIF(count(*) FILTER (WHERE signed_amount < 0 AND NOT is_internal_transfer), 0), 4) AS category_coverage,
    round(count(*) FILTER (WHERE signed_amount < 0 AND NOT is_internal_transfer
                             AND split_part(category_rule, ':', 1) IN ('reference', 'counterparty'))::numeric
          / NULLIF(count(*) FILTER (WHERE signed_amount < 0 AND NOT is_internal_transfer), 0), 4) AS explained_by_purpose,
    0.98                                                                        AS continuity_target,
    0.90                                                                        AS coverage_target,
    (SELECT max(finished_at) FROM dw.owner_etl_run WHERE status = 'succeeded')        AS last_load
FROM dw.owner_fact;

CREATE OR REPLACE VIEW mart.report_info AS
SELECT
    min(occurred_at)::date                                                      AS data_from,
    max(occurred_at)::date                                                      AS data_to,
    'All time: ' || to_char(min(occurred_at), 'FMDD Mon YYYY') || ' to '
        || to_char(max(occurred_at), 'FMDD Mon YYYY')                          AS period_label,
    count(*)                                                                    AS transactions,
    (SELECT max(finished_at) FROM dw.owner_etl_run WHERE status = 'succeeded')        AS last_load
FROM dw.owner_fact;
