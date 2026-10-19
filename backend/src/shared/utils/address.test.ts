import { sanitizeAddress, isAddressInput } from './address';

describe('sanitizeAddress', () => {
  it('returns undefined for non-objects and arrays', () => {
    expect(sanitizeAddress(undefined)).toBeUndefined();
    expect(sanitizeAddress(null)).toBeUndefined();
    expect(sanitizeAddress('1 Main St')).toBeUndefined();
    expect(sanitizeAddress(['1 Main St'])).toBeUndefined();
  });

  it('keeps only known non-empty string fields, trimmed', () => {
    expect(sanitizeAddress({ line1: ' 1 Main St ', city: '', state: 5, extra: 'x', postalCode: '92618' }))
      .toEqual({ line1: '1 Main St', postalCode: '92618' });
  });

  it('returns undefined when every field is empty', () => {
    expect(sanitizeAddress({ line1: '  ', city: '' })).toBeUndefined();
  });
});

describe('isAddressInput', () => {
  it('accepts null and plain objects', () => {
    expect(isAddressInput(null)).toBe(true);
    expect(isAddressInput({})).toBe(true);
  });

  it('rejects strings, numbers and arrays', () => {
    expect(isAddressInput('x')).toBe(false);
    expect(isAddressInput(5)).toBe(false);
    expect(isAddressInput([])).toBe(false);
  });
});
