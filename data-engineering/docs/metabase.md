# Metabase dashboard

The SikaTrack dashboard built in Metabase, following the Power BI design (the guide in
`docs/powerbi/`, on hold). Metabase runs in the Docker stack at **http://localhost:3000** and
reads the warehouse through the **`mart` views** (migration `004_dashboard_views`).

1. [Does Metabase cover the Power BI design?](#1-does-metabase-cover-the-power-bi-design)
2. [The views](#2-the-views)
3. [First-time setup](#3-first-time-setup)
4. [Design system: one look for every tab](#4-design-system-one-look-for-every-tab)
5. [Tab by tab](#5-tab-by-tab): [Overview](#tab-1-overview) ·
   [Spending](#tab-2-where-the-money-goes) · [Habits](#tab-3-spending-habits) ·
   [Fees](#tab-4-fees-and-charges) · [Recurring](#tab-5-recurring-payments) ·
   [Wallet](#tab-6-wallet-health) · [Pipeline](#tab-7-pipeline-health) ·
   [Counterparty](#tab-8-counterparty-detail)
6. [Interactions](#6-interactions)
7. [Finish and maintain](#7-finish-and-maintain)

## 1. Does Metabase cover the Power BI design?

Yes: every Power BI page and chart has a Metabase card. A few Power BI features have no
Metabase equivalent; each has a stand-in, listed below.

### Every visual, page by page

| Power BI page and visual | Metabase card | Source | Match |
|---|---|---|---|
| **1 Overview** · 5 KPI cards + "vs last month" | Trend cards (value + change vs the previous month) | `monthly_cashflow` | Same |
| Money in vs out by month (columns + 3-month line) | Combo chart | `monthly_cashflow` | Same |
| Spending by category (donut) | Pie (Metabase draws it as a donut with the total in the middle) | `transactions.category_top5` | Same |
| Top 5 categories (bar) | Row chart | `transactions` | Same |
| Top 10 counterparties (table + data bars) | Table with mini bar charts | `transactions` | Same |
| Key insights (text with live values) | SQL table of sentences, following the filters | `transactions`, `insights` | Same |
| **2 Spending** · Top category, coverage, explained by purpose, spending transactions | Number cards | `transactions` | Same |
| Spending by category (bar) | Row chart | `transactions` | Same |
| Category trend (stacked area) | Area, stacked | `transactions` | Same |
| Decomposition tree | Click a category → a counterparty table filters to it | `transactions` | **Stand-in** (no decomposition tree in Metabase) |
| How categories were decided | Row chart | `transactions.rule_layer` | Same |
| **3 Habits** · Peak day, peak day part, weekend share, median, airtime per week | One SQL question shown as five number cards | `transactions` | Same |
| Weekday × time-of-day heatmap (matrix) | SQL table with a colour range | `transactions` | Same |
| By hour, size bands, average by type | Bar, bar, row chart | `transactions` | Same |
| **4 Fees** · Fees, fee rate, cash-out fees, cash-out share | Trend + number cards | `monthly_cashflow`, `transactions` | Same |
| Fees by type, cumulative fees, fees by month | Row chart, line (cumulative sum), bar | `transactions`, `monthly_cashflow` | Same |
| What to do (insight text) | SQL sentence + text card | `transactions` | Same |
| **5 Recurring** · Active series, monthly and annual cost, recurring share | Number cards | `recurring_series`, `transactions` | Same |
| Series table with status | Table, status coloured | `recurring_series` | Same |
| Recurring spend by month by rhythm | Bar, stacked | `recurring_payments` | Same |
| Series activity grid | Pivot table | `recurring_payments` | Same |
| **6 Wallet** · Latest, lowest, days below threshold | Number cards | wallet views | Same |
| Balance over time + threshold line | Line by wallet with a goal line | `wallet_daily_balance` | Same (the line is fixed at GHS 5; the KPI and monthly cards follow the threshold filter) |
| Low-balance days by month, balance by wallet | Bar, row chart | wallet views | Same |
| **7 Pipeline** · KPIs, two gauges, notes, loads table | Number, gauge, text, table | `data_quality`, `pipeline_runs` | Same |

### Report features

| Power BI feature | In Metabase |
|---|---|
| Page navigator rail | **Dashboard tabs** across the top |
| Header: title, "All time: 15 Nov 2025 to 3 Oct 2026", last refresh | A heading card + a period card + a last-load card on every tab (`report_info`) |
| Slicers synced across pages (Month, Provider) | **Dashboard filters**: one filter bar for all tabs; wire each filter to the cards it should change |
| Card notes under KPIs ("0.77% of money out") | The card's **description** line, or a second, smaller number card |
| Theme JSON (colours, fonts, white cards on grey) | Metabase's default look is already white cards on light grey. Series colours are set per chart (section 4). Custom fonts and a global palette need a paid plan |
| What-if threshold slider | A **Number filter** "Low balance threshold" feeding SQL questions |
| Drill-through to a counterparty | **Click behaviour** on the counterparty table → the Counterparty tab, filtered (tab 8) |
| Tooltips | Built in: hover any bar, line point or slice |
| Field parameter (switch the metric) | Not available. Each metric gets its own card |
| Bookmarks (chart/table toggle) | Not needed: any card's **⋯ → View as table** |
| Dark variant | Only in full-screen mode (**⋯ → Enter fullscreen → Night mode**) |

### What changed in the views to close the gaps

| Gap | Fix in `004_dashboard_views` |
|---|---|
| "vs last month" on KPI cards | `monthly_cashflow` has `*_prev` columns (previous month's money out, money in, net, fees, average daily spend) and `is_complete_month` |
| Header subtitle and last refresh | New view `report_info` |
| Activity grid showed series IDs | New view `recurring_payments`: each recurring payment with its readable `series_label` and status |
| Own transfers had no direction | `transactions.direction` (`In` / `Out`) |

## 2. The views

| View | One row per | Main columns |
|---|---|---|
| `transactions` | Transaction | `date`, `month`, `provider`, `flow`, `direction`, `money_out`, `money_in`, `net_amount`, `fees`, `category`, `category_group`, `category_top5`, `rule_layer`, `counterparty`, `counterparty_kind`, `weekday`, `weekday_number`, `hour`, `day_part`, `size_band`, `is_recurring`, `rhythm`, `transaction_type` |
| `monthly_cashflow` | Month (all wallets) | `month`, `money_out`, `money_in`, `net`, `fees`, `avg_daily_spend`, `fee_rate`, `money_out_3m_avg`, `*_prev`, `is_complete_month`, `days_with_data` |
| `recurring_series` | Recurring series | `series_label`, `rhythm`, `category`, `counterparty`, `typical_amount`, `payments`, `last_paid_at`, `status`, `monthly_cost` |
| `recurring_payments` | Recurring payment | `date`, `month`, `money_out`, `series_label`, `rhythm`, `status` |
| `wallet_daily_balance` | Day × wallet | `date`, `provider`, `balance` (carried forward) |
| `wallet_daily_total` | Day | `date`, `total_balance`, `below_threshold` (under GHS 5) |
| `wallet_latest_balance` | Wallet | `provider`, `balance`, `as_of` |
| `pipeline_runs` | Warehouse load | `run_id`, `status`, `finished_at`, rows, `parse_rate`, `category_coverage` |
| `data_quality` | (one row) | `transactions`, `duplicate_sms_merged`, `balance_gaps`, `balance_continuity`, `category_coverage`, targets, `last_load` |
| `report_info` | (one row) | `period_label`, `data_from`, `data_to`, `last_load` |
| `insights` | Sentence | `sort_order`, `insight` (all time) |

Rules already in the views, so you never rebuild them:

- `money_out` and `money_in` leave out transfers between your own wallets. **Sum those
  columns; never sum `amount`.** `net_amount` = in minus out.
- People appear as `Person #<n>`: safe to screenshot and share.
- `category_top5` keeps the five biggest spending categories and folds the rest into `Other`,
  the same five on every tab and every month, so colours never move.
- Balances are carried forward per day. Never sum `balance_after`.
- `monthly_cashflow` covers all wallets; the Provider filter doesn't apply to it (noted on the
  cards that use it).

## 3. First-time setup

1. Start Metabase (from `data-engineering/`):

   ```bash
   docker compose up -d metabase-db metabase-reader-init metabase
   ```

   The first start takes 1-2 minutes. Metabase needs about 1 GB of RAM.
2. Create the `mart` views. The next pipeline run does it automatically; to do it now:

   ```bash
   docker compose exec airflow-scheduler python -c "from src.load.warehouse import connect, migrate; print(migrate(connect()))"
   ```

   It prints `['004_dashboard_views']`.
3. Open http://localhost:3000 and create your admin account.
4. **Add a database → PostgreSQL**:

   | Field | Value |
   |---|---|
   | Display name | SikaTrack |
   | Host | `warehouse` (the Docker service name, not localhost) |
   | Port | `5432` |
   | Database name | `sikatrack_dw` |
   | Username | `metabase_reader` |
   | Password | `METABASE_READER_PASSWORD` from `.env` |
   | Schemas | **Only these… → `mart`** |

5. **Admin settings → Table metadata → SikaTrack**. For each view, set:
   - money columns (`money_out`, `money_in`, `net_amount`, `net`, `fees`, `amount`, `balance`,
     `total_balance`, `typical_amount`, `monthly_cost`, `avg_daily_spend`, `money_out_3m_avg`,
     the `*_prev` money columns): **Semantic type → Currency**, then the gear → **Currency:
     Ghanaian Cedi (GHS)**, **Currency label style: Code** (shows "GHS 40,356").
   - rates (`fee_rate`, `parse_rate`, `category_coverage`, `balance_continuity`,
     `explained_by_purpose`, targets): **Semantic type → Percentage**.
   - `transaction_id`, `weekday_number`, `day_part_order`, `hour`: **Semantic type → Category**
     or "No semantic type", so Metabase doesn't sum them.
6. Create the collections: **New → Collection** named *SikaTrack*, with one sub-collection per
   tab. Save each question into its tab's collection.
7. Create the dashboard: **New → Dashboard**, name **SikaTrack**, save into the collection.
   Click the **+** by the first tab to make 8 tabs: *Overview, Spending, Habits, Fees,
   Recurring, Wallet, Pipeline, Counterparty*.
8. In the dashboard's **⋯ → Edit settings**: turn on **Full width** and **Auto-apply filters**.

## 4. Design system: one look for every tab

### The grid

A dashboard is **24 columns** wide; cards are placed in grid units. Every tab uses the same
rows, so tabs line up when you switch between them:

```text
row 0  ┌──────────── heading (12) ────────────┬──── period (7) ────┬─ last load (5) ┐  height 2
row 2  ├──── KPI ────┬──── KPI ────┬──── KPI ────┬──── KPI ────┬──── KPI ──────────┤  height 3
row 5  ├──────────────── main chart (14) ──────────────┬───── second chart (10) ─────┤  height 7
row 12 ├─────── detail (8) ───────┬─────── detail (8) ───────┬─────── detail (8) ───────┤  height 6
row 18 └──────────────────────────────────────────────────────────────────────────────┘
```

Positions below are given as **x (column), y (row), width × height**. In edit mode, drag a card
to its column and row and drag its corner to size it; cards snap to the grid.

### The header (repeat on every tab)

| Card | Position | How |
|---|---|---|
| Heading | x0 y0, 12 × 2 | Edit mode → **T → Heading**: the tab's question, e.g. *"Overview: where does my money stand?"* |
| Period | x12 y0, 7 × 2 | Question: `report_info` → column `period_label` only → visualization **Number**; card title off. Shows *All time: 15 Nov 2025 to 3 Oct 2026* |
| Last load | x19 y0, 5 × 2 | Question: `report_info` → `last_load` → **Number**; title *Last load*; date style *Oct 7, 2026, 13:54* |

Save the period and last-load questions once and add the same two to every tab.

### Colours

Metabase's default dashboard is white cards on light grey, like the Power BI theme. Set
series colours on each chart: the chart's gear → **Display** (or the series' colour dot) →
type the hex, or pick the nearest swatch if your version only offers swatches.

| What | Colour | Hex |
|---|---|---|
| Money Out; single-series bars and lines | Blue | `#2a78d6` |
| Money In | Orange | `#eb6834` |
| 3-month average line, targets | Dark ink | `#1B2631` |
| Categories (`category_top5`) | Cash Withdrawal blue, Transfers-Personal orange, Food green, Airtime/Data yellow, Giving pink, Other grey | `#2a78d6` `#eb6834` `#1baf7a` `#eda100` `#e87ba4` `#b9b8b2` |
| Wallets | MTN MoMo blue, GhanaPay orange | `#2a78d6` `#eb6834` |
| Rhythms | Daily blue, Monthly orange (Weekly green, Fortnightly yellow if they appear) | as above |
| **Good** (Active, healthy, under target) | Green, **only** for status | `#0ca30c` |
| **Bad** (low balance, failed, gaps) | Red, **only** for status | `#d03b3b` |
| Heatmap and grid scales | White → blue | `#ffffff` → `#256abf` |

Rules from the Power BI design that still apply: one y-axis per chart (no second axis); at
most six colours in a chart (that's why `category_top5` exists); the same thing keeps the
same colour on every tab; red and green never colour ordinary data.

### Card conventions

- **Titles**: sentence case, no units (*Spending by category*, not *SPENDING BY CATEGORY (GHS)*).
- **Number cards**: gear → **Formatting → Decimals 0** for money above 1,000; Metabase shortens
  large numbers on small cards automatically.
- **Trend cards**: gear → **Comparisons → Add comparison → Value from another column** →
  the `*_prev` column; label *vs last month*. If your version lacks that option, use
  **Previous value**: the same result, because the rows are months.
  Switch *Switch positive / negative colours* **on** for Money Out, Fees and Avg daily spend,
  so spending going **down** shows green.
- **Charts**: gear → **Display**: show values on bars only where there are 12 bars or fewer;
  **Axes**: hide the x-axis label when the title already says what it is.
- **Descriptions**: the card's **ⓘ description** holds the Power BI card notes (e.g. "0.77% of
  money out") and how to read the card.

### The filters

Add these in edit mode (filter icon), once for the whole dashboard:

| Filter | Type | Default | Wire to |
|---|---|---|---|
| **Month** | Date picker → *Month and Year* (or *All options*) | Previous month | `date` on `transactions`, `recurring_payments` and the wallet views; `month` on `monthly_cashflow`; the `{{date}}` variable of SQL questions. **Not** on Pipeline, recurring-series or header cards |
| **Provider** | Text or Category → Is, values from `transactions.provider` | (none) | `provider` on `transactions`, `recurring_payments`, `wallet_daily_balance`, `wallet_latest_balance`; `{{provider}}` in SQL |
| **Category** | Text or Category → Is, values from `transactions.category` | (none) | `category` on Spending-tab cards; set by clicking a bar (section 6) |
| **Counterparty** | Text or Category → Is, values from `transactions.counterparty` | (none) | Only the Counterparty tab |
| **Low balance threshold** | Number → Equal to | 5 | `{{threshold}}` on the Wallet SQL questions |

A filter shows on every tab but only changes the cards it's wired to; Metabase hides a filter
on tabs where it's wired to nothing.

## 5. Tab by tab

Each tab: the layout, then every card with its position, how to build it, how to present it,
and a **check** (your real all-time numbers, or September 2026 for monthly cards). If the card
shows the check value with the right filter, it's built right.

Notebook shorthand used below: **view → Summarize → by → filter → sort/limit**.
SQL questions: **New → SQL query**, database SikaTrack, paste, then in the variables panel set
each `{{date}}` to **Field filter → the named view → date** and each `{{provider}}` to
**Field filter → that view → provider**.

### Tab 1: Overview

*Where does my money stand?*

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [Money Out 5][Money In 5][ Net 5 ][ Fees 5 ][Avg daily 4]
y5  [ Money in vs money out by month 14 ][ Spending by category 10 ]
y12 [ Top 5 categories 8 ][ Top 10 counterparties 8 ][ Key insights 8 ]
```

| # | Card | Position | Build | Present | Check |
|---|---|---|---|---|---|
| 1 | Money out | x0 y2, 5×3 | `monthly_cashflow` → Sum of `money_out`, Sum of `money_out_prev` → by `month` (Month) | **Trend**; compare to `money_out_prev`; switch colours on | Sep 2026: GHS 2,719, ▼30.6% |
| 2 | Money in | x5 y2, 5×3 | Same with `money_in`, `money_in_prev` | Trend; colours normal | Sep: GHS 1,447 |
| 3 | Net cash flow | x10 y2, 5×3 | Same with `net`, `net_prev` | Trend | Sep: -GHS 1,272 |
| 4 | Fees & tax | x15 y2, 5×3 | Same with `fees`, `fees_prev` | Trend; switch colours on | Sep: GHS 21.20 (Aug 34.67) |
| 5 | Avg daily spend | x20 y2, 4×3 | Same with `avg_daily_spend` (Max), `avg_daily_spend_prev` (Max) | Trend; switch colours on | Sep: GHS 90.63 |
| 6 | Money in vs money out by month | x0 y5, 14×7 | `monthly_cashflow` → Sum of `money_out`, Sum of `money_in`, Sum of `money_out_3m_avg` → by `month` (Month) | **Combo**: money_out and money_in **Bar**, 3m avg **Line**; all on the **left** axis; colours blue / orange / ink; legend top | Mar 2026 bar: 5,061 |
| 7 | Spending by category | x14 y5, 10×7 | `transactions` → Sum of `money_out` → by `category_top5` → filter `category_group` is *Spending* | **Pie**; **Show percentages: In legend**; category colours | Cash Withdrawal 43.3% (all time) |
| 8 | Top 5 spending categories | x0 y12, 8×6 | `transactions` → Sum of `money_out` → by `category` → filter `category_group` *Spending* → sort desc → limit 5 | **Row** chart, blue, **Show values** | Cash Withdrawal 17,470 |
| 9 | Top 10 counterparties | x8 y12, 8×6 | `transactions` → Sum of `money_out`, Count → by `counterparty` → filter `money_out` > 0 → sort desc → limit 10 | **Table**; rename columns *Counterparty, Money out, Payments*; `money_out` column gear → **Show a mini bar chart** | Person #43, 5,117 |
| 10 | Key insights | x16 y12, 8×6 | SQL below | **Table**; hide column `n` (gear → columns); header off; text wrapping on | "You spent GHS 40,356 over 323 days…" (all time) |

Card 6 shows all wallets (the Provider filter doesn't reach `monthly_cashflow`). Add *All
wallets* to its description.

Key insights SQL (`{{date}}` → transactions.date, `{{provider}}` → transactions.provider):

```sql
WITH t AS (
    SELECT * FROM mart.transactions
    WHERE 1 = 1 [[AND {{date}}]] [[AND {{provider}}]]
),
tot AS (
    SELECT sum(money_out) AS money_out, max(date) - min(date) + 1 AS days,
           sum(fees) AS fees, sum(fees) FILTER (WHERE transaction_type = 'cashout') AS cashout_fees
    FROM t
),
top_cat AS (
    SELECT category, sum(money_out) AS amount FROM t
    WHERE category_group = 'Spending' GROUP BY category ORDER BY amount DESC LIMIT 1
)
SELECT 1 AS n, 'You spent GHS ' || to_char(money_out, 'FM999,999,990') || ' over ' || days
       || ' days, about GHS ' || to_char(money_out / NULLIF(days, 0), 'FM999,990') || ' a day.' AS "Key insights"
FROM tot
UNION ALL
SELECT 2, 'Biggest category: ' || c.category || ' ('
       || to_char(100 * c.amount / NULLIF(tot.money_out, 0), 'FM990') || '% of spending).'
FROM top_cat c CROSS JOIN tot
UNION ALL
SELECT 3, insight FROM mart.insights WHERE sort_order = 3
UNION ALL
SELECT 4, to_char(100 * cashout_fees / NULLIF(fees, 0), 'FM990')
       || '% of your fees come from cash-outs. Paying merchants directly avoids them.'
FROM tot
ORDER BY n
```

The recurring sentence (3) is always about today, so it ignores the filters, as in Power BI.

### Tab 2: Where the money goes

*What do I spend on, and how sure are we of the categories?*

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [ Top category 6 ][ Coverage 6 ][ Explained by purpose 6 ][ Spending txns 6 ]
y5  [ Spending by category 12 ][ Category trend by month 12 ]
y12 [ Counterparties in the selected category 14 ][ How categories were decided 10 ]
```

| # | Card | Position | Build | Present | Check (all time) |
|---|---|---|---|---|---|
| 1 | Top category | x0 y2, 6×3 | `transactions` → Sum of `money_out` → by `category` → filter *Spending* → sort desc → limit 1 | **Number**, field to show `category`; description "43.3% of spending" | Cash Withdrawal |
| 2 | Category coverage | x6 y2, 6×3 | `transactions` → Custom expression `CountIf([category] != "Uncategorized" AND [money_out] > 0) / CountIf([money_out] > 0)` | Number, **Style: Percent**, 1 decimal | 99.9% |
| 3 | Explained by purpose | x12 y2, 6×3 | Custom `CountIf(([rule_layer] = "reference" OR [rule_layer] = "counterparty") AND [money_out] > 0) / CountIf([money_out] > 0)` | Number, Percent; description "categorised from your reference or the payee" | 27.6% |
| 4 | Spending transactions | x18 y2, 6×3 | Custom `CountIf([money_out] > 0)` | Number | 1,519 |
| 5 | Spending by category | x0 y5, 12×7 | Sum of `money_out` → by `category` → filter *Spending* → sort desc | **Row** chart, blue, show values | 10+ bars, Cash Withdrawal first |
| 6 | Category trend by month | x12 y5, 12×7 | Sum of `money_out` → by `month` (Month) and `category_top5` → filter *Spending* | **Area**, **Stacking: Stack**; category colours; legend top | |
| 7 | Counterparties in the selected category | x0 y12, 14×6 | Sum of `money_out`, Count → by `counterparty`, `counterparty_kind` → filter `money_out` > 0 → sort desc → limit 15 | Table, mini bar on money out; wire the **Category** filter to `category` | With *Cash Withdrawal* clicked: agents only |
| 8 | How categories were decided | x14 y12, 10×6 | Count → by `rule_layer` → filter `money_out` > 0 → sort desc | Row chart; description: "type = from the transaction type; reference = from what you typed; counterparty = from who you paid; default = fallback" | type 960 |

Card 7 replaces Power BI's decomposition tree: click a bar on card 5 and card 7 shows where
that category's money went (set up in section 6).

### Tab 3: Spending habits

*When and how do I spend?*

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [Peak day 5][Peak part 5][Weekend 5][Median 5][Airtime/wk 4]
y5  [ Weekday x time of day 12 ][ Spending by hour 12 ]
y12 [ How big are payments? 12 ][ Average payment by type 12 ]
```

Cards 1-5 are **one SQL question** added five times; on each copy, gear → **Field to show**.

```sql
SELECT
    (SELECT weekday FROM mart.transactions WHERE money_out > 0 [[AND {{date}}]] [[AND {{provider}}]]
     GROUP BY weekday ORDER BY sum(money_out) DESC LIMIT 1)                    AS "Peak spending day",
    (SELECT day_part FROM mart.transactions WHERE money_out > 0 [[AND {{date}}]] [[AND {{provider}}]]
     GROUP BY day_part ORDER BY sum(money_out) DESC LIMIT 1)                   AS "Peak time of day",
    sum(money_out) FILTER (WHERE is_weekend) / NULLIF(sum(money_out), 0)       AS "Weekend share",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) FILTER (WHERE money_out > 0) AS "Median payment",
    count(*) FILTER (WHERE category = 'Airtime/Data' AND money_out > 0)
        / NULLIF((max(date) - min(date) + 1) / 7.0, 0)                         AS "Airtime buys per week"
FROM mart.transactions
WHERE 1 = 1 [[AND {{date}}]] [[AND {{provider}}]]
```

| # | Card | Position | Present | Check (all time) |
|---|---|---|---|---|
| 1 | Peak spending day | x0 y2, 5×3 | Number, field *Peak spending day* | Monday |
| 2 | Peak time of day | x5 y2, 5×3 | Number, field *Peak time of day* | Afternoon |
| 3 | Weekend share | x10 y2, 5×3 | Number, Percent, 1 decimal | 28.0% |
| 4 | Median payment | x15 y2, 5×3 | Number, Currency GHS, 2 decimals | GHS 15.00 |
| 5 | Airtime buys per week | x20 y2, 4×3 | Number, 1 decimal | 15.9 |
| 6 | Weekday × time of day | x0 y5, 12×7 | SQL below → **Table**; gear → **Conditional formatting → Color range**, columns Morning-Night, white → `#256abf` | Monday · Afternoon 3,929 (hottest) |
| 7 | Spending by hour | x12 y5, 12×7 | `transactions` → Sum of `money_out` → by `hour` → **Bar**, blue; x-axis **Scale: Ordinal** | Peak at 12 |
| 8 | How big are payments? | x0 y12, 12×6 | Count → by `size_band` → filter `money_out` > 0 → **Bar**, show values | 2. 5-20: 349 |
| 9 | Average payment by type | x12 y12, 12×6 | Average of `amount` → by `transaction_type` → filter `money_out` > 0 → sort desc → **Row**, show values | cashout GHS 47.99 |

Heatmap SQL (card 6):

```sql
SELECT weekday AS "Day",
       sum(money_out) FILTER (WHERE day_part = 'Morning')   AS "Morning",
       sum(money_out) FILTER (WHERE day_part = 'Afternoon') AS "Afternoon",
       sum(money_out) FILTER (WHERE day_part = 'Evening')   AS "Evening",
       sum(money_out) FILTER (WHERE day_part = 'Night')     AS "Night"
FROM mart.transactions
WHERE 1 = 1 [[AND {{date}}]] [[AND {{provider}}]]
GROUP BY weekday_number, weekday
ORDER BY weekday_number
```

### Tab 4: Fees and charges

*What does moving money cost me, and how can I pay less?*

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [ Fees & tax 6 ][ Fee rate 6 ][ Cash-out fees 6 ][ Cash-out share 6 ]
y5  [ Fees by transaction type 12 ][ Fees add up 12 ]
y12 [ Fees by month 14 ][ What to do 10 ]
```

| # | Card | Position | Build | Present | Check (all time) |
|---|---|---|---|---|---|
| 1 | Fees & tax | x0 y2, 6×3 | `transactions` → Sum of `fees` | Number, GHS, 2 decimals | GHS 309.07 |
| 2 | Fee rate | x6 y2, 6×3 | Custom `Sum([fees]) / Sum([money_out])` | Number, Percent, 2 decimals; description "of money out" | 0.77% |
| 3 | Cash-out fees | x12 y2, 6×3 | Sum of `fees` → filter `transaction_type` *cashout* | Number, GHS | GHS 208.20 |
| 4 | Cash-out share of fees | x18 y2, 6×3 | Custom `SumIf([fees], [transaction_type] = "cashout") / Sum([fees])` | Number, Percent, 1 decimal | 67.4% |
| 5 | Fees by transaction type | x0 y5, 12×7 | Sum of `fees` → by `transaction_type` → filter `fees` > 0 → sort desc | Row, blue, show values | cashout 208.20 |
| 6 | Fees add up | x12 y5, 12×7 | **Cumulative sum of** `fees` → by `date` (Day) | **Line**, blue, no dots | ends at 309.07 |
| 7 | Fees by month | x0 y12, 14×6 | `monthly_cashflow` → Sum of `fees` → by `month` (Month) | Bar, blue; description "All wallets" | |
| 8 | What to do | x14 y12, 10×3 | SQL below | Table, header off | "67% of your fees come from cash-outs…" |
| 9 | Tips | x14 y15, 10×3 | Text card: *Pay shops with MoMo Pay or a merchant ID instead of withdrawing cash first. Send to people on the same network: cross-network sends cost more.* | Text | |

```sql
SELECT to_char(100 * sum(fees) FILTER (WHERE transaction_type = 'cashout') / NULLIF(sum(fees), 0), 'FM990')
       || '% of your fees come from cash-outs. Paying merchants directly avoids them.' AS "What to do"
FROM mart.transactions
WHERE 1 = 1 [[AND {{date}}]] [[AND {{provider}}]]
```

### Tab 5: Recurring payments

*What keeps coming back, and what does it cost?*

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [ Active series 6 ][ Monthly cost 6 ][ Annual cost 6 ][ Recurring share 6 ]
y5  [ Recurring series 14 ][ Recurring spend by month 10 ]
y12 [ Series activity 18 ][ Headline 6 ]
```

Cards 1-3 and 5 describe the series **today**, so don't wire the Month filter to them.

| # | Card | Position | Build | Present | Check |
|---|---|---|---|---|---|
| 1 | Active series | x0 y2, 6×3 | `recurring_series` → Count → filter `status` *Active* | Number; description "of 7 found" | 2 |
| 2 | Monthly cost (active) | x6 y2, 6×3 | `recurring_series` → Sum of `monthly_cost` | Number, GHS | GHS 235.00 |
| 3 | Annual cost | x12 y2, 6×3 | Custom `Sum([monthly_cost]) * 12` | Number, GHS, 0 decimals | GHS 2,820 |
| 4 | Recurring share | x18 y2, 6×3 | `transactions` → Custom `SumIf([money_out], [is_recurring]) / Sum([money_out])` | Number, Percent; description "of all spending" | 8.1% |
| 5 | Recurring series | x0 y5, 14×7 | `recurring_series` → columns `series_label`, `category`, `counterparty`, `typical_amount`, `payments`, `last_paid_at`, `status`, `monthly_cost` → sort `status` asc, `payments` desc | Table; rename *Series, Category, Paid to, Typical, Payments, Last paid, Status, Monthly cost*; **Conditional formatting → Single color**: `status` is *Active* → green `#0ca30c`, *Stopped* → grey | 7 rows, 2 Active |
| 6 | Recurring spend by month | x14 y5, 10×7 | `recurring_payments` → Sum of `money_out` → by `month` (Month) and `rhythm` | **Bar**, **Stack**; Daily blue, Monthly orange | |
| 7 | Series activity | x0 y12, 18×6 | `recurring_payments` → Count → by `series_label` and `month` (Month) | **Pivot table** (rows `series_label`, columns `month`); conditional formatting white → `#256abf` if your version offers it | Daily GHS 3: 30-57 a month |
| 8 | Headline | x18 y12, 6×6 | `insights` → filter `sort_order` = 3 → column `insight` | Table, header off, wrap text | "2 recurring payments are still active, costing about GHS 235 a month." |

### Tab 6: Wallet health

*How close do I run to zero?*

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [ Latest balance 6 ][ Lowest balance 6 ][ Days below threshold 6 ][ Average balance 6 ]
y5  [ Wallet balance at the end of each day 24 ]
y12 [ Low-balance days by month 12 ][ Balance by wallet now 12 ]
```

| # | Card | Position | Build | Present | Check (all time) |
|---|---|---|---|---|---|
| 1 | Latest balance | x0 y2, 6×3 | `wallet_latest_balance` → Sum of `balance` | Number, GHS, 2 decimals; don't wire Month | GHS 30.24 |
| 2 | Lowest end-of-day balance | x6 y2, 6×3 | `wallet_daily_total` → Min of `total_balance` | Number, GHS; Month → `date` | GHS 1.13 |
| 3 | Days below threshold | x12 y2, 6×3 | SQL A below | Number; title *Days below threshold*; **red** value via **Conditional formatting** if your version offers it, otherwise neutral | 21 (at GHS 5) |
| 4 | Average end-of-day balance | x18 y2, 6×3 | `wallet_daily_total` → Average of `total_balance` | Number, GHS | |
| 5 | Wallet balance at the end of each day | x0 y5, 24×7 | `wallet_daily_balance` → Sum of `balance` → by `date` (Day) and `provider` | **Line**; MTN blue, GhanaPay orange; gear → **Goal line** on, value 5, label *Low balance (GHS 5)* | Ends at 27.35 and 2.89 |
| 6 | Low-balance days by month | x0 y12, 12×6 | SQL B below | **Bar**, blue (not red: it's a count, not a status) | |
| 7 | Balance by wallet now | x12 y12, 12×6 | `wallet_latest_balance` → Sum of `balance` → by `provider` | Row, show values | MTN 27.35, GhanaPay 2.89 |

SQL A (`{{threshold}}`: type **Number**, default 5, wired to the *Low balance threshold*
filter; `{{date}}` → wallet_daily_total.date):

```sql
SELECT count(*) AS "Days below threshold"
FROM mart.wallet_daily_total
WHERE total_balance < {{threshold}} [[AND {{date}}]]
```

SQL B:

```sql
SELECT date_trunc('month', date)::date AS "Month",
       count(*) FILTER (WHERE total_balance < {{threshold}}) AS "Days below threshold"
FROM mart.wallet_daily_total
WHERE 1 = 1 [[AND {{date}}]]
GROUP BY 1
ORDER BY 1
```

`wallet_daily_total` adds up both wallets, so the Provider filter applies to cards 1, 5 and 7
only.

### Tab 7: Pipeline health

*Can I trust these numbers?* Wire **no** filters on this tab.

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [Transactions 5][Duplicates 5][Gaps 5][Loads 5][Last load 4]
y5  [ Balance continuity 8 ][ Category coverage 8 ][ How it checks itself 8 ]
y12 [ Warehouse loads 24 ]
```

| # | Card | Position | Build | Present | Check |
|---|---|---|---|---|---|
| 1 | Transactions | x0 y2, 5×3 | `data_quality` → `transactions` | Number | 1,890 |
| 2 | Duplicate SMS merged | x5 y2, 5×3 | `data_quality` → `duplicate_sms_merged` | Number | 73 |
| 3 | Balance gaps | x10 y2, 5×3 | `data_quality` → `balance_gaps` | Number | 7 |
| 4 | Successful loads | x15 y2, 5×3 | `pipeline_runs` → Count → filter `status` *succeeded* | Number | |
| 5 | Last load | x20 y2, 4×3 | `data_quality` → `last_load` | Number | |
| 6 | Balance continuity | x0 y5, 8×7 | `data_quality` → `balance_continuity` | **Gauge**; ranges 0-0.98 red `#d03b3b`, 0.98-1 green `#0ca30c`; Percent | 99.63% |
| 7 | Category coverage | x8 y5, 8×7 | `data_quality` → `category_coverage` | Gauge; 0-0.90 red, 0.90-1 green | 99.93% |
| 8 | How the pipeline checks itself | x16 y5, 8×7 | Text card: *Every load is all-or-nothing: a failed run changes nothing. A run stops if parsing, balance continuity or category coverage fall below their limits. Reloading the same data changes nothing.* | Text | |
| 9 | Warehouse loads | x0 y12, 24×6 | `pipeline_runs` → columns `run_id`, `status`, `finished_at`, `rows_inserted`, `rows_updated`, `rows_unchanged`, `parse_rate`, `category_coverage` → sort `finished_at` desc | Table; `status` conditional formatting: *succeeded* green, *failed* red | Latest: succeeded |

### Tab 8: Counterparty detail

The Power BI drill-through page. Reached by clicking a counterparty on the Overview (section 6);
wire the **Counterparty** filter to every card here, plus Month and Provider.

```text
y0  [ Heading 12 ][ Period 7 ][ Last load 5 ]
y2  [ Money out 6 ][ Money in 6 ][ Payments 6 ][ Last payment 6 ]
y5  [ By month 12 ][ Categories 12 ]
y12 [ Every transaction 24 ]
```

| # | Card | Position | Build | Present |
|---|---|---|---|---|
| 1 | Money out | x0 y2, 6×3 | `transactions` → Sum of `money_out` | Number, GHS |
| 2 | Money in | x6 y2, 6×3 | Sum of `money_in` | Number, GHS |
| 3 | Payments | x12 y2, 6×3 | Count | Number |
| 4 | Last payment | x18 y2, 6×3 | Max of `occurred_at` | Number, date |
| 5 | By month | x0 y5, 12×7 | Sum of `money_out`, Sum of `money_in` → by `month` (Month) | Bar; blue / orange |
| 6 | Categories | x12 y5, 12×7 | Sum of `money_out` → by `category` | Row |
| 7 | Every transaction | x0 y12, 24×6 | `transactions` → columns `occurred_at`, `transaction_type`, `category`, `money_out`, `money_in`, `fees`, `provider` → sort `occurred_at` desc | Table |

## 6. Interactions

Set in edit mode: hover a card → **⚡ Click behavior**.

| From | Click behaviour | Result |
|---|---|---|
| Spending tab, *Spending by category* (card 5) | **Update a dashboard filter** → Category ← `category` | Card 7 shows that category's counterparties (the decomposition tree's job). Click again to clear |
| Overview, *Spending by category* pie | Update a dashboard filter → Category | Picking a slice carries the category to the Spending tab |
| Overview, *Top 10 counterparties* | **Go to a custom destination → Dashboard → SikaTrack, tab Counterparty**, pass Counterparty ← `counterparty` | The drill-through page for that counterparty |
| Recurring, *Recurring series* table | Update a dashboard filter → Counterparty ← `counterparty`, then switch to the Counterparty tab | Every payment of that series |
| Any Trend card | Default (opens the question) | See the months behind the number |

Hovering shows tooltips everywhere without setup.

## 7. Finish and maintain

Before calling a tab done:

- [ ] Every card shows its check value (clear the Month filter for all-time checks; pick
      September 2026 for the monthly ones).
- [ ] Month and Provider change the cards they should, and nothing else.
- [ ] Money out is blue and money in orange everywhere; categories keep their colours.
- [ ] No people's names visible (only `Person #`).
- [ ] Card titles in sentence case, descriptions filled in where Power BI had a card note.

Maintenance:

- New data appears automatically: Metabase queries the views live, so after each pipeline run
  the dashboard is current (Metabase caches nothing by default).
- New categories appear in `category_top5` only if they enter the top five; give them a colour
  then.
- Metabase's questions and dashboards live in the `metabase_db_data` Docker volume. Back it up
  with the others; `docker compose down -v` deletes it.
- If a view changes in a later migration, **Admin → Databases → SikaTrack → Sync database
  schema now** so Metabase sees new columns.
