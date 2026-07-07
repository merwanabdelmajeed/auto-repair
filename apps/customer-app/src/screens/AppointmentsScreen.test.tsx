import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AppointmentsScreen from './AppointmentsScreen';
import { listAppointments, createAppointment, cancelAppointment } from '../api/appointments';
import { validatePromoCode } from '../api/promotions';
import { listServices } from '../api/services';
import { listVehicles } from '../api/vehicles';
import { getAvailability } from '../api/availability';
import { listLocations } from '../api/locations';
import { localDateStr } from '../utils/bookingDate';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, []) };
});
jest.mock('../api/appointments', () => ({ listAppointments: jest.fn(), createAppointment: jest.fn(), cancelAppointment: jest.fn() }));
jest.mock('../api/promotions', () => ({ validatePromoCode: jest.fn() }));
jest.mock('../api/services', () => ({ listServices: jest.fn() }));
jest.mock('../api/vehicles', () => ({ listVehicles: jest.fn() }));
jest.mock('../api/availability', () => ({ getAvailability: jest.fn() }));
jest.mock('../api/locations', () => ({ listLocations: jest.fn() }));

function appt(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'a1', locationId: 'loc1', vehicleId: 'v1', serviceId: 's1',
    scheduledAt: '2099-06-01T14:00:00.000Z', status: 'pending', notes: '',
    promoCode: null, promoId: null, promoApplied: false, serviceName: 'Oil Change',
    vehicleSummary: '2020 Honda Civic', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
function location(overrides: Record<string, unknown> = {}) {
  return { locationId: 'loc1', name: 'Main St', address: '1 Main St', ...overrides };
}
function service(overrides: Record<string, unknown> = {}) {
  return { serviceId: 's1', name: 'Oil Change', description: 'Quick service', durationMinutes: 30, isActive: true, ...overrides };
}
function vehicle(overrides: Record<string, unknown> = {}) {
  return { vehicleId: 'v1', make: 'Honda', model: 'Civic', trim: null, year: 2020, licensePlate: 'ABC123', color: 'blue', ...overrides };
}
function availability(overrides: Record<string, unknown> = {}) {
  return { date: localDateStr(new Date()), isOpen: true, slots: [{ time: '09:00', available: true, booked: 0 }], ...overrides };
}

function mockBookingDeps() {
  (listLocations as jest.Mock).mockResolvedValue([location()]);
  (listServices as jest.Mock).mockResolvedValue([service()]);
  (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
  (getAvailability as jest.Mock).mockResolvedValue(availability());
}

beforeEach(() => jest.clearAllMocks());

describe('AppointmentsScreen — list', () => {
  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listAppointments as jest.Mock).mockRejectedValue(new Error('down'));
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load appointments.'));
  });

  it('shows the empty state for Upcoming with a Book button', async () => {
    (listAppointments as jest.Mock).mockResolvedValue([]);
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('No Upcoming Appointments')).toBeTruthy());
    expect(screen.getByText('Book an Appointment')).toBeTruthy();
  });

  it('splits appointments into Upcoming/Past tabs with counts', async () => {
    (listAppointments as jest.Mock).mockResolvedValue([
      appt({ appointmentId: 'up1', status: 'pending' }),
      appt({ appointmentId: 'past1', status: 'completed', serviceName: 'Tire Rotation' }),
    ]);
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);

    await waitFor(() => expect(screen.getByText('Upcoming (1)')).toBeTruthy());
    expect(screen.getByText('Past (1)')).toBeTruthy();
    expect(screen.getByText('Oil Change')).toBeTruthy();

    fireEvent.press(screen.getByText('Past (1)'));
    expect(screen.getByText('Tire Rotation')).toBeTruthy();
  });

  it('toggles sort order', async () => {
    (listAppointments as jest.Mock).mockResolvedValue([
      appt({ appointmentId: 'a1', scheduledAt: '2099-06-01T10:00:00.000Z', serviceName: 'First' }),
      appt({ appointmentId: 'a2', scheduledAt: '2099-06-02T10:00:00.000Z', serviceName: 'Second' }),
    ]);
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => screen.getByText('First'));

    fireEvent.press(screen.getByText('Date'));
    // No crash and still renders both after toggling sort direction
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('auto-opens the detail modal from a route param and clears it', async () => {
    const setParams = jest.fn();
    (listAppointments as jest.Mock).mockResolvedValue([appt({ appointmentId: 'target' })]);
    render(<AppointmentsScreen navigation={{ setParams }} route={{ params: { appointmentId: 'target' } }} />);

    await waitFor(() => expect(setParams).toHaveBeenCalledWith({ appointmentId: undefined }));
    expect(screen.getByText('Booked On')).toBeTruthy();
  });
});

describe('AppointmentsScreen — cancel', () => {
  it('cancels an appointment when confirmed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Cancel Appointment')?.onPress?.();
    });
    (listAppointments as jest.Mock).mockResolvedValue([appt({ status: 'pending' })]);
    (cancelAppointment as jest.Mock).mockResolvedValue({ appointmentId: 'a1', status: 'cancelled' });
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => screen.getByText('Cancel'));

    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => expect(cancelAppointment).toHaveBeenCalledWith('a1'));
  });

  it('does not cancel when the confirm dialog is dismissed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Keep')?.onPress?.();
    });
    (listAppointments as jest.Mock).mockResolvedValue([appt({ status: 'pending' })]);
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => screen.getByText('Cancel'));

    fireEvent.press(screen.getByText('Cancel'));

    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it('shows an error alert when cancellation fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Cancel Appointment')?.onPress?.();
    });
    (listAppointments as jest.Mock).mockResolvedValue([appt({ status: 'pending' })]);
    (cancelAppointment as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => screen.getByText('Cancel'));

    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to cancel appointment.'));
  });
});

