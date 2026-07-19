import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Customers from './Customers';
import { listCustomers } from '../api/customers';
import { listVehicles } from '../api/vehicles';

vi.mock('../api/customers', () => ({ listCustomers: vi.fn() }));
vi.mock('../api/vehicles', () => ({ listVehicles: vi.fn() }));

function customer(overrides: Record<string, unknown> = {}) {
  return { userId: 'c1', email: 'jane@shop.com', firstName: 'Jane', lastName: 'Doe', phone: '555-1234', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
}
function vehicle(overrides: Record<string, unknown> = {}) {
  return { vehicleId: 'v1', customerId: 'c1', make: 'Honda', model: 'Civic', trim: null, year: 2020, licensePlate: 'ABC123', color: 'blue', createdAt: 'c', ...overrides };
}

function renderPage(initialEntries = ['/customers']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Customers />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Customers', () => {
  it('shows an error when loading fails', async () => {
    vi.mocked(listCustomers).mockRejectedValue(new Error('down'));
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load customers.')).toBeInTheDocument());
  });

  it('shows the empty state with a customer-app hint when there is no search', async () => {
    vi.mocked(listCustomers).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('No customers yet')).toBeInTheDocument());
  });

  it('renders customers with their vehicle counts', async () => {
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle(), vehicle({ vehicleId: 'v2' })], nextCursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    expect(screen.getByText('2 vehicles')).toBeInTheDocument();
    expect(screen.queryByText('555-1234')).not.toBeInTheDocument();
  });

  it('falls back to email as the display name and initials when no first/last name', async () => {
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer({ firstName: '', lastName: '', email: 'noname@shop.com' })], nextCursor: null });
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('noname@shop.com')).toBeInTheDocument());
  });

  it('filters by search across name/email, with a "No matches" empty state', async () => {
    vi.mocked(listCustomers).mockResolvedValue({
      items: [customer(), customer({ userId: 'c2', firstName: 'Bob', lastName: 'Smith', email: 'bob@shop.com', phone: '555-9999' })],
      nextCursor: null,
    });
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('Jane Doe'));

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'bob' } });
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('applies a customerId filter from the URL and shows a way back to the full list', async () => {
    vi.mocked(listCustomers).mockResolvedValue({
      items: [customer(), customer({ userId: 'c2', firstName: 'Bob', lastName: 'Smith' })],
      nextCursor: null,
    });
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage(['/customers?customerId=c2']);

    await waitFor(() => expect(screen.getByText('Bob Smith')).toBeInTheDocument());
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('← Back to all customers'));
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
  });

  it('opens and closes the detail panel when a row is clicked', async () => {
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('Jane Doe'));

    fireEvent.click(screen.getByText('Jane Doe'));
    expect(screen.getByText('Customer Details')).toBeInTheDocument();
    expect(screen.getByText('2020 Honda Civic')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Jane Doe')[0]);
    expect(screen.queryByText('Customer Details')).not.toBeInTheDocument();
  });

  it('shows "No vehicles registered" in the detail panel when the customer has none', async () => {
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('Jane Doe'));

    fireEvent.click(screen.getByText('Jane Doe'));

    expect(screen.getByText('No vehicles registered')).toBeInTheDocument();
  });
});
