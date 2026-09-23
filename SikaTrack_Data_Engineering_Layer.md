# SikaTrack — Data Engineering Layer

**Scope:** turning raw filtered SMS text into structured, categorized, pattern-flagged transaction records. This is the layer that makes SikaTrack a data engineering project rather than just an app — it's where the real technical work lives.

**Input contract (from Data Collection layer):** `data/raw/momo_sms_raw.json` (bulk, unlabeled) and `data/labeled/labeled_samples.json` (hand-labeled test set).

**Output contract (to Backend layer):** structured transaction records matching the schema in section 2, delivered via whatever mechanism the backend's ingest endpoint expects (see Backend Layer doc).

---

## 1. Sub-Phase A: SMS Parser

### Design principle
Don't build one universal parser. MoMo SMS formats are template-based and stable — one function per (provider, transaction_type) combination, not a generic NLP model. This is a deliberate, defensible engineering decision worth stating explicitly if you ever write this up: **simple, template-matched parsing beats ML here because the input space is small and stable, not open-ended.**

### Steps
1. Group your labeled samples by provider and transaction type — you'll likely find 4-8 distinct templates total (received, sent, airtime, bill pay, cash-out, per provider)
2. Write one regex-based parser function per template
3. Build a dispatcher: try each template's matcher against incoming raw text, use the first match
4. Anything matching nothing → tag `unparsed`, store raw text + timestamp for manual review later (never drop, never crash)

### Output schema (every parsed message, regardless of source template)
```json
{
  "raw_text": "string",
  "provider": "mtn_momo | vodafone_cash | airteltigo",
  "direction": "credit | debit",
  "amount": 0.00,
  "counterparty": "string | null",
  "transaction_type": "transfer | airtime | bill | cashout | other",
  "balance_after": 0.00,
  "timestamp": "ISO 8601 datetime",
  "parse_status": "parsed | unparsed"
}
```

### Testing
- Every message in `labeled_samples.json` must produce output matching its `expected` field exactly — this is your test suite, run it on every change to a parser function
- Track a simple **parse success rate** metric: `parsed / total` across your bulk raw file. This number is one of the "real numbers" worth citing later — e.g. "parser correctly handles 95% of real transaction messages across 3 providers"

**Done when:** 100% of labeled samples parse correctly, and you have a measured parse rate against your full bulk dataset.

---

## 2. Sub-Phase B: Categorization Engine

### Design
Rule-based first, not ML — you don't have enough labeled data yet for ML to outperform simple rules, and rules are auditable (you can explain exactly why a transaction was categorized a certain way, which matters for a finance tool).

### Steps
1. Seed category list: `Food, Transport, Airtime/Data, Bills, Transfers-Personal, Transfers-Business, Savings, Uncategorized`
2. Build a rules engine: match on `transaction_type` first (airtime → Airtime/Data automatically), then keyword/counterparty-name matching for the rest
3. Anything unmatched → `Uncategorized`, logged separately
4. **The feedback loop is the actual design**: periodically review the `Uncategorized` log, spot patterns, add new rules. This is expected ongoing maintenance, not a bug to eliminate entirely.

### Testing
- Run categorization against your bulk parsed dataset, measure **category coverage rate**: `categorized / total`
- Track this over time as you add rules — improving this number is a legitimate engineering narrative ("started at 60% coverage, reached 90% after two rule-refinement passes")

---

## 3. Sub-Phase C: Recurring Charge Detection

### Algorithm
1. Group parsed transactions by `counterparty`
2. Within each group, check for repeated amounts (±10% tolerance) at a roughly consistent interval (weekly/monthly)
3. If found, flag all matching transactions with `is_recurring: true` and store the detected interval

### Testing
- Since you likely won't have months of real data yet, construct a small synthetic test *only for this specific test* — a handful of fabricated transactions with a clear repeating pattern — to confirm the detection logic itself works correctly. This is different from using dummy data for the whole project: it's a targeted unit test for one algorithm, not a substitute for real transaction data.
- Once real data accumulates over a few weeks, validate against it directly and drop the synthetic test cases.

---

## 4. Running This as a Job

At this scale, a single Python script triggered by a scheduled task (cron, or a simple `while True` loop with a sleep if running locally) is enough. Don't reach for Airflow yet — that's justified once you have multiple interdependent jobs and failure recovery needs, not for one linear pipeline.

Pipeline order: `raw SMS → parse → categorize → detect recurring → write to output ready for backend ingestion`

---

## 5. Handoff to Backend Layer

Deliver structured, categorized, flagged records in the schema above (extended with `category` and `is_recurring` fields) to whatever the backend's ingest endpoint expects — see the Backend Layer doc for the exact API contract.

**Done when (full layer checklist):**
- [ ] Parser passes 100% of labeled test samples
- [ ] Parse success rate measured against bulk real data
- [ ] Categorization engine running, coverage rate measured
- [ ] Recurring detection logic unit-tested and validated against real data once available
- [ ] Output format matches what the backend ingest endpoint expects
