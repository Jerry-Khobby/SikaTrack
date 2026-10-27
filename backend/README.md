# SikaTrack backend

The API between the React Native app and everything behind it. **Built:** every endpoint in
[docs/api-contract.md](docs/api-contract.md), phases 0-6 of the build plan below, and account
erasure from phase 7. Interactive docs at `/docs` when it runs (development only).

| Area | Endpoints |
|---|---|
| Accounts | `POST /v1/auth/otp/request`, `/otp/verify`, `/refresh`, `/logout`; `GET/PATCH/DELETE /v1/me`; `PUT/DELETE /v1/devices/{id}` |
| Getting data in | `GET /v1/config`; `/v1/wallets` (CRUD); `POST /v1/sms/batches`; `GET /v1/sms/batches/{id}`; `GET /v1/sync/status` |
| Reading | `/v1/transactions` (list, detail, correct); `/v1/summary` (+ `/categories`, `/trend`, `/counterparties`, `/habits`); `/v1/balances` (+ `/history`); `/v1/categories`; `/v1/counterparties` (list, one, nickname); `/v1/recurring` (list, one, payments, decision); `/v1/insights` |
| Budgets and alerts | `/v1/budgets` (list, set, delete); `/v1/notifications` (inbox, read, read-all) |
| Operations | `GET /health`, `GET /ready`; `POST /internal/pipeline-events` (the pipeline only) |

## Run it

The backend joins the data stack's Docker network, so start that first.

```bash
cd ../data-engineering && docker compose up -d     # warehouse + RustFS
cd ../backend
cp .env.example .env                                # then fill in the passwords and S3 keys
docker compose up -d --build                        # creates the DB login, migrates, starts the API
```

Then the app talks to **https://localhost** (the HTTPS proxy). For debugging on this machine
only: http://127.0.0.1:8000/docs (interactive API docs) and /ready. The API's own port is
bound to 127.0.0.1, so from outside the proxy is the only way in.

### Going to production

| Setting (`.env`) | Value |
|---|---|
| `ENVIRONMENT` | `production` (turns off /docs; refuses printed sign-in codes) |
| `API_DOMAIN` | Your domain, e.g. `api.sikatrack.app`. Point its DNS here and open ports 80 and 443; Caddy gets and renews the Let's Encrypt certificate |
| `OTP_PROVIDER` | `arkesel` (recommended in Ghana: a few pesewas per SMS, topped up with mobile money), with `ARKESEL_API_KEY` from its dashboard and `ARKESEL_SENDER` (a sender ID registered there, at most 11 characters, e.g. `SikaTrack`). Or `twilio`, with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. Another provider is one more class in `auth/sms.py` |
| `RATE_LIMIT_PER_USER`, `RATE_LIMIT_PER_IP` | Requests per minute per signed-in user (120) and per IP before sign-in (30) |

The proxy blocks `/internal` (only the pipeline, on the Docker network, may call it), caps
request bodies at 2 MB and adds HSTS and the usual security headers.

To work on it without Docker for the API (Postgres and RustFS still in Docker):

```bash
python -m venv .venv && .venv\Scriptsctivate
pip install -e ".[dev]"
alembic upgrade head
uvicorn sikatrack_api.main:create_app --factory --reload
```

Checks (the same ones CI runs):

```bash
ruff check . && ruff format --check .
mypy
pytest                                    # integration tests skip unless TEST_DATABASE_URL is set
```

| Endpoint | Answers | Use |
|---|---|---|
| `GET /health` | `200 {"status": "ok", "version": ...}` while the process runs; never touches a dependency | Docker health check (restart if dead) |
| `GET /ready` | `200` when Postgres and RustFS both answer; `503` naming the one that didn't (never why) | Watchdog, load balancer (send traffic or not) |

