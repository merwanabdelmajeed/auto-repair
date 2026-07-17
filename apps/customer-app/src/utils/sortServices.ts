import type { Service } from '../api/services';

// Keyword order doubles as priority: oil change / smog / check-engine are
// the shop's highest-priority services and always sort first, followed by
// the rest of the curated "commonly booked" list. There's no real booking-
// frequency data to sort by, so this is a manually-curated approximation —
// same approach this list already used before check-engine/smog were added.
const POPULAR_KEYWORDS = [
  'oil change', 'oil', 'smog', 'check engine', 'engine light', 'check-engine',
  'tire rotation', 'tire', 'tyre',
  'brake', 'battery', 'ac service', 'air condition', 'a/c', 'ac',
  'alignment', 'wheel', 'filter', 'transmission', 'coolant', 'flush',
  'inspection', 'tune up', 'tune', 'spark',
  'wiper', 'belt', 'fluid', 'exhaust',
];

function rank(name: string): number {
  const lower = name.toLowerCase();
  for (let i = 0; i < POPULAR_KEYWORDS.length; i++) {
    if (lower.includes(POPULAR_KEYWORDS[i]!)) return i;
  }
  return POPULAR_KEYWORDS.length;
}

// Within the same priority tier, faster services sort first.
export function sortServices(svcs: Service[]): Service[] {
  return [...svcs].sort((a, b) =>
    rank(a.name) - rank(b.name)
    || a.durationMinutes - b.durationMinutes
    || a.name.localeCompare(b.name)
  );
}
