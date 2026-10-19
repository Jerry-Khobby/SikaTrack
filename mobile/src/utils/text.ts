/** `['MTN MoMo', 'GhanaPay', 'Telecel']` → `MTN MoMo, GhanaPay and Telecel`. */
export function joinWithAnd(items: string[]) {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
