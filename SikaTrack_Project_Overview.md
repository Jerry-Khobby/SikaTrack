# SikaTrack — Project Overview

*Working name. "Sika" is Twi for money. Rename freely — the docs use this as a placeholder.*

---

## 1. What This Project Is

SikaTrack is a personal finance tracker built specifically for mobile-money users in Ghana. It automatically reads MoMo transaction SMS (MTN MoMo, Vodafone Cash, AirtelTigo Money), parses them into structured transaction records, categorizes spending, flags recurring/subscription charges you may have forgotten about, and shows you a clear picture of where your money goes — without you ever typing a single transaction in by hand.

**One sentence version:** *A Mint/YNAB-style budgeting app, but built for the mobile-money economy instead of Western bank accounts.*

---

## 2. The Problem

Global personal-finance apps (Mint, YNAB, Copilot, Monarch) all assume your money moves through a bank account they can connect to via an API (Plaid, etc.). In Ghana, most day-to-day money movement happens through mobile money — sending, receiving, paying bills, buying airtime/data — none of which those apps can see.

Because of this, most people track spending in one of three ways:
- Not at all
- Mentally, badly
- Manually, in a notes app or spreadsheet, until they give up

There's also no local tool solving two smaller but real problems:
- **Recurring charge blindness** — small standing charges or repeated transfers that quietly drain money and go unnoticed month to month
- **Dumb categorization** — even where categorization exists, it's tuned to US/UK merchant name databases and fails completely on local transaction patterns (peer transfers, informal vendor names, MoMo agent transactions)

---

## 3. The Gap

| Existing Tool | What It Does | Why It Doesn't Work Here |
|---|---|---|
| Mint / YNAB / Copilot | Connects to bank accounts, categorizes spend | No mobile money support at all |
| Plaid / Mono / Okra | Bank/API aggregation for fintech builders | Costs money, requires partnership, limited/no MoMo coverage |
| Manual spreadsheet | Free, flexible | Nobody keeps it up |
| Bank's own app | Shows balance/history | No cross-provider view, no categorization, no insight |

**SikaTrack's angle:** don't wait for an API that doesn't exist — read the SMS the user already receives, and build the intelligence layer on top of that.

---

## 4. Who It's For

- **Primary user (v1):** you — this is a real dogfooding project. You're the first and most reliable data source.
- **Secondary users (v2+):** young professionals and students in Ghana who use MoMo as their primary means of payment and want visibility into spending without manual entry.

---

## 5. Core Features (v1 scope)

1. **SMS Ingestion** — reads MoMo SMS notifications on the user's Android device (with explicit permission)
2. **Transaction Parsing** — extracts amount, direction (in/out), counterparty, transaction type, running balance, timestamp
3. **Categorization Engine** — rule-based first pass (merchant/keyword matching), with room to grow into a smarter model later
4. **Recurring Charge Detection** — flags transactions that repeat at a similar amount/interval to the same counterparty
5. **Dashboard** — spend by category, monthly trend, flagged subscriptions, balance-over-time view

## 6. Deferred Features (v2+)

- Community-sourced scam/fraud number reporting
- Budgets and goal-setting
- Multi-user / shareable household view
- iOS support (requires a different data-access strategy since iOS doesn't allow SMS reading)

---

## 7. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile client | React Native (or Flutter) — Android only for v1 | Needs SMS read permission; only Android allows this |
| Backend API | FastAPI or Django REST | Matches your existing backend experience |
| Database | Postgres (Supabase free tier) | Free, persistent, no expiry unlike some trial-based free tiers |
| Categorization/ETL jobs | Python, scheduled via cron or lightweight scheduler | Same pattern as your Airflow/dbt experience, scaled down |
| Dashboard | Next.js, deployed on Vercel | Free hosting, matches your existing stack |
| Backend hosting | Render free web service tier | 750 free compute hours/month, acceptable cold starts for a personal-scale project |

**Total infrastructure cost at this stage: $0/month.**

---

## 8. Why This Is a Good Portfolio + Real Product Project

- It solves a problem you and people around you actually have — not a hypothetical
- It touches all three of your skill areas: data ingestion/parsing (data engineering), API + auth + business logic (backend), dashboard (full stack)
- It has a believable path from "solo project" to "real product" without needing to raise money or sign a bank partnership first
- It produces genuinely interesting engineering problems: SMS format variability across providers, recurring-pattern detection, categorization without labeled data
