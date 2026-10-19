import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Customers from './Customers';
import { listCustomers, updateCustomer, type Customer } from '../api/customers';
import { listVehicles } from '../api/vehicles';

vi.mock('../api/customers', () => ({ listCustomers: vi.fn(), updateCustomer: vi.fn() }));
vi.mock('../api/vehicles', () => ({ listVehicles: vi.fn() }));
vi.mock('../components/AddVehicleForm', () => ({
  default: ({ customerId, onAdded, onCancel }: { customerId: string; onAdded: (v: unknown) => void; onCancel: () => void }) => (
    <div>
      <span>AddVehicleForm:{customerId}</span>
      <button onClick={() => onAdded({ vehicleId: 'v9', customerId, make: 'HONDA', model: 'Accord', trim: null, year: 2003, licensePlate: null, color: 'Silver', createdAt: 'c' })}>form-add</button>
      <button onClick={onCancel}>form-cancel</button>
    </div>
  ),
}));

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
    expect(screen.getByText('555-1234')).toBeInTheDocument();
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

    fireEvent.change(screen.getByPlaceholderText('Search by name, email, or phone…'), { target: { value: 'bob' } });
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by name, email, or phone…'), { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('search by phone returns every customer sharing that number, and shows phone/address in detail', async () => {
    vi.mocked(listCustomers).mockResolvedValue({
      items: [
        customer({ phone: '(949) 555-1234', address: { line1: '1 Main St', city: 'Irvine', state: 'CA', postalCode: '92618' } }),
        customer({ userId: 'c2', firstName: 'Bob', lastName: 'Smith', email: 'bob@shop.com', phone: '(949) 555-1234' }),
        customer({ userId: 'c3', firstName: 'Ann', lastName: 'Lee', email: 'ann@shop.com', phone: '(714) 000-0000' }),
      ],
      nextCursor: null,
    });
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('Jane Doe'));

    fireEvent.change(screen.getByPlaceholderText('Search by name, email, or phone…'), { target: { value: '9495551234' } });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Jane Doe'));
    expect(screen.getByText('1 Main St, Irvine, CA 92618')).toBeInTheDocument();
  });

  describe('editing the phone number', () => {
    async function openJane(overrides: Partial<Customer> = {}) {
      vi.mocked(listCustomers).mockResolvedValue({ items: [customer(overrides)], nextCursor: null });
      vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
      renderPage();
      await waitFor(() => screen.getByText('Jane Doe'));
      fireEvent.click(screen.getByText('Jane Doe'));
    }

    it('saves a formatted phone and updates the list and panel', async () => {
      vi.mocked(updateCustomer).mockResolvedValue({ userId: 'c1', phone: '(714) 222-3333' });
      await openJane();

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '7142223333' } });
      expect(screen.getByLabelText('Phone number')).toHaveValue('(714) 222-3333');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { phone: '(714) 222-3333' }));
      await waitFor(() => expect(screen.queryByLabelText('Phone number')).not.toBeInTheDocument());
      expect(screen.getAllByText('(714) 222-3333')).toHaveLength(2);
    });

    it('saves on Enter and cancels on Escape', async () => {
      vi.mocked(updateCustomer).mockResolvedValue({ userId: 'c1', phone: '555-1234' });
      await openJane();

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.keyDown(screen.getByLabelText('Phone number'), { key: 'Escape' });
      expect(screen.queryByLabelText('Phone number')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.keyDown(screen.getByLabelText('Phone number'), { key: 'Enter' });
      await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { phone: '555-1234' }));
    });

    it('offers "Add" when the customer has no phone yet', async () => {
      await openJane({ phone: null });
      expect(screen.getByText('No phone number')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });

    it('requires a non-empty phone', async () => {
      await openJane();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Phone number is required.');
      expect(updateCustomer).not.toHaveBeenCalled();
    });

    it('shows an error and keeps editing when the save fails; Cancel discards', async () => {
      vi.mocked(updateCustomer).mockRejectedValue(new Error('down'));
      await openJane();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to save phone number.'));
      expect(screen.getByLabelText('Phone number')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByLabelText('Phone number')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('editing the address', () => {
    async function openJane(overrides: Partial<Customer> = {}) {
      vi.mocked(listCustomers).mockResolvedValue({ items: [customer(overrides)], nextCursor: null });
      vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
      renderPage();
      await waitFor(() => screen.getByText('Jane Doe'));
      fireEvent.click(screen.getByText('Jane Doe'));
    }

    it('adds an address split into fields and shows it formatted', async () => {
      vi.mocked(updateCustomer).mockResolvedValue({ userId: 'c1' });
      await openJane();
      expect(screen.getByText('No address')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
      fireEvent.change(screen.getByLabelText('Street address'), { target: { value: ' 1 Main St ' } });
      fireEvent.change(screen.getByLabelText('Apt, suite, unit'), { target: { value: 'Apt 2' } });
      fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Irvine' } });
      fireEvent.change(screen.getByLabelText('State'), { target: { value: 'CA' } });
      fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '92618' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      const address = { line1: '1 Main St', line2: 'Apt 2', city: 'Irvine', state: 'CA', postalCode: '92618' };
      await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { address }));
      await waitFor(() => expect(screen.getByText('1 Main St, Apt 2, Irvine, CA 92618')).toBeInTheDocument());
      expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
    });

    it('saves on Enter, and clears the address when every field is emptied', async () => {
      vi.mocked(updateCustomer).mockResolvedValue({ userId: 'c1' });
      await openJane({ address: { city: 'Irvine' } });

      fireEvent.click(screen.getByRole('button', { name: 'Edit address' }));
      expect(screen.getByLabelText('City')).toHaveValue('Irvine');
      fireEvent.change(screen.getByLabelText('City'), { target: { value: '' } });
      fireEvent.submit(screen.getByLabelText('City').closest('form')!);

      await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { address: null }));
      await waitFor(() => expect(screen.getByText('No address')).toBeInTheDocument());
    });

    it('shows an error when the save fails; Escape and Cancel discard', async () => {
      vi.mocked(updateCustomer).mockRejectedValue(new Error('down'));
      await openJane();

      fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
      fireEvent.keyDown(screen.getByLabelText('City'), { key: 'Escape' });
      expect(screen.queryByLabelText('City')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to save address.'));

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('adds a vehicle for the customer from the detail panel', async () => {
    vi.mocked(listCustomers).mockResolvedValue({ items: [customer()], nextCursor: null });
    vi.mocked(listVehicles).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => screen.getByText('Jane Doe'));
    fireEvent.click(screen.getByText('Jane Doe'));
    expect(screen.getByText('Vehicles (0)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Add vehicle' }));
    expect(screen.getByText('AddVehicleForm:c1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add vehicle' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('form-add'));
    expect(screen.getByText('Vehicles (1)')).toBeInTheDocument();
    expect(screen.getByText('2003 HONDA Accord')).toBeInTheDocument();
    expect(screen.queryByText('AddVehicleForm:c1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Add vehicle' }));
    fireEvent.click(screen.getByText('form-cancel'));
    expect(screen.queryByText('AddVehicleForm:c1')).not.toBeInTheDocument();
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
