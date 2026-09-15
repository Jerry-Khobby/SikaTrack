---
name: sikatrack-project
description: Use this skill whenever working on SikaTrack — a mobile-money personal finance tracker for Ghana (SMS parsing of MoMo transactions, FastAPI backend, Expo/React Native mobile app, Next.js dashboard). ALWAYS consult this skill for anything touching MoMo/mobile-money transaction parsing, categorization rules, recurring-charge detection, the ingestion API, the Expo dev-build setup, or the phased build roadmap — even if the user just says "the app," "the tracker," or describes a feature without naming the project.
---

# SikaTrack Project Skill

Personal finance tracker for mobile-money users in Ghana. Reads MoMo SMS, parses transactions, categorizes spending, flags recurring charges. Built solo, zero infrastructure budget, real data (the builder's own SMS), no external API partnerships.

Full context lives in two docs the user already has: `SikaTrack_Project_Overview.md` (what/why) and `SikaTrack_Build_Roadmap.md` (phased how, week by week). Treat this skill as the fast-reference layer on top of those — check the roadmap doc for full phase detail when the user references a phase number.

## Current State

Ask the user which phase they're on if unclear. Don't assume — this project moves in discrete phases and advice for Phase 2 (backend) is often wrong for Phase 4 (mobile client).

Phases: 0 Setup → 1 SMS Parser → 2 Backend+DB → 3 Categorization/Recurring → 4 Mobile Client → 5 Dashboard → 6 (optional) Scam signal layer.

## Tech Stack (locked in — don't suggest alternatives without a strong reason)

| Layer | Choice |
|---|---|
| Mobile | React Native via **Expo**, Android-first |
| Backend | FastAPI |
| Database | Postgres via Supabase (free tier, doesn't expire) |
| Dashboard | Next.js on Vercel |
| Backend hosting | Render free web service tier |
| Scheduled jobs | Simple cron-triggered scripts (not Airflow — overkill at this scale) |

Budget constraint is real and permanent for v1: **$0/month infra**. Don't suggest paid services, bank API aggregators (Plaid/Mono/Okra), or anything requiring a partnership/approval process. If a feature seems to need one, look for a free/DIY alternative first (e.g. SMS parsing instead of bank API access).

## Critical Constraints — always keep these in mind

1. **Expo Go cannot read SMS.** Any native module (SMS reading, and likely others added later) requires a **development build** via `expo prebuild` + **EAS Build**, not Expo Go. If the user reports something "just doesn't work" on Expo Go and the feature touches native code, this is almost certainly why — check this before debugging anything else.

2. **Google Play restricts the SMS-read permission** to default SMS/messaging apps, with a manual declaration/review path for exceptions. This affects the *distribution* plan, not local development. Sideloading APKs to test devices is unaffected. Don't assume a smooth Play Store launch is available by default — flag this if the user starts planning a public release.

3. **Local network gotchas for Expo + FastAPI on the same machine:**
   - Android emulator → backend at `http://10.0.2.2:PORT`, not `localhost`
   - Physical device on same WiFi → use the laptop's LAN IP
   - FastAPI needs `CORSMiddleware` configured or requests silently fail from the RN client
   - Android blocks plain HTTP to non-localhost hosts by default (cleartext traffic policy) — relevant when testing against a LAN IP over HTTP

4. **MoMo SMS parsing is per-template, not universal.** Each provider (MTN MoMo, Vodafone Cash, AirtelTigo) and each transaction type (receive, send, airtime, bill pay, cash-out) has its own stable SMS format. Don't suggest a single generic regex or an NLP model for this — write one parser function per template, matched against real labeled sample messages the user has collected from their own phone.

## Conventions

- **Transaction schema fields** (keep consistent across parser output, DB schema, and API): `raw_text`, `provider`, `direction` (`credit`/`debit`), `amount`, `counterparty`, `transaction_type`, `balance_after`, `timestamp`.
- Unparseable SMS → flag as `unparsed`, store raw text for review. Never crash or drop silently.
- Uncategorized transactions → log them; the user reviews and turns patterns into new categorization rules over time. This is the intended feedback loop, not a gap to "solve" with ML right away.
- Recurring detection = same counterparty + similar amount (±10%) + consistent interval. Simple heuristic, not a forecasting model, at this stage.

## When Helping With This Project

- Ask which phase the user is on before giving architecture advice — solutions differ a lot phase to phase.
- Default to the cheapest/simplest tool that works (this is a $0-budget solo project, not an enterprise system) unless the user explicitly says they're ready to spend money or scale up.
- If a request would reintroduce something the constraints above rule out (e.g. "let's just use Plaid," "let's skip the dev build and use Expo Go"), flag the conflict rather than proceeding — the user has hit these walls before and wants them caught early, not rediscovered.
- Reference the two project docs by name if the user seems to have lost track of the plan — don't restate their full contents inline, point back to the relevant section/phase.
