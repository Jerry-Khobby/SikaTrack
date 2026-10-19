# SikaTrack mobile

The SikaTrack Android app, built with Expo and React Native. Every screen and the endpoint
behind it is described in [docs/ui-spec.md](docs/ui-spec.md).

## Running it

```bash
npm install
npx expo start
```

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

## Sign-in without a backend

Until the API exists, [src/services/](src/services/) lets everyone through: any Ghanaian number
gets a code and any code signs in, except `000000`, which is rejected so the wrong-code state can
be seen. The countries people can sign in from come from `supportedCountries` in
[src/services/config.ts](src/services/config.ts); every other country can be chosen but shows a
"not available yet" note. To see the update-required screen, start with `EXPO_PUBLIC_FORCE_UPDATE=true npx expo start`.

Each layer has an `index.ts` that re-exports its components, so imports read
`import { ThemedText } from '@/components/atoms';`. File names are kebab-case
(`money-amount.tsx`), component names PascalCase (`MoneyAmount`).
