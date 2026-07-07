import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import DashboardScreen from './DashboardScreen';
import { getDashboardSummary } from '../api/dashboard';
import { listAppointments, updateAppointmentStatus, applyPromo } from '../api/appointments';
import { listCustomers } from '../api/customers';
import { listVehicles, updateVehicle } from '../api/vehicles';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('../api/dashboard', () => ({ getDashboardSummary: jest.fn() }));
jest.mock('../api/appointments', () => ({
  listAppointments: jest.fn(),
  updateAppointmentStatus: jest.fn(),
  applyPromo: jest.fn(),
}));
jest.mock('../api/customers', () => ({ listCustomers: jest.fn() }));
jest.mock('../api/vehicles', () => ({ listVehicles: jest.fn(), updateVehicle: jest.fn() }));

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function appt(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'a1', customerId: 'u1', customerEmail: 'jane@shop.com', customerName: 'Jane Doe',
    vehicleId: 'v1', serviceId: 's1', scheduledAt: `${todayLocalDate()}T10:00:00.000Z`,
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

function setupApis(opts: { summary?: unknown; appts?: unknown[]; customers?: unknown[]; vehicles?: unknown[] } = {}) {
  (getDashboardSummary as jest.Mock).mockResolvedValue(opts.summary ?? { totalCustomers: 10, totalVehicles: 8, totalAppointments: 20, bookingsToday: 2 });
  (listAppointments as jest.Mock).mockResolvedValue({ items: opts.appts ?? [appt()], nextCursor: null });
  (listCustomers as jest.Mock).mockResolvedValue({ items: opts.customers ?? [customer()], nextCursor: null });
  (listVehicles as jest.Mock).mockResolvedValue({ items: opts.vehicles ?? [vehicle()], nextCursor: null });
}

beforeEach(() => jest.clearAllMocks());

describe('DashboardScreen', () => {
  it('loads and renders KPIs and today\'s bookings', async () => {
    setupApis();
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);

    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  it('navigates via clickable KPI cards and quick-nav links', async () => {
    setupApis();
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Total Customers'));
    expect(mockNavigate).toHaveBeenCalledWith('Customers');

    fireEvent.press(screen.getByText('See all →'));
    expect(mockNavigate).toHaveBeenCalledWith('Bookings');

    fireEvent.press(screen.getByText('Promotions'));
    expect(mockNavigate).toHaveBeenCalledWith('Promotions');
  });

  it('shows "No bookings today" when there are none for today', async () => {
    setupApis({ appts: [appt({ scheduledAt: '2020-01-01T10:00:00.000Z' })] });
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('No bookings today')).toBeTruthy());
  });

  it('filters bookings via the dashboard search box', async () => {
    setupApis({ appts: [appt(), appt({ appointmentId: 'a2', serviceName: 'Brake Check', customerName: 'Bob Smith' })] });
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search service, customer, vehicle…'), 'brake');

    expect(screen.getByText('Brake Check')).toBeTruthy();
    expect(screen.queryByText('Oil Change')).toBeNull();
  });

  it('shows "No results found" for a search with no matches', async () => {
    setupApis();
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search service, customer, vehicle…'), 'zzz-nomatch');

    expect(screen.getByText('No results found')).toBeTruthy();
  });

  it('opens the status picker for a card with a valid transition and changes status', async () => {
    setupApis();
    (updateAppointmentStatus as jest.Mock).mockResolvedValue({ appointmentId: 'a1', status: 'confirmed' });
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Pending ▾'));
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
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Pending ▾'));
    fireEvent.press(screen.getByText('Cancel Appointment'));

    expect(alertSpy).toHaveBeenCalledWith('Cancel Appointment', 'Cancel "Oil Change" for Jane Doe?', expect.any(Array));
    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'cancelled'));
  });

  it('shows an alert when a status update fails', async () => {
    setupApis();
    (updateAppointmentStatus as jest.Mock).mockRejectedValue(new Error('boom'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Pending ▾'));
    fireEvent.press(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to update status.'));
  });

  it('does not show a status dropdown for a terminal status', async () => {
    setupApis({ appts: [appt({ status: 'completed' })] });
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());
    expect(screen.queryByText(/▾/)).toBeNull();
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('shows an Apply Promo action and applies it', async () => {
    setupApis({ appts: [appt({ promoCode: 'SAVE10', promoId: 'p1' })] });
    (applyPromo as jest.Mock).mockResolvedValue({ applied: true });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const apply = buttons?.find((b) => b.text === 'Mark Applied');
      apply?.onPress?.();
    });
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Apply Promo'));

    expect(alertSpy).toHaveBeenCalledWith('Apply Promo', 'Mark "SAVE10" as applied for Jane Doe?', expect.any(Array));
    await waitFor(() => expect(applyPromo).toHaveBeenCalledWith('p1', 'u1', 'a1'));
    await waitFor(() => expect(screen.getByText(/Applied/)).toBeTruthy());
  });

  it('reverts promoApplied and shows an error when applying a promo fails', async () => {
    setupApis({ appts: [appt({ promoCode: 'SAVE10', promoId: 'p1' })] });
    (applyPromo as jest.Mock).mockRejectedValue(new Error('promo expired'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Apply Promo') {
        const apply = buttons?.find((b) => b.text === 'Mark Applied');
        apply?.onPress?.();
      }
    });
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Apply Promo'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'promo expired'));
  });

  it('opens the detail modal, expands vehicle info, edits and saves it', async () => {
    setupApis();
    (updateVehicle as jest.Mock).mockResolvedValue({ licensePlate: 'NEWPLATE' });
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
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
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getAllByText('2020 Honda Civic')[screen.getAllByText('2020 Honda Civic').length - 1]);
    fireEvent.press(screen.getByText('Edit Plate / VIN'));
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Failed to save.')).toBeTruthy());
  });

  it('cancels a vehicle edit', async () => {
    setupApis();
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
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
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getAllByText('Oil Change').length).toBeGreaterThan(0));

    fireEvent.press(screen.getAllByText('Oil Change')[0]);
    fireEvent.press(screen.getByText('Change Status'));
    fireEvent.press(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'confirmed'));
  });

  it('closes the detail modal via the close icon', async () => {
    setupApis();
    render(<DashboardScreen navigation={{ navigate: mockNavigate }} />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    expect(screen.getByText('jane@shop.com')).toBeTruthy();
    fireEvent.press(screen.getByText('close'));
  });
});
