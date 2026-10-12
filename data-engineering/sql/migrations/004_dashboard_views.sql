-- Dashboard views: a `mart` schema of ready-to-chart views for Metabase (or any BI tool).
-- Business rules live here once (own transfers excluded, privacy-safe counterparty names,
-- carried-forward balances, recurring status), so dashboard questions are drag-and-drop.
-- Views only: they hold no data and are rebuilt with the warehouse.

CREATE SCHEMA IF NOT EXISTS mart;

-- Read-only group role for dashboards. Login roles (e.g. metabase_reader) are members of it;
-- it can read mart and nothing else: no raw SMS text, references or phone numbers.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mart_reader') THEN
        CREATE ROLE mart_reader NOLOGIN;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- transactions: one row per transaction, every page's base
-- ---------------------------------------------------------------------
CREATE VIEW mart.transactions AS
WITH spend_rank AS (
    -- Five biggest spending categories over all time; the rest fold into 'Other' in category_top5
    SELECT f.category_key,
           RANK() OVER (ORDER BY SUM(f.amount) DESC) AS rnk
    FROM dw.fact_transaction f
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
FROM dw.fact_transaction f
JOIN dw.dim_date d                  USING (date_key)
JOIN dw.dim_time tm                 USING (time_key)
JOIN dw.dim_provider p              USING (provider_key)
JOIN dw.dim_transaction_type tt     USING (transaction_type_key)
JOIN dw.dim_category c              USING (category_key)
JOIN dw.dim_counterparty cp         USING (counterparty_key)
LEFT JOIN spend_rank r              USING (category_key);

-- ---------------------------------------------------------------------
-- monthly_cashflow: page 1 trend and KPI trend cards (all wallets)
-- ---------------------------------------------------------------------
CREATE VIEW mart.monthly_cashflow AS
WITH bounds AS (
    SELECT min(date) AS first_day, max(date) AS last_day FROM mart.transactions
),
months AS (
    SELECT generate_series(date_trunc('month', first_day), date_trunc('month', last_day), '1 month')::date AS month
    FROM bounds
),
totals AS (
    SELECT month,
           sum(money_out) AS money_out, sum(money_in) AS money_in, sum(net_amount) AS net,
           sum(fees) AS fees, count(*) FILTER (WHERE money_out > 0) AS spending_transactions
    FROM mart.transactions GROUP BY month
),
filled AS (
    SELECT m.month,
           to_char(m.month, 'YYYY-MM')                    AS year_month,
           COALESCE(t.money_out, 0)                       AS money_out,
           COALESCE(t.money_in, 0)                        AS money_in,
           COALESCE(t.net, 0)                             AS net,
           COALESCE(t.fees, 0)                            AS fees,
           COALESCE(t.spending_transactions, 0)           AS spending_transactions,
           -- Days of the month inside the data range, so partial first/last months aren't diluted
           (LEAST((m.month + interval '1 month - 1 day')::date, b.last_day)
              - GREATEST(m.month, b.first_day) + 1)       AS days_with_data,
           ((m.month + interval '1 month')::date - m.month) AS days_in_month
    FROM months m CROSS JOIN bounds b
    LEFT JOIN totals t USING (month)
)
SELECT
    month,
    year_month,
    days_with_data = days_in_month                                                         AS is_complete_month,
    money_out,
    money_in,
    net,
    fees,
    spending_transactions,
    days_with_data,
    round(money_out / NULLIF(days_with_data, 0), 2)                                       AS avg_daily_spend,
    round(fees / NULLIF(money_out, 0), 4)                                                  AS fee_rate,
    -- Previous month's values, for "vs last month" on KPI cards (Trend: compare to a column)
    lag(money_out) OVER (ORDER BY month)                                                   AS money_out_prev,
    lag(money_in)  OVER (ORDER BY month)                                                   AS money_in_prev,
    lag(net)       OVER (ORDER BY month)                                                   AS net_prev,
    lag(fees)      OVER (ORDER BY month)                                                   AS fees_prev,
    round(lag(money_out) OVER (ORDER BY month)
          / NULLIF(lag(days_with_data) OVER (ORDER BY month), 0), 2)                       AS avg_daily_spend_prev,
    -- Same definition as the Power BI measure: last three calendar months / 3
    round(sum(money_out) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) / 3, 2) AS money_out_3m_avg,
    round(money_out / NULLIF(lag(money_out) OVER (ORDER BY month), 0) - 1, 4)             AS money_out_change,
    round(money_in  / NULLIF(lag(money_in)  OVER (ORDER BY month), 0) - 1, 4)             AS money_in_change
FROM filled;

-- ---------------------------------------------------------------------
-- recurring_series: page 5, one row per detected series
-- ---------------------------------------------------------------------
CREATE VIEW mart.recurring_series AS
WITH data_end AS (SELECT max(occurred_at) AS ts FROM dw.fact_transaction),
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

