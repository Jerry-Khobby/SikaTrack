import Svg, { Path } from 'react-native-svg';

import type { CounterpartyKind } from '@/services/categories';

/** One icon per category `id` (docs/ui-spec.md §3, Category icons). */
const CATEGORY_PATHS: Record<string, string> = {
  food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9',
  transport: 'M6 3h12a2 2 0 0 1 2 2v12H4V5a2 2 0 0 1 2-2zM4 11h16M8 21v-4M16 21v-4',
  airtime_data: 'M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  bills: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6',
  shopping: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  health: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11zM12 9v5M9.5 11.5h5',
  education: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
  personal_care:
    'M8 3h8l1 3H7zM7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  giving: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  cash_withdrawal:
    'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  transfers_personal:
    'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M17 8h5M19.5 5.5 22 8l-2.5 2.5',
  transfers_business: 'M4 7h16v13H4zM9 7V4h6v3M4 12h16',
  income: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  cash_deposit:
    'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 9v6M9 12h6',
  refunds: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  savings: 'M5 11a7 6 0 0 1 14 0v4l-2 1v3h-3v-2h-4v2H7v-3a6 6 0 0 1-2-5zM15 9h.01',
  own_transfers: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
};

/** Counterparty kinds, used when a payment has no category of its own yet. */
const KIND_PATHS: Record<CounterpartyKind, string> = {
  person: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  merchant: 'M4 9l1.5-5h13L20 9M4 9v11h16V9',
  agent: CATEGORY_PATHS.cash_withdrawal,
  telco: CATEGORY_PATHS.airtime_data,
  bank: 'M3 10l9-6 9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18',
  own_wallet: CATEGORY_PATHS.own_transfers,
  unknown: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01',
};

export type CategoryGlyphProps = {
  categoryId?: string;
  /** Falls back to the counterparty's kind for `uncategorized` or unknown ids. */
  kind?: CounterpartyKind;
  color: string;
  size?: number;
};

export function CategoryGlyph({ categoryId, kind = 'unknown', color, size = 20 }: CategoryGlyphProps) {
  const d = (categoryId && CATEGORY_PATHS[categoryId]) || KIND_PATHS[kind];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

/** The icon for a counterparty kind on its own, e.g. on the detail screen's name chip. */
export function CounterpartyGlyph({ kind, color, size = 16 }: { kind: CounterpartyKind; color: string; size?: number }) {
  return <CategoryGlyph kind={kind} color={color} size={size} />;
}
