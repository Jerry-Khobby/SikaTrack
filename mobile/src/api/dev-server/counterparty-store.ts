/**
 * What the user changed about a counterparty (`PATCH /v1/counterparties/{id}`):
 * its alias and its default category. Held in memory like the rest of the dev
 * server, and laid over the dataset's transactions every time they're read, so
 * the changes survive the dataset being rebuilt (e.g. after adding a wallet).
 */
import type { ApiCategoryRef, ApiTransaction } from '../types';
import { categoryRef } from './catalog';

type Choice = { alias: string | null; defaultCategory: string | null };

let choices = new Map<string, Choice>();

/** Each transaction as the dataset made it, before any choice was laid over it. */
const originals = new WeakMap<ApiTransaction, { name: string; category: ApiCategoryRef; source: ApiTransaction['category_source'] }>();

function original(t: ApiTransaction) {
  let o = originals.get(t);
  if (!o) {
    o = { name: t.counterparty.name, category: t.category, source: t.category_source };
    originals.set(t, o);
  }
  return o;
}

export function counterpartyChoice(id: string): Choice {
  return choices.get(id) ?? { alias: null, defaultCategory: null };
}

/** The name the SMS gave this counterparty, before any alias. */
export function originalName(t: ApiTransaction) {
  return original(t).name;
}

export function setCounterpartyChoice(id: string, patch: Partial<Choice>) {
  choices.set(id, { ...counterpartyChoice(id), ...patch });
}

/**
 * Shows each alias in place of the SMS name, and files payments under the
 * default category unless the user set that payment's category themselves.
 */
export function applyCounterpartyChoices(transactions: ApiTransaction[]) {
  if (choices.size === 0) return;
  for (const t of transactions) {
    const choice = choices.get(t.counterparty.id);
    if (!choice) continue;
    const o = original(t);
    const name = choice.alias ?? o.name;
    if (t.counterparty.name !== name) t.counterparty = { ...t.counterparty, name };
    if (t.category_source === 'user') continue;
    if (choice.defaultCategory) {
      t.category = categoryRef(choice.defaultCategory);
      t.category_source = 'counterparty_default';
    } else if (t.category_source === 'counterparty_default' && o.source !== 'counterparty_default') {
      t.category = o.category;
      t.category_source = o.source;
    }
  }
}

/** Forgets every alias and default category, e.g. between tests. */
export function resetCounterpartyStore() {
  choices = new Map();
}
