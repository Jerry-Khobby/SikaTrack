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
├── theme/               Design tokens: colours, spacing, fonts
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
- **Account, wallet and config stand-ins:** `services/me.ts`, `services/wallets.ts`,
  `services/auth.ts` and `services/config.ts` still keep their data in memory. They need to
  move onto `api` like the others.

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

To see the edge cases, start the app with one of these:

| Command | Shows |
| --- | --- |
| `EXPO_PUBLIC_FORCE_UPDATE=true npx expo start` | The update-required screen |
| `EXPO_PUBLIC_EMPTY_INBOX=true npx expo start` | No MoMo SMS: an empty first sync, an empty month on Home, and no transactions |
| `EXPO_PUBLIC_DEV_API_FAILURE=true npx expo start` | Every dev server request failing: the error states with **Try again** and a request ID |
