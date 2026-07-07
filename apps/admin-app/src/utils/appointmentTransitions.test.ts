import { VALID_NEXT } from './appointmentTransitions';

describe('VALID_NEXT', () => {
  it('defines the correct forward transitions for each active status', () => {
    expect(VALID_NEXT.pending).toEqual(['confirmed', 'cancelled']);
    expect(VALID_NEXT.confirmed).toEqual(['in-progress', 'cancelled']);
    expect(VALID_NEXT['in-progress']).toEqual(['completed', 'cancelled']);
  });

  it('has no forward transitions defined for terminal statuses', () => {
    expect(VALID_NEXT.completed).toBeUndefined();
    expect(VALID_NEXT.cancelled).toBeUndefined();
  });
});