Every response carries `X-Request-ID`; every error is an RFC 9457 problem document with a stable
`code` (see [docs/api-contract.md](docs/api-contract.md#errors)). Logs are JSON lines with the
request ID and never contain SMS text, tokens, phone numbers or request bodies.

| Document | What it covers |
|---|---|
| [docs/api-contract.md](docs/api-contract.md) | Every endpoint: request, response, errors, and what it does behind the scenes |
| [docs/data-model.md](docs/data-model.md) | The backend's own tables (`app` schema) and the changes the warehouse needs for many users |
| [docs/ingestion-and-sync.md](docs/ingestion-and-sync.md) | How an SMS on a phone becomes a transaction in the app, step by step |

## Link your existing data to your account

Your SMS backups in the warehouse belong to the "legacy owner" until you link them:

1. Sign in through the API (or the app) once, and copy your user ID from `GET /v1/me`
   (`usr_3f2a...`: the 32 characters after `usr_` are a UUID).
2. Put it in `data-engineering/.env` as `LEGACY_OWNER_USER_ID=3f2a....` (with the dashes:
   `3f2a9c0e-1b7d-...`; Python's `uuid.UUID(hex=...)` prints it), then
   `docker compose up -d` in `data-engineering/` so Airflow reads it.
3. Do this **before** uploading SMS from the app. The next pipeline run links your history to
   your account with no reload; the loader refuses (with a clear error) if your account already
   has rows of its own.

Your Power BI and Metabase dashboards keep showing your data only.

## What the backend is for

The data layer (`data-engineering/`) already turns SMS into clean, categorised transactions in
the Postgres warehouse. It has three limits the backend removes:

| Today | With the backend |
|---|---|
| One owner, configured in `.env` (`OWNER_NAMES`, `OWNER_NUMBERS`) | Many users, each with their own wallets, settings and data |
| New data only when someone copies an XML backup into `data/inbox/` | The app uploads new MoMo SMS as they arrive |
| Results visible only in Power BI on your laptop | The app shows them, with budgets, corrections and push notifications |

The backend does **six jobs**:

1. **Accounts:** phone-number sign-in with a one-time code, tokens, devices, account deletion.
2. **Ingestion:** accept raw MoMo SMS from the app, file them per user in the raw zone, and
   tell the pipeline there's new work.
3. **Instant view:** parse new SMS on arrival with the pipeline's own parser, so a payment shows
   in the app within seconds, marked *provisional* until the pipeline confirms it.
4. **Serving:** read the warehouse and answer the app's questions (transactions, summaries,
   categories, recurring payments, balances), each user seeing only their own rows.
5. **User input:** category corrections, counterparty nicknames, budgets, recurring-payment
   decisions. The pipeline reads these back, so the app and the warehouse agree.
6. **Notifications:** push and in-app messages (budget warnings, low balance, new recurring
   charge, "your data is up to date").

What it does **not** do: clean, deduplicate, categorise for the record, detect recurring
payments, or check balances. That stays in the pipeline, which has the quality gates and the
tests. The backend never writes to the warehouse's `dw` schema.

## Architecture

```text
React Native app (Android)
  │ reads MoMo SMS on the phone (only allowlisted senders)
  │ HTTPS + JWT
  ▼
FastAPI backend ─────────────────────────────────────────────┐
  │ 1. raw SMS ──► RustFS raw zone  users/<user_id>/... (raw bucket)     │
  │ 2. provisional parse (shared parser) ──► app.provisional_*  │
  │ 3. "new data" ──► Airflow REST API (debounced)               │
  │                                                             │
  │        Airflow pipeline (per user): extract → parse →        │
  │        transform → quality gates → load ──► Postgres dw      │
  │                                     │                       │
  │ 4. pipeline-finished event ◄────────┘  (internal endpoint)   │
  │ 5. reads dw.* (read-only role) + app.* ──► API responses ◄───┘
  ▼
Push (Expo / FCM)                     Power BI (operator view, unchanged)
```

One Postgres server, two schemas with clear ownership:

| Schema | Owner | Backend access |
|---|---|---|
| `dw` | The pipeline | **Read only**, through views that are always filtered by `user_id` |
| `app` | The backend | Read and write: users, wallets, devices, overrides, budgets, notifications |

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | **FastAPI** (Python 3.11) | Same language as the pipeline: the backend imports the real parser, categoriser and `message_id` function instead of copying them |
| Contract | OpenAPI generated by FastAPI from Pydantic models | The app generates its TypeScript types and client from `/openapi.json` (`openapi-typescript`), so both sides compile against one contract |
| Database | The existing Postgres, new `app` schema | One server to run and back up; joins between app data and warehouse data stay in SQL |
| Migrations | Alembic for `app`; `dw` keeps the pipeline's own migration runner | Each schema has exactly one owner |
| DB access | SQLAlchemy 2 (async) + asyncpg | Typed queries, connection pooling |
| Auth | Phone number + one-time SMS code, then JWT access + rotating refresh tokens | MoMo users all have a phone number; no passwords to forget or leak |
| OTP delivery | Behind an interface; provider chosen at build time | Compare local SMS providers on price and delivery in Ghana; a console provider for development |
| Raw zone | RustFS (S3 API) via boto3, same buckets as the pipeline | Raw SMS stays the source of truth, exactly as today |
| Pipeline trigger | Airflow REST API (`/api/v2/dags/.../dagRuns`), debounced per user | Airflow already runs; no new queue to operate |
| Push | Expo push service (FCM underneath) | Matches a React Native / Expo app; swap to FCM directly if the app isn't Expo |
| Hosting | Same Docker Compose stack, a new `api` service | Deploys wherever the data stack deploys; see the deployment notes in the data-engineering runbook once written |

**This supersedes parts of `SikaTrack_Backend_Layer.md` and the roadmap's Phase 2.** Those were
written before the data layer existed. Two changes, and why:

- **No backend-owned `transactions` table fed by `POST /transactions/ingest`.** The warehouse is
  already that table, with deduplication, quality gates and an audit trail. A second copy would
  drift. The app uploads **raw SMS** instead (the roadmap's "parse server-side" option), and the
  backend reads the warehouse.
- **Supabase and Render are optional, not assumed.** The backend runs next to the data stack.
  Supabase can still host Postgres if you move the whole stack there later.

## Data protection

The data is financial and personal, so these are requirements, not extras:

- **Least data:** the app sends only SMS from allowlisted MoMo senders (the list comes from
  `GET /v1/config`), never other SMS.
- **Isolation:** every query is scoped to the caller's `user_id`, enforced in one place (a
  dependency that every router uses) and tested with two users.
- **No secrets or SMS text in logs:** request logs carry IDs and counts only, like the pipeline.
- **Deletion:** `DELETE /v1/me` removes the user's raw objects, warehouse rows and app rows
  (see the contract for timing). Ghana's Data Protection Act 2012 gives users this right.
- **Transport:** HTTPS only; the API is never exposed without TLS.
- **Phone numbers:** stored normalised (`+233...`); counterparty phone numbers are never returned
  by the API (the warehouse already hides them from Power BI).

## Folder layout

```text
backend/
├── README.md                this file
├── docs/                    design: contract, data model, ingestion flow
├── pyproject.toml
├── Dockerfile
├── alembic/                 migrations for the app schema
├── src/sikatrack_api/
│   ├── main.py              app factory, middleware, routers
│   ├── config.py            settings from the environment
│   ├── db.py                engine, session, read-only warehouse session
│   ├── auth/                OTP, tokens, current-user dependency
│   ├── routers/             one module per tag in the contract
│   ├── schemas/             Pydantic request/response models (= the contract)
│   ├── services/            ingestion, summaries, budgets, notifications, pipeline trigger
│   └── providers/           OTP SMS sender, push sender, object store
└── tests/                   pytest + httpx; two-user isolation tests; moto for S3
```

The pipeline's parser becomes importable by turning `data-engineering/src` into an installable
package (`pip install -e ../data-engineering`), so there's one copy of the templates.

## Build plan

Each phase ends with something that works end to end.

| Phase | Build | Done when |
|---|---|---|
| **0. Groundwork** | Make `data-engineering` installable; add `user_id` to the warehouse (migration `005`, see [data-model](docs/data-model.md#warehouse-changes-dw)); run the pipeline per user | Your existing data loads under your user ID, all data-engineering tests pass, Power BI still refreshes |
| **1. Skeleton** | FastAPI project, settings, `/health`, `/ready`, Alembic, `app` schema, Docker service, CI job | `docker compose up` serves `/docs`; CI runs the backend tests |
| **2. Auth** | OTP request/verify, tokens, refresh rotation, `/v1/me`, devices | Sign in from `curl` with the console OTP provider; refresh and logout work; tokens expire |
| **3. Ingestion** | `/v1/config`, `POST /v1/sms/batches`, raw-zone writes, provisional parse, sync status, pipeline trigger, internal pipeline event | Uploading SMS twice creates nothing new; a new SMS shows as provisional, then final after the pipeline runs |
| **4. Read API** | Transactions, summaries, categories, counterparties, balances, recurring | Numbers match Power BI for the same month to the pesewa |
| **5. User input** | Category overrides, counterparty aliases, recurring decisions, budgets; the pipeline reads overrides | A correction shows immediately in the app and in Power BI after the next run |
| **6. Notifications** | Device tokens, push sender, notification inbox, budget and low-balance rules | Crossing 80% of a budget sends one push, not one per transaction |
| **7. Hardening** | Rate limits, account deletion and export, load test, security review | A second test user sees none of your data through any endpoint |

Status: phases 0-6 are built and tested (every endpoint has tests on a real Postgres, including
a second user who must never see the first one's data). From phase 7, account erasure is built;
still to do: data export (`GET /v1/me/export`), general per-user rate limits beyond sign-in and
uploads, a load test, and an external security review.

v2, already in the project overview: the scam-number reporting layer (`/v1/reports/numbers`) and
custom categories. They fit this design without changing existing endpoints.
