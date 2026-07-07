import { localDateStr, parseDateParts, fmt12h, fmtDate } from './bookingDate';

describe('localDateStr', () => {
  it('formats a Date as YYYY-MM-DD using local time, zero-padded', () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe('2026-01-05'); // Jan 5, local midnight
  });
});

describe('parseDateParts', () => {
  it('parses day/month/weekday from a date string using UTC-noon anchoring', () => {
    // 2026-07-04 is a Saturday
    expect(parseDateParts('2026-07-04')).toMatchObject({ dayName: 'Sat', day: 4, month: 'Jul' });
  });

  it('flags isToday correctly relative to the current date', () => {
    const today = localDateStr(new Date());
    expect(parseDateParts(today).isToday).toBe(true);
    expect(parseDateParts('2020-01-01').isToday).toBe(false);
  });
});

describe('fmt12h', () => {
  it.each([
    ['09:00', '9:00 AM'],
    ['00:00', '12:00 AM'],
    ['12:00', '12:00 PM'],
    ['13:30', '1:30 PM'],
    ['23:45', '11:45 PM'],
  ])('formats %s as %s', (input, expected) => {
    expect(fmt12h(input)).toBe(expected);
  });
});

describe('fmtDate', () => {
  it('formats an ISO string as a locale date+time string', () => {
    expect(fmtDate('2026-03-15T14:30:00.000Z')).toMatch(/Mar 15, 2026/);
  });
});
