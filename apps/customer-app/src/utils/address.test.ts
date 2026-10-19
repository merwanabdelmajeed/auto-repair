import { cleanAddress, formatAddress } from './address';

describe('cleanAddress', () => {
  it('returns undefined when every field is blank', () => {
    expect(cleanAddress({})).toBeUndefined();
    expect(cleanAddress({ line1: '  ', city: '' })).toBeUndefined();
  });

  it('trims fields and drops the empty ones', () => {
    expect(cleanAddress({ line1: ' 1 Main St ', line2: ' ', city: 'Irvine', state: ' CA', postalCode: '' }))
      .toEqual({ line1: '1 Main St', city: 'Irvine', state: 'CA' });
  });

  it('keeps a full address as-is', () => {
    const full = { line1: '1 Main St', line2: 'Apt 2', city: 'Irvine', state: 'CA', postalCode: '92618' };
    expect(cleanAddress(full)).toEqual(full);
  });
});

describe('formatAddress', () => {
  it('returns null for a missing or empty address', () => {
    expect(formatAddress(null)).toBeNull();
    expect(formatAddress(undefined)).toBeNull();
    expect(formatAddress({})).toBeNull();
  });

  it('joins the present fields on one line', () => {
    expect(formatAddress({ line1: '1 Main St', line2: 'Apt 2', city: 'Irvine', state: 'CA', postalCode: '92618' }))
      .toBe('1 Main St, Apt 2, Irvine, CA 92618');
    expect(formatAddress({ city: 'Irvine', state: 'CA' })).toBe('Irvine, CA');
  });
});
