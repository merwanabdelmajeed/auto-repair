import { matchesCustomerSearch } from './customerSearch';
import type { Customer } from '../api/customers';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    userId: 'c1', email: 'jane@shop.com', firstName: 'Jane', lastName: 'Doe',
    phone: '(949) 555-1234', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('matchesCustomerSearch', () => {
  it('matches everything on an empty query', () => {
    expect(matchesCustomerSearch(customer(), '  ')).toBe(true);
  });

  it('matches name and email case-insensitively', () => {
    expect(matchesCustomerSearch(customer(), 'JANE D')).toBe(true);
    expect(matchesCustomerSearch(customer(), 'shop.com')).toBe(true);
    expect(matchesCustomerSearch(customer(), 'bob')).toBe(false);
  });

  it('matches phone by digits regardless of formatting', () => {
    const c = customer();
    expect(matchesCustomerSearch(c, '9495551234')).toBe(true);
    expect(matchesCustomerSearch(c, '949-555-1234')).toBe(true);
    expect(matchesCustomerSearch(c, '(949) 555')).toBe(true);
    expect(matchesCustomerSearch(c, '5551234')).toBe(true);
    expect(matchesCustomerSearch(c, '7145551234')).toBe(false);
  });

  it('does not phone-match queries that contain letters', () => {
    expect(matchesCustomerSearch(customer(), 'x949')).toBe(false);
  });

  it('handles customers with no phone', () => {
    expect(matchesCustomerSearch(customer({ phone: null }), '949')).toBe(false);
  });

  it('matches every customer sharing the same number', () => {
    const list = [
      customer(),
      customer({ userId: 'c2', firstName: 'John', email: 'john@shop.com' }),
      customer({ userId: 'c3', firstName: 'Bob', email: 'bob@shop.com', phone: '(714) 000-0000' }),
    ];
    expect(list.filter(c => matchesCustomerSearch(c, '9495551234')).map(c => c.userId)).toEqual(['c1', 'c2']);
  });
});
