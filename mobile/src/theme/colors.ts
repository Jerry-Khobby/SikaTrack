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
    tintRed: '#FBE4E4',
    iconRed: '#B8302F',
    tintAmber: '#FFF3D6',
    iconAmber: '#8A5A00',
    tintSuccess: '#E3F3E3',
    iconSuccess: '#0A6E0A',
    avatar: '#EDEFF2',
    unreadRow: '#FBFAF7',
    unreadDot: '#2a78d6',
    moneyIn: '#C4501F',
    skeleton: '#E6E3DC',
    dashed: '#A9A498',
    statusGood: '#0ca30c',
    statusWarning: '#eda100',
    statusBad: '#d03b3b',
    overlay: 'rgba(27, 38, 49, 0.5)',
    /** The ink hero cards (Home's money out, the Budgets summary). */
    hero: '#1B2631',
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
    tintRed: '#3A1E20',
    iconRed: '#F28B8B',
    tintAmber: '#3A3017',
    iconAmber: '#F0C060',
    tintSuccess: '#16301C',
    iconSuccess: '#7BD87B',
    avatar: '#26313B',
    unreadRow: '#18212A',
    unreadDot: '#5B9BE6',
    moneyIn: '#F0956B',
    skeleton: '#26313B',
    dashed: '#5B6570',
    statusGood: '#3CC23C',
    statusWarning: '#F0B429',
    statusBad: '#E06565',
    overlay: 'rgba(0, 0, 0, 0.6)',
    /** Lifted off the dark cards, so the hero still stands out in dark mode. */
    hero: '#2A3846',
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
  /** The small stat tiles and loading blocks inside the brand-ink hero card. */
  inkTile: 'rgba(255, 255, 255, 0.07)',
  inkSkeleton: 'rgba(255, 255, 255, 0.14)',
  /** Status on brand ink: spending down is good, up is bad. */
  goodOnInk: '#7BE07B',
  goodOnInkTint: 'rgba(12, 163, 12, 0.18)',
  badOnInk: '#FF9B9B',
  badOnInkTint: 'rgba(208, 59, 59, 0.22)',
  moneyInOnInk: '#F59A6E',
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

export type DataPalette = {
  moneyOut: string;
  moneyIn: string;
  reference: string;
  good: string;
  bad: string;
  warning: string;
  categories: readonly string[];
  categoryOther: string;
};

/** Light-theme chart colours from the spec. Screens read them through useDataColors(). */
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

/**
 * The dark-theme twins: the same hues, with orange, yellow and pink darkened until
 * the set passes the palette checks (lightness, colour-blind separation, contrast)
 * on the dark card colour, #1B2631.
 */
export const DataColorsDark: DataPalette = {
  moneyOut: '#2a78d6',
  moneyIn: '#d55a26',
  reference: '#F2F1EC',
  good: '#3CC23C',
  bad: '#E06565',
  warning: '#c08600',
  categories: ['#2a78d6', '#d55a26', '#1baf7a', '#c08600', '#cf5f93'],
  categoryOther: '#8a8983',
};
