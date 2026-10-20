// Putting a link back into a list that is sorted newest-first (used by Undo
// and Restore, so a card returns to its old spot instead of the top).

/**
 * Returns a new list with `item` inserted so the list stays sorted by
 * `getTime` from newest to oldest. If the item is already in the list
 * (same id) it is replaced rather than duplicated.
 */
export function insertNewestFirst<T extends { id: number }>(
  list: T[],
  item: T,
  getTime: (item: T) => string | null,
): T[] {
  const time = (x: T) => Date.parse(getTime(x) ?? "") || 0;
  const without = list.filter((x) => x.id !== item.id);
  const index = without.findIndex((x) => time(x) < time(item));
  if (index === -1) return [...without, item];
  return [...without.slice(0, index), item, ...without.slice(index)];
}
