# SikaTrack — Build Roadmap

This is your step-by-step build guide. Follow it in order — each phase produces something working before you move to the next, so you're never stuck building for weeks without seeing results.

---

## Phase 0: Setup (Before Week 1)

**Goal:** Environment ready, no code yet.

- [ ] Create a GitHub repo (`sikatrack` or your chosen name), split into `/mobile`, `/backend`, `/dashboard`
- [ ] Create a free Supabase project → note the Postgres connection string
- [ ] Create a free Render account (for backend hosting later)
- [ ] Create a free Vercel account (for dashboard hosting later)
- [ ] Collect 15-20 real MoMo SMS messages from your own phone (MTN MoMo and/or Vodafone Cash) — copy the raw text into a `sample_sms.txt` file in the repo. You'll need these as test fixtures for parsing.
- [ ] Manually label each sample SMS with what it should parse into (amount, direction, counterparty, type, balance) — this becomes your test dataset

**Done when:** repo exists, accounts exist, you have a labeled sample SMS file.

---

## Phase 1: SMS Parser (Week 1-2)

**Goal:** A Python function that takes raw MoMo SMS text and returns structured data. No app yet — this can be built and tested entirely on your laptop.

### Steps
1. Group your sample SMS by provider and by transaction type (received, sent, airtime, bill payment, cash-out, etc.) — each type usually has a distinct template
2. Write one regex/parsing function per template. Don't try to write one universal parser — MoMo SMS formats are inconsistent between transaction types
3. Output format for every parsed message, regardless of source template:
   ```
   {
     "raw_text": str,
     "provider": "mtn_momo" | "vodafone_cash" | "airteltigo",
     "direction": "credit" | "debit",
     "amount": float,
     "counterparty": str | null,
     "transaction_type": "transfer" | "airtime" | "bill" | "cashout" | "other",
     "balance_after": float | null,
     "timestamp": datetime
   }
   ```
4. Write a test for every sample SMS you collected — parser must produce the correct structured output for each
5. Handle the unhappy path: what happens when a message doesn't match any known template? (Don't crash — flag it as `unparsed` and store the raw text for later review)

**Done when:** every sample SMS parses correctly, and unrecognized formats are gracefully flagged instead of crashing.

**Common trap:** don't over-engineer this into a generic NLP parser. Real MoMo SMS templates are stable and finite per provider — simple regex per template beats a fancy model here.

---

## Phase 2: Backend + Database (Week 2-3)

**Goal:** An API that accepts parsed transactions and stores them.

### Database schema (Postgres)
```sql
users (id, phone_number, created_at)
transactions (
  id, user_id, provider, direction, amount,
  counterparty, transaction_type, balance_after,
  category_id, is_recurring, raw_text, occurred_at, created_at
)
categories (id, name, is_default)
recurring_flags (id, transaction_group_id, interval_days, confidence, detected_at)
```

### API endpoints (FastAPI or Django REST — whichever you're more comfortable with)
- `POST /transactions/ingest` — accepts a batch of parsed transactions from the mobile client
- `GET /transactions` — list with filters (date range, category, direction)
- `GET /summary/monthly` — aggregated spend by category for a given month
- `POST /auth/*` — basic auth (email/phone + password, or magic link via Supabase Auth to save yourself the work)

### Steps
1. Set up the FastAPI/Django project, connect to Supabase Postgres
2. Build the schema via migrations (Alembic for FastAPI, or Django's built-in migrations)
3. Build `POST /transactions/ingest` first — this is the critical path
4. Build basic auth — don't roll your own password hashing; use a library (`passlib`, or Supabase Auth directly)
5. Deploy to Render, confirm the free tier is live and reachable

**Done when:** you can `curl` a parsed transaction into the API and see it land in the Postgres table.

---

## Phase 3: Categorization + Recurring Detection (Week 3-4)

**Goal:** Transactions get auto-categorized, and repeated charges get flagged.

### Categorization (rule-based v1)
1. Build a `categories` seed list: Food, Transport, Airtime/Data, Bills, Transfers-Personal, Transfers-Business, Savings, Uncategorized
2. Write a rules engine: keyword/counterparty matching → category. Start simple (if counterparty name contains "MTN" and type is airtime → Airtime/Data)
3. Anything that doesn't match a rule → `Uncategorized`, logged for you to review and turn into new rules over time (this feedback loop is how the categorizer actually improves)

### Recurring detection
1. Group transactions by counterparty
2. For each group, check: does a similar amount (±10%) repeat at a roughly consistent interval (weekly, monthly)?
3. If yes, mark as `is_recurring = true` and store the detected interval
4. Run this as a scheduled job (a simple cron-triggered script is enough at this scale — no need for Airflow yet)

**Done when:** a batch of test transactions gets categorized without manual tagging, and at least one synthetic recurring pattern (e.g., a fake "weekly data bundle" set) gets correctly flagged.

---

## Phase 4: Mobile Client (Week 4-5, can overlap with Phase 3)

**Goal:** An Android app that reads MoMo SMS and sends parsed data to your backend.

### Steps
1. Set up a React Native (or Flutter) project
2. Request SMS read permission (Android `READ_SMS`) — be upfront in the UI about exactly why you need it and what you do with it
3. Filter incoming/existing SMS by known MoMo sender IDs
4. Reuse your Phase 1 parsing logic — port it to JS/Dart, or keep parsing server-side and just forward raw SMS text + timestamp to the backend (simpler, but sends more raw data over the network)
5. Call `POST /transactions/ingest` with parsed (or raw, if parsing server-side) transaction data
6. Basic screens: transaction list, category breakdown, login

**Done when:** a real MoMo SMS on your phone shows up as a categorized transaction in your backend within a few seconds.

---

## Phase 5: Dashboard (Week 4-5, parallel with mobile client)

**Goal:** A web view of your data — this can double as your portfolio piece even before the mobile app is polished.

### Steps
1. Next.js app, calling your backend's `GET /transactions` and `GET /summary/monthly`
2. Screens:
   - Monthly spend by category (bar or pie chart)
   - Spend trend over time (line chart)
   - Flagged recurring charges list
   - Raw transaction table with filters
3. Deploy to Vercel

**Done when:** you can log in and see your real spending data visualized.

---

## Phase 6: v2 — Scam/Fraud Signal Layer (Week 5+, optional stretch)

Only start this once Phases 1-5 are working end to end.

- [ ] `reported_numbers` table: phone number, report count, report reason
- [ ] Endpoint to check a counterparty number against reported numbers before a transfer
- [ ] Simple reporting UI (flag a number as suspicious)

This is a natural v2 because by this point you already have the transaction pipeline and user base structure in place — it's additive, not a rebuild.

---

## Milestones Checklist (quick reference)

- [ ] Phase 0 — Setup complete
- [ ] Phase 1 — Parser passes all sample SMS tests
- [ ] Phase 2 — API + DB live on Render, ingest endpoint works
- [ ] Phase 3 — Categorization + recurring detection working on real data
- [ ] Phase 4 — Android app ingesting real SMS end to end
- [ ] Phase 5 — Dashboard showing real data
- [ ] Phase 6 — (Optional) Scam signal layer

---

## When You Get Stuck

Come back to this conversation (or a new one) with:
- Which phase you're on
- What you've tried
- The exact error or blocker

I can help debug parsing regex, review your schema, design specific endpoints, or work through the recurring-detection logic in more depth when you get there.
