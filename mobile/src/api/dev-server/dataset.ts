/**
 * The dev server's sample history: about five months of MoMo transactions,
 * dated relative to today and spread over the wallets added in onboarding.
 * Generated with a fixed seed so every run looks the same. Start the app with
 * EXPO_PUBLIC_EMPTY_INBOX=true for an account with no transactions.
 */
import { listWallets } from '@/services/wallets';
import { fromPesewas } from '@/utils/money';

import type { ApiTransactionDetail, TransactionType } from '../types';
import { COUNTERPARTIES, RECURRING_SERIES, SALARY, categoryRef, type CounterpartySeed } from './catalog';

export type DevWallet = {
  id: string;
  provider: string;
  phoneNumber: string;
  accountName: string;
  label: string | null;
  createdAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 150;
const SEED = 20261020;

/** Used when the account has no wallets yet, e.g. when a screen is opened on its own. */
const FALLBACK_WALLETS: DevWallet[] = [
  {
    id: 'wal_dev_main',
    provider: 'mtn_momo',
    phoneNumber: '+233241234567',
    accountName: 'ACCOUNT HOLDER',
    label: 'Main MoMo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wal_dev_savings',
    provider: 'ghanapay',
    phoneNumber: '+233205550142',
    accountName: 'ACCOUNT HOLDER',
    label: 'Savings wallet',
    createdAt: new Date().toISOString(),
  },
];

const SENDER_STYLE: Record<string, 'mtn' | 'ghanapay'> = { mtn_momo: 'mtn', ghanapay: 'ghanapay' };

/** A small seeded random generator (mulberry32). */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Draft = {
  at: number;
  wallet: DevWallet;
  direction: 'in' | 'out';
  type: TransactionType;
  amount: number;
  fee: number;
  category: string;
  counterparty: { id: string; name: string; kind: ApiTransactionDetail['counterparty']['kind'] };
  reference: string | null;
  explanation: string;
  isOwnTransfer?: boolean;
  recurringId?: string;
};

function smsText(draft: Draft, balance: number, providerTxnId: string) {
  const amount = fromPesewas(draft.amount);
  const fee = fromPesewas(draft.fee);
  const bal = fromPesewas(balance);
  const name = draft.counterparty.name.toUpperCase();
  const ref = draft.reference ? ` Reference: ${draft.reference}.` : '';
  if (SENDER_STYLE[draft.wallet.provider] === 'ghanapay') {
    return draft.direction === 'in'
      ? `You have received GHS ${amount} from ${name}. Your GhanaPay balance is GHS ${bal}.${ref} Transaction ID: ${providerTxnId}.`
      : `You have paid GHS ${amount} to ${name}. Fee: GHS ${fee}. Your GhanaPay balance is GHS ${bal}.${ref} Transaction ID: ${providerTxnId}.`;
  }
  if (draft.direction === 'in') {
    const verb = draft.type === 'cashin' ? 'Cash In received' : 'Payment received';
    return `${verb} for GHS ${amount} from ${name}. Current Balance: GHS ${bal}. Available Balance: GHS ${bal}.${ref} Transaction ID: ${providerTxnId}.`;
  }
  if (draft.type === 'cashout') {
    return `Cash Out made for GHS ${amount} to ${name}. Current Balance: GHS ${bal}. Financial Transaction Id: ${providerTxnId}. Fee charged: GHS ${fee}.`;
  }
  return `Payment made for GHS ${amount} to ${name}. Current Balance: GHS ${bal}.${ref} Transaction ID: ${providerTxnId}. Fee charged: GHS ${fee} TAX charged: GHS 0.00.`;
}

function generate(wallets: DevWallet[], now: number): ApiTransactionDetail[] {
  if (process.env.EXPO_PUBLIC_EMPTY_INBOX === 'true') return [];

  const random = seededRandom(SEED);
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => Math.round((min + random() * (max - min)) * 2) * 50;
  const main = wallets[0];
  const second = wallets[1];
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const totalWeight = COUNTERPARTIES.reduce((sum, c) => sum + c.weight, 0);
  const weighted = (): CounterpartySeed => {
    let roll = random() * totalWeight;
    for (const seed of COUNTERPARTIES) {
      roll -= seed.weight;
      if (roll <= 0) return seed;
    }
    return COUNTERPARTIES[0];
  };

  const drafts: Draft[] = [];
  for (let back = HISTORY_DAYS; back >= 0; back--) {
    const day = today - back * DAY_MS;
    const date = new Date(day);
    const minute = (hour: number) => day + hour * 3600000 + Math.floor(random() * 50) * 60000;

    for (const series of RECURRING_SERIES) {
      const due =
        series.intervalDays === 1 || (series.rhythm === 'monthly' && date.getUTCDate() === 15);
      if (due) {
        drafts.push({
          at: minute(series.hour),
          wallet: main,
          direction: 'out',
          type: series.type,
          amount: series.amount * 100,
          fee: 0,
          category: series.category,
          counterparty: series.counterparty,
          reference: null,
          explanation: series.explanation,
          recurringId: series.id,
        });
      }
    }

    if (date.getUTCDate() === SALARY.day) {
      drafts.push({
        at: minute(10),
        wallet: main,
        direction: 'in',
        type: 'transfer',
        amount: SALARY.amount * 100,
        fee: 0,
        category: 'income',
        counterparty: SALARY.counterparty,
        reference: 'salary',
        explanation: SALARY.explanation,
      });
    }

    if (second && back % 11 === 3) {
      const amount = between(40, 120);
      const at = minute(19);
      drafts.push({
        at,
        wallet: main,
        direction: 'out',
        type: 'transfer',
        amount,
        fee: 0,
        category: 'own_transfers',
        counterparty: { id: `cpt_dev_${second.id}`, name: second.label ?? 'Own wallet', kind: 'own_wallet' },
        reference: 'savings',
        explanation: 'Money between your own wallets',
        isOwnTransfer: true,
      });
      drafts.push({
        at: at + 60000,
        wallet: second,
        direction: 'in',
        type: 'transfer',
        amount,
        fee: 0,
        category: 'own_transfers',
        counterparty: { id: `cpt_dev_${main.id}`, name: main.label ?? 'Own wallet', kind: 'own_wallet' },
        reference: 'savings',
        explanation: 'Money between your own wallets',
        isOwnTransfer: true,
      });
    }

    const count = Math.floor(random() * 4.6);
    for (let i = 0; i < count; i++) {
      const seed = weighted();
      const amount = between(seed.min, seed.max);
      const useSecond = second && seed.type === 'merchant' && random() < 0.15;
      drafts.push({
        at: minute(8 + Math.floor(random() * 13)),
        wallet: useSecond ? second : main,
        direction: seed.direction,
        type: seed.type,
        amount,
        fee: seed.feeRate ? Math.round(amount * seed.feeRate) : 0,
        category: seed.category,
        counterparty: { id: seed.id, name: seed.name, kind: seed.kind },
        reference: seed.reference ? `${seed.reference} wk${Math.ceil(date.getUTCDate() / 7)}` : null,
        explanation: seed.explanation,
      });
    }
  }

  const visible = drafts.filter((draft) => draft.at <= now).sort((a, b) => a.at - b.at);

  // Replay in time order, keeping each wallet's balance, and top up with a cash
  // deposit whenever a payment would take it below zero.
  const balances = new Map(wallets.map((wallet, index) => [wallet.id, index === 0 ? 35000 : 4000]));
  const agent = COUNTERPARTIES.find((seed) => seed.type === 'cashout') ?? COUNTERPARTIES[0];
  const replay: Draft[] = [];
  for (const draft of visible) {
    const balance = balances.get(draft.wallet.id) ?? 0;
    if (draft.direction === 'out' && balance < draft.amount + draft.fee) {
      const topUp = draft.amount + draft.fee - balance + between(100, 300);
      replay.push({
        at: draft.at - 30 * 60000,
        wallet: draft.wallet,
        direction: 'in',
        type: 'cashin',
        amount: topUp,
        fee: 0,
        category: 'cash_deposit',
        counterparty: { id: agent.id, name: agent.name, kind: 'agent' },
        reference: null,
        explanation: 'Cash-ins at an agent count as Cash Deposit',
      });
      balances.set(draft.wallet.id, balance + topUp);
    }
    replay.push(draft);
    const next = balances.get(draft.wallet.id) ?? 0;
    balances.set(
      draft.wallet.id,
      draft.direction === 'in' ? next + draft.amount : next - draft.amount - draft.fee,
    );
  }

  const running = new Map(wallets.map((wallet, index) => [wallet.id, index === 0 ? 35000 : 4000]));
  const transactions = replay.map((draft, index): ApiTransactionDetail => {
    const before = running.get(draft.wallet.id) ?? 0;
    const after = draft.direction === 'in' ? before + draft.amount : before - draft.amount - draft.fee;
    running.set(draft.wallet.id, after);
    const providerTxnId = String(70000000000 + Math.floor(random() * 9999999999));
    return {
      id: `txn_dev_${String(index + 1).padStart(5, '0')}`,
      status: 'final',
      occurred_at: new Date(draft.at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      provider: draft.wallet.provider,
      wallet_id: draft.wallet.id,
      type: draft.type,
      direction: draft.direction,
      amount: fromPesewas(draft.amount),
      fee: fromPesewas(draft.fee),
      tax: '0.00',
      total_cost: fromPesewas(draft.fee),
      balance_after: fromPesewas(after),
      currency: 'GHS',
      category: categoryRef(draft.category),
      category_source: 'rule',
      counterparty: draft.counterparty,
      reference: draft.reference,
      note: null,
      is_own_transfer: Boolean(draft.isOwnTransfer),
      recurring_id: draft.recurringId ?? null,
      flags: [],
      sms_text: smsText(draft, after, providerTxnId),
      sms_count: 1,
      category_explanation: draft.explanation,
      provider_txn_id: providerTxnId,
    };
  });

  const newestFirst = transactions.reverse();

  // The latest payment is still being processed by the pipeline.
  if (newestFirst[0] && Date.parse(newestFirst[0].occurred_at) > now - DAY_MS) {
    newestFirst[0].status = 'provisional';
  }
  // A couple of older payments carry the flags the detail screen explains.
  const merchants = newestFirst.filter((t) => t.type === 'merchant' && Date.parse(t.occurred_at) < now - 2 * DAY_MS);
  if (merchants[1]) merchants[1].flags = ['balance_gap'];
  if (merchants[3]) {
    merchants[3].flags = ['duplicate_sms_merged'];
    merchants[3].sms_count = 2;
  }
  return newestFirst;
}

let cache: { key: string; wallets: DevWallet[]; transactions: ApiTransactionDetail[] } | undefined;

/** The wallets and transactions (newest first) every dev endpoint reads from. */
export async function getDataset() {
  const added = await listWallets();
  const wallets: DevWallet[] = added.length
    ? added.map((wallet) => ({ ...wallet, createdAt: new Date().toISOString() }))
    : FALLBACK_WALLETS;
  const key = `${process.env.EXPO_PUBLIC_EMPTY_INBOX}|${wallets.map((w) => `${w.id}:${w.label}`).join(',')}`;
  if (!cache || cache.key !== key) {
    cache = { key, wallets, transactions: generate(wallets, Date.now()) };
  }
  return cache;
}

/** Forgets the generated data, e.g. between tests. */
export function resetDataset() {
  cache = undefined;
}
