import type { Transaction } from '@/services/transactions';

import { formatDayHeader } from './dates';
import { formatMoney } from './format';
import { fromPesewas, toPesewas } from './money';

export type DaySection = {
  /** `2026-10-20` */
  day: string;
  /** `Today`, `Yesterday`, `Fri 16 Oct` */
  title: string;
  /** That day's money out, own transfers left out. */
  total: string;
  data: Transaction[];
};

/** Groups a newest-first list into days, each with its money out (docs/ui-spec.md S13). */
export function groupByDay(items: Transaction[], now = Date.now()): DaySection[] {
  const sections: DaySection[] = [];
  for (const transaction of items) {
    const day = transaction.occurredAt.slice(0, 10);
    let section = sections[sections.length - 1];
    if (!section || section.day !== day) {
      section = { day, title: formatDayHeader(transaction.occurredAt, now), total: '', data: [] };
      sections.push(section);
    }
    section.data.push(transaction);
  }
  for (const section of sections) {
    const out = section.data
      .filter((t) => t.direction === 'out' && !t.isOwnTransfer)
      .reduce((sum, t) => sum + toPesewas(t.amount), 0);
    section.total = formatMoney(fromPesewas(out), section.data[0]?.currency ?? '');
  }
  return sections;
}
