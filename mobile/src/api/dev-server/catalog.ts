/**
 * What the dev server's sample data is made from: the category list from
 * `dw.dim_category`, and the people and shops a MoMo user in Accra typically pays.
 * None of this reaches a screen except through an API response.
 */
import type { ApiCategoryRef, CounterpartyKind, TransactionType } from '../types';

export const CATEGORIES: (ApiCategoryRef & { user_selectable: boolean })[] = [
  { id: 'food', name: 'Food', group: 'spending', user_selectable: true },
  { id: 'transport', name: 'Transport', group: 'spending', user_selectable: true },
  { id: 'airtime_data', name: 'Airtime/Data', group: 'spending', user_selectable: true },
  { id: 'bills', name: 'Bills', group: 'spending', user_selectable: true },
  { id: 'shopping', name: 'Shopping', group: 'spending', user_selectable: true },
  { id: 'health', name: 'Health', group: 'spending', user_selectable: true },
  { id: 'education', name: 'Education', group: 'spending', user_selectable: true },
  { id: 'personal_care', name: 'Personal Care', group: 'spending', user_selectable: true },
  { id: 'giving', name: 'Giving', group: 'spending', user_selectable: true },
  { id: 'cash_withdrawal', name: 'Cash Withdrawal', group: 'spending', user_selectable: true },
  { id: 'transfers_personal', name: 'Transfers-Personal', group: 'spending', user_selectable: true },
  { id: 'transfers_business', name: 'Transfers-Business', group: 'spending', user_selectable: true },
  { id: 'income', name: 'Income', group: 'money_in', user_selectable: true },
  { id: 'cash_deposit', name: 'Cash Deposit', group: 'money_in', user_selectable: true },
  { id: 'refunds', name: 'Refunds', group: 'money_in', user_selectable: true },
  { id: 'savings', name: 'Savings', group: 'own_money', user_selectable: true },
  { id: 'own_transfers', name: 'Own Transfers', group: 'own_money', user_selectable: false },
  { id: 'uncategorized', name: 'Uncategorized', group: 'spending', user_selectable: false },
];

export function categoryRef(id: string): ApiCategoryRef {
  const category = CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
  return { id: category.id, name: category.name, group: category.group };
}

export type CounterpartySeed = {
  id: string;
  name: string;
  kind: CounterpartyKind;
  category: string;
  type: TransactionType;
  direction: 'in' | 'out';
  /** Amount range in whole cedis. */
  min: number;
  max: number;
  /** How often it turns up among random payments. */
  weight: number;
  /** Fee as a fraction of the amount (MoMo charges about 1% on transfers and cash-outs). */
  feeRate?: number;
  reference?: string;
  explanation: string;
};

/** Random day-to-day payments and receipts. */
export const COUNTERPARTIES: CounterpartySeed[] = [
  { id: 'cpt_dev_laundry', name: 'Sunshine Laundry', kind: 'merchant', category: 'personal_care', type: 'merchant', direction: 'out', min: 25, max: 60, weight: 2, reference: 'laundry', explanation: "Your reference mentions 'laundry'" },
  { id: 'cpt_dev_papaye', name: 'Papaye Osu', kind: 'merchant', category: 'food', type: 'merchant', direction: 'out', min: 35, max: 95, weight: 5, explanation: 'Papaye Osu is a restaurant' },
  { id: 'cpt_dev_chopbar', name: 'Chop Bar Osu', kind: 'merchant', category: 'food', type: 'merchant', direction: 'out', min: 12, max: 40, weight: 6, explanation: 'Chop Bar Osu is a restaurant' },
  { id: 'cpt_dev_melcom', name: 'Melcom Shop', kind: 'merchant', category: 'shopping', type: 'merchant', direction: 'out', min: 40, max: 220, weight: 2, explanation: 'Melcom is a shop' },
  { id: 'cpt_dev_shoprite', name: 'Shoprite Junction Mall', kind: 'merchant', category: 'shopping', type: 'merchant', direction: 'out', min: 60, max: 260, weight: 1, explanation: 'Shoprite is a supermarket' },
  { id: 'cpt_dev_yango', name: 'Yango Rides', kind: 'merchant', category: 'transport', type: 'merchant', direction: 'out', min: 15, max: 45, weight: 5, feeRate: 0.01, explanation: 'Yango is a ride-hailing service' },
  { id: 'cpt_dev_trotro', name: 'Kaneshie Station', kind: 'merchant', category: 'transport', type: 'merchant', direction: 'out', min: 5, max: 15, weight: 3, explanation: 'Payments at stations count as Transport' },
  { id: 'cpt_dev_ernest', name: 'Ernest Chemist', kind: 'merchant', category: 'health', type: 'merchant', direction: 'out', min: 20, max: 90, weight: 1, explanation: 'Ernest Chemist is a pharmacy' },
  { id: 'cpt_dev_ecg', name: 'ECG Prepaid', kind: 'merchant', category: 'bills', type: 'merchant', direction: 'out', min: 50, max: 150, weight: 1, reference: 'prepaid', explanation: 'ECG is an electricity bill' },
  { id: 'cpt_dev_church', name: 'Grace Chapel', kind: 'merchant', category: 'giving', type: 'merchant', direction: 'out', min: 20, max: 50, weight: 1, reference: 'offering', explanation: "Your reference mentions 'offering'" },
  { id: 'cpt_dev_adom', name: 'Adom MoMo Agent', kind: 'agent', category: 'cash_withdrawal', type: 'cashout', direction: 'out', min: 100, max: 400, weight: 2, feeRate: 0.01, explanation: 'Cash-outs at an agent count as Cash Withdrawal' },
  { id: 'cpt_dev_kwame', name: 'Kwame Express Agent', kind: 'agent', category: 'cash_withdrawal', type: 'cashout', direction: 'out', min: 50, max: 300, weight: 1, feeRate: 0.01, explanation: 'Cash-outs at an agent count as Cash Withdrawal' },
  { id: 'cpt_dev_mum', name: 'Mum', kind: 'person', category: 'transfers_personal', type: 'transfer', direction: 'out', min: 50, max: 200, weight: 2, feeRate: 0.01, explanation: 'Money sent to a person counts as Transfers-Personal' },
  { id: 'cpt_dev_kojo', name: 'Kojo Asante', kind: 'person', category: 'transfers_personal', type: 'transfer', direction: 'out', min: 20, max: 100, weight: 2, feeRate: 0.01, explanation: 'Money sent to a person counts as Transfers-Personal' },
  { id: 'cpt_dev_airtime', name: 'MTN Airtime', kind: 'telco', category: 'airtime_data', type: 'airtime', direction: 'out', min: 5, max: 20, weight: 2, explanation: 'Airtime top-ups count as Airtime/Data' },
  { id: 'cpt_dev_ama', name: 'Ama Serwaa', kind: 'person', category: 'income', type: 'transfer', direction: 'in', min: 20, max: 150, weight: 1, explanation: 'Money from a person counts as Income' },
];

