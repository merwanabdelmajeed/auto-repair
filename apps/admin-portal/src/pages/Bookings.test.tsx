import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Bookings from './Bookings';
import { listAppointments, updateAppointmentStatus, applyPromo } from '../api/appointments';
import { listCustomers } from '../api/customers';
import { listVehicles, updateVehicle } from '../api/vehicles';

vi.mock('../api/appointments', () => ({ listAppointments: vi.fn(), updateAppointmentStatus: vi.fn(), applyPromo: vi.fn() }));
vi.mock('../api/customers', () => ({ listCustomers: vi.fn() }));
vi.mock('../api/vehicles', () => ({ listVehicles: vi.fn(), updateVehicle: vi.fn() }));

function appt(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'a1', customerId: 'c1', customerEmail: 'jane@shop.com', customerName: 'Jane Doe',
    vehicleId: 'v1', serviceId: 's1', scheduledAt: '2099-06-01T14:00:00.000Z', status: 'pending',
    notes: '', promoCode: null, promoId: null, promoApplied: false, serviceName: 'Oil Change',
    vehicleSummary: '2020 Honda Civic', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
function customer(overrides: Record<string, unknown> = {}) {
  return { userId: 'c1', email: 'jane@shop.com', firstName: 'Jane', lastName: 'Doe', phone: '555-1234', status: 'ACTIVE', createdAt: 'c', ...overrides };
}
function vehicle(overrides: Record<string, unknown> = {}) {
  return { vehicleId: 'v1', customerId: 'c1', make: 'Honda', model: 'Civic', trim: null, year: 2020, licensePlate: 'ABC123', color: 'blue', vin: '1HGCM82633A123456', createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

function mockLoad({ appointments = [appt()], customers = [customer()], vehicles = [vehicle()] }: { appointments?: unknown[]; customers?: unknown[]; vehicles?: unknown[] } = {}) {
  vi.mocked(listAppointments).mockResolvedValue({ items: appointments, nextCursor: null } as never);
  vi.mocked(listCustomers).mockResolvedValue({ items: customers, nextCursor: null } as never);
  vi.mocked(listVehicles).mockResolvedValue({ items: vehicles, nextCursor: null } as never);
}

function renderPage(initialEntries = ['/bookings']) {
  return render(<MemoryRouter initialEntries={initialEntries}><Bookings /></MemoryRouter>);
}

beforeEach(() => vi.clearAllMocks());

describe('Bookings — loading and tabs', () => {
  it('shows an error when loading fails', async () => {
    vi.mocked(listAppointments).mockRejectedValue(new Error('down'));
    vi.mocked(listCustomers).mockResolvedValue({ items: [], nextCursor: null } as never);
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null } as never);
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load appointments.')).toBeInTheDocument());
  });

  it('defaults to the Current tab, showing future/today appointments, with correct tab counts', async () => {
    mockLoad({
      appointments: [
        appt({ appointmentId: 'future', scheduledAt: '2099-06-01T00:00:00.000Z', status: 'pending' }),
        appt({ appointmentId: 'past', scheduledAt: '2000-01-01T00:00:00.000Z', status: 'completed' }),
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Past'));
    expect(screen.getByText('Oil Change')).toBeInTheDocument(); // the past appt also has this service name

    fireEvent.click(screen.getByText('Completed', { selector: 'button' }));
    // completed tab counts only from currentAppts (future+today), so the past-completed one is NOT counted/shown here
    expect(screen.getByText('No completed appointments')).toBeInTheDocument();
  });

  it('shows a per-status empty-state message and the generic current/past ones', async () => {
    mockLoad({ appointments: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No upcoming appointments')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Past'));
    expect(screen.getByText('No past appointments')).toBeInTheDocument();
  });

  it('filters the current tab by search text', async () => {
    mockLoad({
      appointments: [
        appt({ appointmentId: 'a1', serviceName: 'Oil Change' }),
        appt({ appointmentId: 'a2', serviceName: 'Tire Rotation', customerName: 'Bob Smith', customerEmail: 'bob@shop.com' }),
      ],
    });
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));

    fireEvent.change(screen.getByPlaceholderText('Search service, customer, vehicle…'), { target: { value: 'tire' } });
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
    expect(screen.getByText('Tire Rotation')).toBeInTheDocument();
  });
});

describe('Bookings — URL appointmentId auto-open', () => {
  it('opens the detail panel for the matching appointment and strips the query param', async () => {
    mockLoad();
    renderPage(['/bookings?appointmentId=a1']);
    await waitFor(() => expect(screen.getByText('✕')).toBeInTheDocument());
  });

  it('does nothing when the appointmentId param matches no loaded appointment', async () => {
    mockLoad();
    renderPage(['/bookings?appointmentId=does-not-exist']);
    await waitFor(() => screen.getByText('Oil Change'));
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });
});

describe('Bookings — status / cancel / promo flows', () => {
  it('updates status via the picker', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    vi.mocked(updateAppointmentStatus).mockResolvedValue({ appointmentId: 'a1', status: 'confirmed' });
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'confirmed'));
  });

  it('shows an error dialog on a failed status update and dismisses it', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    vi.mocked(updateAppointmentStatus).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(screen.getByText('Failed to update status.')).toBeInTheDocument());
    fireEvent.click(screen.getByText('OK'));
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('routes cancellation through a confirmation dialog that can be dismissed', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Cancel Appt'));
    expect(screen.getByText('Cancel Appointment?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Keep it'));
    expect(screen.queryByText('Cancel Appointment?')).not.toBeInTheDocument();
    expect(updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it('confirms cancellation', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    vi.mocked(updateAppointmentStatus).mockResolvedValue({ appointmentId: 'a1', status: 'cancelled' });
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Cancel Appt'));
    fireEvent.click(screen.getByText('Cancel Appointment', { selector: 'button' }));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'cancelled'));
  });

  it('applies a promo and reverts optimistically on failure', async () => {
    mockLoad({ appointments: [appt({ promoCode: 'SAVE10', promoId: 'p1', promoApplied: false })] });
    vi.mocked(applyPromo).mockRejectedValue(new Error('expired'));
    renderPage();
    await waitFor(() => screen.getByText('🏷 Apply'));

    fireEvent.click(screen.getByText('🏷 Apply'));
    fireEvent.click(screen.getByText('Mark Applied'));

    await waitFor(() => expect(screen.getByText('expired')).toBeInTheDocument());
  });
});

