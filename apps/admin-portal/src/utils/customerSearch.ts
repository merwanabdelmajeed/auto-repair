import type { Customer } from '../api/customers';

// Matches a customer against the admin search box: name or email (substring,
// case-insensitive), or phone. Phone matching compares digits only, so
// "949555", "(949) 555" and "949-555-1234" all find "(949) 555-1234". It only
// applies to digit-only queries ("jane2" shouldn't match every phone with a
// 2 in it). Phones aren't unique — every customer sharing a number matches,
// and the admin picks the intended one from the results.
export function matchesCustomerSearch(c: Customer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (c.email.toLowerCase().includes(q)) return true;
  if (`${c.firstName} ${c.lastName}`.toLowerCase().includes(q)) return true;

  const digits = q.replace(/\D/g, '');
  if (digits && !/[a-z]/.test(q) && c.phone) {
    return c.phone.replace(/\D/g, '').includes(digits);
  }
  return false;
}
