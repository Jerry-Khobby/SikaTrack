# SikaTrack: Data Engineering Layer

Turns an Android SMS backup into clean, deduplicated mobile-money transactions, ready for a
Postgres star schema and a Power BI dashboard.

```
SMS backup (.xml) → raw zone → extract → parse → transform → processed zone → warehouse → Power BI
```

On the current dataset (8,059 SMS, Nov 2025 – Oct 2026), a full run takes about 2 seconds:

| Metric | Value |
|---|---|
| MoMo SMS kept | 2,583 |
| Parse success rate | 100% (1,964 parsed, 619 non-transactions ignored, 0 unparsed) |
| Transactions after dedup | 1,890 (73 duplicate SMS and 1 cross-provider receipt removed) |
| Balance continuity | MTN MoMo 99.6%, GhanaPay 100% |

## Status

| Stage | Status |
|---|---|
| Stage to raw zone | Done (local folder now, MinIO later) |
| Extract, parse, transform | Done |
| Quality gates, lineage, run reports | Done |
| Warehouse load | Code done and tested against real Postgres; runs for real once Docker is installed |
| Airflow orchestration | Planned (needs Docker) |
| Categorisation, recurring-charge detection | Planned |

## Quick start

Requires Python 3.11.

```bash
cd data-engineering
python -m venv .venv && .venv\Scripts\activate      # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                 # then set OWNER_NAMES / OWNER_NUMBERS
```

Put an SMS Backup & Restore export in `data/` and run the pipeline:

```bash
python -m src.orchestration.pipeline                  # uses data/sms-20261003215510.xml
python -m src.orchestration.pipeline path/to/new.xml  # or stage a newer backup
```

Outputs land in `data/processed/` (working copy) and `data/lake/` (raw and processed zones).
Logs go to the console and `logs/pipeline.log`.

## Commands

| Command | What it does |
|---|---|
| `python -m src.orchestration.pipeline [xml] [--load]` | Full run: stage, extract, parse, transform, publish (and load with `--load`) |
| `python -m src.extraction.filter_sms --discover` | List senders whose SMS look like mobile money, to grow the sender allowlist |
| `python -m src.extraction.momo_parser` | Re-parse `data/momo_sms.csv` only |
| `python -m src.transform.run` | Re-run the transform only |
| `python -m src.load.warehouse --init` | Create the `dw` schema in an existing Postgres and load the latest Parquet |
| `python -m pytest` | Run the test suite |

## Configuration

Everything is set in `.env`; `.env.example` documents every variable. The ones you'll touch:

| Variable | Default | Purpose |
|---|---|---|
| `OWNER_NAMES`, `OWNER_NUMBERS` | empty | Your own names and wallet numbers, so transfers between your wallets aren't counted as income or spending |
| `LAKE_BACKEND` | `local` | `local` stores buckets as folders under `data/lake`; `s3` uses MinIO |
| `LOG_LEVEL` | `INFO` | `DEBUG` also logs every ignored and duplicate SMS |
| `GATE_MIN_PARSE_RATE` | `0.95` | Fail the run below this parse rate |
| `GATE_MIN_BALANCE_CONTINUITY` | `0.98` | Fail the run below this continuity, per provider |
| `GATE_MAX_UNEXPLAINED_GAPS` | `20` | Fail the run above this many unexplained balance gaps |
| `WAREHOUSE_URL` or `WAREHOUSE_*` | see example | Postgres connection for the load step |

## Project layout

```
data-engineering/
├── src/
│   ├── extraction/     filter_sms.py (XML → MoMo CSV), momo_parser.py (CSV → parsed JSON)
│   ├── transform/      clean, dedupe, counterparty, enrich, quality, schema, storage, run
│   ├── lake/           store.py (local / S3 object store), raw_zone.py (staging backups)
│   ├── load/           warehouse.py (idempotent Postgres load)
│   ├── orchestration/  pipeline.py (runs every step), gates.py (quality gates), run_id.py
│   └── utils/          constants.py (SMS templates), logging_config.py, fileio.py
├── sql/                warehouse_schema.sql (star schema)
├── test/               pytest suite; samples.py holds SMS in real formats with fake data
├── docs/               architecture, data model, runbook
├── data/               backups and outputs (gitignored: real financial data)
└── logs/               pipeline.log (gitignored)
```

## Testing

```bash
python -m pytest
```

134 tests cover every step. They need no external services:

- **S3 / MinIO** is simulated in memory by `moto`.
- **Postgres** is a real server started by `pgserver`, a pip package that ships Postgres binaries.
- **SMS fixtures** in `test/samples.py` copy the real provider formats with made-up names and numbers.

The warehouse tests take most of the ~50 s, because Postgres starts once per session.

## Further reading

- [Architecture](docs/architecture.md): how data flows, idempotency, quality gates, lineage, privacy, design decisions
- [Data model](docs/data-model.md): the processed dataset and the warehouse star schema
- [Runbook](docs/runbook.md): adding backups and SMS formats, handling gate failures, reading logs