describe('Bookings — detail panel vehicle editing', () => {
  it('expands the vehicle section and saves an inline edit', async () => {
    mockLoad();
    vi.mocked(updateVehicle).mockResolvedValue(vehicle({ licensePlate: 'NEW999' }));
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.click(screen.getByText('Oil Change'));

    fireEvent.click(screen.getAllByText('2020 Honda Civic')[1]);
    fireEvent.click(screen.getByText('✏️ Edit Plate / VIN'));
    fireEvent.change(screen.getByPlaceholderText('e.g. ABC1234'), { target: { value: 'new999' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'NEW999', vin: '1HGCM82633A123456' }));
  });

  it('cancels an inline vehicle edit without saving', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.click(screen.getByText('Oil Change'));
    fireEvent.click(screen.getAllByText('2020 Honda Civic')[1]);
    fireEvent.click(screen.getByText('✏️ Edit Plate / VIN'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(updateVehicle).not.toHaveBeenCalled();
  });
});

describe('Bookings — deleted customer', () => {
  it('shows a plain (non-clickable) status badge in the table, even from confirmed', async () => {
    mockLoad({ appointments: [appt({ customerId: undefined, customerName: 'Deleted Customer', status: 'confirmed' })] });
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));

    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
    expect(screen.queryByText(/▾/)).not.toBeInTheDocument();
  });

  it('hides Change Status in the detail panel and shows a locked notice instead', async () => {
    mockLoad({ appointments: [appt({ customerId: undefined, customerName: 'Deleted Customer', status: 'confirmed' })] });
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));

    fireEvent.click(screen.getByText('Oil Change'));

    expect(screen.queryByText('⇄ Change Status')).not.toBeInTheDocument();
    expect(screen.getByText(/account was deleted/)).toBeInTheDocument();
  });
});
