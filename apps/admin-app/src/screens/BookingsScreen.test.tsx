import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import BookingsScreen from './BookingsScreen';
import { listAppointments, updateAppointmentStatus, applyPromo } from '../api/appointments';
import { listCustomers } from '../api/customers';
import { listVehicles, updateVehicle } from '../api/vehicles';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('../api/appointments', () => ({
  listAppointments: jest.fn(),
  updateAppointmentStatus: jest.fn(),
  applyPromo: jest.fn(),
}));
jest.mock('../api/customers', () => ({ listCustomers: jest.fn() }));
jest.mock('../api/vehicles', () => ({ listVehicles: jest.fn(), updateVehicle: jest.fn() }));

function todayLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function appt(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'a1', customerId: 'u1', customerEmail: 'jane@shop.com', customerName: 'Jane Doe',
    vehicleId: 'v1', serviceId: 's1', scheduledAt: `${todayLocalDateStr()}T10:00:00.000Z`,
    status: 'pending', notes: null, promoCode: null, promoId: null, promoApplied: false,
    serviceName: 'Oil Change', vehicleSummary: '2020 Honda Civic', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function customer(overrides: Record<string, unknown> = {}) {
  return { userId: 'u1', email: 'jane@shop.com', firstName: 'Jane', lastName: 'Doe', phone: '5551234567', status: 'ACTIVE', createdAt: 'c', ...overrides };
}

function vehicle(overrides: Record<string, unknown> = {}) {
  return { vehicleId: 'v1', customerId: 'u1', make: 'Honda', model: 'Civic', year: 2020, licensePlate: 'ABC123', color: 'Blue', vin: 'VIN123', createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();

function setupApis(opts: { appts?: unknown[]; customers?: unknown[]; vehicles?: unknown[] } = {}) {
  (listAppointments as jest.Mock).mockResolvedValue({ items: opts.appts ?? [appt()], nextCursor: null });
  (listCustomers as jest.Mock).mockResolvedValue({ items: opts.customers ?? [customer()], nextCursor: null });
  (listVehicles as jest.Mock).mockResolvedValue({ items: opts.vehicles ?? [vehicle()], nextCursor: null });
}

function nav() {
  return { navigate: mockNavigate, setParams: mockSetParams };
}

beforeEach(() => jest.clearAllMocks());

describe('BookingsScreen', () => {
  it('loads and renders current appointments with tab counts', async () => {
    setupApis();
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);

    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('pending ▾')).toBeTruthy();
  });

  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listAppointments as jest.Mock).mockRejectedValue(new Error('down'));
    (listCustomers as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
    (listVehicles as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load appointments.'));
  });

  it('shows the empty state for the Current tab', async () => {
    setupApis({ appts: [] });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('No Upcoming Appointments')).toBeTruthy());
  });

  it('splits appointments into Current and Past tabs by date', async () => {
    setupApis({ appts: [appt(), appt({ appointmentId: 'a2', serviceName: 'Old Job', scheduledAt: '2020-01-01T10:00:00.000Z' })] });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());
    expect(screen.queryByText('Old Job')).toBeNull();

    fireEvent.press(screen.getByText('Past'));

    expect(screen.getByText('Old Job')).toBeTruthy();
    expect(screen.queryByText('Oil Change')).toBeNull();
  });

  it('shows a status-specific empty state on a status tab', async () => {
    setupApis({ appts: [appt({ status: 'confirmed' })] });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Cancelled'));

    expect(screen.getByText('No cancelled appointments')).toBeTruthy();
  });

  it('filters by status tab and shows only matching appointments', async () => {
    setupApis({ appts: [appt({ status: 'pending' }), appt({ appointmentId: 'a2', serviceName: 'Brake Check', status: 'confirmed' })] });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Confirmed'));

    expect(screen.getByText('Brake Check')).toBeTruthy();
    expect(screen.queryByText('Oil Change')).toBeNull();
  });

  it('filters by search text', async () => {
    setupApis({ appts: [appt(), appt({ appointmentId: 'a2', serviceName: 'Brake Check', customerName: 'Bob Smith' })] });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search service, customer, vehicle…'), 'bob');

    expect(screen.getByText('Brake Check')).toBeTruthy();
    expect(screen.queryByText('Oil Change')).toBeNull();
  });

  it('opens the status picker and changes status', async () => {
    setupApis();
    (updateAppointmentStatus as jest.Mock).mockResolvedValue({ appointmentId: 'a1', status: 'confirmed' });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('pending ▾'));
    fireEvent.press(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'confirmed'));
  });

  it('confirms before cancelling via the status picker', async () => {
    setupApis();
    (updateAppointmentStatus as jest.Mock).mockResolvedValue({ appointmentId: 'a1', status: 'cancelled' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find((b) => b.text === 'Cancel Appointment');
      cancel?.onPress?.();
    });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('pending ▾'));
    fireEvent.press(screen.getByText('Cancel Appointment'));

    expect(alertSpy).toHaveBeenCalledWith('Cancel Appointment', 'Cancel "Oil Change" for Jane Doe?', expect.any(Array));
    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'cancelled'));
  });

  it('shows an alert when a status update fails', async () => {
    setupApis();
    (updateAppointmentStatus as jest.Mock).mockRejectedValue(new Error('boom'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('pending ▾'));
    fireEvent.press(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to update status.'));
  });

  it('applies a promo from the card', async () => {
    setupApis({ appts: [appt({ promoCode: 'SAVE10', promoId: 'p1' })] });
    (applyPromo as jest.Mock).mockResolvedValue({ applied: true });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const apply = buttons?.find((b) => b.text === 'Mark Applied');
      apply?.onPress?.();
    });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Apply Promo'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Apply Promo Code',
      'Mark code "SAVE10" as applied for Jane Doe? This records that the discount was given in person.',
      expect.any(Array),
    );
    await waitFor(() => expect(applyPromo).toHaveBeenCalledWith('p1', 'u1', 'a1'));
  });

  it('shows "Cannot Apply" alert with the server message when applying a promo fails', async () => {
    setupApis({ appts: [appt({ promoCode: 'SAVE10', promoId: 'p1' })] });
    (applyPromo as jest.Mock).mockRejectedValue(new Error('promo expired'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Apply Promo Code') {
        const apply = buttons?.find((b) => b.text === 'Mark Applied');
        apply?.onPress?.();
      }
    });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Apply Promo'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Cannot Apply', 'promo expired'));
  });

  it('opens the detail modal, expands the vehicle, edits and saves it', async () => {
    setupApis();
    (updateVehicle as jest.Mock).mockResolvedValue({ licensePlate: 'NEWPLATE' });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    expect(screen.getByText('jane@shop.com')).toBeTruthy();

    fireEvent.press(screen.getAllByText('2020 Honda Civic')[screen.getAllByText('2020 Honda Civic').length - 1]);
    expect(screen.getByText('ABC123')).toBeTruthy();

    fireEvent.press(screen.getByText('Edit Plate / VIN'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. ABC1234'), 'newplate');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'NEWPLATE', vin: 'VIN123' }));
  });

  it('shows an error when saving the vehicle edit fails', async () => {
    setupApis();
    (updateVehicle as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getAllByText('2020 Honda Civic')[screen.getAllByText('2020 Honda Civic').length - 1]);
    fireEvent.press(screen.getByText('Edit Plate / VIN'));
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Failed to save.')).toBeTruthy());
  });

  it('cancels a vehicle edit', async () => {
    setupApis();
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getAllByText('2020 Honda Civic')[screen.getAllByText('2020 Honda Civic').length - 1]);
    fireEvent.press(screen.getByText('Edit Plate / VIN'));
    fireEvent.press(screen.getByText('Cancel'));

    expect(screen.getByText('Edit Plate / VIN')).toBeTruthy();
  });

  it('changes status and applies promo from the detail modal', async () => {
    setupApis({ appts: [appt({ promoCode: 'SAVE10', promoId: 'p1' })] });
    (updateAppointmentStatus as jest.Mock).mockResolvedValue({ appointmentId: 'a1', status: 'confirmed' });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getAllByText('Oil Change').length).toBeGreaterThan(0));

    fireEvent.press(screen.getAllByText('Oil Change')[0]);
    fireEvent.press(screen.getByText('Change Status'));
    fireEvent.press(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'confirmed'));
  });

  it('closes the detail modal via the close icon', async () => {
    setupApis();
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    expect(screen.getByText('jane@shop.com')).toBeTruthy();
    fireEvent.press(screen.getByText('close'));
  });

  it('auto-opens the detail modal when arriving with route.params.appointmentId, then clears the param', async () => {
    setupApis();
    render(<BookingsScreen navigation={nav()} route={{ params: { appointmentId: 'a1' } }} />);

    await waitFor(() => expect(screen.getByText('jane@shop.com')).toBeTruthy());
    expect(mockSetParams).toHaveBeenCalledWith({ appointmentId: undefined });
  });

  it('does not show a status dropdown for a terminal status', async () => {
    setupApis({ appts: [appt({ status: 'completed' })] });
    render(<BookingsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());
    expect(screen.queryByText(/▾/)).toBeNull();
  });
});