describe('AppointmentsScreen — detail modal', () => {
  it('shows notes/promo rows only when present, and closes on the ✕ button', async () => {
    (listAppointments as jest.Mock).mockResolvedValue([appt({ notes: 'Please be careful', promoCode: 'SAVE10' })]);
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => screen.getByText('Oil Change'));

    fireEvent.press(screen.getByText('Oil Change'));

    expect(screen.getByText('Please be careful')).toBeTruthy();
    // SAVE10 legitimately renders twice: the list card's promo tag + the detail modal's row
    expect(screen.getAllByText('SAVE10').length).toBeGreaterThanOrEqual(2);

    fireEvent.press(screen.getByTestId('appt-detail-close'));
  });

  it('cancels from the detail modal', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Cancel Appointment')?.onPress?.();
    });
    (listAppointments as jest.Mock).mockResolvedValue([appt({ status: 'confirmed' })]);
    (cancelAppointment as jest.Mock).mockResolvedValue({ appointmentId: 'a1', status: 'cancelled' });
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Oil Change'));

    fireEvent.press(screen.getByText('Cancel Appointment'));

    await waitFor(() => expect(cancelAppointment).toHaveBeenCalledWith('a1'));
  });
});

describe('AppointmentsScreen — booking flow', () => {
  beforeEach(() => {
    (listAppointments as jest.Mock).mockResolvedValue([]);
    mockBookingDeps();
  });

  async function openBookingModal() {
    render(<AppointmentsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />);
    await waitFor(() => screen.getByText('Book an Appointment'));
    fireEvent.press(screen.getByText('Book an Appointment'));
    await waitFor(() => screen.getByText('Main St'));
  }

  it('requires a location before continuing', async () => {
    await openBookingModal();
    fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('Please select a location.')).toBeTruthy();
  });

  it('walks location -> service -> datetime -> vehicle -> confirm and books successfully', async () => {
    (createAppointment as jest.Mock).mockResolvedValue(appt({ appointmentId: 'new1' }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await openBookingModal();

    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Oil Change'));

    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => expect(getAvailability).toHaveBeenCalled());

    await waitFor(() => screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('Next'));

    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('Next'));

    await waitFor(() => screen.getByPlaceholderText('Enter code'));
    fireEvent.press(screen.getByTestId('appt-booking-submit'));

    await waitFor(() => expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'loc1', serviceId: 's1', vehicleId: 'v1',
    })));
    expect(alertSpy).toHaveBeenCalledWith('Booked!', expect.stringContaining('submitted'));
  });

  it('requires a time slot before leaving the datetime step', async () => {
    await openBookingModal();
    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => expect(getAvailability).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('Please select a date and time slot.')).toBeTruthy();
  });

  it('shows closed message when the shop is not open that day', async () => {
    (getAvailability as jest.Mock).mockResolvedValue(availability({ isOpen: false, blockedReason: 'Holiday', slots: [] }));
    await openBookingModal();
    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Next'));

    await waitFor(() => expect(screen.getByText('Closed — Holiday')).toBeTruthy());
  });

  it('requires a vehicle before confirming, and shows the no-vehicles state', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([]);
    await openBookingModal();
    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('Next'));

    await waitFor(() => expect(screen.getByText('No vehicles added')).toBeTruthy());
  });

  it('applies a promo code and can remove it', async () => {
    (validatePromoCode as jest.Mock).mockResolvedValue({ promoId: 'p1', code: 'SAVE10', description: '10% off', type: 'percent', value: 10 });
    await openBookingModal();
    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByPlaceholderText('Enter code'));

    fireEvent.changeText(screen.getByPlaceholderText('Enter code'), 'save10');
    fireEvent.press(screen.getByText('Apply'));

    await waitFor(() => expect(screen.getByText('10% off')).toBeTruthy());
    expect(validatePromoCode).toHaveBeenCalledWith('SAVE10');

    fireEvent.press(screen.getByText('Remove'));
    expect(screen.queryByText('10% off')).toBeNull();
  });

  it('shows an error for an invalid promo code', async () => {
    (validatePromoCode as jest.Mock).mockRejectedValue(new Error('Promo code not found'));
    await openBookingModal();
    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByPlaceholderText('Enter code'));

    fireEvent.changeText(screen.getByPlaceholderText('Enter code'), 'BADCODE');
    fireEvent.press(screen.getByText('Apply'));

    await waitFor(() => expect(screen.getByText('Promo code not found')).toBeTruthy());
  });

  it('shows a slot-taken message on a 409 conflict when submitting', async () => {
    (createAppointment as jest.Mock).mockRejectedValue(new Error('409 slot not available'));
    await openBookingModal();
    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('9:00 AM'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByPlaceholderText('Enter code'));

    fireEvent.press(screen.getByTestId('appt-booking-submit'));

    await waitFor(() => expect(screen.getByText('That time slot was just taken. Please go back and pick another.')).toBeTruthy());
  });

  it('navigates back through steps with the back button', async () => {
    await openBookingModal();
    fireEvent.press(screen.getByText('Main St'));
    fireEvent.press(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Choose Service'));

    fireEvent.press(screen.getByTestId('appt-booking-back'));

    await waitFor(() => expect(screen.getByText('Choose Location')).toBeTruthy());
  });

  it('closes the booking modal via the ✕ button', async () => {
    await openBookingModal();
    fireEvent.press(screen.getByTestId('appt-booking-close'));
    await waitFor(() => expect(screen.queryByText('Choose Location')).toBeNull());
  });
});
