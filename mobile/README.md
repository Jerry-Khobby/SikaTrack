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
├── app/                 Pages: expo-router routes. Each one fills a template with real data
├── components/
│   ├── atoms/           Smallest parts: text, view, icon, button, input, badge
│   ├── molecules/       A few atoms doing one job: money amount, category chip, labelled input
│   ├── organisms/       Screen sections: transaction list, budget card, sync strip
│   └── templates/       Page layouts that place organisms, with no real content
├── hooks/               Shared React hooks (colour scheme, theme, countdown)
├── services/            Calls to the backend (stand-ins until the API is wired in)
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

## Running without a backend

Until the API exists, each file in [src/services/](src/services/) stands in for its endpoints
and keeps its data in memory, so everything starts over when the app reloads. Screens only
read data through these files, so wiring in the real API changes nothing else.

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
| `EXPO_PUBLIC_EMPTY_INBOX=true npx expo start` | A phone with no MoMo SMS at the first sync |
