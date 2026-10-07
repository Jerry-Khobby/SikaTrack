# Runbook

All commands run from `data-engineering/`, with the stack up (`docker compose up -d`).

## Run with Airflow

Open http://localhost:8080 (login in `.env`: `AIRFLOW_ADMIN_USER` / `AIRFLOW_ADMIN_PASSWORD`).

1. Drop SMS Backup & Restore exports into `data/inbox/`.
2. In the Airflow UI, open **sikatrack_pipeline**, switch it on (it's paused when created),
   and click **Trigger**. Set `force` to true to reprocess even if nothing changed.
3. Once switched on, it also runs daily. A run with no new backup or settings change stops
   after `has_changes` and skips the rest (shown as skipped, not failed).

Every run rebuilds the outputs from **all** backups in the raw zone, so re-running is always
safe.

| Task fails | Meaning |
|---|---|
| `has_changes` | The raw zone is empty: add a backup to `data/inbox/` |
| `parse` / `transform` | A quality gate failed; see [below](#a-quality-gate-fails). Not retried |
| `stage`, `publish`, `load` | Storage or database unreachable; retried twice before failing |

A failed run keeps its files in `data/work/<run_id>/` for debugging.
Trigger with `force=true` after changing parser templates, category rules or other transform
code: the change check only sees backups and settings, not code.

For a one-off run without the scheduler:

```bash
docker compose exec airflow-scheduler python -m src.orchestration.pipeline
```

## Monitoring and alerts

Alerts go by email, from the Gmail account in `.env` (`EMAIL_USER`, `EMAIL_PASS` = a Gmail **app
password**) to `ALERT_EMAIL_TO` (default: the same address). Three parts:

| Part | Runs | Emails |
|---|---|---|
| Failure callback on every task | Inside Airflow, whenever a task fails for good (after retries) | `FAILED: <dag>.<task>` with the run, attempt, error and a link to the log |
| `sikatrack_monitoring` DAG | Inside Airflow, daily at 06:00 UTC (after the midnight pipeline run) | `ACTION NEEDED: ...` when something is broken, otherwise `Daily digest: all good` with the day's numbers |
| Watchdog (`scripts/watchdog.cmd`) | On Windows, via Task Scheduler, outside Docker | `ACTION NEEDED: stack down` when Airflow, Postgres or RustFS don't answer, or the pipeline heartbeat is stale |

The watchdog exists because Airflow can't report its own absence: if Docker is down, nothing
inside it runs.

### What the daily check looks at

| Check | Level | Default limit (`.env`) |
|---|---|---|
| Pipeline hasn't run (no heartbeat) | critical | `MONITOR_MAX_HOURS_SINCE_PIPELINE=36` |
| Last warehouse load failed | critical | |
| A staged backup hasn't been loaded | critical | `MONITOR_MAX_DAYS_BACKUP_NOT_LOADED=2` |
| Postgres or RustFS unreachable | critical | |
| No new SMS backup recently | warning | `MONITOR_MAX_DAYS_SINCE_BACKUP=14` |
| Parse rate drifting down | warning | `MONITOR_WARN_MIN_PARSE_RATE=0.98` (gate fails at 0.95) |
| Category coverage drifting down / dropped since last load | warning | `MONITOR_WARN_MIN_CATEGORY_COVERAGE=0.95` (gate 0.90), `MONITOR_WARN_MAX_COVERAGE_DROP=0.02` |
| Balance continuity drifting down | warning | `MONITOR_WARN_MIN_BALANCE_CONTINUITY=0.99` (gate 0.98) |
| Unexplained balance gaps piling up | warning | `MONITOR_WARN_MAX_UNEXPLAINED_GAPS=10` (gate 20) |
| Fewer transactions than the previous load | warning | |

Warnings are deliberately tighter than the quality gates: you hear about drift while the
pipeline still passes, instead of on the day it fails.

### Set up (once)

1. In `.env`: `EMAIL_USER`, `EMAIL_PASS` (and optionally `ALERT_EMAIL_TO`), then
   `docker compose up -d` so the containers read them.
2. In Airflow, switch on **sikatrack_monitoring** (new DAGs start paused).
3. Watchdog: register it with Windows Task Scheduler (run once in PowerShell, as you):

   ```powershell
   schtasks /Create /TN "SikaTrack Watchdog" /SC DAILY /ST 08:00 /F `
     /TR "E:\jerry\Downloads\SikaTrack\data-engineering\scripts\watchdog.cmd"
   ```

   It uses your Windows Python, so `pip install -r requirements.txt` there once.

### Test it

- **Digest:** in Airflow, trigger **sikatrack_monitoring**; the email arrives within a minute.
- **Failure alert:** trigger **sikatrack_pipeline** with RustFS stopped
  (`docker compose stop rustfs`); `stage` fails after its retries and the FAILED email arrives.
  Then `docker compose start rustfs`.
- **Watchdog:** `scripts\watchdog.cmd` from a terminal; it emails only if something is down.

### Silence or tune

| Want | Set in `.env` |
|---|---|
| No emails at all (they're logged instead) | `ALERTS_ENABLED=false` |
| Only problem emails, no daily "all good" | `DIGEST_ENABLED=false` |
| Pause the watchdog (e.g. while E: is unplugged) | `WATCHDOG_ENABLED=false` |
| Other recipients | `ALERT_EMAIL_TO=a@x.com,b@y.com` |

After changing `.env`, run `docker compose up -d` so Airflow picks it up (the watchdog reads it
directly).

## Add a new backup

1. Export your SMS with SMS Backup & Restore.
2. Put the file in `data/inbox/` and trigger the DAG (or wait for the daily run).

The backup is staged under today's date and merged with the earlier ones. SMS already seen in
older backups are kept once; SMS your phone has since deleted stay in the history. Files stay
in the inbox; staging the same file again does nothing.

## A new SMS format appears

Symptoms: the parse gate fails (`parse rate ... < 95%`). Each unparsed SMS is logged as a
warning with its `message_id`, and the failed run's `data/work/<run_id>/unparsed_sms.csv`
holds the text.

1. Open that `unparsed_sms.csv` and look at the new format.
   `missing_fields` is empty for an unknown format and names the field otherwise.
2. Add a row to `TEMPLATES` in `src/utils/constants.py`. Put specific templates before
   general ones: the first match wins.
3. Add the SMS to `test/samples.py` **with made-up names and numbers**, and a case to
   `PARSED_CASES` in `test/test_momo_parser.py`.
4. Run `python -m pytest`, then trigger the DAG with `force=true`. The fix applies to every
   past backup too.

A new sender (e.g. another provider) also needs adding to `MOMO_SENDERS` and
`SENDER_TO_PROVIDER`. To find sender IDs: `python -m src.extraction.filter_sms --discover path/to/backup.xml`.

## Improve categorisation

Uncategorized transactions are logged (by message ID) in each run, and every run report has
the coverage and a breakdown by rule. To add a rule:

1. Add a keyword to `PURPOSE_KEYWORDS` (what people type as a reference) or
   `COUNTERPARTY_KEYWORDS` (business names) in `src/transform/categorise.py`.
2. A **new category** also needs a migration: add `sql/migrations/003_….sql` inserting it into
   `dw.dim_category`. The test suite fails until it exists, and so would the load.
3. Add a case to `test/test_categorise.py`, run `python -m pytest`, then trigger with
   `force=true`.

To see why any transaction got its category, look at `category_rule` in the warehouse.

## A quality gate fails

The run stops before publishing, so the processed zone and warehouse keep the last good data.
The error lists every broken limit.

| Failure | Usual cause | What to do |
|---|---|---|
| Parse rate below limit | New SMS format | See [above](#a-new-sms-format-appears) |
| No transactions parsed | Wrong file, or sender allowlist doesn't match | Check the backup; run `--discover` |
| Balance continuity below limit | Many missing SMS, or a parser bug in amounts | Check the balance-gap warnings in the log |
| Too many unexplained gaps | Same as above | Same as above |
| Category coverage below limit | New kinds of spending with no matching rule | See [Improve categorisation](#improve-categorisation) |

If the data really is fine, adjust the limit in `.env` (`GATE_*`), then
`docker compose up -d` so Airflow picks up the change.

## Balance gaps

The transform checks that each reported balance equals the previous balance plus every
transaction since. A gap means something moved money without an SMS in the backup.

| Reason | Meaning |
|---|---|
| `own_transfer_leg_missing` | Another of your wallets sent or received exactly the gap amount; this wallet just never got the SMS. Needs `OWNER_NAMES` / `OWNER_NUMBERS` set |
| `unexplained` | No matching transaction anywhere; the SMS is missing from the backup |

Each gap is logged as a warning with its date, amount and reason, and flagged per row in
`has_balance_gap`. A few gaps are normal: some debits (e.g. bundles bought by USSD, bank pulls)
never send a mobile-money SMS.

## Read the logs

Each task's log is in the Airflow UI (click the task, then **Logs**), and on disk under
`logs/airflow/`. A manual run logs to the console and to `logs/pipeline.log`. Each line names
the module that wrote it:

```
2026-10-05 15:08:26,301 | WARNING | src.transform.run | Balance gap +40.00 on mtn_momo at 2026-05-02 19:27 (payment_sent, own_transfer_leg_missing)
```

| Level | What you'll see |
|---|---|
| INFO | Row counts per step, parse rate, category coverage, files written, continuity per provider |
| WARNING | Unparsed SMS, unreadable dates, balance gaps, missing owner settings |
| DEBUG | Every ignored and duplicate SMS (`LOG_LEVEL=DEBUG` in `.env`) |

Logs never contain SMS text or references.

## Check the warehouse

Each load is recorded in `dw.etl_run`; loading again changes nothing unless the data changed:

```bash
docker compose exec warehouse sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT run_id, status, rows_inserted, rows_updated, rows_unchanged, error FROM dw.etl_run ORDER BY started_at DESC LIMIT 5"'
```

Applied schema migrations are in `dw.schema_migration`.

## Rebuild everything from scratch

The raw bucket is the source of truth; everything else can be rebuilt from it. Trigger the DAG
with `force=true` and the processed zone and warehouse are recomputed from every backup.

Never delete the `sikatrack-raw` bucket or the `rustfs_data` Docker volume: they hold every
backup, including SMS your phone no longer has. `docker compose down -v` deletes volumes;
use `docker compose down` (or `stop`) instead.
