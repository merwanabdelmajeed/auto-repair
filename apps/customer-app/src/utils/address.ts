// US postal address, split into the standard USPS lines. Every field is a
// plain string with no validation — the whole address is optional at signup.
export interface Address {
  line1?: string;      // street address
  line2?: string;      // apt / suite / unit
  city?: string;
  state?: string;
  postalCode?: string; // ZIP code
}

// Trims every field and drops empty ones; returns undefined when nothing was
// entered so an all-blank form doesn't produce an empty address record.
export function cleanAddress(address: Address): Address | undefined {
  const cleaned: Address = {};
  for (const key of ['line1', 'line2', 'city', 'state', 'postalCode'] as const) {
    const value = address[key]?.trim();
    if (value) cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

// One-line display form: "1 Main St, Apt 2, Irvine, CA 92618"; null when empty.
export function formatAddress(a: Address | null | undefined): string | null {
  if (!a) return null;
  const stateZip = [a.state, a.postalCode].filter(Boolean).join(' ');
  const parts = [a.line1, a.line2, a.city, stateZip].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}
