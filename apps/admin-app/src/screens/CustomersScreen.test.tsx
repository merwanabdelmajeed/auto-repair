import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import CustomersScreen from './CustomersScreen';
import { listCustomers, updateCustomer } from '../api/customers';
import { listVehicles } from '../api/vehicles';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, []) };
});
jest.mock('../api/customers', () => ({ listCustomers: jest.fn(), updateCustomer: jest.fn() }));
jest.mock('../api/vehicles', () => ({ listVehicles: jest.fn() }));
jest.mock('../components/AddVehicleForm', () => {
  const { Text, View } = require('react-native');
  return ({ customerId, onAdded, onCancel }: { customerId: string; onAdded: (v: unknown) => void; onCancel: () => void }) => (
    <View>
      <Text>AddVehicleForm:{customerId}</Text>
      <Text onPress={() => onAdded({ vehicleId: 'v9', customerId, make: 'HONDA', model: 'Accord', year: 2003, licensePlate: '', color: 'Silver', createdAt: 'c' })}>form-add</Text>
      <Text onPress={onCancel}>form-cancel</Text>
    </View>
  );
});

function customer(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'u1', email: 'jane@shop.com', firstName: 'Jane', lastName: 'Doe',
    phone: '5551234567', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function vehicle(overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: 'v1', customerId: 'u1', make: 'Honda', model: 'Civic', year: 2020,
    licensePlate: 'ABC123', color: 'blue', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mockNavigate = jest.fn();

function setupApis(customers = [customer()], vehicles = [vehicle()]) {
  (listCustomers as jest.Mock).mockResolvedValue({ items: customers, nextCursor: null });
  (listVehicles as jest.Mock).mockResolvedValue({ items: vehicles, nextCursor: null });
}

beforeEach(() => jest.clearAllMocks());

describe('CustomersScreen', () => {
  it('loads and renders customers with total/showing stats', async () => {
    setupApis();
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());
    expect(screen.getByText('jane@shop.com')).toBeTruthy();
  });

  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listCustomers as jest.Mock).mockRejectedValue(new Error('down'));
    (listVehicles as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });

    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load customers.'));
  });

  it('shows the empty state when there are no customers', async () => {
    setupApis([], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('No Customers Yet')).toBeTruthy());
  });

  it('filters customers by search text', async () => {
    setupApis([customer(), customer({ userId: 'u2', firstName: 'Bob', lastName: 'Smith', email: 'bob@shop.com' })]);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search by name, email, or phone…'), 'bob');

    expect(screen.getByText('Bob Smith')).toBeTruthy();
    expect(screen.queryByText('Jane Doe')).toBeNull();
  });

  it('shows a "no matches" empty state when the search has no results', async () => {
    setupApis();
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search by name, email, or phone…'), 'zzz-nomatch');

    expect(screen.getByText('No matches found')).toBeTruthy();
  });

  it('clears the search when the clear icon is pressed', async () => {
    setupApis();
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search by name, email, or phone…'), 'bob');
    fireEvent.press(screen.getByText('close-circle'));

    expect(screen.getByPlaceholderText('Search by name, email, or phone…').props.value).toBe('');
  });

  it('filters to a single customer when route.params.customerId is set, with a "back to all" banner', async () => {
    setupApis([customer(), customer({ userId: 'u2', firstName: 'Bob', lastName: 'Smith', email: 'bob@shop.com' })]);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: { customerId: 'u2' } }} />);

    await waitFor(() => expect(screen.getByText('Bob Smith')).toBeTruthy());
    expect(screen.queryByText('Jane Doe')).toBeNull();

    fireEvent.press(screen.getByText('Back to all customers'));
    expect(mockNavigate).toHaveBeenCalledWith('Customers', { customerId: undefined });
  });

  it('opens the customer detail modal and shows vehicles, then navigates to Vehicles on a vehicle press', async () => {
    setupApis([customer()], [vehicle()]);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.press(screen.getByText('Jane Doe'));

    expect(screen.getByText('Customer Details')).toBeTruthy();
    expect(screen.getByText('Vehicles (1)')).toBeTruthy();
    expect(screen.getByText('2020 Honda Civic')).toBeTruthy();

    fireEvent.press(screen.getByText('2020 Honda Civic'));
    expect(mockNavigate).toHaveBeenCalledWith('Vehicles', { customerId: 'u1' });
  });

  it('shows "No vehicles registered" when a customer has none', async () => {
    setupApis([customer()], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.press(screen.getByText('Jane Doe'));

    expect(screen.getByText('No vehicles registered')).toBeTruthy();
  });

  it('shows a fallback display name and initial for a customer with no first/last name', async () => {
    setupApis([customer({ firstName: '', lastName: '', email: 'noname@shop.com' })], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('noname@shop.com')).toBeTruthy());
  });

  it('shows "Inactive" status in the detail modal', async () => {
    setupApis([customer({ status: 'INACTIVE' })], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.press(screen.getByText('Jane Doe'));

    expect(screen.getByText('Inactive')).toBeTruthy();
  });

  it('shows phone and address in the detail modal', async () => {
    setupApis([customer({
      phone: '(949) 555-1234',
      address: { line1: '1 Main St', city: 'Irvine', state: 'CA', postalCode: '92618' },
    })], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.press(screen.getByText('Jane Doe'));

    expect(screen.getAllByText('(949) 555-1234').length).toBeGreaterThan(0);
    expect(screen.getByText('1 Main St, Irvine, CA 92618')).toBeTruthy();
  });

  it('search by phone returns every customer sharing that number', async () => {
    setupApis([
      customer({ phone: '(949) 555-1234' }),
      customer({ userId: 'u2', firstName: 'Bob', lastName: 'Smith', email: 'bob@shop.com', phone: '(949) 555-1234' }),
      customer({ userId: 'u3', firstName: 'Ann', lastName: 'Lee', email: 'ann@shop.com', phone: '(714) 000-0000' }),
    ], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search by name, email, or phone…'), '949-555-1234');

    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('Bob Smith')).toBeTruthy();
    expect(screen.queryByText('Ann Lee')).toBeNull();

    fireEvent.press(screen.getByText('Bob Smith'));
    expect(screen.getByText('Customer Details')).toBeTruthy();
    expect(screen.getAllByText('bob@shop.com')).toHaveLength(2);
  });

  describe('editing the phone number', () => {
    async function openJane(overrides: Record<string, unknown> = {}) {
      setupApis([customer(overrides)], []);
      render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());
      fireEvent.press(screen.getByText('Jane Doe'));
    }

    it('saves a formatted phone and updates the list and modal', async () => {
      (updateCustomer as jest.Mock).mockResolvedValue({ userId: 'u1', phone: '(714) 222-3333' });
      await openJane();

      fireEvent.press(screen.getByTestId('edit-phone-btn'));
      fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), '7142223333');
      expect(screen.getByPlaceholderText('(555) 555-5555').props.value).toBe('(714) 222-3333');
      fireEvent.press(screen.getByTestId('save-phone-btn'));

      await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('u1', { phone: '(714) 222-3333' }));
      await waitFor(() => expect(screen.queryByPlaceholderText('(555) 555-5555')).toBeNull());
      // Shown on both the list row and the modal.
      expect(screen.getAllByText('(714) 222-3333')).toHaveLength(2);
    });

    it('offers "Add" when the customer has no phone yet', async () => {
      await openJane({ phone: null });
      expect(screen.getByText('No phone number')).toBeTruthy();
      expect(within(screen.getByTestId('edit-phone-btn')).getByText('Add')).toBeTruthy();
    });

    it('requires a non-empty phone', async () => {
      await openJane();
      fireEvent.press(screen.getByTestId('edit-phone-btn'));
      fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), '');
      fireEvent.press(screen.getByTestId('save-phone-btn'));

      expect(screen.getByText('Phone number is required.')).toBeTruthy();
      expect(updateCustomer).not.toHaveBeenCalled();
    });

    it('shows an error and keeps editing when the save fails', async () => {
      (updateCustomer as jest.Mock).mockRejectedValue(new Error('down'));
      await openJane();
      fireEvent.press(screen.getByTestId('edit-phone-btn'));
      fireEvent.press(screen.getByTestId('save-phone-btn'));

      await waitFor(() => expect(screen.getByText('Failed to save phone number.')).toBeTruthy());
      expect(screen.getByPlaceholderText('(555) 555-5555')).toBeTruthy();
    });

    it('cancel discards the edit', async () => {
      await openJane();
      fireEvent.press(screen.getByTestId('edit-phone-btn'));
      fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), '111');
      fireEvent.press(screen.getByTestId('cancel-phone-btn'));

      expect(screen.queryByPlaceholderText('(555) 555-5555')).toBeNull();
      expect(updateCustomer).not.toHaveBeenCalled();
    });
  });

  describe('editing the address', () => {
    async function openJane(overrides: Record<string, unknown> = {}) {
      setupApis([customer(overrides)], []);
      render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());
      fireEvent.press(screen.getByText('Jane Doe'));
    }

    it('adds an address split into fields and shows it formatted', async () => {
      (updateCustomer as jest.Mock).mockResolvedValue({});
      await openJane();
      expect(screen.getByText('No address')).toBeTruthy();

      fireEvent.press(screen.getByTestId('edit-address-btn'));
      fireEvent.changeText(screen.getByPlaceholderText('Street address'), ' 1 Main St ');
      fireEvent.changeText(screen.getByPlaceholderText('City'), 'Irvine');
      fireEvent.changeText(screen.getByPlaceholderText('State'), 'CA');
      fireEvent.changeText(screen.getByPlaceholderText('ZIP code'), '92618');
      fireEvent.press(screen.getByTestId('save-address-btn'));

      await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('u1', {
        address: { line1: '1 Main St', city: 'Irvine', state: 'CA', postalCode: '92618' },
      }));
      await waitFor(() => expect(screen.getByText('1 Main St, Irvine, CA 92618')).toBeTruthy());
      expect(screen.queryByPlaceholderText('Street address')).toBeNull();
    });

    it('pre-fills the form and clears the address when every field is emptied', async () => {
      (updateCustomer as jest.Mock).mockResolvedValue({});
      await openJane({ address: { line1: '1 Main St', city: 'Irvine' } });

      fireEvent.press(screen.getByTestId('edit-address-btn'));
      expect(screen.getByPlaceholderText('Street address').props.value).toBe('1 Main St');
      fireEvent.changeText(screen.getByPlaceholderText('Street address'), '');
      fireEvent.changeText(screen.getByPlaceholderText('City'), '');
      fireEvent.press(screen.getByTestId('save-address-btn'));

      await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('u1', { address: null }));
      await waitFor(() => expect(screen.getByText('No address')).toBeTruthy());
    });

    it('shows an error and keeps the form open when the save fails', async () => {
      (updateCustomer as jest.Mock).mockRejectedValue(new Error('down'));
      await openJane();
      fireEvent.press(screen.getByTestId('edit-address-btn'));
      fireEvent.press(screen.getByTestId('save-address-btn'));

      await waitFor(() => expect(screen.getByText('Failed to save address.')).toBeTruthy());
      expect(screen.getByPlaceholderText('Street address')).toBeTruthy();
    });

    it('cancel discards the edit', async () => {
      await openJane();
      fireEvent.press(screen.getByTestId('edit-address-btn'));
      fireEvent.changeText(screen.getByPlaceholderText('City'), 'Irvine');
      fireEvent.press(screen.getByTestId('cancel-address-btn'));

      expect(screen.queryByPlaceholderText('City')).toBeNull();
      expect(updateCustomer).not.toHaveBeenCalled();
    });
  });

  it('adds a vehicle for the customer from the detail modal', async () => {
    setupApis([customer()], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());
    fireEvent.press(screen.getByText('Jane Doe'));
    expect(screen.getByText('Vehicles (0)')).toBeTruthy();

    fireEvent.press(screen.getByTestId('add-vehicle-btn'));
    expect(screen.getByText('AddVehicleForm:u1')).toBeTruthy();
    expect(screen.queryByTestId('add-vehicle-btn')).toBeNull();

    fireEvent.press(screen.getByText('form-add'));
    expect(screen.getByText('Vehicles (1)')).toBeTruthy();
    expect(screen.getByText('2003 HONDA Accord')).toBeTruthy();
    expect(screen.queryByText('AddVehicleForm:u1')).toBeNull();

    fireEvent.press(screen.getByTestId('add-vehicle-btn'));
    fireEvent.press(screen.getByText('form-cancel'));
    expect(screen.queryByText('AddVehicleForm:u1')).toBeNull();
  });

  it('closes the detail modal via the close button', async () => {
    setupApis();
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.press(screen.getByText('Jane Doe'));
    expect(screen.getByText('Customer Details')).toBeTruthy();

    fireEvent.press(screen.getByText('close'));
  });
});
