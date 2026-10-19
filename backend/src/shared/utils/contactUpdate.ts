import { sanitizeAddress, isAddressInput, type Address } from './address.js';

export interface ContactUpdate {
  sets: string[];                    // "phone = :phone", …
  removes: string[];                 // "address" when the address is cleared
  values: Record<string, unknown>;   // ExpressionAttributeValues for `sets`
  result: { phone?: string; address?: Address | null };
  changed: boolean;                  // false when the body had neither field
}

// Shared by PUT /users/me (customer edits own profile) and
// PATCH /customers/{id} (admin edits a customer): reads the optional `phone`
// and `address` from a request body into UpdateExpression parts.
//   phone:   omitted = unchanged; otherwise a non-empty string (required at
//            signup), no format or uniqueness checks.
//   address: omitted = unchanged; null or all-blank = cleared (REMOVE);
//            otherwise only the known string fields are kept.
export function parseContactUpdate(body: Record<string, unknown>): ContactUpdate | { error: string } {
  const update: ContactUpdate = { sets: [], removes: [], values: {}, result: {}, changed: false };

  if (body.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!phone) return { error: 'phone cannot be empty' };
    update.sets.push('phone = :phone');
    update.values[':phone'] = phone;
    update.result.phone = phone;
    update.changed = true;
  }

  if (body.address !== undefined) {
    if (!isAddressInput(body.address)) return { error: 'address must be an object or null' };
    const address = sanitizeAddress(body.address);
    if (address) {
      update.sets.push('address = :address');
      update.values[':address'] = address;
    } else {
      update.removes.push('address');
    }
    update.result.address = address ?? null;
    update.changed = true;
  }

  return update;
}

// Joins SET/REMOVE clauses into one UpdateExpression.
export function updateExpression(sets: string[], removes: string[]): string {
  return [
    sets.length ? `SET ${sets.join(', ')}` : '',
    removes.length ? `REMOVE ${removes.join(', ')}` : '',
  ].filter(Boolean).join(' ');
}
