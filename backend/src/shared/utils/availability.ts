import type { CapacitySettings, AvailabilityResult, TimeSlot } from '../types/index.js';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export const DEFAULT_CAPACITY: Omit<CapacitySettings, 'tenantId' | 'updatedAt'> = {
  slotDurationMinutes: 30,
  maxConcurrent: 2,
  operatingHours: {
    monday: { open: '07:00', close: '17:00' },
    tuesday: { open: '07:00', close: '17:00' },
    wednesday: { open: '07:00', close: '17:00' },
    thursday: { open: '07:00', close: '17:00' },
    friday: { open: '07:00', close: '17:00' },
    saturday: { open: '07:00', close: '17:00' },
    sunday: null,
  },
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function minutesToTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}

type AppointmentSummary = { scheduledAt: string; status: string };
type BlockedTimeSummary = { startDate: string; endDate: string; label: string };

export function computeAvailability(
  date: string,
  capacity: CapacitySettings,
  blockedTimes: BlockedTimeSummary[],
  appointments: AppointmentSummary[],
): AvailabilityResult {
  const blocked = blockedTimes.find(bt => date >= bt.startDate && date <= bt.endDate);
  if (blocked) {
    return { date, isOpen: false, blockedReason: blocked.label, slots: [] };
  }

  const dayName = DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const hours = capacity.operatingHours[dayName];
  if (!hours) {
    return { date, isOpen: false, slots: [] };
  }

  const slotCounts: Record<string, number> = {};
  for (const appt of appointments) {
    if (appt.scheduledAt.startsWith(date) && appt.status !== 'cancelled') {
      const time = appt.scheduledAt.substring(11, 16);
      slotCounts[time] = (slotCounts[time] ?? 0) + 1;
    }
  }

  const slots: TimeSlot[] = [];
  let cur = timeToMinutes(hours.open);
  const close = timeToMinutes(hours.close);
  while (cur + capacity.slotDurationMinutes <= close) {
    const time = minutesToTime(cur);
    slots.push({ time, available: (slotCounts[time] ?? 0) < capacity.maxConcurrent, booked: slotCounts[time] ?? 0 });
    cur += capacity.slotDurationMinutes;
  }

  return { date, isOpen: true, slots };
}

export function isSlotAvailable(
  date: string,
  time: string,
  capacity: CapacitySettings,
  blockedTimes: BlockedTimeSummary[],
  appointments: AppointmentSummary[],
): boolean {
  const result = computeAvailability(date, capacity, blockedTimes, appointments);
  if (!result.isOpen) return false;
  return result.slots.find(s => s.time === time)?.available ?? false;
}
