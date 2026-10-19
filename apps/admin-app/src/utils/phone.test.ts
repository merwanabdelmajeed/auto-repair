import { formatPhone } from './phone';

describe('formatPhone', () => {
  it('returns an empty string for no digits', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('abc')).toBe('');
  });

  it('formats progressively as digits are typed', () => {
    expect(formatPhone('9')).toBe('(9');
    expect(formatPhone('949')).toBe('(949');
    expect(formatPhone('9495')).toBe('(949) 5');
    expect(formatPhone('949555')).toBe('(949) 555');
    expect(formatPhone('9495551')).toBe('(949) 555-1');
    expect(formatPhone('9495551234')).toBe('(949) 555-1234');
  });

  it('re-formats an already formatted value (e.g. after a backspace)', () => {
    expect(formatPhone('(949) 555-123')).toBe('(949) 555-123');
    expect(formatPhone('(949) 5')).toBe('(949) 5');
  });

  it('caps at 10 digits', () => {
    expect(formatPhone('94955512349999')).toBe('(949) 555-1234');
  });

  it('drops a leading US country code from pasted numbers', () => {
    expect(formatPhone('+1 949-555-1234')).toBe('(949) 555-1234');
    expect(formatPhone('19495551234')).toBe('(949) 555-1234');
  });
});
