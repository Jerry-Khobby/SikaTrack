/**
 * Colour tokens. Surface colours change with the colour scheme; the data and
 * status colours come from the SikaTrack dashboard (docs/ui-spec.md §3, Colours)
 * so the app and Metabase read the same.
 */

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Light-theme values from the spec. Each still needs a dark-theme twin with the same meaning. */
export const DataColors = {
  moneyOut: '#2a78d6',
  moneyIn: '#eb6834',
  reference: '#1B2631',
  good: '#0ca30c',
  bad: '#d03b3b',
  warning: '#eda100',
  categories: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  categoryOther: '#b9b8b2',
} as const;
