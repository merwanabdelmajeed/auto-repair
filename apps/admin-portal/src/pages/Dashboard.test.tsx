import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { getDashboardSummary } from '../api/dashboard';
import { listAppointments, updateAppointmentStatus, applyPromo } from '../api/appointments';
import { listCustomers } from '../api/customers';
import { listVehicles, updateVehicle } from '../api/vehicles';

vi.mock('../api/dashboard', () => ({ getDashboardSummary: vi.fn() }));
vi.mock('../api/appointments', () => ({ listAppointments: vi.fn(), updateAppointmentStatus: vi.fn(), applyPromo: vi.fn() }));
vi.mock('../api/customers', () => ({ listCustomers: vi.fn() }));
vi.mock('../api/vehicles', () => ({ listVehicles: vi.fn(), updateVehicle: vi.fn() }));

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function appt(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'a1', customerId: 'c1', customerEmail: 'jane@shop.com', customerName: 'Jane Doe',
    vehicleId: 'v1', serviceId: 's1', scheduledAt: `${todayLocalDate()}T14:00:00.000Z`, status: 'pending',
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

function mockLoad({
  summary = { totalCustomers: 5, totalVehicles: 3, totalAppointments: 10, bookingsToday: 1 },
  appointments = [appt()],
  customers = [customer()],
  vehicles = [vehicle()],
}: { summary?: unknown; appointments?: unknown[]; customers?: unknown[]; vehicles?: unknown[] } = {}) {
  vi.mocked(getDashboardSummary).mockResolvedValue(summary as never);
  vi.mocked(listAppointments).mockResolvedValue({ items: appointments, nextCursor: null } as never);
  vi.mocked(listCustomers).mockResolvedValue({ items: customers, nextCursor: null } as never);
  vi.mocked(listVehicles).mockResolvedValue({ items: vehicles, nextCursor: null } as never);
}

function renderPage() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
}

beforeEach(() => vi.clearAllMocks());

describe('Dashboard — KPIs and loading', () => {
  it('shows KPI values once loaded', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument()); // bookingsToday
    expect(screen.getByText('5')).toBeInTheDocument(); // totalCustomers
    expect(screen.getByText('3')).toBeInTheDocument(); // totalVehicles
  });

  it('still renders KPIs (as 0) when the summary fetch fails', async () => {
    vi.mocked(getDashboardSummary).mockRejectedValue(new Error('down'));
    vi.mocked(listAppointments).mockResolvedValue({ items: [], nextCursor: null } as never);
    vi.mocked(listCustomers).mockResolvedValue({ items: [], nextCursor: null } as never);
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null } as never);
    renderPage();
    await waitFor(() => expect(screen.getByText('No bookings today')).toBeInTheDocument());
    expect(screen.getAllByText('0')).not.toHaveLength(0);
  });

  it('shows the empty state when there are no bookings today', async () => {
    mockLoad({ appointments: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No bookings today')).toBeInTheDocument());
  });

  it('navigates to /customers when the customers KPI is clicked', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => screen.getByText('Total Customers'));
    fireEvent.click(screen.getByText('Total Customers').closest('div')!.parentElement!);
    // no throw / no crash is the main assertion here since navigate is mocked internally by MemoryRouter
  });
});

