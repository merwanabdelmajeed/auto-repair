// US postal address, split into the standard USPS lines. Every field is an
// optional plain string — no validation beyond that.
export const ADDRESS_FIELDS = ['line1', 'line2', 'city', 'state', 'postalCode'] as const;
export type Address = Partial<Record<(typeof ADDRESS_FIELDS)[number], string>>;

// Keeps only the known fields that are non-empty strings, trimmed. Returns
// undefined when nothing is left, so callers can REMOVE the attribute instead
// of storing an empty map.
export function sanitizeAddress(value: unknown): Address | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const address: Address = {};
  for (const key of ADDRESS_FIELDS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) address[key] = v.trim();
  }
  return Object.keys(address).length > 0 ? address : undefined;
}

// Request-body check for endpoints that accept an address: it may be omitted
// (leave unchanged), null (clear it), or an object. Anything else is invalid.
export function isAddressInput(value: unknown): boolean {
  return value === null || (typeof value === 'object' && !Array.isArray(value));
}
