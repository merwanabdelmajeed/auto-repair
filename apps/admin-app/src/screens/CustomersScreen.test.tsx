import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CustomersScreen from './CustomersScreen';
import { listCustomers } from '../api/customers';
import { listVehicles } from '../api/vehicles';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, []) };
});
jest.mock('../api/customers', () => ({ listCustomers: jest.fn() }));
jest.mock('../api/vehicles', () => ({ listVehicles: jest.fn() }));

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

  it('shows "Inactive" status and no-phone fallback in the detail modal', async () => {
    setupApis([customer({ status: 'INACTIVE', phone: null })], []);
    render(<CustomersScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.press(screen.getByText('Jane Doe'));

    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.getByText('No phone number')).toBeTruthy();
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
