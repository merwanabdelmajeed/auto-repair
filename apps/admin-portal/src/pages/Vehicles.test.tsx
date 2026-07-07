import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Vehicles from './Vehicles';
import { listVehicles, updateVehicle } from '../api/vehicles';
import { listCustomers } from '../api/customers';

vi.mock('../api/vehicles', () => ({ listVehicles: vi.fn(), updateVehicle: vi.fn() }));
vi.mock('../api/customers', () => ({ listCustomers: vi.fn() }));

function vehicle(overrides: Record<string, unknown> = {}) {
  return { vehicleId: 'v1', customerId: 'c1', make: 'Honda', model: 'Civic', trim: null, year: 2020, licensePlate: 'ABC123', color: 'blue', vin: '1HGCM82633A123456', createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
}
function customer(overrides: Record<string, unknown> = {}) {
  return { userId: 'c1', email: 'jane@shop.com', firstName: 'Jane', lastName: 'Doe', phone: '555-1234', status: 'ACTIVE', createdAt: 'c', ...overrides };
}

function renderPage(initialEntries = ['/vehicles']) {
  return render(<MemoryRouter initialEntries={initialEntries}><Vehicles /></MemoryRouter>);
}

beforeEach(() => vi.clearAllMocks());

describe('Vehicles', () => {
  it('shows an error when loading fails', async () => {
    vi.mocked(listVehicles).mockRejectedValue(new Error('down'));
    vi.mocked(listCustomers).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load vehicles.')).toBeInTheDocument());
  });

  it('shows the generic empty state with no vehicles at all', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('No vehicles registered yet')).toBeInTheDocument());
  });

  it('renders a vehicle row with its owner', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeInTheDocument());
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('filters by search text across make/model/plate/VIN, with a search-specific empty state', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle(), vehicle({ vehicleId: 'v2', make: 'Toyota', model: 'Camry', licensePlate: 'XYZ999' })], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('2020 Honda Civic'));

    fireEvent.change(screen.getByPlaceholderText('Search by make, model, plate, or VIN…'), { target: { value: 'toyota' } });
    expect(screen.queryByText('2020 Honda Civic')).not.toBeInTheDocument();
    expect(screen.getByText('2020 Toyota Camry')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by make, model, plate, or VIN…'), { target: { value: 'nomatch123' } });
    expect(screen.getByText('No vehicles match your search')).toBeInTheDocument();
  });

  it('applies a customerId filter and can clear it via Show all', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle(), vehicle({ vehicleId: 'v2', customerId: 'c2', make: 'Toyota' })], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage(['/vehicles?customerId=c1']);

    await waitFor(() => expect(screen.getByText(/Showing vehicles for/)).toBeInTheDocument());
    expect(screen.getByText('2020 Honda Civic')).toBeInTheDocument();
    expect(screen.queryByText('2020 Toyota Civic')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show all'));
    await waitFor(() => expect(screen.queryByText(/Showing vehicles for/)).not.toBeInTheDocument());
  });

  it('shows the customer-specific empty state when the filtered customer has no vehicles', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle({ customerId: 'other' })], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage(['/vehicles?customerId=c1']);
    await waitFor(() => expect(screen.getByText('This customer has no registered vehicles')).toBeInTheDocument());
  });

  it('auto-opens the detail panel when a vehicleId query param matches a loaded vehicle', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage(['/vehicles?vehicleId=v1']);
    await waitFor(() => expect(screen.getByText('Vehicle Details')).toBeInTheDocument());
  });

  it('opens the detail panel on row click and shows plate/VIN/owner', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('2020 Honda Civic'));

    fireEvent.click(screen.getByText('2020 Honda Civic'));

    expect(screen.getByText('Vehicle Details')).toBeInTheDocument();
    expect(screen.getByText('VIN: 1HGCM82633A123456')).toBeInTheDocument();
  });

  it('shows placeholders for a vehicle with no plate/VIN', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle({ licensePlate: null, vin: null })], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.click(screen.getByText('2020 Honda Civic'));

    expect(screen.getByText('No license plate')).toBeInTheDocument();
    expect(screen.getByText('No VIN on file')).toBeInTheDocument();
  });

  it('edits and saves plate/VIN, merging the API response', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    vi.mocked(updateVehicle).mockResolvedValue(vehicle({ licensePlate: 'NEW999' }));
    renderPage();
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.click(screen.getByText('2020 Honda Civic'));

    fireEvent.click(screen.getByText('✏️ Edit Plate / VIN'));
    fireEvent.change(screen.getByPlaceholderText('License plate'), { target: { value: 'new999' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'NEW999', vin: '1HGCM82633A123456' }));
  });

  it('shows an error and stays in edit mode when saving fails', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    vi.mocked(updateVehicle).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.click(screen.getByText('2020 Honda Civic'));

    fireEvent.click(screen.getByText('✏️ Edit Plate / VIN'));
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save changes.')).toBeInTheDocument());
  });

  it('cancels edit mode without saving', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.click(screen.getByText('2020 Honda Civic'));

    fireEvent.click(screen.getByText('✏️ Edit Plate / VIN'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(updateVehicle).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('License plate')).not.toBeInTheDocument();
  });

  it('navigates to the owner\'s customer page when the owner card is clicked', async () => {
    vi.mocked(listVehicles).mockResolvedValue({ items: [vehicle()], nextCursor: null });
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.click(screen.getByText('2020 Honda Civic'));

    fireEvent.click(screen.getByText('jane@shop.com'));

    await waitFor(() => expect(screen.queryByText('Vehicle Details')).not.toBeInTheDocument());
  });
});
