-- =====================================================================
-- SikaTrack warehouse: star schema for Power BI
--
-- Grain of fact_transaction: ONE MoMo transaction (= one parsed SMS).
--
--                 dim_date      dim_time
--                      \          /
--   dim_provider --- fact_transaction --- dim_counterparty
--                      /          \
--      dim_transaction_type      dim_category
--
-- Every dimension has an "Unknown" member with key -1, so fact rows
-- never carry NULL foreign keys (Power BI relationships stay clean).
--
-- Runs automatically on the warehouse container's first start.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS dw;
SET search_path TO dw;

-- ---------------------------------------------------------------------
-- dim_date: one row per calendar day, pre-generated
-- ---------------------------------------------------------------------
CREATE TABLE dim_date (
    date_key        INTEGER PRIMARY KEY,          -- YYYYMMDD
    full_date       DATE        NOT NULL UNIQUE,
    day_of_month    SMALLINT    NOT NULL,
    day_name        VARCHAR(9)  NOT NULL,
    day_of_week     SMALLINT    NOT NULL,         -- 1 = Monday ... 7 = Sunday (ISO)
    is_weekend      BOOLEAN     NOT NULL,
    week_of_year    SMALLINT    NOT NULL,         -- ISO week
    month_number    SMALLINT    NOT NULL,
    month_name      VARCHAR(9)  NOT NULL,
    month_short     CHAR(3)     NOT NULL,
    year_month      CHAR(7)     NOT NULL,         -- '2025-11', sortable label
    quarter         SMALLINT    NOT NULL,
    year            SMALLINT    NOT NULL,
    is_month_end    BOOLEAN     NOT NULL
);

INSERT INTO dim_date
SELECT
    TO_CHAR(d, 'YYYYMMDD')::INT,
    d::DATE,
    EXTRACT(DAY FROM d),
    TRIM(TO_CHAR(d, 'Day')),
    EXTRACT(ISODOW FROM d),
    EXTRACT(ISODOW FROM d) IN (6, 7),
    EXTRACT(WEEK FROM d),
    EXTRACT(MONTH FROM d),
    TRIM(TO_CHAR(d, 'Month')),
    TO_CHAR(d, 'Mon'),
    TO_CHAR(d, 'YYYY-MM'),
    EXTRACT(QUARTER FROM d),
    EXTRACT(YEAR FROM d),
    d::DATE = (DATE_TRUNC('month', d) + INTERVAL '1 month - 1 day')::DATE
FROM GENERATE_SERIES('2020-01-01'::DATE, '2030-12-31'::DATE, INTERVAL '1 day') AS d;

INSERT INTO dim_date VALUES
    (-1, '1900-01-01', 0, 'Unknown', 0, FALSE, 0, 0, 'Unknown', 'UNK', 'Unknown', 0, 0, FALSE);

-- ---------------------------------------------------------------------
-- dim_time: hour of day (Ghana is UTC+0, so SMS UTC timestamps are local time)
-- ---------------------------------------------------------------------
CREATE TABLE dim_time (
    time_key        SMALLINT PRIMARY KEY,         -- 0..23
    hour_label      CHAR(5)     NOT NULL,         -- '08:00'
    day_part        VARCHAR(10) NOT NULL          -- Night / Morning / Afternoon / Evening
);

INSERT INTO dim_time
SELECT
    h,
    LPAD(h::TEXT, 2, '0') || ':00',
    CASE
        WHEN h BETWEEN 5 AND 11  THEN 'Morning'
        WHEN h BETWEEN 12 AND 16 THEN 'Afternoon'
        WHEN h BETWEEN 17 AND 20 THEN 'Evening'
        ELSE 'Night'
    END
FROM GENERATE_SERIES(0, 23) AS h;

INSERT INTO dim_time VALUES (-1, 'UNK', 'Unknown');

-- ---------------------------------------------------------------------
-- dim_provider
-- ---------------------------------------------------------------------
CREATE TABLE dim_provider (
    provider_key    SERIAL PRIMARY KEY,
    provider_code   VARCHAR(30)  NOT NULL UNIQUE, -- matches parser output: mtn_momo, ghanapay, ...
    provider_name   VARCHAR(60)  NOT NULL
);

INSERT INTO dim_provider (provider_key, provider_code, provider_name) VALUES
    (-1, 'unknown', 'Unknown');
INSERT INTO dim_provider (provider_code, provider_name) VALUES
    ('mtn_momo',      'MTN MoMo'),
    ('ghanapay',      'GhanaPay'),
    ('telecel_cash',  'Telecel Cash'),
    ('airteltigo',    'AirtelTigo Money');