export type SeriesSeed = {
  id: string;
  label: string;
  counterparty: { id: string; name: string; kind: CounterpartyKind };
  category: string;
  type: TransactionType;
  rhythm: 'daily' | 'weekly' | 'monthly';
  intervalDays: number;
  /** Whole cedis. */
  amount: number;
  hour: number;
  /** Monthly series: the day of the month it charges. */
  dayOfMonth?: number;
  /** Weekly series: the weekday it charges (0 = Sunday). */
  weekday?: number;
  /** Days ago of the first payment. */
  firstBack: number;
  /** Days ago of the last payment; 0 while it's still charging. */
  lastBack: number;
  /** The user's decision so far (`user_state`); null means not reviewed. */
  userState: 'expected' | 'cancel_planned' | null;
  explanation: string;
};

/**
 * Payments that repeat on a rhythm, so recurring detection has something to
 * find: one of each rhythm, one the user means to cancel that's still
 * charging, one that stopped, and one waiting for review.
 */
export const RECURRING_SERIES: SeriesSeed[] = [
  {
    id: 'rec_dev_bundle',
    label: 'Daily GHS 3 bundle',
    counterparty: { id: 'cpt_dev_bundle', name: 'MTN Bundle', kind: 'telco' },
    category: 'airtime_data',
    type: 'airtime',
    rhythm: 'daily',
    intervalDays: 1,
    amount: 3,
    hour: 7,
    firstBack: 150,
    lastBack: 0,
    userState: 'expected',
    explanation: 'Data bundles count as Airtime/Data',
  },
  {
    id: 'rec_dev_dstv',
    label: 'TV subscription',
    counterparty: { id: 'cpt_dev_dstv', name: 'DStv Compact', kind: 'merchant' },
    category: 'bills',
    type: 'merchant',
    rhythm: 'monthly',
    intervalDays: 30,
    amount: 120,
    hour: 9,
    dayOfMonth: 1,
    firstBack: 150,
    lastBack: 0,
    userState: 'expected',
    explanation: 'DStv is a TV subscription',
  },
  {
    id: 'rec_dev_netflix',
    label: 'Streaming',
    counterparty: { id: 'cpt_dev_netflix', name: 'Netflix', kind: 'merchant' },
    category: 'bills',
    type: 'merchant',
    rhythm: 'monthly',
    intervalDays: 30,
    amount: 25,
    hour: 6,
    dayOfMonth: 15,
    firstBack: 150,
    lastBack: 0,
    userState: 'cancel_planned',
    explanation: 'Netflix is a subscription',
  },
  {
    id: 'rec_dev_kwesi',
    label: 'Weekly transfer',
    counterparty: { id: 'cpt_dev_kwesi', name: 'Kwesi Ofori', kind: 'person' },
    category: 'transfers_personal',
    type: 'transfer',
    rhythm: 'weekly',
    intervalDays: 7,
    amount: 50,
    hour: 18,
    weekday: 5,
    firstBack: 40,
    lastBack: 0,
    userState: null,
    explanation: 'Money sent to a person counts as Transfers-Personal',
  },
  {
    id: 'rec_dev_boomplay',
    label: 'Music',
    counterparty: { id: 'cpt_dev_boomplay', name: 'Boomplay Premium', kind: 'merchant' },
    category: 'bills',
    type: 'merchant',
    rhythm: 'monthly',
    intervalDays: 30,
    amount: 10,
    hour: 8,
    dayOfMonth: 3,
    firstBack: 150,
    lastBack: 75,
    userState: 'expected',
    explanation: 'Boomplay is a music subscription',
  },
];

/** Monthly income from an employer. */
export const SALARY = {
  counterparty: { id: 'cpt_dev_kbv', name: 'Kofi Boateng Ventures', kind: 'merchant' as const },
  amount: 1400,
  day: 25,
  explanation: 'Regular payments from Kofi Boateng Ventures count as Income',
};

/** Budgets the sample user has set (`PUT /v1/budgets/{category_id}`). */
export const BUDGETS = [
  { category: 'cash_withdrawal', limit: '1000.00' },
  { category: 'food', limit: '700.00' },
  { category: 'airtime_data', limit: '450.00' },
  { category: 'transport', limit: '400.00' },
];

export const LOW_BALANCE_THRESHOLD = '5.00';
