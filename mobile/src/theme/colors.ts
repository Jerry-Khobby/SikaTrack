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
    tintNeutral: '#EDEAE3',
    tintGold: '#FFF6DC',
    borderGold: '#E8B33A',
    surfaceSelected: '#F1F4F8',
    chip: '#F1EFEA',
    divider: '#EFECE6',
    track: '#DDD9D0',
    toggleOff: '#CFCBC2',
    textDisabled: '#8A9098',
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
    tintNeutral: '#232D37',
    tintGold: '#3A3220',
    borderGold: '#B88A20',
    surfaceSelected: '#22324A',
    chip: '#26313B',
    divider: '#26313B',
    track: '#2C3742',
    toggleOff: '#3A4652',
    textDisabled: '#6B7580',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Brand colours that stay the same in both colour schemes (splash, logo). */
export const BrandColors = {
  ink: '#1B2631',
  gold: '#E8B33A',
  onInk: '#FFFFFF',
  onInkMuted: '#AEB6C0',
  onInkSoft: '#C9D0D8',
} as const;

/**
 * Each provider's own colour, used only in its small wallet badge (docs/ui-spec.md §3).
 * Keyed by the provider `code` from `GET /v1/config`; a provider missing here gets a
 * neutral badge with its initials.
 */
export const ProviderBrands: Record<string, { background: string; text: string; short: string }> = {
  mtn_momo: { background: '#FFCC00', text: '#1B2631', short: 'MTN' },
  ghanapay: { background: '#0B5D4B', text: '#FFFFFF', short: 'GP' },
};

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
