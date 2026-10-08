# API contract (v1)

What the React Native app and the FastAPI backend agree on. Once built, the Pydantic models
are the source of truth and FastAPI publishes them at `/openapi.json`; the app generates its
TypeScript types from that. This document is the design those models are written from.

- [Conventions](#conventions)
- [Auth](#auth) · [Me](#me) · [Devices](#devices) · [Config](#config) · [Wallets](#wallets)
- [SMS ingestion and sync](#sms-ingestion-and-sync)
- [Transactions](#transactions) · [Summaries](#summaries) · [Balances](#balances)
- [Categories](#categories) · [Counterparties](#counterparties) · [Recurring](#recurring)
- [Budgets](#budgets) · [Notifications](#notifications) · [Insights](#insights)
- [Internal and health](#internal-and-health)
- [Endpoint index](#endpoint-index)

## Conventions

| Topic | Rule |
|---|---|
| Base URL | `https://<host>/v1`. A breaking change means `/v2`; adding fields is not breaking, so the app must ignore fields it doesn't know |
| Format | JSON, UTF-8, `snake_case` field names |
| Auth | `Authorization: Bearer <access_token>` on everything except `/v1/auth/*`, `/v1/config` and health checks |
| Money | **Decimal strings with two places**: `"125.50"`. Never JSON floats, so 0.1 + 0.2 problems can't reach the app. Currency is always GHS, given once as `"currency": "GHS"` where a response has money |
| Times | ISO 8601 in UTC with `Z`: `"2026-09-14T09:32:00Z"`. Ghana is UTC+0 with no daylight saving, so a UTC day is a local day |
| Dates and months | `"2026-09-14"`, `"2026-09"` |
| IDs | Opaque strings with a type prefix (`usr_`, `wal_`, `txn_`, `cpt_`, `rec_`, `bud_`, `ntf_`, `bat_`). The app never parses them |
| Lists | Cursor pagination: `?limit=50&cursor=...` → `{"items": [...], "next_cursor": "..." \| null}`. `limit` max 100 |
| Errors | RFC 9457 problem details, `Content-Type: application/problem+json` (below) |
| Idempotency | `POST /v1/sms/batches` requires an `Idempotency-Key` header; repeats with the same key return the first response |
| Rate limits | `429` with `Retry-After` (seconds). Limits are listed per endpoint |
| Request IDs | Every response has `X-Request-ID`; the app shows it on error screens so problems can be traced |

### Errors

```json
{
  "type": "https://sikatrack.app/errors/otp-invalid",
  "title": "The code is wrong or has expired",
  "status": 400,
  "code": "otp_invalid",
  "detail": "Request a new code and try again.",
  "errors": [{"field": "code", "message": "Must be 6 digits"}]
}
```

`code` is stable and is what the app switches on; `title` and `detail` are for display and may
change. Codes used across the API:

| HTTP | `code` | When |
|---|---|---|
| 400 | `validation_error` | Body or query failed validation (`errors[]` lists fields) |
| 400 | `otp_invalid` | Wrong or expired one-time code |
| 401 | `unauthenticated` | Missing, malformed or expired access token; the app refreshes, then retries once |
| 401 | `refresh_invalid` | Refresh token unknown, expired, revoked or reused; the app signs the user out |
| 403 | `forbidden` | Valid token, not allowed (e.g. internal endpoint) |
| 404 | `not_found` | Resource doesn't exist **or belongs to another user** (never reveal which) |
| 409 | `conflict` | E.g. the same wallet added twice |
| 409 | `idempotency_mismatch` | Same `Idempotency-Key` with a different body |
| 413 | `payload_too_large` | SMS batch over the limits |
| 422 | `unsupported_provider` | A wallet for a provider the parser doesn't support yet |
| 426 | `app_update_required` | App older than `min_app_version` |
| 429 | `rate_limited` | Too many requests; see `Retry-After` |
| 503 | `dependency_unavailable` | Database or object store down; safe to retry |

### Shared objects

`Money` fields are strings; `Category` and `Counterparty` are embedded in short form:

```json
"category": {"id": "food", "name": "Food", "group": "spending"},
"counterparty": {"id": "cpt_7Hq2", "name": "Sunshine Laundry", "kind": "merchant"}
```

Category `id` is a stable slug (`food`, `airtime_data`, `cash_withdrawal`, ...), so the app can
map it to an icon. `group` is one of `spending`, `money_in`, `own_money`.

---

## Auth

Phone number plus a one-time code sent by SMS. No passwords.

### `POST /v1/auth/otp/request`

Sends a 6-digit code to the phone number.

```json
{"phone_number": "0241234567"}
```

`202 Accepted`
```json
{"otp_request_id": "otp_9fK2", "expires_in": 300, "resend_after": 60}
```

- Accepts `024...` or `+23324...`; stores and returns `+233` form. Rejects non-Ghanaian numbers
  in v1 (`validation_error`).
- The code is stored hashed (never in plain text), expires in 5 minutes, allows 5 attempts.
- Same response whether or not the number has an account, so the endpoint can't be used to
  check who uses SikaTrack.
- Rate limits: 3 per phone number per 10 minutes, 20 per IP per hour.

### `POST /v1/auth/otp/verify`

Checks the code; signs in, creating the account on first sign-in.

```json
{
  "otp_request_id": "otp_9fK2",
  "code": "482913",
  "device": {"device_id": "b3f1c2e0-...", "platform": "android", "app_version": "1.0.0", "model": "Tecno Spark 20"}
}
```

`200 OK`
```json
{
  "access_token": "eyJ...",
  "refresh_token": "rt_...",
  "token_type": "Bearer",
  "expires_in": 900,
  "is_new_user": true,
  "user": { "...": "same as GET /v1/me" }
}
```

- `device_id` is a UUID the app generates once and keeps; tokens are tied to it.
- Access token: JWT, 15 minutes, claims `sub` (user ID), `sid` (session), `exp`.
- Refresh token: random, 30 days, stored hashed, one session per device.
- Errors: `otp_invalid` (wrong, expired or too many attempts), `rate_limited`.

### `POST /v1/auth/refresh`

```json
{"refresh_token": "rt_..."}
```
`200 OK`: a new access token **and a new refresh token**; the old refresh token stops working.
If an old refresh token is used again, someone has copied it: the whole session is revoked
and the app gets `refresh_invalid`.

### `POST /v1/auth/logout`

```json
{"refresh_token": "rt_..."}
```
`204 No Content`. Revokes the session and removes the device's push token.

---

## Me

### `GET /v1/me`

```json
{
  "id": "usr_3kP9",
  "phone_number": "+233241234567",
  "display_name": "Jerry",
  "created_at": "2026-10-08T10:00:00Z",
  "onboarding": {"wallets_added": true, "sms_permission": "granted", "first_sync_done": true},
  "settings": {
    "low_balance_threshold": "5.00",
    "notify": {"budget": true, "low_balance": true, "recurring": true, "weekly_digest": true, "data_ready": false}
  },
  "data": {"first_transaction_at": "2025-11-15T21:43:07Z", "last_transaction_at": "2026-10-03T20:14:01Z", "transactions": 1890}
}
```

### `PATCH /v1/me`

Any subset of `display_name`, `settings.low_balance_threshold`, `settings.notify.*`,
`onboarding.sms_permission` (`granted` / `denied`, reported by the app). Returns the updated
`/v1/me` body.

### `DELETE /v1/me`

`202 Accepted` `{"deletion_scheduled_for": "2026-10-15T10:00:00Z"}`

Signs out every device at once and hides all data immediately. After 7 days (time to change
your mind by signing in again, which cancels it) a job deletes the user's raw-zone objects,
warehouse rows and `app` rows, and writes an audit entry with no personal data in it.

### `GET /v1/me/export` (phase 7)

`202 Accepted` `{"export_id": "exp_..."}`, then a notification with a time-limited download link
to a ZIP of the user's transactions (CSV) and settings (JSON).

---

## Devices

### `PUT /v1/devices/{device_id}`

Registers or updates this phone's push token; call on sign-in and whenever the token changes.
```json
{"platform": "android", "push_token": "ExponentPushToken[...]", "app_version": "1.0.3"}
```
`200 OK` with the stored device. If `app_version` is below `min_app_version`, responds
`426 app_update_required`.

### `DELETE /v1/devices/{device_id}`

`204`. Stops push to that phone.

---

## Config

### `GET /v1/config` (no auth)

What the app needs before and after sign-in; cache for an hour.
```json
{
  "min_app_version": "1.0.0",
  "momo_senders": ["MobileMoney", "GhanaPay"],
  "providers": [
    {"code": "mtn_momo", "name": "MTN MoMo", "senders": ["MobileMoney"], "supported": true},
    {"code": "ghanapay", "name": "GhanaPay", "senders": ["GhanaPay"], "supported": true},
    {"code": "telecel_cash", "name": "Telecel Cash", "senders": [], "supported": false}
  ],
  "limits": {"sms_batch_max_messages": 500, "sms_batch_max_bytes": 1048576},
  "features": {"budgets": true, "export": false}
}
```
`momo_senders` comes from the pipeline's `MOMO_SENDERS`, so adding a provider on the server
starts collecting its SMS without an app release. The app must filter on this list **on the
phone** and never upload other SMS.

---

## Wallets

A wallet is one of the user's own mobile-money accounts. The pipeline uses them to tell
transfers between your own accounts from real spending (what `OWNER_NAMES` and
`OWNER_NUMBERS` do today).

### `GET /v1/wallets`

```json
{"items": [{
  "id": "wal_A1",
  "provider": "mtn_momo",
  "phone_number": "+233241234567",
  "account_name": "JERRY K MENSAH",
  "label": "Main MoMo",
  "latest_balance": "27.35",
  "balance_as_of": "2026-10-03T20:14:01Z",
  "created_at": "2026-10-08T10:02:00Z"
}]}
```

### `POST /v1/wallets`

```json
{"provider": "mtn_momo", "phone_number": "0241234567", "account_name": "JERRY K MENSAH", "label": "Main MoMo"}
```
`201 Created`. `account_name` is the name exactly as it appears in your MoMo SMS; the app
suggests names it finds in the first SMS scan. Errors: `conflict` (already added),
`unsupported_provider`. Adding or changing a wallet marks the user for reprocessing, because it
changes which transfers count as own transfers.

### `PATCH /v1/wallets/{wallet_id}` · `DELETE /v1/wallets/{wallet_id}`

Change `label` or `account_name`, or remove a wallet. Both trigger reprocessing; deleting a
wallet does not delete its transactions.

---

## SMS ingestion and sync

The full flow is in [ingestion-and-sync.md](ingestion-and-sync.md).

### `POST /v1/sms/batches`

Uploads raw MoMo SMS from the phone.

Headers: `Idempotency-Key: <uuid generated by the app per batch>`

```json
{
  "device_id": "b3f1c2e0-...",
  "source": "initial_scan",
  "messages": [
    {
      "sender": "MobileMoney",
      "date_ms": "1760002321570",
      "body": "Payment made for GHS 40.00 to SUNSHINE LAUNDRY. ...",
      "android_id": 48213
    }
  ]
}
```

| Field | Rule |
|---|---|
| `source` | `initial_scan` (first sync, reading the inbox history), `incremental` (SMS since the last sync), `live` (one SMS just received) |
| `sender` | The SMS address exactly as Android stores it |
| `date_ms` | Android's `date` column as a **string of digits**: milliseconds since 1970, the same value SMS Backup & Restore writes as `date`. It is part of the message ID, so it must not be reformatted |
| `body` | The full text, unchanged |
| `android_id` | Android's `_id`; optional, for the app's own bookkeeping only |

Limits: 500 messages and 1 MB per batch; 60 batches per user per hour.

`202 Accepted`
```json
{
  "batch_id": "bat_X7",
  "received": 120,
  "accepted": 117,
  "duplicates": 3,
  "rejected_senders": 0,
  "parsed": 114,
  "unparsed": 1,
  "ignored": 2,
  "provisional_transactions": 114,
  "sync": {"latest_date_ms": "1760002321570", "pipeline": "scheduled"}
}
```

What happens:
1. Rejects messages whose `sender` isn't in `momo_senders` (counted, not stored).
2. Computes each `message_id` with the pipeline's own function: SHA-256 of
   `sender|date_ms|body`, first 16 hex characters. A message already received (by any batch,
   or from an XML backup you loaded before) is a duplicate and is skipped.
3. Writes the accepted messages as one JSON Lines object to the raw zone,
   `raw/users/<user_id>/sms/<YYYY-MM-DD>/<batch_id>.jsonl`, the source of truth.
4. Parses each with the pipeline's parser and categoriser and stores a provisional transaction,
   so the app can show it immediately.
5. Schedules a pipeline run for the user, debounced (see the sync doc), and returns.

Errors: `validation_error`, `payload_too_large`, `idempotency_mismatch`, `rate_limited`.

### `GET /v1/sms/batches/{batch_id}`

```json
{"batch_id": "bat_X7", "status": "loaded", "received_at": "2026-10-08T10:05:00Z", "accepted": 117, "pipeline_run_id": "20261008T100700Z-91ab", "loaded_at": "2026-10-08T10:08:12Z"}
```
`status`: `received` → `processing` → `loaded`, or `failed` (the pipeline failed; the operator
is alerted by email and the batch is retried with the next run).

### `GET /v1/sync/status`

What the app checks on start-up and on pull-to-refresh.
```json
{
  "latest_date_ms": "1760002321570",
  "last_upload_at": "2026-10-08T10:05:00Z",
  "pending_messages": 0,
  "provisional_transactions": 0,
  "last_pipeline_run": {"status": "succeeded", "finished_at": "2026-10-08T10:08:12Z"},
  "data_through": "2026-10-03T20:14:01Z"
}
```
The app scans for SMS newer than `latest_date_ms` (with a 10-minute overlap; duplicates are
harmless), so a reinstall or a second phone picks up where the server left off.

---

## Transactions

A transaction is either **final** (in the warehouse, after the pipeline's checks) or
**provisional** (parsed on upload, not yet processed). Lists merge both; a provisional item is
replaced by its final version once the pipeline loads it.

### Transaction object

```json
{
  "id": "txn_9Qe1",
  "status": "final",
  "occurred_at": "2026-09-14T09:32:00Z",
  "provider": "mtn_momo",
  "wallet_id": "wal_A1",
  "type": "merchant",
  "direction": "out",
  "amount": "40.00",
  "fee": "0.00",
  "tax": "0.00",
  "total_cost": "0.00",
  "balance_after": "287.15",
  "currency": "GHS",
  "category": {"id": "personal_care", "name": "Personal Care", "group": "spending"},
  "category_source": "rule",
  "counterparty": {"id": "cpt_7Hq2", "name": "Sunshine Laundry", "kind": "merchant"},
  "reference": "Laundry",
  "note": null,
  "is_own_transfer": false,
  "recurring_id": null,
  "flags": []
}
```

| Field | Values and meaning |
|---|---|
| `direction` | `in`, `out` |
| `type` | The pipeline's `transaction_type`: `transfer`, `airtime`, `cashout`, `cashin`, `merchant`, `bank_transfer`, `refund`, `interest`, `savings`, `reversal` |
| `category_source` | `rule` (pipeline rules), `user` (you corrected it), `counterparty_default` (your default for that counterparty) |
| `counterparty.name` | Your alias if you set one, otherwise the cleaned name. People you've never named show as their name from the SMS; phone numbers are never returned |
| `is_own_transfer` | Between your own wallets; excluded from spending and income totals |
| `flags` | `balance_gap` (an SMS seems to be missing before this one), `duplicate_sms_merged` |

### `GET /v1/transactions`

| Query | Meaning |
|---|---|
| `from`, `to` | Dates, inclusive; default the last 30 days |
| `direction` | `in` / `out` |
| `category` | Category id; repeatable |
| `provider`, `wallet_id`, `counterparty_id`, `recurring_id` | Filters |
| `include_own_transfers` | Default `false` |
| `q` | Search in counterparty name, alias and reference |
| `min_amount`, `max_amount` | Decimal strings |
| `limit`, `cursor` | Pagination, newest first |

`200 OK` `{"items": [Transaction...], "next_cursor": "..."}`

### `GET /v1/transactions/{id}`

The transaction object plus detail fields:
```json
{
  "...": "all Transaction fields",
  "sms_text": "Payment made for GHS 40.00 to SUNSHINE LAUNDRY. ...",
  "sms_count": 2,
  "category_explanation": "Your reference mentions 'laundry'",
  "provider_txn_id": "69065381661"
}
```
`category_explanation` turns the pipeline's `category_rule` into a sentence, so users can see
why a category was chosen.

### `PATCH /v1/transactions/{id}`

Corrects the category or adds a note.
```json
{"category": "food", "note": "Lunch with team", "apply_to_counterparty": false}
```
- Stores an override keyed by the transaction's natural key (stable across pipeline runs, and
  the same for provisional and final versions). The API applies it at once; the pipeline
  applies it on its next run, so Power BI agrees.
- `apply_to_counterparty: true` also sets this as the counterparty's default category, which
  applies to its past and future transactions unless individually overridden.
- `category: null` removes your override and goes back to the rule.

`200 OK` with the updated transaction.

---

## Summaries

All accept `from`/`to` (dates) or `month` (`YYYY-MM`), plus `provider` and `wallet_id` filters.
Own transfers are always excluded. The numbers are the same definitions as the Power BI
measures (Money Out, Money In, Fees & Tax...), so the app and the dashboard agree.

### `GET /v1/summary`

The home screen.
```json
{
  "period": {"from": "2026-09-01", "to": "2026-09-30", "days": 30},
  "currency": "GHS",
  "money_out": "2723.40",
  "money_in": "1480.00",
  "net": "-1243.40",
  "fees": "21.30",
  "avg_daily_spend": "90.78",
  "spending_transactions": 128,
  "compare": {
    "period": {"from": "2026-08-01", "to": "2026-08-31"},
    "money_out": "3920.00",
    "money_out_change": "-0.305",
    "money_in_change": "-0.221"
  },
  "top_category": {"id": "cash_withdrawal", "name": "Cash Withdrawal", "share": "0.412"},
  "recurring_monthly_cost": "235.00",
  "includes_provisional": false
}
```
Changes and shares are decimal strings of a fraction (`"-0.305"` = -30.5%). `compare` is the
previous period of the same length.

### `GET /v1/summary/categories`

Spending by category (the roadmap's `/summary/monthly`).
```json
{
  "period": {"from": "2026-09-01", "to": "2026-09-30"},
  "total": "2723.40",
  "items": [
    {"category": {"id": "cash_withdrawal", "name": "Cash Withdrawal", "group": "spending"}, "amount": "1122.00", "share": "0.412", "transactions": 9, "budget": {"limit": "1000.00", "used": "1.122"}}
  ]
}
```
`group` query: `spending` (default), `money_in`, `all`.

### `GET /v1/summary/trend`

```json
{"granularity": "month", "items": [{"period": "2026-08", "money_out": "3920.00", "money_in": "1900.00", "fees": "30.10"}]}
```
`granularity`: `day`, `week`, `month`. Periods with no transactions are returned as zeros, so
charts have no gaps.

### `GET /v1/summary/counterparties`

Top counterparties by money out: `limit` (default 10), `direction`.
```json
{"items": [{"counterparty": {"id": "cpt_7Hq2", "name": "Sunshine Laundry", "kind": "merchant"}, "amount": "320.00", "transactions": 8}]}
```

### `GET /v1/summary/habits`

When you spend: weekday by time-of-day grid and hourly totals (the dashboard's Habits page).
```json
{
  "grid": [{"weekday": 1, "day_part": "afternoon", "amount": "392.90"}],
  "by_hour": [{"hour": 12, "amount": "810.00"}],
  "peak": {"weekday": 1, "day_part": "afternoon"},
  "weekend_share": "0.280",
  "median_payment": "15.00"
}
```

---

## Balances

### `GET /v1/balances`

Latest balance per wallet, from the most recent SMS that reported one.
```json
{"total": "30.24", "items": [{"wallet_id": "wal_A1", "provider": "mtn_momo", "balance": "27.35", "as_of": "2026-10-03T20:14:01Z"}]}
```

### `GET /v1/balances/history`

End-of-day balance per wallet, carried forward on days with no SMS. `from`, `to`, `wallet_id`.
```json
{"items": [{"date": "2026-10-01", "wallet_id": "wal_A1", "balance": "112.35"}], "days_below_threshold": 3, "threshold": "5.00"}
```

---

## Categories

### `GET /v1/categories`

The category list for pickers and icons; same as `dw.dim_category`.
```json
{"items": [{"id": "food", "name": "Food", "group": "spending", "user_selectable": true}]}
```
`user_selectable: false` for categories the pipeline manages itself (`own_transfers`,
`uncategorized`). Custom categories are v2.

---

## Counterparties

### `GET /v1/counterparties`

`q`, `kind` (the pipeline's `counterparty_kind`: `person`, `merchant`, `agent`, `telco`, `bank`,
`own_wallet`, `unknown`), `limit`, `cursor`.
```json
{"items": [{"id": "cpt_7Hq2", "name": "Sunshine Laundry", "original_name": "SUNSHINE LAUNDRY", "alias": null, "kind": "merchant", "default_category": null, "money_out": "320.00", "transactions": 8, "last_seen_at": "2026-09-30T18:02:00Z"}]}
```

### `PATCH /v1/counterparties/{id}`

```json
{"alias": "Mum", "default_category": "giving"}
```
`alias` is shown everywhere in the app instead of the SMS name (`null` removes it).
`default_category` applies to all of this counterparty's transactions without their own
override, past and future. Both are the user's own data and never leave their account.

---

## Recurring

Series found by the pipeline's recurring detection, plus the user's decision about each.

### `GET /v1/recurring`

`status` filter: `active`, `stopped`, `all` (default `active`).
```json
{
  "monthly_cost": "235.00",
  "items": [{
    "id": "rec_59e375",
    "label": "Daily GHS 3 bundle",
    "counterparty": {"id": "cpt_mtnb", "name": "Mtn Bundle", "kind": "telco"},
    "category": {"id": "airtime_data", "name": "Airtime/Data", "group": "spending"},
    "rhythm": "daily",
    "interval_days": 1,
    "typical_amount": "3.00",
    "payments": 372,
    "first_paid_at": "2025-11-20T07:01:00Z",
    "last_paid_at": "2026-10-03T07:00:00Z",
    "status": "active",
    "monthly_cost": "90.00",
    "user_state": null
  }]
}
```
- `status` uses the pipeline's rule: active if the last payment is within two rhythm-lengths of
  your latest data.
- `user_state`: `null` (not reviewed), `expected` (fine, keep it), `cancel_planned` (you mean to
  stop it: the app reminds you if it keeps charging), `not_recurring` (a false match: hidden and
  left out of `monthly_cost`).

### `GET /v1/recurring/{id}/transactions`

The series' payments, same shape and pagination as `/v1/transactions`.

### `PATCH /v1/recurring/{id}`

```json
{"user_state": "cancel_planned", "label": "Old data bundle"}
```

---

## Budgets

Monthly spending limits per category.

### `GET /v1/budgets`

`month` (default the current month).
```json
{
  "month": "2026-10",
  "items": [{
    "id": "bud_F1",
    "category": {"id": "food", "name": "Food", "group": "spending"},
    "limit": "300.00",
    "spent": "212.50",
    "remaining": "87.50",
    "used": "0.708",
    "projected": "620.00",
    "state": "on_track",
    "alert_thresholds": ["0.8", "1.0"]
  }]
}
```
`state`: `on_track`, `warning` (past the first threshold), `over`. `projected` extends the daily
pace to the end of the month.

### `PUT /v1/budgets/{category_id}`

```json
{"limit": "300.00", "alert_thresholds": ["0.8", "1.0"]}
```
Creates or replaces the budget (one per category). `200 OK` with the budget.

### `DELETE /v1/budgets/{category_id}`

`204`.

Each threshold sends at most one notification per month, so a run of small payments past 80%
doesn't send one push each.

---

## Notifications

Push notifications also land in this in-app inbox.

### `GET /v1/notifications`

`unread_only`, `limit`, `cursor`.
```json
{"unread": 2, "items": [{"id": "ntf_K2", "kind": "budget_warning", "title": "Food budget at 80%", "body": "GHS 240 of GHS 300 spent, 12 days left.", "created_at": "2026-10-18T19:02:00Z", "read_at": null, "link": "sikatrack://budgets/food"}]}
```
`kind`: `budget_warning`, `budget_over`, `low_balance`, `new_recurring`, `recurring_still_charging`,
`weekly_digest`, `data_ready`, `sync_problem`. `link` is a deep link into the app.

### `POST /v1/notifications/{id}/read` · `POST /v1/notifications/read-all`

`204`.

---

## Insights

### `GET /v1/insights`

`month`. Short, ready-to-show cards, written from the same logic as the dashboard's insight
measures.
```json
{"items": [
  {"id": "fees_cashout", "severity": "tip", "title": "Cash-outs cost you the most", "body": "67% of your fees come from cash-outs. Paying merchants directly avoids them.", "link": "sikatrack://fees"},
  {"id": "top_category", "severity": "info", "title": "Cash Withdrawal leads", "body": "43% of your spending this month.", "link": "sikatrack://categories/cash_withdrawal"}
]}
```
`severity`: `info`, `tip`, `warning`. The app shows them in order.

---

## Internal and health

### `GET /health`

`200 {"status": "ok"}` if the process is up. For the container health check.

### `GET /ready`

`200` if Postgres and RustFS answer, otherwise `503` with which one failed. For the watchdog
and the load balancer.

### `POST /internal/pipeline-events`

Called by the Airflow pipeline when a per-user run finishes. Authenticated with a shared
service token (`Authorization: Bearer <INTERNAL_API_TOKEN>`), not reachable from outside the
Docker network.
```json
{"run_id": "20261008T100700Z-91ab", "user_id": "usr_3kP9", "status": "succeeded", "batch_ids": ["bat_X7"], "finished_at": "2026-10-08T10:08:12Z"}
```
`204`. The backend then marks batches `loaded`, removes provisional transactions now in the
warehouse, evaluates budget and low-balance rules, and sends `data_ready` if the user wants it.
On `failed`, batches go back to `received` and are picked up by the next run.

---

## Endpoint index

| Method | Path | Auth | Phase |
|---|---|---|---|
| POST | `/v1/auth/otp/request` | none | 2 |
| POST | `/v1/auth/otp/verify` | none | 2 |
| POST | `/v1/auth/refresh` | none | 2 |
| POST | `/v1/auth/logout` | none | 2 |
| GET, PATCH, DELETE | `/v1/me` | user | 2, 7 |
| GET | `/v1/me/export` | user | 7 |
| PUT, DELETE | `/v1/devices/{device_id}` | user | 2 |
| GET | `/v1/config` | none | 3 |
| GET, POST | `/v1/wallets` | user | 3 |
| PATCH, DELETE | `/v1/wallets/{id}` | user | 3 |
| POST | `/v1/sms/batches` | user | 3 |
| GET | `/v1/sms/batches/{id}` | user | 3 |
| GET | `/v1/sync/status` | user | 3 |
| GET | `/v1/transactions` | user | 4 |
| GET, PATCH | `/v1/transactions/{id}` | user | 4, 5 |
| GET | `/v1/summary` | user | 4 |
| GET | `/v1/summary/categories` | user | 4 |
| GET | `/v1/summary/trend` | user | 4 |
| GET | `/v1/summary/counterparties` | user | 4 |
| GET | `/v1/summary/habits` | user | 4 |
| GET | `/v1/balances` | user | 4 |
| GET | `/v1/balances/history` | user | 4 |
| GET | `/v1/categories` | user | 4 |
| GET | `/v1/counterparties` | user | 4 |
| PATCH | `/v1/counterparties/{id}` | user | 5 |
| GET | `/v1/recurring` | user | 4 |
| GET | `/v1/recurring/{id}/transactions` | user | 4 |
| PATCH | `/v1/recurring/{id}` | user | 5 |
| GET | `/v1/budgets` | user | 5 |
| PUT, DELETE | `/v1/budgets/{category_id}` | user | 5 |
| GET | `/v1/notifications` | user | 6 |
| POST | `/v1/notifications/{id}/read`, `/v1/notifications/read-all` | user | 6 |
| GET | `/v1/insights` | user | 4 |
| GET | `/health`, `/ready` | none | 1 |
| POST | `/internal/pipeline-events` | service | 3 |
