-- API views: what the backend (the app's API) may read from the warehouse.
--
-- Each view returns only the rows of the user named in the database session's
-- `sikatrack.user_id` setting, which the backend sets from the caller's access token at the
-- start of each request. Unset or empty, the views return nothing: a query that forgets the
-- user fails closed instead of leaking someone else's data.
--
-- The backend's login gets `api_reader`: SELECT on these views, nothing in dw itself.

CREATE SCHEMA IF NOT EXISTS api;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_reader') THEN
        CREATE ROLE api_reader NOLOGIN;
    END IF;
END $$;

-- The caller's user_key, or NULL when no user is set. SECURITY DEFINER: it reads dw.dim_user,
-- which api_reader can't; the fixed search_path stops a caller substituting their own objects.
CREATE FUNCTION api.current_user_key() RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, dw AS $$
    SELECT user_key FROM dw.dim_user
    WHERE user_id = NULLIF(current_setting('sikatrack.user_id', TRUE), '')::uuid
$$;

-- One row per transaction of the caller
CREATE VIEW api.transaction AS
SELECT
    f.transaction_key,
    f.transaction_nk,
    f.provider_txn_id,
    f.occurred_at,
    d.full_date                                            AS date,
    d.day_of_week                                          AS weekday,      -- 1 = Monday
    d.is_weekend,
    tm.time_key                                            AS hour,
    lower(tm.day_part)                                     AS day_part,     -- morning, afternoon, ...
    p.provider_code,
    p.provider_name,
    tt.transaction_type,
    CASE WHEN f.signed_amount < 0 THEN 'out' ELSE 'in' END AS direction,
    f.amount,
    f.signed_amount,
    f.fee,
    f.tax,
    f.total_cost,
    f.balance_after,
    c.category_name,
    c.category_group,
    f.category_rule,
    NULLIF(cp.counterparty_key, -1)                        AS counterparty_key,
    CASE WHEN cp.counterparty_key = -1 THEN NULL ELSE cp.counterparty_name END AS counterparty_name,
    CASE WHEN cp.counterparty_key = -1 THEN NULL ELSE cp.counterparty_kind END AS counterparty_kind,
    f.reference,
    f.is_internal_transfer                                 AS is_own_transfer,
    f.is_recurring,
    f.recurring_series,
    f.recurring_interval_days,
    f.has_balance_gap,
    f.sms_count,
    f.raw_text
FROM dw.fact_transaction f
JOIN dw.dim_date d              USING (date_key)
JOIN dw.dim_time tm             USING (time_key)
JOIN dw.dim_provider p          USING (provider_key)
JOIN dw.dim_transaction_type tt USING (transaction_type_key)
JOIN dw.dim_category c          USING (category_key)
JOIN dw.dim_counterparty cp     USING (counterparty_key)
WHERE f.user_key = api.current_user_key();

-- The caller's counterparties (never their phone numbers)
CREATE VIEW api.counterparty AS
SELECT counterparty_key, counterparty_name, counterparty_kind, first_seen_at, last_seen_at
FROM dw.dim_counterparty
WHERE user_key = api.current_user_key();

-- Hours to day parts, the same as the transactions' (for rows not in the warehouse yet)
CREATE VIEW api.time_of_day AS
SELECT time_key AS hour, lower(day_part) AS day_part
FROM dw.dim_time
WHERE time_key >= 0;

-- Categories are shared
CREATE VIEW api.category AS
SELECT category_name, category_group
FROM dw.dim_category;

-- The caller's pipeline runs
CREATE VIEW api.pipeline_run AS
SELECT run_id, status, started_at, finished_at
FROM dw.etl_run
WHERE user_key = api.current_user_key();

-- Account deletion (the user's right to erasure): the one write the backend may make in the
-- warehouse, limited to removing a single user's rows. SECURITY DEFINER, as above.
CREATE FUNCTION api.forget_user(target UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, dw AS $$
DECLARE
    key INTEGER;
    removed INTEGER;
BEGIN
    SELECT user_key INTO key FROM dw.dim_user WHERE user_id = target;
    IF key IS NULL THEN
        RETURN 0;
    END IF;
    DELETE FROM dw.fact_transaction WHERE user_key = key;
    GET DIAGNOSTICS removed = ROW_COUNT;
    DELETE FROM dw.dim_counterparty WHERE user_key = key;
    DELETE FROM dw.etl_run WHERE user_key = key;
    DELETE FROM dw.dim_user WHERE user_key = key AND NOT is_legacy_owner;
    -- The legacy owner's row stays (the dashboards point at it), unlinked from the account
    UPDATE dw.dim_user SET user_id = NULL WHERE user_key = key AND is_legacy_owner;
    RETURN removed;
END $$;
REVOKE ALL ON FUNCTION api.forget_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.forget_user(UUID) TO api_reader;

GRANT USAGE ON SCHEMA api TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO api_reader;
GRANT EXECUTE ON FUNCTION api.current_user_key() TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO api_reader;
