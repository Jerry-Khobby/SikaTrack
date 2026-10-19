# SikaTrack

A personal-finance tracker for mobile-money users in Ghana. ("Sika" is Twi for money.)

Most day-to-day money in Ghana moves through mobile money, which budgeting apps like Mint or
YNAB can't see. SikaTrack works from the MoMo SMS already on your phone instead. It reads
them, turns each one into a transaction, sorts your spending into categories, finds payments
that keep charging every month, and tracks your budgets. You never type a transaction in by
hand.

It supports **MTN MoMo** and **GhanaPay** today.

## How it fits together

```text
Android app ──SMS──► Backend API ──► Data pipeline ──► Postgres warehouse
     ▲                    │                                   │
     └──── transactions, summaries, budgets, alerts ◄─────────┘
```

1. The **mobile app** reads MoMo SMS on the phone and uploads them.
2. The **backend** stores them and hands them to the pipeline.
3. The **data pipeline** parses, cleans, deduplicates and categorises them, then loads them
   into a Postgres star schema.
4. The backend reads the results back to the app. The same warehouse also feeds a Metabase
   dashboard.

## Folder structure

```text
SikaTrack/
├── mobile/              The Android app (Expo, React Native, TypeScript)
├── backend/             The API the app talks to (FastAPI, PostgreSQL, Docker)
├── data-engineering/    The SMS-to-transactions pipeline (Python, Airflow, RustFS, Postgres)
├── .github/workflows/   CI for the backend and the data pipeline
└── SikaTrack_*.md       Early planning documents
```

### `mobile/`

The Android app. It's built with Atomic Design (atoms, molecules, organisms, templates,
pages). The launch and sign-in screens are done; onboarding and the main tabs come next.
`docs/ui-spec.md` describes every screen and the endpoint behind it. See
[mobile/README.md](mobile/README.md) to run it and its tests.

### `backend/`

The HTTP API between the app and everything behind it. It handles sign-in by SMS code, SMS
uploads, transactions, spending summaries, budgets, recurring payments and notifications. It
runs in Docker behind a Caddy HTTPS proxy. In `backend/docs/` you'll find:

- the API contract
- the data model
- how SMS get from the phone to the server

See [backend/README.md](backend/README.md) for setup.

### `data-engineering/`

The pipeline that turns raw SMS into clean, categorised transactions:

- **Storage:** raw and processed files are kept in a RustFS (S3-compatible) lake.
- **Orchestration:** Airflow runs the pipeline.
- **Checks:** quality gates and data lineage run on every load.
- **Analysis:** recurring payments are detected automatically.
- **Monitoring:** email alerts for failures and drift.

`data-engineering/docs/` covers the architecture, the warehouse model, the Metabase dashboard
and the runbook. See [data-engineering/README.md](data-engineering/README.md) for setup.

### `.github/workflows/`

CI on GitHub Actions. It runs on pushes to `main` and on pull requests, but only for the
folder that changed. The backend gets linting, format checks, type checks and tests. The
pipeline gets its tests, including a check that the Airflow DAGs load.

### `SikaTrack_*.md`

The documents written at the start of the project:

- `SikaTrack_Project_Overview.md`
- `SikaTrack_Build_Roadmap.md`
- `SikaTrack_Data_Collection_Guide.md`
- `SikaTrack_Data_Engineering_Layer.md`
- `SikaTrack_Backend_Layer.md`
- `SikaTrack_SKILL.md`

They explain the problem, the plan and each layer's original design. Some details have
changed since they were written. Where they disagree with a folder's own README or `docs/`,
the folder wins.

## Getting started

Everything except the app runs on Docker. Start the data stack first, because the backend
joins its network:

1. **Data stack:** set up and start `data-engineering/` (Postgres, RustFS, Airflow).
2. **Backend:** set up and start `backend/`.
3. **App:** run `mobile/` with `npx expo start`.

Each folder's README has the exact commands and the `.env` settings it needs.
