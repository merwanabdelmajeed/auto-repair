import { computeAvailability, isSlotAvailable, DEFAULT_CAPACITY } from './availability';
import type { CapacitySettings } from '../types/index.js';

const capacity: CapacitySettings = {
  tenantId: 't1',
  locationId: 'loc1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...DEFAULT_CAPACITY,
};

// 2026-08-10 is a Monday; 2026-08-16 is a Sunday.
const MONDAY = '2026-08-10';
const SUNDAY = '2026-08-16';

describe('computeAvailability', () => {
  it('returns isOpen: false with the block label when the date falls inside a blocked range', () => {
    const result = computeAvailability(
      MONDAY,
      capacity,
      [{ startDate: '2026-08-09', endDate: '2026-08-11', label: 'Staff Training' }],
      [],
    );
    expect(result).toEqual({ date: MONDAY, isOpen: false, blockedReason: 'Staff Training', slots: [] });
  });

  it('treats the blocked range boundaries as inclusive', () => {
    const blockedTimes = [{ startDate: MONDAY, endDate: MONDAY, label: 'Single Day Block' }];
    expect(computeAvailability(MONDAY, capacity, blockedTimes, []).isOpen).toBe(false);
    expect(computeAvailability('2026-08-11', capacity, blockedTimes, []).isOpen).toBe(true);
  });

  it('returns isOpen: false with no slots on a day with no operating hours (Sunday)', () => {
    const result = computeAvailability(SUNDAY, capacity, [], []);
    expect(result).toEqual({ date: SUNDAY, isOpen: false, slots: [] });
  });

  it('marks a slot unavailable once maxConcurrent non-cancelled appointments occupy it, independent of other slots', () => {
    const appointments = [
      { scheduledAt: `${MONDAY}T07:00:00.000Z`, status: 'pending' },
      { scheduledAt: `${MONDAY}T07:00:00.000Z`, status: 'confirmed' },
    ];
    const result = computeAvailability(MONDAY, capacity, [], appointments);
    const sevenAm = result.slots.find(s => s.time === '07:00');
    const sevenThirty = result.slots.find(s => s.time === '07:30');
    expect(sevenAm).toEqual({ time: '07:00', available: false, booked: 2 });
    expect(sevenThirty).toEqual({ time: '07:30', available: true, booked: 0 });
  });

  it('does not count cancelled appointments toward the concurrency limit', () => {
    const appointments = [
      { scheduledAt: `${MONDAY}T07:00:00.000Z`, status: 'cancelled' },
      { scheduledAt: `${MONDAY}T07:00:00.000Z`, status: 'cancelled' },
    ];
    const result = computeAvailability(MONDAY, capacity, [], appointments);
    expect(result.slots.find(s => s.time === '07:00')).toEqual({ time: '07:00', available: true, booked: 0 });
  });

  it('stops generating slots at the lastAppointment cutoff even though later slots would still fit before close', () => {
    const result = computeAvailability(MONDAY, capacity, [], []);
    // DEFAULT_CAPACITY: open 07:00, close 17:30, lastAppointment 15:30, 30-min slots.
    expect(result.slots.at(-1)?.time).toBe('15:30');
    expect(result.slots.find(s => s.time === '16:00')).toBeUndefined();
  });

  it('falls back to close-minus-slotDuration when lastAppointment is not set (legacy record)', () => {
    const legacyCapacity: CapacitySettings = {
      ...capacity,
      operatingHours: {
        ...capacity.operatingHours,
        monday: { open: '07:00', close: '17:30' },
      },
    };
    const result = computeAvailability(MONDAY, legacyCapacity, [], []);
    expect(result.slots.at(-1)?.time).toBe('17:00');
  });
});

describe('isSlotAvailable', () => {
  it('returns true for an open day with an empty slot', () => {
    expect(isSlotAvailable(MONDAY, '07:00', capacity, [], [])).toBe(true);
  });

  it('returns false when the day is closed, without needing to check the specific slot', () => {
    expect(isSlotAvailable(SUNDAY, '07:00', capacity, [], [])).toBe(false);
  });
});
