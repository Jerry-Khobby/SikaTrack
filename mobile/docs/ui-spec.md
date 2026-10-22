# SikaTrack mobile app: UI specification

Every screen of the Android app, from first launch to account deletion, and the backend
endpoint behind each one. The API it builds on is in
[backend/docs/api-contract.md](../../backend/docs/api-contract.md); how SMS reach the server is in
[backend/docs/ingestion-and-sync.md](../../backend/docs/ingestion-and-sync.md).

1. [What the app is](#1-what-the-app-is)
2. [Navigation map](#2-navigation-map)
3. [Rules every screen follows](#3-rules-every-screen-follows)
4. [Launch and sign-in](#4-launch-and-sign-in) (S01–S05)
5. [Onboarding](#5-onboarding) (S06–S11)
6. [Home](#6-home) (S12)
7. [Transactions](#7-transactions) (S13–S16)
8. [Spending](#8-spending) (S17–S22)
9. [Budgets](#9-budgets) (S23–S24)
10. [More: wallets, recurring, people, settings](#10-more) (S25–S40)
11. [Global states](#11-global-states) (G1–G9)
12. [Screen index](#12-screen-index)

---

## 1. What the app is

SikaTrack turns the MoMo SMS already on a phone into a personal-finance view: where the money
went, what it cost in fees, what keeps charging every month, and how close each budget is to
its limit. Nobody types a transaction in. The phone reads MoMo SMS, uploads them, and the
backend and pipeline turn them into categorised transactions.

| Fact | What it means for the UI |
|---|---|
| **Android only** | Reading SMS needs Android's `READ_SMS`; there is no iOS version. `platform` is always `android` |
| **Ghana only** | Phone numbers are Ghanaian (`024…` or `+233…`). Money is always **GHS**. Ghana is UTC+0, so a UTC date is the local date |
| **Supported wallets** | MTN MoMo and GhanaPay. Telecel Cash and AirtelTigo Money are listed by the server as **not yet supported** (greyed out, "Coming soon ›", which opens S40) |
| **Two kinds of transaction** | **Provisional**: parsed seconds after upload. **Final**: confirmed by the pipeline a few minutes later. Lists show both; provisional ones carry a small "Processing" marker |
| **The server is the source of truth** | The app keeps only a cache. A reinstall or a new phone signs in and syncs again |
| **Privacy promise** | Only SMS from the MoMo senders in `GET /v1/config → momo_senders` (today `MobileMoney`, `GhanaPay`) ever leave the phone. People are shown by name, never by phone number |

---

## 2. Navigation map

```text
Launch (S01) ── update required? ──► Update required (S02)
   │
   ├── signed out ──► Welcome (S03) ► Phone number (S04) ► Code (S05)
   │                                                        │
   │                          new user / onboarding unfinished
   │                                                        ▼
   │                     Name (S06) ► SMS permission (S07) ► Wallets (S08)
   │                     ► First sync (S09) ► Notifications (S10) ► All set (S11)
   │                                                        │
   └── signed in ───────────────────────────────────────────┤
                                                            ▼
 ┌────────────────────────── Bottom tab bar ───────────────────────────┐
 │  Home (S12)   Transactions (S13)   Spending (S17)   Budgets (S23)   More (S25) │
 └─────────────────────────────────────────────────────────────────────┘
   Bell icon (top right of Home) ► Notifications inbox (S36)
```

| Tab | Icon | Screens inside it |
|---|---|---|
| **Home** | house | S12 (and the inbox S36 from the bell) |
| **Transactions** | list | S13 → S15 (detail), S14 (filters sheet), S16 (category picker sheet) |
| **Spending** | pie chart | S17 (segments: Categories, Trend, Habits, People, Fees) → S18 (category), S20 (counterparty) |
| **Budgets** | target | S23 → S24 (editor sheet) |
| **More** | three dots | S25 menu → wallets, recurring, people, notification settings, sync, privacy, account |

**Deep links.** The backend puts these in notifications and insight cards (`link`); the app
must handle every one:

| Link (sent by the backend) | Opens |
|---|---|
| `sikatrack://summary` | Home (S12) |
| `sikatrack://transactions` | Transactions (S13) |
| `sikatrack://budgets/<category_id>` | Budgets (S23), that budget highlighted |
| `sikatrack://categories/<category_id>` | Category detail (S18) |
| `sikatrack://fees` | Spending → Fees segment (S17e) |
| `sikatrack://recurring` | Recurring payments (S28) |
| `sikatrack://recurring/<recurring_id>` | Recurring detail (S29) |
| `sikatrack://balances` | Wallets and balances (S26) |
| `sikatrack://wallets` | Wallets and balances (S26), the same screen |

The app adds two of its own, for sharing and for the sync strip: `sikatrack://transactions/<id>`
→ S15, and `sikatrack://sync` → S34.

The same table serves taps inside the app (notification rows, insight cards) and links that open
the app from outside it, such as a push notification. A link the app doesn't know opens
"This page isn't here" (G9) with **Go to Home**.

---

## 3. Rules every screen follows

### Money, numbers, dates

| Data | Arrives as | Show as |
|---|---|---|
| Money | Decimal string `"2723.40"` | `GHS 2,723.40`. On big totals: `GHS 2,723`. Never convert to a float for display. The currency comes from `GET /v1/me → settings.currency` |
| Money out / in | Two fields, both positive | Out without a sign in neutral ink; in with a `+` and the "money in" colour. Net: `-GHS 1,243.40` / `+GHS 120.00` |
| Change vs last period | Fraction string `"-0.305"` | `▼ 30.5% vs last month`. **For spending, down is good** (green arrow); for money in, up is good |
| Share | `"0.412"` | `41%` |
| Times | UTC ISO `2026-09-14T09:32:00Z` | `14 Sep, 09:32`. Today: `Today, 09:32`. Yesterday: `Yesterday, 09:32` |
| Months | `2026-09` | `September 2026`; in selectors `Sep 2026` |

### Colours

Taken from the SikaTrack dashboard, so the app and Metabase read the same:

| Use | Colour |
|---|---|
| Money out, single-series charts | Blue `#2a78d6` |
| Money in | Orange `#eb6834` |
| Averages, targets, reference lines | Dark ink `#1B2631` |
| Good status only (on track, active, healthy) | Green `#0ca30c` |
| Bad status only (over budget, low balance, failed) | Red `#d03b3b` |
| Warning status (budget past 80%) | Amber `#eda100` |
| Categories in charts (top five + Other) | Blue `#2a78d6`, orange `#eb6834`, green `#1baf7a`, yellow `#eda100`, pink `#e87ba4`, Other grey `#b9b8b2` |
| Wallets | MTN MoMo yellow-on-dark badge, GhanaPay its own badge (use each provider's brand colour only in the small wallet badge) |

Red and green never colour ordinary data, only status. Dark mode is required: every colour above
has a dark-theme twin with the same meaning. In charts, orange, yellow and pink are darkened in
dark mode (`#d55a26`, `#c08600`, `#cf5f93`) so the set still passes the lightness,
colour-blind and contrast checks on the dark card colour. The ink hero cards (Home's money out,
the Budgets and Recurring summaries) are a lifted slate in dark mode (`#2A3846`), so they
still stand out from ordinary cards.

### Charts

Every chart lets you read its numbers, not just its shape:

- A y-axis of round values with the unit on top (`GHS · 4K · 2K · 0`), hairline gridlines, and a
  label under each bar or along the line.
- Exact figures without guessing: tap a bar or a day for a readout under the chart. Short charts
  (fees, a category's six months) write the value over every bar, and heatmap cells have their
  amount in them.
- One value axis per chart. Two measures on different scales get two charts, never a second
  axis.
- Category colours go in a fixed order and follow the category, not its rank; past five, the
  rest share Other grey.
- Every bar, cell and point has a screen-reader label with its value, e.g.
  "October 2026: out GHS 2,723.40, in GHS 1,480.00".

### Category icons

The category `id` is a stable slug; map each to an icon:

| Group | Categories (`id` → name) |
|---|---|
| Spending | `food` Food · `transport` Transport · `airtime_data` Airtime/Data · `bills` Bills · `shopping` Shopping · `health` Health · `education` Education · `personal_care` Personal Care · `giving` Giving · `cash_withdrawal` Cash Withdrawal · `transfers_personal` Transfers-Personal · `transfers_business` Transfers-Business |
| Money in | `income` Income · `cash_deposit` Cash Deposit · `refunds` Refunds |
| Own money | `savings` Savings · `own_transfers` Own Transfers (not selectable) |
| Unknown | `uncategorized` Uncategorized (not selectable) |

Counterparty kinds also get small icons: `person`, `merchant`, `agent`, `telco`, `bank`,
`own_wallet`, `unknown`.

### States every data screen has

| State | Looks like |
|---|---|
| **Loading** | Skeleton blocks in the shape of the content (no full-screen spinner) |
| **Empty** | An illustration, one sentence saying why it's empty, and the action that fills it (e.g. "No transactions this month yet") |
| **Includes provisional data** | A thin info strip: "Some recent payments are still processing" (when a summary has `includes_provisional: true`) |
| **Error** | A short message, a **Try again** button, and the request ID in small grey text ("Ref: 9ff98286…") from the `X-Request-ID` header, so support can trace it |
| **Offline** | Cached content stays visible, with the offline banner (G1) |

Pull-to-refresh on every list and dashboard screen. It also runs a sync (S34's "Sync now").

---

## 4. Launch and sign-in

### S01 · Launch (splash)

**Purpose:** decide where to go, in under a second.

**Layout:** full-screen brand colour, SikaTrack logo centred, nothing else.

**Behind it:**
1. `GET /v1/config` (no sign-in needed; cache 1 hour): `min_app_version`, `momo_senders`,
   `providers`, `features`.
2. If this app's version is below `min_app_version` → **S02**.
3. No saved refresh token → **S03**.
4. Saved token → `GET /v1/me`. If onboarding isn't finished (`onboarding.wallets_added`,
   `sms_permission`, `first_sync_done`) → resume at the first unfinished onboarding step;
   otherwise → **Home (S12)**.

### S02 · Update required

**Purpose:** block an app too old for the API (`426 app_update_required` or a version below
`min_app_version`).

**Layout:** illustration; title "Time for an update"; one sentence "This version of SikaTrack
no longer works with our servers."; primary button **Update on Play Store**. No way past it.

### S03 · Welcome

**Purpose:** say what SikaTrack does, then start sign-in.

**Layout (top to bottom):**
- Logo and the line "Your MoMo, made clear."
- Three short points, each with an icon:
  - "See where your money goes: automatically, from your MoMo SMS."
  - "Spot fees and payments that keep charging."
  - "Set budgets and get a heads-up before you overspend."
- Small text: "Works with MTN MoMo and GhanaPay."
- Primary button **Get started** → S04.
- Footer link "How we handle your data" → S35 (Privacy), read-only before sign-in.

### S04 · Phone number

**Purpose:** ask for the number to send a sign-in code to. There are no passwords.

**Layout:**
- Back arrow; title "What's your phone number?"
- One input with a country picker in front (Ghana first, from `GET /v1/config →
  supported_countries`); numeric keypad; accepts `024 123 4567` or `+233…`. Picking a country
  that isn't supported yet shows "SikaTrack isn't available there yet".
- Hint: "We'll text you a 6-digit code."
- Primary button **Send code** (disabled until the number is valid).
- Small text: "By continuing you agree to the **Terms** (S39) and **Privacy Policy** (S35)."

**Calls:** `POST /v1/auth/otp/request {phone_number}` → keep `otp_request_id`, `expires_in`
(300 s), `resend_after` (60 s) → S05.

**Errors:**
- `validation_error`: under the field, "Enter a Ghanaian mobile number."
- `rate_limited` (3 codes per number per 10 min): "Too many codes. Try again in N minutes."
  using `Retry-After`.

### S05 · Enter the code

**Purpose:** check the code; this signs in, and creates the account on first use.

**Layout:**
- Title "Enter the code"; subtitle "Sent to +233 24 123 4567 · **Change**" (back to S04).
- Six single-digit boxes; auto-advance; paste a whole code; Android SMS autofill if the code
  SMS arrives.
- Countdown "Resend code in 0:42", which becomes a **Resend code** link after 60 s.
- "The code expires in 5 minutes."
- Submits automatically on the sixth digit; a spinner replaces the boxes while checking.

**Calls:** `POST /v1/auth/otp/verify {otp_request_id, code, device}`. The `device_id` is a
UUID the app creates once and keeps. Store both tokens in the secure store. Then:
- `is_new_user: true`, or onboarding unfinished → S06.
- Otherwise → Home.
- Register for push: `PUT /v1/devices/{device_id}` with the Expo push token (S10 asks for
  permission first on new users).

**Errors:** `otp_invalid` → boxes shake and clear; "That code is wrong or has expired."
After 5 wrong tries the code is dead: "Request a new code."

---

## 5. Onboarding

A progress bar (5 steps) runs across the top of S06–S10. Each step is saved as it happens, so
closing the app resumes at the same step: the app reports only the SMS permission
(`PATCH /v1/me {onboarding: {sms_permission}}`). The server records the other two steps
itself: `wallets_added` when a wallet is added (`POST /v1/wallets`), and `first_sync_done`
when it takes the first `initial_scan` upload.

### S06 · Your name

**Purpose:** a friendly greeting on Home. Optional.

**Layout:** title "What should we call you?"; one text field; **Continue** and **Skip**.

**Calls:** `PATCH /v1/me {display_name}`.

### S07 · Read your MoMo SMS

**Purpose:** the most important trust moment: ask for `READ_SMS` and say exactly what happens.

**Layout:**
- Illustration of a phone inbox with only MoMo messages highlighted.
- Title "Let SikaTrack read your MoMo SMS".
- Three points, each with an icon:
  - "We only read messages from **MobileMoney** and **GhanaPay**." (from `momo_senders`)
  - "Your other messages never leave your phone."
  - "We read them to build your transactions; nobody reads them by hand."
- Primary button **Allow access** → Android's system permission dialog.
- Text link "Not now".

**Calls:** `PATCH /v1/me {onboarding: {sms_permission: "granted" | "denied"}}`.

**Denied:** a calm screen, "SikaTrack needs this to work", with **Open settings** (Android app
settings) and "Maybe later". Later, Home shows a permanent card "Turn on SMS access to see
your transactions" until it's granted.

### S08 · Add your wallets

**Purpose:** tell SikaTrack which MoMo accounts are yours, so transfers between them aren't
counted as spending.

**Layout:**
- Title "Which wallets are yours?"
- One card per provider from `GET /v1/config → providers`:
  - **MTN MoMo**, **GhanaPay**: tappable, with an **Add** button.
  - **Telecel Cash**, **AirtelTigo Money**: greyed, "Coming soon ›", which opens S40.
- Added wallets are listed above, each with its number, name and an edit icon.
- Primary button **Continue** (enabled after at least one wallet).

**Add-wallet sheet (S27, also used later from More):**
- Provider (preselected); phone number (prefilled with the sign-in number for the first wallet).
- "Name on the account", with chips suggesting names found in the user's MoMo SMS ("Is this
  you? **JERRY K MENSAH**"). It must match the SMS exactly; that's how the pipeline knows the
  money is moving between your own wallets.
- Optional label ("Main MoMo").
- **Save**.

**Calls:** `POST /v1/wallets`.
**Errors:** `conflict` → "This wallet is already on your account"; `unsupported_provider` →
"We don't support this provider yet."

### S09 · First sync

**Purpose:** read the SMS history once and show it being turned into transactions.

**Layout:**
- Animated illustration (messages flowing into a chart).
- Title "Reading your MoMo history…"
- Progress bar, with live counts from each upload's response:
  - "1,240 messages found"
  - "1,198 transactions" (`parsed`)
  - "42 skipped (codes, promotions)" (`ignored`)
- Below: "You can leave this screen; we'll keep going." Button **Continue in the background**.
- When done: a check mark, "Done! Your first transactions are ready.", then **Continue**.

**Behind it:** query the inbox for `address IN momo_senders`, oldest first; upload in batches
of up to 500 (`POST /v1/sms/batches`, `source: "initial_scan"`, a new `Idempotency-Key` per
batch, retried with the same key). The server marks `first_sync_done` when it takes the first
`initial_scan` upload; the app doesn't send it.

**Edge cases:**
- **No MoMo SMS found:** "We didn't find any MoMo messages on this phone. New ones will
  appear as they arrive."
- **Offline mid-way:** progress pauses with "Waiting for internet…" and resumes by itself.

### S10 · Notifications

**Purpose:** ask for push permission, with the choices pre-set.

**Layout:**
- Title "Stay ahead of your money".
- Toggles, all on except the last (they map to `settings.notify.*`):
  - Budget alerts: "When a budget reaches 80% and 100%."
  - Low balance: "When a wallet drops below GHS 5.00" (the amount is editable later).
  - Recurring payments: "New subscriptions, and ones still charging after you planned to cancel."
  - Weekly summary: "Your week in one message, every Monday."
  - New data ready (off): "When your latest SMS have been processed."
- Primary button **Turn on notifications** → the system prompt; then
  `PUT /v1/devices/{device_id}` with the push token.
- Link "Not now".

**Calls:** `PATCH /v1/me {settings: {notify: {...}}}`.

### S11 · All set

**Layout:** a celebration illustration; "You're all set, Jerry"; a one-line teaser from the
first data ("We found 1,890 transactions since Nov 2025"); button **Go to my dashboard** →
Home.

---

## 6. Home

### S12 · Home (tab 1)

**Purpose:** "Where does my money stand this month?" in one screen.

**Layout, top to bottom:**

1. **Header:** "Good morning, Jerry" (time-based greeting); month selector chip
   ("October 2026 ▾", opens a month picker listing months that have data); bell icon with an
   unread badge (`GET /v1/notifications → unread`) → S36.
2. **Sync strip** (only when relevant), from `GET /v1/sync/status`:
   - pending uploads → "Syncing 12 new messages…";
   - provisional > 0 → "3 recent payments are still processing";
   - last run failed → "Some payments are taking longer than usual" (tap → S34).
3. **Hero card: money out this month**
   - Big number `GHS 2,723.40`.
   - Under it: `▼ 30.5% vs September` (green when down).
   - Row of three small stats: **Money in** `+GHS 1,480`, **Net** `-GHS 1,243`,
     **Fees & tax** `GHS 21.30`.
   - Small grey line: "GHS 90.78 a day on average · 128 payments".
4. **Balances card:** "Total balance GHS 30.24"; one row per wallet (badge, label, balance,
   "as of 3 Oct, 20:14"); a wallet below the low-balance threshold shows its amount in red with
   "Low". Tap → S26.
5. **Spending by category:** a donut of the top five plus Other, with the total in the middle;
   below it the top three as rows (icon, name, amount, share). Link **See all** → S17
   Categories.
6. **Insight cards:** a horizontal carousel from `GET /v1/insights`, coloured by `severity`
   (`info` blue, `tip` green-tinted, `warning` amber); each card has a title, two lines of
   body, and opens its `link`. Example: "Cash-outs cost you the most · 67% of your fees come
   from cash-outs. Paying merchants directly avoids them."
7. **Recurring strip:** "GHS 235.00 a month in recurring payments · 2 active" → S28.
8. **Budgets strip:** the two budgets closest to their limit, as progress bars → S23. If there
   are no budgets: "Set a budget →".
9. **Recent transactions:** the last five (same row as S13) and **See all** → S13.

**Data:** `GET /v1/summary?month=`, `GET /v1/balances`, `GET /v1/summary/categories?month=`,
`GET /v1/insights?month=`, `GET /v1/recurring` (for `monthly_cost`),
`GET /v1/budgets?month=`, `GET /v1/transactions?limit=5`, `GET /v1/sync/status`.

**Empty month:** the hero says "No spending in October yet"; the cards below hide.

---

## 7. Transactions

### S13 · Transactions (tab 2)

**Purpose:** every payment, searchable.

**Layout:**
- **Search bar** at the top: "Search people, shops, references" (`q`, at least 2 letters).
- **Filter chips** under it, scrolling sideways: date range (default "Last 30 days"),
  **Out / In**, **Category**, **Wallet**, **More filters** (→ S14). Active filters show as
  filled chips with an ×.
- **List** grouped by day with sticky day headers ("Today", "Yesterday", "Mon 12 Oct"), each
  header showing that day's money out on the right.
- **Transaction row:**
  - left: the category icon in a soft circle (the counterparty kind icon when it's
    uncategorised);
  - middle: counterparty name (the user's alias if set) in bold; under it the category name ·
    time · wallet badge;
  - right: amount (`GHS 40.00` for out, `+GHS 150.00` in the money-in colour), and the fee
    under it in small grey when there is one ("fee 0.50");
  - a small **"Processing"** pill on provisional rows;
  - a small ⚠ on rows flagged `balance_gap` (an SMS seems to be missing before it).
- Infinite scroll (cursor pages of 50).

**Data:** `GET /v1/transactions` with the filters as query parameters.

**Rules:**
- Transfers between your own wallets are hidden by default; a toggle in S14 shows them
  (`include_own_transfers`), in grey with a ⇄ icon.
- **Range limit:** one query can cover at most three years. The date picker doesn't allow a
  wider range.

**Empty:** with filters on, "Nothing matches these filters" plus **Clear filters**; without
filters, "No transactions in the last 30 days".

### S14 · Filters (bottom sheet)

**Layout:**
- **Date:** presets (This month, Last month, Last 30 days, Last 3 months, This year) or a custom
  range picker.
- **Direction:** All / Money out / Money in.
- **Categories:** multi-select grid of icons.
- **Wallet:** one chip per wallet.
- **Amount:** min and max fields (GHS).
- **Show transfers between my wallets:** a toggle.
- Buttons **Reset** and **Show 128 results**.

### S15 · Transaction detail

**Purpose:** everything about one payment, and the place to correct it.

**Layout, top to bottom:**
1. **Header:** the large amount (`-GHS 40.00` or `+GHS 150.00`), the counterparty name with its
   kind icon (tap → S20), date and time, the wallet badge, and a status pill **Confirmed** or
   **Processing**.
2. **Category row:** icon and name, with a **Change** button → S16. Under it, in grey, why it
   was chosen (`category_explanation`, e.g. "Your reference mentions 'laundry'"), or "You set
   this" (`category_source: user`) or "Your default for Sunshine Laundry"
   (`counterparty_default`).
3. **Details list:** Type (Merchant payment, Cash out, Transfer…), Fee, Tax, Total cost, Balance
   after, Reference, Transaction ID (`provider_txn_id`, copyable).
4. **Note:** "Add a note" (inline text field, saves on blur).
5. **Recurring:** if `recurring_id` is set, a row "Part of **Daily GHS 3 bundle**" → S29.
6. **Flags:** a `balance_gap` info box: "An SMS before this one seems to be missing, so the
   balance doesn't add up. That's fine; we still counted this payment." A
   `duplicate_sms_merged` note: "You received this SMS twice; we counted it once."
7. **Original SMS:** a collapsed card "View the SMS" that expands to the full text in a
   monospace bubble; "2 SMS" if `sms_count` is 2.
8. **Footer link:** "See all payments to Sunshine Laundry" → S13 filtered by counterparty.

**Data:** `GET /v1/transactions/{id}`.
**Saving:** `PATCH /v1/transactions/{id}` (category, note).

### S16 · Change category (bottom sheet)

**Layout:**
- A grid of the selectable categories (icons with names), grouped Spending / Money in / Own
  money; the current one ticked.
- A toggle **"Always use this for Sunshine Laundry"** (`apply_to_counterparty`), with a hint
  "Also changes their past payments."
- If there's a user override, a link **Go back to automatic**, which sends `category: null`.
- **Save**: the row updates at once; the pipeline applies it on its next run, so the dashboard
  agrees.

---

## 8. Spending

### S17 · Spending (tab 3)

**Purpose:** the analysis behind Home. One screen with a month selector at the top and a
segmented control: **Categories · Trend · Habits · People · Fees**.

#### S17a · Categories

- Large donut (top five plus Other) with the month's total in the middle.
- A toggle at the top: **Spending / Money in**.
- A list of every category: icon, name, amount, share bar, number of payments. Where a budget
  exists, a thin progress bar under the row ("GHS 1,122 of 1,000 budget", red when over).
- Tap a row → S18.

**Data:** `GET /v1/summary/categories?month=&group=spending|money_in`.

#### S17b · Trend

- Granularity switch: **Daily · Weekly · Monthly**.
- Grouped bars: money out (blue) and money in (orange), over a y-axis in GHS. Daily shows the
  days of the chosen month, Weekly the eight weeks ending with it, Monthly the six months ending
  with it.
- Tap a pair → a readout under the chart with the period ("October 2026 (so far)") and its exact
  **Out**, **In** and **Fees & tax**, plus a link "See these transactions" → S13 filtered to
  that period. Fees are about 1% of money out, so they aren't drawn on this chart (they would be
  a flat line on the same axis); they have their own chart under Fees (S17e).
- Under the chart: "Lowest month: May 2026 (GHS 705 out)" and "Average: GHS 3,156 out a month",
  both from complete periods only, so a half-finished month doesn't count as a good one.

**Data:** `GET /v1/summary/trend?granularity=`. Periods without data come back as zeros, so the
chart has no gaps.

#### S17c · Habits

- A **heatmap**: weekdays (Mon–Sun) by time of day (Morning, Afternoon, Evening, Night), with
  darker blue meaning more spending and each cell's amount written in it. A key under it shows
  the range, e.g. "GHS 0 … GHS 485".
- **By-hour bars** (00:00–23:00) with a GHS y-axis. Tap an hour for its amount; it opens on the
  busiest hour ("17:00–18:00 · GHS 434.50 · your busiest hour").
- Three stat chips:
  - "You spend most on **Monday afternoons**" (`peak`);
  - "**28%** of spending is at weekends" (`weekend_share`);
  - "Your typical payment: **GHS 15.00**" (`median_payment`).

**Data:** `GET /v1/summary/habits?month=`.

#### S17d · People and places

- A toggle: **Who I paid / Who paid me**.
- Top ten counterparties: kind icon, name (alias), amount, number of payments, and a bar
  showing the size.
- Tap → S20. Link **See everyone** → S21.

**Data:** `GET /v1/summary/counterparties?direction=&limit=10`.

#### S17e · Fees

- Hero: "**GHS 21.30** in fees and tax this month" with the change vs last month.
- A small bar chart of fees and tax over six months (`trend → fees`), each bar labelled with
  its amount and this month at full strength.
- An insight card about fees, when there is one (from `GET /v1/insights`, the one linking to
  `sikatrack://fees`), at full width.
- A list of the month's payments that had a fee or tax, biggest first (`GET /v1/transactions`
  for the month): who, "Cash Withdrawal · 13 Oct", the payment ("GHS 326.00 payment"), and
  the fee on the right.

### S18 · Category detail

**Opens from:** S17a, Home donut, `sikatrack://categories/<id>`.

**Layout:**
- Header: icon, name; the month's total and its share of spending.
- A 6-month mini trend of this category.
- **Budget card:** if a budget exists, a progress bar plus **Edit** (→ S24); if not,
  **Set a budget for Food** (→ S24).
- Top places for this category (counterparties).
- This category's transactions for the month (S13 rows).

**Data:** `GET /v1/summary/trend` + `GET /v1/transactions?category=&from=&to=` +
`GET /v1/budgets`.

### S19 · (reserved)

Custom categories are planned for v2; not in v1.

### S20 · Counterparty detail

**Opens from:** S15, S17d, S21.

**Layout:**
- Header: kind icon, display name; under it the original SMS name in grey when an alias is set
  ("SUNSHINE LAUNDRY").
- **Rename** (alias): "Call them something else, e.g. Mum". It changes the name everywhere
  in the app.
- **Default category:** "Always file their payments under…" → the category picker (S16 without
  the toggle).
- Stats: total paid, number of payments, last payment date.
- Their transactions (S13 rows).

**Data:** `GET /v1/counterparties/{id}`, `GET /v1/transactions?counterparty_id=`.
**Saving:** `PATCH /v1/counterparties/{id} {alias, default_category}`.

### S21 · Everyone (counterparties list)

**Opens from:** S17d "See everyone", More → People.

**Layout:** search ("Search people and shops", `q`); kind filter chips (People, Merchants,
Agents, Telcos, Banks); rows with icon, name (alias), money out, payments, "last paid 30 Sep".

**Data:** `GET /v1/counterparties?q=&kind=`.

### S22 · (reserved)

---

## 9. Budgets

### S23 · Budgets (tab 4)

**Purpose:** monthly limits per category, and how each one is going.

**Layout:**
- Month selector (current month by default).
- **Summary card:** "GHS 812 of GHS 1,500 budgeted · 18 days left".
- **One card per budget:**
  - category icon and name, with a state badge: **On track** (green), **Close to limit**
    (amber, past the first threshold), **Over** (red);
  - a progress bar `spent / limit`, with a marker at the alert threshold (80%);
  - "GHS 212.50 of GHS 300.00 · GHS 87.50 left";
  - the projection in grey: "At this pace: GHS 620 by month end", red when it's above the
    limit.
- Floating button **+ New budget** → S24.
- Swipe left on a card → **Delete**.

**Data:** `GET /v1/budgets?month=`.
**Hidden** when `config.features.budgets` is false.

**Empty:** an illustration; "Budgets keep you on track"; the user's top two spending
categories suggested as one-tap chips ("Set GHS 1,000 for Cash Withdrawal").

### S24 · Budget editor (bottom sheet)

**Layout:**
- Category picker (spending categories only; ones that already have a budget are marked).
- Monthly limit: GHS amount with a numeric keypad; a hint underneath, "You usually spend
  GHS 1,122 a month on this" (from S17a's figures).
- Alerts: two toggles, **At 80%** and **At 100%** (`alert_thresholds`).
- **Save**; **Delete budget** in red, when editing.

**Calls:** `PUT /v1/budgets/{category_id} {limit, alert_thresholds}`;
`DELETE /v1/budgets/{category_id}`.

---

## 10. More

### S25 · More (tab 5)

A grouped menu:

| Group | Rows |
|---|---|
| **Profile** | Avatar initial, display name, phone number → S33 |
| **Money** | Wallets and balances (S26) · Recurring payments (S28) · People and places (S21) |
| **App** | Notifications (S31) · Low-balance alert (S32), showing the amount · Sync status (S34), showing "Up to date", "N processing" or "Delayed" |
| **Privacy** | How we handle your data (S35) · Export my data (S38), marked "Coming soon" while `features.export` is false |
| **Account** | Sign out · Delete account (S37) |
| **Footer** | App version, "Made in Ghana 🇬🇭" |

### S26 · Wallets and balances

**Opens from:** More, Home balances card, `sikatrack://wallets`.

**Layout:**
- **Total balance** at the top (`GET /v1/balances → total`).
- One card per wallet: provider badge, label, number, account name, balance, "as of 3 Oct,
  20:14". It turns red with "Low" when below the threshold. A ⋯ menu offers **Edit** (S27) and
  **Remove**.
- **Balance history chart:** one line per wallet, end of day, with a red dashed line at the
  low-balance threshold. Range chips: 1M, 3M, 6M. Under it: "3 days below GHS 5.00 this
  month" (`days_below_threshold`).
- Button **+ Add wallet** → S27. Under it, one line per unsupported provider: "Telecel Cash is
  coming soon. **What that means**" → S40.
- Removing a wallet asks for confirmation: "Your past transactions stay. Transfers to this
  number will count as spending again."

**Data:** `GET /v1/wallets`, `GET /v1/balances`, `GET /v1/balances/history?from=&to=`.

### S27 · Add or edit a wallet (sheet)

As described under S08: provider, phone number, account name (with suggestions), label.
Editing allows the label and the account name.

**Calls:** `POST /v1/wallets`, `PATCH /v1/wallets/{id}`, `DELETE /v1/wallets/{id}`.

### S28 · Recurring payments

**Purpose:** subscriptions and regular payments the pipeline found by itself.

**Layout:**
- Hero: "**GHS 235.00** a month" (`monthly_cost`), "2 active".
- Tabs: **Active · Stopped · All**.
- **"Review these"** section at the top, for series the user hasn't reviewed yet
  (`user_state: null`): "Is this a regular payment?" with inline buttons **Yes, expected** and
  **Not recurring**.
- Row: counterparty icon and name, the label ("Daily GHS 3 bundle"), rhythm chip (Daily,
  Weekly, Fortnightly, Monthly), typical amount, monthly cost, "last paid 3 Oct".
  - `cancel_planned` rows show an amber pill "You plan to cancel".
  - When a `cancel_planned` series charged again, a red pill "Still charging".

**Data:** `GET /v1/recurring?status=`.

### S29 · Recurring detail

**Layout:**
- Header: name, label (editable, "Rename"), category, rhythm, typical amount, monthly cost,
  status (**Active** in green, **Stopped** in grey), first and last payment dates, number of
  payments.
- **Your decision**, as a segmented choice:
  - **Expected**: "Fine, keep tracking it";
  - **Plan to cancel**: "Remind me if it keeps charging";
  - **Not recurring**: "Hide it; it's a false match", which also takes it out of the monthly
    cost.
- Payment history: a list of payments, plus a small dot timeline showing the rhythm.

**Data:** `GET /v1/recurring/{id}`, `GET /v1/recurring/{id}/transactions`.
**Saving:** `PATCH /v1/recurring/{id} {user_state, label}`.

### S30 · (reserved)

### S31 · Notification settings

The S10 toggles (`settings.notify.budget`, `low_balance`, `recurring`, `weekly_digest`,
`data_ready`), plus a row showing whether Android notifications are allowed for the app at all,
with **Open Android settings** when they're blocked. Each switch saves the moment it's flipped,
and flips back with a message if the save fails. A row under them opens S32.

**Saving:** `PATCH /v1/me {settings: {notify: {...}}}`.

### S32 · Low-balance alert

**Layout:** "Tell me when a wallet drops below", then the amount between − and + buttons
(GHS 1 a step, from GHS 1 to GHS 100; default `5.00`), then a preview: "You'd have been
alerted on 3 days in September". The preview counts last month's days on which any wallet ended
below the amount (`GET /v1/balances/history` for last month). **Save** at the bottom.

**Saving:** `PATCH /v1/me {settings: {low_balance_threshold}}`.

### S33 · Profile

Display name (editable), phone number (read-only: "To change it, contact support"), "Member
since Oct 2026", and a data summary ("1,890 transactions from 15 Nov 2025 to 3 Oct 2026",
from `GET /v1/me → data`).

### S34 · Sync status

**Purpose:** reassure the user, and help when something's stuck.

**Layout:**
- A status line with an icon:
  - ✅ "Up to date": nothing pending, last run succeeded;
  - ⏳ "Processing 12 messages": pending or provisional items;
  - ⚠ "Taking longer than usual": the last run failed. We retry automatically; nothing is lost.
- Details list: last upload, messages waiting, payments still processing, last processing run
  (time and result), "Data up to: 3 Oct, 20:14" (`data_through`).
- Button **Sync now**: reads new SMS since `latest_date_ms` (minus 10 minutes) and uploads them
  as `incremental`.
- SMS permission row: "Allowed" or "Off · Turn on".

**Data:** `GET /v1/sync/status`.

### S35 · How we handle your data

A plain-language page, reachable before sign-in too:
- what is read (only SMS from the listed MoMo senders), and what isn't (everything else);
- where it goes (SikaTrack's servers in a private store, used only to build your transactions);
- who can see it (only you, plus the alias and category choices you make);
- what we never show (other people's phone numbers);
- how to leave (Delete account, with a 7-day grace period).

### S36 · Notifications inbox

**Opens from:** the bell on Home; tapping a push notification.

**Layout:**
- Title "Notifications"; **Mark all as read** at the top right.
- Rows: kind icon, title in bold if unread (with a blue dot), body, time ago. Tap → mark as
  read and open `link`.
- Infinite scroll.

**Kinds and icons:**

| `kind` | Icon and colour | Example |
|---|---|---|
| `budget_warning` | target, amber | "Food budget at 80% · GHS 240 of GHS 300 spent, 12 days left." |
| `budget_over` | target, red | "Food budget used up" |
| `low_balance` | wallet, red | "MTN MoMo is below GHS 5.00" |
| `new_recurring` | repeat, blue | "New regular payment: Daily GHS 3 bundle" |
| `recurring_still_charging` | repeat, red | "Netflix charged you again" |
| `weekly_digest` | calendar, blue | "Your week: GHS 420 out, top category Food" |
| `data_ready` | check, green | "Your latest payments are ready" |
| `sync_problem` | warning, amber | "We couldn't process your latest SMS yet" |

**Data:** `GET /v1/notifications`, `POST /v1/notifications/{id}/read`,
`POST /v1/notifications/read-all`.

### S37 · Delete account

**Layout:**
- A red warning icon; title "Delete your account?"
- What happens:
  - "You're signed out on every phone straight away, and your data is hidden."
  - "After **7 days** everything is deleted for good: your SMS, transactions and settings."
  - "Changed your mind? Sign in again within 7 days and nothing is lost."
- A field: type **DELETE** to confirm.
- A red button **Delete my account**; and **Cancel**.

**Calls:** `DELETE /v1/me` → `{deletion_scheduled_for}` → a final screen "Your account will
be deleted on 25 Oct 2026" → back to Welcome (S03).

**Sign out** (from S25) instead asks "Sign out of SikaTrack on this phone?", then
`POST /v1/auth/logout`, which also stops push to this phone, then goes to S03.

### S38 · Export my data

**Opens from:** More → Export my data.

**Layout:**
- "A copy of everything SikaTrack has built from your MoMo SMS, to keep or to open in a
  spreadsheet."
- What's in it: transactions as a CSV file; wallets, budgets, names and chosen categories as a
  JSON file.
- How it arrives: prepared in the background, then a notification with a download link that
  stops working after a while.
- While `features.export` is false: an amber note "Export isn't ready yet…" and a disabled
  **Coming soon** button. Once it's true: **Request my export**, then "We're preparing your
  export. You'll get a notification with the download link."

**Calls:** `GET /v1/me/export` (phase 7) → `{export_id}`.

### S39 · Terms of use

**Opens from:** S04's "Terms" link. Reachable before sign-in, like S35.

A plain-language page: what SikaTrack is (it shows your money and can never move it); that
figures come from SMS, so the provider's statement is the official record; one account per
phone number; your data (with a link to S35); leaving (Delete account, 7 days to change your
mind); and that changes are announced in the app first. The text is a first draft and needs a
legal review before release.

### S40 · Provider coming soon

**Opens from:** an unsupported provider's "Coming soon ›" in S08, and the line under
**+ Add wallet** in S26 ("Telecel Cash is coming soon. What that means").

**Layout:** the provider's badge (muted); "Telecel Cash is coming soon"; "SikaTrack can't read
Telecel Cash SMS yet, so payments from a Telecel Cash wallet won't show up for now."; then what
still works:
- add your supported wallets now;
- money sent from them to a Telecel Cash number still shows up, as a payment to that person;
- when it's ready it appears under Add a wallet, with nothing to sign up for.

**Back to wallets** at the bottom. The provider's name and the supported list come from
`GET /v1/config → providers`.

---

## 11. Global states

| ID | When | Looks like |
|---|---|---|
| **G1 Offline** | No connection | A slim grey banner at the top, "You're offline · showing saved data"; uploads queue and send later |
| **G2 Session expired** | `refresh_invalid` (refresh token expired, revoked, or reused elsewhere) | Clear the tokens and the cache; a dialog "Please sign in again" that can't be dismissed: **Send code** texts the last number and opens S05, **Use a different number** opens S04 |
| **G3 Access token expired** | `unauthenticated` | Invisible: refresh the token silently, retry once |
| **G4 Too many requests** | `rate_limited` | A toast "Slow down a little. Try again in N seconds" (`Retry-After`) |
| **G5 Server unavailable** | `dependency_unavailable` (503), or no answer within 20 seconds, on a screen with nothing saved to show | A full-screen card "SikaTrack is taking a break" with **Try again** and **Keep using saved data**; cached screens stay usable |
| **G6 Update required** | `app_update_required` (426) on any call | → S02 |
| **G7 Unexpected error** | Any other error | Inline error state with **Try again** and the request ID |
| **G8 Live SMS** | A new MoMo SMS arrives while the app is open | Upload as `live`; the new row slides into Home's recent list and S13 with the "Processing" pill |
| **G9 Page not found** | A link to a screen the app doesn't have (e.g. from a newer version) | "This page isn't here" with **Go to Home** |

---

## 12. Screen index

| ID | Screen | Main endpoints |
|---|---|---|
| S01 | Launch | `GET /v1/config`, `GET /v1/me` |
| S02 | Update required | none |
| S03 | Welcome | none |
| S04 | Phone number | `GET /v1/config`, `POST /v1/auth/otp/request` |
| S05 | Enter the code | `POST /v1/auth/otp/verify`, `PUT /v1/devices/{id}` |
| S06 | Your name | `PATCH /v1/me` |
| S07 | SMS permission | `PATCH /v1/me` |
| S08 | Add your wallets | `GET /v1/config`, `POST /v1/wallets` |
| S09 | First sync | `POST /v1/sms/batches` |
| S10 | Notifications | `PATCH /v1/me`, `PUT /v1/devices/{id}` |
| S11 | All set | `GET /v1/me` |
| S12 | Home | `GET /v1/summary`, `/balances`, `/summary/categories`, `/insights`, `/recurring`, `/budgets`, `/transactions`, `/sync/status`, `/notifications` |
| S13 | Transactions | `GET /v1/transactions` |
| S14 | Filters | `GET /v1/categories`, `GET /v1/wallets` |
| S15 | Transaction detail | `GET`/`PATCH /v1/transactions/{id}` |
| S16 | Change category | `GET /v1/categories`, `PATCH /v1/transactions/{id}` |
| S17 | Spending (Categories, Trend, Habits, People, Fees) | `GET /v1/summary/categories`, `/summary/trend`, `/summary/habits`, `/summary/counterparties`, `/insights`, `/transactions` |
| S18 | Category detail | `GET /v1/summary/categories` (one per month, for the six-month chart), `/transactions`, `/budgets` |
| S20 | Counterparty detail | `GET`/`PATCH /v1/counterparties/{id}`, `GET /v1/transactions` |
| S21 | Everyone | `GET /v1/counterparties` |
| S23 | Budgets | `GET /v1/budgets` |
| S24 | Budget editor | `PUT`/`DELETE /v1/budgets/{category_id}` |
| S25 | More | `GET /v1/me` |
| S26 | Wallets and balances | `GET /v1/wallets`, `/balances`, `/balances/history` |
| S27 | Add or edit a wallet | `POST`/`PATCH`/`DELETE /v1/wallets` |
| S28 | Recurring payments | `GET /v1/recurring` |
| S29 | Recurring detail | `GET`/`PATCH /v1/recurring/{id}`, `GET /v1/recurring/{id}/transactions` |
| S31 | Notification settings | `PATCH /v1/me` |
| S32 | Low-balance alert | `PATCH /v1/me`, `GET /v1/balances/history` |
| S33 | Profile | `GET`/`PATCH /v1/me` |
| S34 | Sync status | `GET /v1/sync/status`, `POST /v1/sms/batches` |
| S35 | How we handle your data | none |
| S36 | Notifications inbox | `GET /v1/notifications`, `POST …/read`, `POST …/read-all` |
| S37 | Delete account | `DELETE /v1/me`; sign out: `POST /v1/auth/logout` |
| S38 | Export my data | `GET /v1/me/export` (phase 7) |
| S39 | Terms of use | none |
| S40 | Provider coming soon | `GET /v1/config` |

**Not in v1:**
- **Data export:** S38 explains it, but its button waits until `features.export` is true and
  the endpoint exists.
- **Unsupported providers:** S40 says what still works.
- Custom categories, iOS, and importing an XML backup from the app have no screen.