-- recurring_payments: page 5 activity grid and monthly chart, readable series names
CREATE VIEW mart.recurring_payments AS
SELECT
    t.transaction_id,
    t.occurred_at,
    t.date,
    t.month,
    t.provider,
    t.money_out,
    s.series_id,
    s.series_label,
    s.rhythm,
    s.category,
    s.counterparty,
    s.status
FROM mart.transactions t
JOIN mart.recurring_series s ON s.series_id = t.recurring_series;

-- ---------------------------------------------------------------------
-- wallet_daily_balance: page 6, end-of-day balance per wallet, carried forward
-- ---------------------------------------------------------------------
CREATE VIEW mart.wallet_daily_balance AS
WITH bounds AS (
    SELECT min(occurred_at)::date AS first_day, max(occurred_at)::date AS last_day FROM dw.fact_transaction
),
days AS (
    SELECT generate_series(first_day, last_day, '1 day')::date AS date FROM bounds
),
wallets AS (
    SELECT DISTINCT provider_key FROM dw.fact_transaction WHERE balance_after IS NOT NULL
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
    FROM dw.fact_transaction f
    WHERE f.provider_key = w.provider_key
      AND f.balance_after IS NOT NULL
      AND f.occurred_at < d.date + 1
    ORDER BY f.occurred_at DESC
    LIMIT 1
) b;

-- Total across wallets per day, with the low-balance flag (threshold GHS 5)
CREATE VIEW mart.wallet_daily_total AS
SELECT date,
       sum(balance)       AS total_balance,
       sum(balance) < 5   AS below_threshold
FROM mart.wallet_daily_balance
GROUP BY date;

-- Latest balance per wallet
CREATE VIEW mart.wallet_latest_balance AS
SELECT DISTINCT ON (provider)
       provider, balance, date AS as_of
FROM mart.wallet_daily_balance
ORDER BY provider, date DESC;

-- ---------------------------------------------------------------------
-- pipeline_runs and data_quality: page 7
-- ---------------------------------------------------------------------
CREATE VIEW mart.pipeline_runs AS
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
FROM dw.etl_run;

CREATE VIEW mart.data_quality AS
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
    (SELECT max(finished_at) FROM dw.etl_run WHERE status = 'succeeded')        AS last_load
FROM dw.fact_transaction;

-- report_info: header text for every tab
CREATE VIEW mart.report_info AS
SELECT
    min(occurred_at)::date                                                      AS data_from,
    max(occurred_at)::date                                                      AS data_to,
    'All time: ' || to_char(min(occurred_at), 'FMDD Mon YYYY') || ' to '
        || to_char(max(occurred_at), 'FMDD Mon YYYY')                          AS period_label,
    count(*)                                                                    AS transactions,
    (SELECT max(finished_at) FROM dw.etl_run WHERE status = 'succeeded')        AS last_load
FROM dw.fact_transaction;

-- ---------------------------------------------------------------------
-- insights: page 1 "Key insights" box, all time, one sentence per row
-- ---------------------------------------------------------------------
CREATE VIEW mart.insights AS
WITH totals AS (
    SELECT sum(money_out) AS money_out,
           max(date) - min(date) + 1 AS days,
           sum(fees) AS fees,
           sum(fees) FILTER (WHERE transaction_type = 'cashout') AS cashout_fees
    FROM mart.transactions
),
top_cat AS (
    SELECT category, sum(money_out) AS amount
    FROM mart.transactions WHERE category_group = 'Spending'
    GROUP BY category ORDER BY amount DESC LIMIT 1
),
rec AS (
    SELECT count(*) FILTER (WHERE status = 'Active') AS active, sum(monthly_cost) AS monthly_cost
    FROM mart.recurring_series
)
SELECT 1 AS sort_order,
       'You spent GHS ' || to_char(t.money_out, 'FM999,999,990') || ' over ' || t.days
       || ' days, about GHS ' || to_char(t.money_out / NULLIF(t.days, 0), 'FM999,990') || ' a day.' AS insight
FROM totals t
UNION ALL
SELECT 2, 'Biggest category: ' || c.category || ' ('
       || to_char(100 * c.amount / NULLIF(t.money_out, 0), 'FM990') || '% of spending).'
FROM top_cat c CROSS JOIN totals t
UNION ALL
SELECT 3, r.active || ' recurring payments are still active, costing about GHS '
       || to_char(r.monthly_cost, 'FM999,990') || ' a month.'
FROM rec r
UNION ALL
SELECT 4, to_char(100 * t.cashout_fees / NULLIF(t.fees, 0), 'FM990')
       || '% of your fees come from cash-outs. Paying merchants directly avoids them.'
FROM totals t;

-- ---------------------------------------------------------------------
-- Access for dashboards
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA mart TO mart_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA mart TO mart_reader;
-- Views added by later migrations are readable too
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO mart_reader;