-- ---------------------------------------------------------------------
-- dim_transaction_type
-- Keyed on (template, transaction_type): the 'payment_sent' template can
-- resolve to either airtime or transfer, so template alone isn't enough.
-- Direction is fixed per template, so it lives here, not in the fact.
-- ---------------------------------------------------------------------
CREATE TABLE dim_transaction_type (
    transaction_type_key SERIAL PRIMARY KEY,
    template            VARCHAR(50) NOT NULL,     -- parser template name
    transaction_type    VARCHAR(30) NOT NULL,     -- transfer, airtime, cashout, ...
    direction           VARCHAR(6)  NOT NULL CHECK (direction IN ('credit', 'debit', 'n/a')),
    flow_label          VARCHAR(10) NOT NULL,     -- 'Money In' / 'Money Out' for visuals
    UNIQUE (template, transaction_type)
);

INSERT INTO dim_transaction_type VALUES (-1, 'unknown', 'unknown', 'n/a', 'Unknown');

-- ---------------------------------------------------------------------
-- dim_counterparty
-- ---------------------------------------------------------------------
CREATE TABLE dim_counterparty (
    counterparty_key    SERIAL PRIMARY KEY,
    counterparty_name   VARCHAR(200) NOT NULL UNIQUE, -- normalised (trimmed, upper-cased)
    counterparty_kind   VARCHAR(30)  NOT NULL DEFAULT 'unclassified',
                        -- person | merchant | bank | telco | agent | own_wallet | unclassified
    first_seen_at       TIMESTAMPTZ,
    last_seen_at        TIMESTAMPTZ
);

INSERT INTO dim_counterparty (counterparty_key, counterparty_name, counterparty_kind)
VALUES (-1, 'UNKNOWN', 'unclassified');

-- ---------------------------------------------------------------------
-- dim_category: seed list from the Data Engineering Layer spec
-- ---------------------------------------------------------------------
CREATE TABLE dim_category (
    category_key    SERIAL PRIMARY KEY,
    category_name   VARCHAR(50) NOT NULL UNIQUE,
    is_default      BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO dim_category (category_key, category_name) VALUES (-1, 'Uncategorized');
INSERT INTO dim_category (category_name) VALUES
    ('Food'),
    ('Transport'),
    ('Airtime/Data'),
    ('Bills'),
    ('Transfers-Personal'),
    ('Transfers-Business'),
    ('Savings'),
    ('Cash Withdrawal'),
    ('Income');

-- ---------------------------------------------------------------------
-- fact_transaction
-- ---------------------------------------------------------------------
CREATE TABLE fact_transaction (
    transaction_key         BIGSERIAL PRIMARY KEY,

    -- Natural / degenerate keys
    message_id              CHAR(16)    NOT NULL UNIQUE,   -- sha256 prefix from filter_sms: idempotent upsert key
    provider_txn_id         VARCHAR(40),                   -- "Financial Transaction Id" from the SMS
    reference               VARCHAR(255),                  -- user-entered reference/message

    -- Dimension foreign keys
    date_key                INTEGER  NOT NULL DEFAULT -1 REFERENCES dim_date (date_key),
    time_key                SMALLINT NOT NULL DEFAULT -1 REFERENCES dim_time (time_key),
    provider_key            INTEGER  NOT NULL DEFAULT -1 REFERENCES dim_provider (provider_key),
    transaction_type_key    INTEGER  NOT NULL DEFAULT -1 REFERENCES dim_transaction_type (transaction_type_key),
    counterparty_key        INTEGER  NOT NULL DEFAULT -1 REFERENCES dim_counterparty (counterparty_key),
    category_key            INTEGER  NOT NULL DEFAULT -1 REFERENCES dim_category (category_key),

    -- Measures (GHS)
    amount                  NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    signed_amount           NUMERIC(14, 2) NOT NULL,       -- +credit / -debit, for net cash-flow
    fee                     NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tax                     NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- E-Levy etc.
    total_cost              NUMERIC(14, 2) GENERATED ALWAYS AS (fee + tax) STORED,
    balance_after           NUMERIC(14, 2),                -- semi-additive: use LASTNONBLANK in DAX, never SUM

    -- Recurring detection (Sub-Phase C) output
    is_recurring            BOOLEAN  NOT NULL DEFAULT FALSE,
    recurring_interval_days SMALLINT,

    -- Audit
    occurred_at             TIMESTAMPTZ NOT NULL,
    raw_text                TEXT        NOT NULL,
    source_object           VARCHAR(500),                  -- MinIO key of the raw file this row came from
    loaded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_fact_txn_date         ON fact_transaction (date_key);
CREATE INDEX ix_fact_txn_counterparty ON fact_transaction (counterparty_key);
CREATE INDEX ix_fact_txn_category     ON fact_transaction (category_key);
CREATE INDEX ix_fact_txn_occurred_at  ON fact_transaction (occurred_at);
