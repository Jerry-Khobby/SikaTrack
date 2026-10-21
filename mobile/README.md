# SikaTrack mobile

The SikaTrack Android app, built with Expo and React Native. Every screen and the endpoint
behind it is described in [docs/ui-spec.md](docs/ui-spec.md).

## Running it

```bash
npm install
npx expo start
```

## Tests

```bash
npm test
```

Tests use Jest (`jest-expo`) and React Native Testing Library. Unit and component tests sit
next to the file they test (`phone.test.ts` beside `phone.ts`). Screen tests live in
`src/__tests__/screens/`, because every file inside `src/app` becomes a route.

## Code layout

The UI follows [Atomic Design](https://atomicdesign.bradfrost.com/chapter-2/): small parts
are combined into bigger ones, and each layer may only import from the layers below it.

```text
src/
├── api/                 HTTP client, the API's JSON types, and the in-app dev server
├── app/                 Pages: expo-router routes. Each one fills a template with real data
├── components/
│   ├── atoms/           Smallest parts: text, view, icon, button, input, badge
│   ├── molecules/       A few atoms doing one job: money amount, category chip, labelled input
│   ├── organisms/       Screen sections: transaction list, budget card, sync strip
│   └── templates/       Page layouts that place organisms, with no real content
├── hooks/               Shared React hooks, including every data query (queries.ts)
├── services/            One file per API area: calls an endpoint, maps it to the app's models
├── theme/               Design tokens (colours, sizes, fonts) that tailwind.config.js reads
└── utils/               Plain functions, e.g. phone number parsing and formatting
```

Each layer may import from its own layer and the layers below it, never from above.

| Layer | May import from | Holds state or fetches data? |
| --- | --- | --- |
| atoms | atoms, `theme`, `hooks` | No |
| molecules | molecules, atoms, `theme`, `hooks` | Local UI state only (focus, animation) |
| organisms | organisms, molecules, atoms, `theme`, `hooks` | Local UI state only |
| templates | organisms, molecules, atoms, `theme` | No |
| pages (`src/app`) | everything | Yes: this is where data is loaded |

Each layer has an `index.ts` that re-exports its components, so imports read
`import { ThemedText } from '@/components/atoms';`. File names are kebab-case
(`money-amount.tsx`), component names PascalCase (`MoneyAmount`).

## Styling

Components are styled with Tailwind classes through
[NativeWind](https://www.nativewind.dev/) (v4): `<View className="flex-row gap-3 rounded-lg bg-surface p-4">`.

- **Tokens:** [tailwind.config.js](tailwind.config.js) builds its theme from
  [src/theme](src/theme), so the classes and the tokens can't drift apart.
- **Colours follow light and dark mode.** Theme colours are CSS variables that the root layout
  switches, so use `bg-surface` or `text-content` and never add `dark:` variants. The names:
  - text colours are `content-*`: `text-content`, `text-content-secondary`;
  - border colours are `line-*`: `border-line`, `border-line-input`;
  - everything else keeps its token name, kebab-cased: `bg-tint-blue`, `text-icon-red`.
- **Fixed colours:** brand and chart colours are the same in both modes: `bg-brand-ink`,
  `text-brand-gold`, `bg-chart-1`.
- **Fonts:** pick a weight with `font-sans`, `font-sans-semibold`, `font-sans-bold` or
  `font-sans-extrabold`. Never set `fontWeight`; each weight is its own font file on Android.
- **Text:** `ThemedText` gives the type styles (`type="caption"`) and theme colours
  (`themeColor="textSecondary"`). For your own font or colour, pass `type="none"` or
  `themeColor="none"` and set it in `className`. Never put two classes for the same property on
  one element: NativeWind doesn't decide between them by order.
- **Sizes:** `inlineRem: 16` in [metro.config.js](metro.config.js) keeps Tailwind's scale in
  real pixels (`p-4` = 16 px). Off-scale values use brackets: `text-[15px] leading-[21px]`.
- **Inline `style` only for what classes can't express:**
  - values computed at runtime (sizes from props, percentages, data colours);
  - animated transforms;
  - native shadows and `elevation`;
  - `fontVariant: ['tabular-nums']`, which NativeWind can't apply on Android.
- **Icons:** they take a colour string, so they still read it from `useTheme()`.
- **Class strings must stay complete words**, not built like `` `bg-${tone}` ``, or Tailwind
  won't see them. Use a lookup object of full class names instead.

## Charts

Every chart has to let you read its numbers, not just its shape. The chart atoms (`BarChart`,
`LineChart`, `Heatmap` in `src/components/atoms`) follow these rules:

- **A y-axis of round values with the unit on top** (`GHS · 4K · 2K · 0`), worked out by
  `niceTicks` in [src/utils/chart-scale.ts](src/utils/chart-scale.ts), plus hairline
  gridlines and a label under each bar or along the line.
- **Exact figures on tap.** Tapping a bar or a day shows its exact amounts under the chart.
  Short charts (fees, a category's six months) write the value over every bar. Heatmap cells
  have their amount written in them.
- **One axis per chart.** Two measures on different scales get two charts, never a second
  y-axis. That's why fees aren't drawn on the Trend chart: they have their own chart under
  **Fees**, and the Trend readout lists them.
- **Colour follows the thing, never its rank.** Categorical colours come from `DataColors`
  in a fixed order. Past five, the rest share the neutral "Other" colour.
- **Screen readers hear every value.** Each bar, cell and point has its own label, e.g.
  `October 2026: out GHS 2,723.40, in GHS 1,480.00`.

## How data reaches a screen

```text
page (src/app) → hook (hooks/queries.ts) → service (services/*.ts) → api.get (api/client.ts) → backend
                                                                                            ↘ dev server
```

- **[api/types.ts](src/api/types.ts)** has the JSON exactly as
  [backend/docs/api-contract.md](../backend/docs/api-contract.md) defines it.
- **[api/client.ts](src/api/client.ts)** sends every request. It turns error responses into an
  `ApiError` that carries `code` and the `X-Request-ID` the error screens show.
- **Services** call one endpoint each and map snake_case JSON to the app's own models, so
  screens never see the wire format.
- **[hooks/queries.ts](src/hooks/queries.ts)** wraps each service in a TanStack Query hook.
  Those hooks handle caching, pull-to-refresh, paging, and refreshing totals after an edit.

### Connecting the real backend

Set the API's address and start the app:

```bash
EXPO_PUBLIC_API_URL=https://api.sikatrack.app npx expo start
```

Every Home, Transactions, transaction detail and inbox request then goes to the backend.
Nothing else changes. Without `EXPO_PUBLIC_API_URL`, requests go to the in-app dev server in
[src/api/dev-server/](src/api/dev-server/). It answers with the same JSON, worked out from
about five months of sample transactions that are dated relative to today and use the wallets
you add in onboarding.

Still to wire in when the backend is ready:

- **Access token:** sign-in has to call `setAccessToken` in `api/client.ts`.
- **Sign-in and config stand-ins:** `services/auth.ts` (the code request and check) and
  `services/config.ts` still keep their data in memory. They need to move onto `api` like the
  others. The account (`/v1/me`), sign-out and wallets already go through `api`.
- **Phone-only parts:** reading SMS (first sync, **Sync now**), the SMS and notification
  permission prompts, and checking whether Android allows notifications all need a development
  build. Until then they answer "allowed" and "no new SMS".
- **Coming-soon features have real screens:**
  - **Export my data** explains the export. Its button turns on when `GET /v1/config` sends
    `features.export: true`.
  - **Unsupported providers** (`supported: false`) open a page on what still works.
- **Terms of use** (`src/app/terms.tsx`) is a plain-language first draft. It needs a legal
  review before release.
- **Links from outside the app** (push notifications) go through `src/app/+native-intent.tsx`,
  which uses the same table as in-app links (`src/utils/deep-links.ts`).
  `src/__tests__/navigation.test.ts` fails if any link points at a missing screen or a screen
  can't be reached.

## Running without a backend

Until the API exists, the dev server and the stand-in services keep their data in memory, so
everything starts over when the app reloads.

**Sign-in** lets everyone through:

- Any valid number gets a code, and any code signs in, except `000000`. That one is rejected
  so you can see the wrong-code state.
- Every sign-in starts a new account, which then goes through onboarding.
- People can sign in from the countries in `supportedCountries` in
  [src/services/config.ts](src/services/config.ts). Any other country can be chosen, but it
  shows a "not available yet" note.

**Onboarding** goes through every step:

- **SMS and notifications:** both permission prompts answer yes. Real ones need a development
  build.
- **Wallets:** the sign-in number is prefilled for the first wallet. Adding the same wallet
  twice shows the "already on your account" error. There are no "Is this you?" name
  suggestions yet, because those come from reading the SMS.
- **First sync:** it replays a scan of the dataset the pipeline was built on, over about 6
  seconds.

**Budgets, wallets and recurring payments** start from sample data in
[src/api/dev-server/catalog.ts](src/api/dev-server/catalog.ts):

- **Budgets:** four budgets. Creating, editing and deleting them works until the app reloads.
  The Budgets tab hides when `features.budgets` is off in `services/config.ts`.
- **Wallets:** two sample wallets. Balances and the balance history come from their
  transactions.
- **Recurring:** five series, one for each state. DStv and MTN Bundle are expected. Netflix is
  planned to cancel but still charging. Kwesi Ofori is waiting for review. Boomplay has
  stopped.

To see the edge cases, start the app with one of these:

| Command | Shows |
| --- | --- |
| `EXPO_PUBLIC_FORCE_UPDATE=true npx expo start` | The update-required screen |
| `EXPO_PUBLIC_EMPTY_INBOX=true npx expo start` | No MoMo SMS: an empty first sync, an empty month on Home, and no transactions |
| `EXPO_PUBLIC_DEV_API_FAILURE=true npx expo start` | Every dev server request failing: the error states with **Try again** and a request ID |
| `EXPO_PUBLIC_DEV_API_FAILURE=unavailable npx expo start` | The servers away (503): "SikaTrack is taking a break" |
| `EXPO_PUBLIC_DEV_API_FAILURE=rate_limited npx expo start` | Too many requests: the "Slow down a little" toast |
| `EXPO_PUBLIC_DEV_API_FAILURE=session_expired npx expo start` | The session gone: the "Please sign in again" dialog |
| `EXPO_PUBLIC_DEV_API_FAILURE=update_required npx expo start` | The app too old for the server: the update-required screen |
| Airplane mode | The "You're offline · showing saved data" banner over saved screens |
