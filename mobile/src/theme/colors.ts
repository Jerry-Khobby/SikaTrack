/**
 * Colour tokens. Surface colours change with the colour scheme; the data and
 * status colours come from the SikaTrack dashboard (docs/ui-spec.md §3, Colours)
 * so the app and Metabase read the same.
 */

export const Colors = {
  light: {
    text: '#1B2631',
    textBody: '#4A525B',
    textSecondary: '#5E6670',
    background: '#F6F5F1',
    surface: '#FFFFFF',
    border: '#E6E3DC',
    borderInput: '#D5D1C8',
    borderFocus: '#1B2631',
    link: '#1F66BD',
    primary: '#1B2631',
    onPrimary: '#FFFFFF',
    error: '#B42F2F',
    tintBlue: '#E8EEF7',
    iconBlue: '#1F66BD',
    tintOrange: '#FCEBE3',
    iconOrange: '#C4501F',
    tintGreen: '#E6F3EE',
    iconGreen: '#137A55',
  },
  dark: {
    text: '#F2F1EC',
    textBody: '#C3C9D0',
    textSecondary: '#A3ABB5',
    background: '#11171D',
    surface: '#1B2631',
    border: '#2C3742',
    borderInput: '#3A4652',
    borderFocus: '#F2F1EC',
    link: '#7FB2F0',
    primary: '#F2F1EC',
    onPrimary: '#1B2631',
    error: '#F07A7A',
    tintBlue: '#1C2D44',
    iconBlue: '#8DB8F0',
    tintOrange: '#3A2219',
    iconOrange: '#F0956B',
    tintGreen: '#16302A',
    iconGreen: '#6FCFA5',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Brand colours that stay the same in both colour schemes (splash, logo). */
export const BrandColors = {
  ink: '#1B2631',
  gold: '#E8B33A',
  onInk: '#FFFFFF',
  onInkMuted: '#AEB6C0',
} as const;

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