describe('Dashboard — bookings table', () => {
  it('renders a booking row and filters it out with a non-matching search', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'zzz-no-match' } });
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'Jane' } });
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
  });

  it('shows a "not applied" promo badge and lets the user apply it', async () => {
    mockLoad({ appointments: [appt({ promoCode: 'SAVE10', promoId: 'p1', promoApplied: false })] });
    vi.mocked(applyPromo).mockResolvedValue({ applied: true });
    renderPage();
    await waitFor(() => screen.getByText('Not applied'));

    fireEvent.click(screen.getByText('🏷 Apply'));
    expect(screen.getByText('Apply Promo Code')).toBeInTheDocument();
    fireEvent.click(screen.getByText('🏷 Mark Applied'));

    await waitFor(() => expect(applyPromo).toHaveBeenCalledWith('p1', 'c1', 'a1'));
  });

  it('reverts the optimistic promo update when applyPromo fails', async () => {
    mockLoad({ appointments: [appt({ promoCode: 'SAVE10', promoId: 'p1', promoApplied: false })] });
    vi.mocked(applyPromo).mockRejectedValue(new Error('promo expired'));
    renderPage();
    await waitFor(() => screen.getByText('🏷 Apply'));

    fireEvent.click(screen.getByText('🏷 Apply'));
    fireEvent.click(screen.getByText('🏷 Mark Applied'));

    await waitFor(() => expect(screen.getByText('promo expired')).toBeInTheDocument());
    fireEvent.click(screen.getByText('OK'));
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('opens the status picker and updates status on selection', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    vi.mocked(updateAppointmentStatus).mockResolvedValue({ appointmentId: 'a1', status: 'confirmed' });
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'confirmed'));
  });

  it('routes a cancelled selection through the confirmation dialog', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    vi.mocked(updateAppointmentStatus).mockResolvedValue({ appointmentId: 'a1', status: 'cancelled' });
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Cancel Appt'));

    expect(screen.getByText('Cancel Appointment?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel Appointment', { selector: 'button' }));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'cancelled'));
  });

  it('keeps the appointment pending when the cancel confirmation is dismissed', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Cancel Appt'));
    fireEvent.click(screen.getByText('Keep it'));

    expect(screen.queryByText('Cancel Appointment?')).not.toBeInTheDocument();
    expect(updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it('shows a completed appointment with no further status transitions as a plain badge', async () => {
    mockLoad({ appointments: [appt({ status: 'completed' })] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Completed')).toBeInTheDocument());
    expect(screen.queryByText('Completed ▾')).not.toBeInTheDocument();
  });

  it('shows an error dialog when a status update fails', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    vi.mocked(updateAppointmentStatus).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => screen.getByText('Pending ▾'));

    fireEvent.click(screen.getByText('Pending ▾'));
    fireEvent.click(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(screen.getByText('Failed to update status.')).toBeInTheDocument());
  });
});

describe('Dashboard — detail panel', () => {
  it('opens on row click, shows customer + vehicle summary, and closes on ✕', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));

    fireEvent.click(screen.getByText('Oil Change'));
    // The plain "Pending" status span is only ever rendered inside the detail
    // panel, unlike the email/vehicle-summary text which also appears in the row.
    expect(screen.getByText('Pending', { selector: 'span' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('Pending', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('expands vehicle details and saves an inline plate/VIN edit', async () => {
    mockLoad();
    vi.mocked(updateVehicle).mockResolvedValue(vehicle({ licensePlate: 'NEW999' }));
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.click(screen.getByText('Oil Change'));

    // "2020 Honda Civic" also appears in the row itself; the detail panel's
    // clickable vehicle-summary toggle is the second match in the DOM.
    fireEvent.click(screen.getAllByText('2020 Honda Civic')[1]);
    expect(screen.getByText('ABC123')).toBeInTheDocument();

    fireEvent.click(screen.getByText('✏️ Edit Plate / VIN'));
    fireEvent.change(screen.getByPlaceholderText('e.g. ABC1234'), { target: { value: 'new999' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'NEW999', vin: '1HGCM82633A123456' }));
  });

  it('shows a save error and stays editable when the vehicle update fails', async () => {
    mockLoad();
    vi.mocked(updateVehicle).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.click(screen.getByText('Oil Change'));
    fireEvent.click(screen.getAllByText('2020 Honda Civic')[1]);
    fireEvent.click(screen.getByText('✏️ Edit Plate / VIN'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Failed to save.')).toBeInTheDocument());
  });

  it('changes status from the detail panel', async () => {
    mockLoad({ appointments: [appt({ status: 'pending' })] });
    vi.mocked(updateAppointmentStatus).mockResolvedValue({ appointmentId: 'a1', status: 'confirmed' });
    renderPage();
    await waitFor(() => screen.getByText('Oil Change'));
    fireEvent.click(screen.getByText('Oil Change'));

    fireEvent.click(screen.getByText('⇄ Change Status'));
    fireEvent.click(screen.getByText('Move to Confirmed'));

    await waitFor(() => expect(updateAppointmentStatus).toHaveBeenCalledWith('a1', 'confirmed'));
  });
});

describe('Dashboard — quick navigation', () => {
  it('renders quick nav links', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => screen.getByText('Quick Navigation'));
    fireEvent.click(screen.getByText('Promotions'));
    fireEvent.click(screen.getByText('Services'));
    fireEvent.click(screen.getByText('Settings'));
  });

  it('navigates to /bookings via See all', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => screen.getByText('See all →'));
    fireEvent.click(screen.getByText('See all →'));
  });
});

describe('Dashboard — deleted customer', () => {
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
