// VIN → year/make/model/trim via NHTSA's free vPIC decoder (same call the
// customer app makes). Admins add vehicles by VIN only: the plate lookup goes
// through a paid API and is reserved for customers.

export const VIN_LENGTH = 17;

export interface DecodedVin {
  make: string;
  model: string;
  year: string;
  trim?: string;
}

// 'unavailable' = NHTSA couldn't be reached or answered with an error (network
// failure, 5xx outage page, non-JSON body). 'not-found' = NHTSA answered but
// couldn't decode this VIN. The form words these differently so an outage
// isn't mistaken for a bad VIN.
export type VinDecodeResult =
  | { status: 'ok'; vehicle: DecodedVin }
  | { status: 'not-found' }
  | { status: 'unavailable' };

// Uppercase, alphanumerics only, capped at 17 — so pasted VINs with spaces or
// dashes still work.
export function normalizeVin(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, VIN_LENGTH);
}

// A hung request counts as 'unavailable' after this long, so callers that
// wait on the lookup (e.g. a disabled Save button) can never get stuck.
export const VIN_DECODE_TIMEOUT_MS = 5000;

export async function decodeVin(vin: string, timeoutMs = VIN_DECODE_TIMEOUT_MS): Promise<VinDecodeResult> {
  let data: { Results?: { Make?: string; Model?: string; ModelYear?: string; Trim?: string }[] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: controller.signal },
    );
    if (!res.ok) return { status: 'unavailable' };
    data = await res.json();
  } catch {
    // Network error, abort (timeout), or a non-JSON body.
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
  const r = data.Results?.[0];
  if (!r?.Make || !r?.Model || !r?.ModelYear) return { status: 'not-found' };
  return { status: 'ok', vehicle: { make: r.Make, model: r.Model, year: r.ModelYear, trim: r.Trim || undefined } };
}
