# Runbook

## Run the pipeline

```bash
python -m src.orchestration.pipeline                 # default backup in data/
python -m src.orchestration.pipeline path/to/new.xml # stage and process a newer backup
python -m src.orchestration.pipeline --load          # also load the warehouse
```

Every run rebuilds the outputs from **all** backups in the raw zone, so re-running is always
safe.

## Run with Airflow

Start the stack from `data-engineering/` with `docker compose up -d`, then open
http://localhost:8080 (login in `.env`: `AIRFLOW_ADMIN_USER` / `AIRFLOW_ADMIN_PASSWORD`).

1. Drop SMS Backup & Restore exports into `data/inbox/`.
2. In the Airflow UI, open **sikatrack_pipeline**, switch it on (it's paused when created),
   and click **Trigger**. Set `force` to true to reprocess even if nothing changed.
3. Once switched on, it also runs daily. A run with no new backup or settings change stops
   after `has_changes` and skips the rest (shown as skipped, not failed).

| Task fails | Meaning |
|---|---|
| `has_changes` | The raw zone is empty: add a backup to `data/inbox/` |
| `parse` / `transform` | A quality gate failed; see [below](#a-quality-gate-fails). Not retried |
| `stage`, `publish`, `load` | Storage or database unreachable; retried twice before failing |

A failed run keeps its files in `data/work/<run_id>/` for debugging.
Trigger with `force=true` after changing parser templates or transform rules: the change
check only sees backups and settings, not code.

## Add a new backup

1. Export your SMS with SMS Backup & Restore.
2. Run `python -m src.orchestration.pipeline path/to/the-export.xml`.

The backup is staged under today's date and merged with the earlier ones. SMS already seen in
older backups are kept once; SMS your phone has since deleted stay in the history.

## A new SMS format appears

Symptoms: the parse gate fails (`parse rate ... < 95%`), or `unparsed_sms.csv` has rows.
Each unparsed SMS is also logged as a warning with its `message_id`.

1. Open `data/unparsed_sms.csv` and look at the new format.
   `missing_fields` is empty for an unknown format and names the field otherwise.
2. Add a row to `TEMPLATES` in `src/utils/constants.py`. Put specific templates before
   general ones: the first match wins.
3. Add the SMS to `test/samples.py` **with made-up names and numbers**, and a case to
   `PARSED_CASES` in `test/test_momo_parser.py`.
4. Run `python -m pytest`, then re-run the pipeline. The fix applies to every past backup too.

A new sender (e.g. another provider) also needs adding to `MOMO_SENDERS` and
`SENDER_TO_PROVIDER`. Use `python -m src.extraction.filter_sms --discover` to find sender IDs.

## A quality gate fails

The run stops before publishing, so the processed zone and warehouse keep the last good data.
The error lists every broken limit.

| Failure | Usual cause | What to do |
|---|---|---|
| Parse rate below limit | New SMS format | See [above](#a-new-sms-format-appears) |
| No transactions parsed | Wrong file, or sender allowlist doesn't match | Check the backup; run `--discover` |
| Balance continuity below limit | Many missing SMS, or a parser bug in amounts | Check the balance-gap warnings in the log |
| Too many unexplained gaps | Same as above | Same as above |

If the data really is fine, adjust the limit in `.env` (`GATE_*`).

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

Logs go to the console and to `logs/pipeline.log`, which rotates at 5 MB and keeps 3 old
files. Each line in the file names the module that wrote it:

```
2026-10-05 15:08:26,301 | WARNING | src.transform.run | Balance gap +40.00 on mtn_momo at 2026-05-02 19:27 (payment_sent, own_transfer_leg_missing)
```

| Level | What you'll see |
|---|---|
| INFO | Row counts per step, parse rate, files written, continuity per provider |
| WARNING | Unparsed SMS, unreadable dates, balance gaps, missing owner settings |
| DEBUG | Every ignored and duplicate SMS (`LOG_LEVEL=DEBUG` in `.env`) |

Logs never contain SMS text.

## Rebuild everything from scratch

The raw zone is the source of truth; everything else can be deleted and rebuilt:

```bash
rm -rf data/processed data/lake/sikatrack-processed data/momo_sms.csv data/parsed_transactions.json data/unparsed_sms.csv
python -m src.orchestration.pipeline
```

Never delete `data/lake/sikatrack-raw`: it holds every backup, including SMS your phone no
longer has.

## Set up the warehouse without Docker

Any Postgres 14+ works. Set `WAREHOUSE_URL` (or the `WAREHOUSE_*` parts) in `.env`, then:

```bash
python -m src.load.warehouse --init          # create the dw schema and load
python -m src.orchestration.pipeline --load  # or as part of a full run
```

Loading again changes nothing unless the data changed. Each load is recorded in `dw.etl_run`:

```sql
SELECT run_id, status, rows_inserted, rows_updated, rows_unchanged, error
FROM dw.etl_run ORDER BY started_at DESC;
```
