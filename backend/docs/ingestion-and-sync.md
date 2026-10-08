# Ingestion and sync

How a MoMo SMS on a phone becomes a transaction in the app, and how the phone and the server
stay in step. Endpoint details are in [api-contract.md](api-contract.md).

## The journey of one SMS

```text
Phone                    Backend                         Raw zone / pipeline            Warehouse
  │ SMS arrives            │                                │                             │
  │ sender in allowlist?   │                                │                             │
  │── POST /v1/sms/batches ►│ 1. drop non-MoMo senders       │                             │
  │                        │ 2. message_id, skip seen ones   │                             │
  │                        │ 3. write JSONL ────────────────►│ raw/users/<id>/sms/...      │
  │                        │ 4. parse + categorise (shared   │                             │
  │                        │    code) → provisional row      │                             │
  │◄── 202 counts ─────────│ 5. schedule run (debounced) ───►│ Airflow: per-user run       │
  │ shows it, "provisional"│                                │ extract → parse → transform │
  │                        │                                │ → gates → load ────────────►│ fact_transaction
  │                        │◄── POST /internal/pipeline-events                            │
  │                        │ 6. batch loaded, drop provisional,                           │
  │                        │    budgets / low balance, push                               │
  │◄── push "data_ready" ──│                                │                             │
  │ list now shows "final" │ reads dw views ◄───────────────────────────────────────────────│
```

Seconds after the SMS arrives, the user sees it (provisional). Minutes later, it's confirmed:
deduplicated, checked against the balance chain, recurring-tested and stored for good (final).

## Phone side (what the React Native app does)

### First sync (after sign-in and permission)

1. `GET /v1/config` → `momo_senders`.
2. Ask for `READ_SMS` with a screen that says exactly what's read and why, and that only these
   senders are uploaded.
3. Query the SMS inbox for `address IN momo_senders`, oldest first.
4. Upload in batches of up to 500 with `source: "initial_scan"`, each with a new
   `Idempotency-Key`. Retry a failed batch with the **same** key.
5. Show progress from the counts in each response.

### After that

- **On new SMS** (a broadcast receiver for `SMS_RECEIVED`, filtered by sender): upload it
  straight away with `source: "live"`.
- **On app open and pull-to-refresh**: `GET /v1/sync/status`, then upload everything with
  `date > latest_date_ms - 10 minutes` as `incremental`. The overlap covers clock edges and
  SMS that arrived while the app was closed; duplicates cost nothing.
- **Offline**: queue batches locally with their keys and send them when back online.

The app keeps no transaction data of its own beyond a cache: the server is the source of truth,
so a reinstall or a new phone just syncs again.

## Server side

### Upload (`POST /v1/sms/batches`)

Runs in one database transaction, in this order:

1. **Idempotency.** Look up `(user_id, Idempotency-Key)` in `app.sms_batch`. Found with the same
   body hash: return the stored response. Found with a different body: `409
   idempotency_mismatch`.
2. **Sender filter.** Drop messages whose sender isn't allowlisted (count them in
   `rejected_senders`).
3. **Message IDs.** `make_message_id(sender, date_ms, body)` from
   `data-engineering/src/extraction/filter_sms.py`. Skip any already in `app.sms_seen` for this
   user (`duplicates`).
4. **Raw zone.** Write the accepted messages as one JSONL object
   `raw/users/<user_id>/sms/<YYYY-MM-DD>/<batch_id>.jsonl`, one line per SMS:
   `{"message_id", "sender", "date_ms", "body", "received_via": "app"}`. If the write fails,
   the whole request fails with `503` and nothing is recorded, so the app's retry is safe.
5. **Provisional parse.** For each message, `parse_message()` from the pipeline's parser, then the
   single-row parts of the transform (counterparty normalisation, categorisation with the
   user's overrides). Store in `app.provisional_transaction`. Steps that need history
   (deduplication across SMS, balance-gap checks, recurring detection) are left to the pipeline.
6. **Record.** Insert `app.sms_seen` rows and the `app.sms_batch` row with its response.
7. **Schedule** the pipeline (below), then return `202`.

### Triggering the pipeline

Uploads come in bursts (an initial scan is many batches), so runs are **debounced per user**:

- Each upload sets `app.user` "dirty since" (a `pipeline_due_at = now() + 2 minutes` column).
- A small scheduler in the backend (every 30 seconds) triggers Airflow's
  `POST /api/v2/dags/sikatrack_pipeline/dagRuns` with `conf: {"user_id": ...}` for users whose
  `pipeline_due_at` has passed, and clears it.
- The DAG keeps `max_active_runs` per user at 1; a user who uploads during a run is picked up by
  the next one.
- The daily schedule still runs for everyone, as a safety net.

### When the pipeline finishes (`POST /internal/pipeline-events`)

1. Batches in the run → `loaded`.
2. Every provisional row from those batches is deleted. The run processed every SMS in them,
   so each one is now either a final transaction or something the pipeline deliberately merged
   (a duplicate SMS for the same transaction) or dropped (not a transaction). Matching row by
   row would miss the merged ones, whose `message_id` isn't the one the warehouse kept.
3. Budget and low-balance rules run for the user; notifications are created (deduplicated by
   `dedupe_key`) and pushed.
4. `data_ready` push, if the user turned it on.

On `failed`: batches go back to `received`; the operator already gets the pipeline's failure
email; the user's provisional transactions keep showing, and `GET /v1/sync/status` shows
`last_pipeline_run.status = "failed"` so the app can say "still processing".

## How reads combine final and provisional

`GET /v1/transactions` and the summaries read:

```text
final rows       dw.api_transaction (user-scoped view)
UNION ALL
provisional rows app.provisional_transaction
                 WHERE parse_status = 'parsed'
                   AND transaction_nk NOT IN (final rows' transaction_nk)
```

then apply the user's overrides and aliases. Responses that include provisional rows say so
(`status: "provisional"` per item, `includes_provisional: true` on summaries), so the app can
show a small "processing" marker.

## Idempotency at every hop

| Hop | Key | A repeat... |
|---|---|---|
| App → backend | `Idempotency-Key` per batch | returns the first response, changes nothing |
| Inside an upload | `message_id` per SMS (`app.sms_seen`) | is counted as a duplicate |
| Raw zone | one object per batch, named by `batch_id` | can't happen: a batch is written once |
| Pipeline → warehouse | `(user_key, transaction_nk)` upsert | leaves the row unchanged (as today) |
| Notifications | `dedupe_key` | is not sent again |

## Importing old XML backups

Your existing SMS Backup & Restore files stay valid. The pipeline puts them under your user,
and because `make_message_id` uses the same three fields, an SMS that's both in an old backup
and uploaded by the app is stored once. A user who has a backup file can import it the same
way later (a phase 7 option: an upload endpoint for a backup file).

## Failure cases

| Problem | What the user sees | What happens |
|---|---|---|
| Phone offline | Nothing changes | Batches queue on the phone and go when online |
| Upload interrupted | Nothing | The app retries with the same key; the server either finished (returns the stored response) or rolled back |
| RustFS down | "Can't sync right now" | `503 dependency_unavailable`; the app retries with backoff |
| New SMS format | The SMS isn't in the list | Counted as `unparsed`; the pipeline's parse gate and `unparsed_sms.csv` work as today, per user |
| Pipeline gate fails | Provisional items stay "processing" | The operator gets the failure email; nothing reaches the warehouse until it's fixed |
| Pipeline down for a day | Provisional items for longer | The daily run and the backend scheduler catch up when it's back |
