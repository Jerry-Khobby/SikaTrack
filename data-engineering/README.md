# SikaTrack: Data Engineering Layer

Turns an Android SMS backup into clean, deduplicated, categorised mobile-money transactions in
a Postgres star schema, ready for a Power BI dashboard. Runs on Docker, orchestrated by Airflow.

```
SMS backup (.xml) → raw zone → extract → parse → transform → processed zone → Postgres → Power BI
                    (RustFS)                                   (RustFS)
```

On the current dataset (8,059 SMS, Nov 2025 – Oct 2026):

| Metric | Value |
|---|---|
| MoMo SMS kept | 2,583 |
| Parse success rate | 100% (1,964 parsed, 619 non-transactions ignored, 0 unparsed) |
| Transactions after dedup | 1,890 (73 duplicate SMS and 1 cross-provider receipt removed) |
| Balance continuity | MTN MoMo 99.6%, GhanaPay 100% |
| Category coverage | 99.9% of spending |

## Status

| Stage | Status |
|---|---|
| Stage, extract, parse, transform | Done |
| Categorisation | Done: rule-based, every category explained by the rule that chose it |
| Quality gates, lineage, run reports | Done |
| Postgres load with schema migrations | Done |
| Airflow orchestration | Done: `dags/sikatrack_pipeline.py` |
| Recurring-charge detection | Planned |
| Power BI dashboard | Planned |

## Quick start

Requires Docker Desktop.

```bash
cd data-engineering
cp .env.example .env          # set the passwords, secrets and OWNER_NAMES / OWNER_NUMBERS
docker compose up -d --build  # RustFS, Postgres, Airflow
```

1. Drop an SMS Backup & Restore export into `data/inbox/`.
2. Open Airflow at http://localhost:8080, switch on **sikatrack_pipeline** and click **Trigger**.

The DAG stages the backup, processes every backup staged so far and loads Postgres. See the
[Runbook](docs/runbook.md#run-with-airflow) for details.

| Service | Address | Login (in `.env`) |
|---|---|---|
| Airflow | http://localhost:8080 | `AIRFLOW_ADMIN_USER` / `AIRFLOW_ADMIN_PASSWORD` |
| RustFS console (the lake) | http://localhost:9001/rustfs/console/ | `S3_ACCESS_KEY` / `S3_SECRET_KEY` |
| Postgres (Power BI) | `localhost:5434`, database `sikatrack_dw`, view `dw.v_fact_transaction` | `WAREHOUSE_USER` / `WAREHOUSE_PASSWORD` |

## Commands

Run from `data-engineering/`:

| Command | What it does |
|---|---|
| `docker compose up -d` / `docker compose stop` | Start / stop the stack (data is kept) |
| `docker compose ps` | Status of every service |
| `docker compose exec airflow-scheduler python -m src.orchestration.pipeline` | Manual full run without Airflow's scheduler |
| `python -m src.extraction.filter_sms --discover path/to/backup.xml` | List senders whose SMS look like mobile money, to grow the sender allowlist |
| `python -m pytest` | Run the test suite |

## Configuration

Everything is set in `.env`; `.env.example` documents every variable. The ones you'll touch:

| Variable | Default | Purpose |
|---|---|---|
| `OWNER_NAMES`, `OWNER_NUMBERS` | empty | Your own names and wallet numbers, so transfers between your wallets aren't counted as income or spending |
| `LOG_LEVEL` | `INFO` | `DEBUG` also logs every ignored and duplicate SMS |
| `GATE_MIN_PARSE_RATE` | `0.95` | Fail the run below this parse rate |
| `GATE_MIN_BALANCE_CONTINUITY` | `0.98` | Fail the run below this continuity, per provider |
| `GATE_MAX_UNEXPLAINED_GAPS` | `20` | Fail the run above this many unexplained balance gaps |
| `GATE_MIN_CATEGORY_COVERAGE` | `0.90` | Fail the run if less of your spending than this gets a category |

## Project layout

```
data-engineering/
├── dags/               sikatrack_pipeline.py (Airflow DAG: one task per step)
├── src/
│   ├── extraction/     filter_sms.py (XML → MoMo CSV), momo_parser.py (CSV → parsed JSON)
│   ├── transform/      clean, dedupe, counterparty, enrich, categorise, quality, schema, storage, run
│   ├── lake/           store.py (S3 object store), raw_zone.py (staging backups), init_buckets.py
│   ├── load/           warehouse.py (schema migrations + idempotent Postgres load)
│   ├── orchestration/  pipeline.py (the steps), gates.py, state.py (change detection), run_id.py
│   └── utils/          constants.py (SMS templates), logging_config.py, fileio.py
├── sql/migrations/     numbered schema changes, applied by the load step
├── test/               pytest suite; samples.py holds SMS in real formats with fake data
├── docs/               architecture, data model, runbook
├── data/               inbox/ for new backups, work/ for in-flight runs (gitignored)
└── logs/               pipeline and Airflow logs (gitignored)
```

## Testing

Run on Windows from `data-engineering/` (`pip install -r requirements-dev.txt` once):

```bash
python -m pytest
```

164 tests cover every step:

- **S3 storage** is simulated in memory by `moto`, so lake tests never touch RustFS.
- **Postgres** tests use the Docker container, each in a throwaway database that's dropped
  afterwards; your `sikatrack_dw` data is never touched. They're skipped if the stack is down.
- **SMS fixtures** in `test/samples.py` copy the real provider formats with made-up names and numbers.

## Further reading

- [Architecture](docs/architecture.md): how data flows, idempotency, quality gates, lineage, privacy, design decisions
- [Data model](docs/data-model.md): the processed dataset, the star schema, categories, migrations
- [Runbook](docs/runbook.md): running with Airflow, adding backups, SMS formats and category rules, handling failures
