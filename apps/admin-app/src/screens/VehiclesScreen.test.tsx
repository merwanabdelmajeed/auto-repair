import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import VehiclesScreen from './VehiclesScreen';
import { listVehicles, updateVehicle } from '../api/vehicles';
import { listCustomers } from '../api/customers';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('../api/vehicles', () => ({ listVehicles: jest.fn(), updateVehicle: jest.fn() }));
jest.mock('../api/customers', () => ({ listCustomers: jest.fn() }));

function vehicle(overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: 'v1', customerId: 'u1', make: 'Honda', model: 'Civic', year: 2020,
    licensePlate: 'ABC123', color: 'Blue', vin: '1HGCM82633A123456', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function customer(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'u1', email: 'jane@shop.com', firstName: 'Jane', lastName: 'Doe',
    phone: '5551234567', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mockNavigate = jest.fn();

function setupApis(vehicles = [vehicle()], customers = [customer()]) {
  (listVehicles as jest.Mock).mockResolvedValue({ items: vehicles, nextCursor: null });
  (listCustomers as jest.Mock).mockResolvedValue({ items: customers, nextCursor: null });
}

beforeEach(() => jest.clearAllMocks());

describe('VehiclesScreen', () => {
  it('loads and renders vehicles with owner and plate', async () => {
    setupApis();
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);

    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByText('1 vehicle')).toBeTruthy();
  });

  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listVehicles as jest.Mock).mockRejectedValue(new Error('down'));
    (listCustomers as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load vehicles.'));
  });

  it('shows the empty state when there are no vehicles', async () => {
    setupApis([], []);
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('No Vehicles')).toBeTruthy());
  });

  it('shows "No plate" for a vehicle without a license plate', async () => {
    setupApis([vehicle({ licensePlate: null })]);
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('No plate')).toBeTruthy());
  });

  it('shows the vehicle trim when present', async () => {
    setupApis([vehicle({ trim: 'Sport' })]);
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic Sport')).toBeTruthy());
  });

  it('filters vehicles by search text', async () => {
    setupApis([vehicle(), vehicle({ vehicleId: 'v2', make: 'Toyota', model: 'Camry' })]);
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search by make, model, plate, VIN…'), 'toyota');

    expect(screen.getByText('2020 Toyota Camry')).toBeTruthy();
    expect(screen.queryByText('2020 Honda Civic')).toBeNull();
  });

  it('shows a "no matches" empty state for a search with no results', async () => {
    setupApis();
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search by make, model, plate, VIN…'), 'zzz-nomatch');

    expect(screen.getByText('No matches found')).toBeTruthy();
  });

  it('clears the search via the clear icon', async () => {
    setupApis();
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('Search by make, model, plate, VIN…'), 'toyota');
    fireEvent.press(screen.getByText('close-circle'));

    expect(screen.getByPlaceholderText('Search by make, model, plate, VIN…').props.value).toBe('');
  });

  it('filters to a single customer via route.params.customerId with a filter banner', async () => {
    setupApis([vehicle(), vehicle({ vehicleId: 'v2', customerId: 'u2', make: 'Toyota', model: 'Camry' })], [customer(), customer({ userId: 'u2', firstName: 'Bob', lastName: 'Smith' })]);
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: { customerId: 'u2' } }} />);

    await waitFor(() => expect(screen.getByText('2020 Toyota Camry')).toBeTruthy());
    expect(screen.queryByText('2020 Honda Civic')).toBeNull();
    expect(screen.getByText('Bob Smith')).toBeTruthy();

    fireEvent.press(screen.getByText('Show all'));
    expect(mockNavigate).toHaveBeenCalledWith('Vehicles', { customerId: undefined });
  });

  it('shows a customer-specific empty message when a filtered customer has no vehicles', async () => {
    setupApis([], [customer()]);
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: { customerId: 'u1' } }} />);
    await waitFor(() => expect(screen.getByText('This customer has no registered vehicles.')).toBeTruthy());
  });

  it('opens the detail modal and shows vehicle + owner info, then navigates to Customers', async () => {
    setupApis();
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.press(screen.getByText('2020 Honda Civic'));

    expect(screen.getByText('Vehicle Details')).toBeTruthy();
    expect(screen.getByText('VIN: 1HGCM82633A123456')).toBeTruthy();
    expect(screen.getByText('Jane Doe')).toBeTruthy();

    fireEvent.press(screen.getByText('Jane Doe'));
    expect(mockNavigate).toHaveBeenCalledWith('Customers', { customerId: 'u1' });
  });

  it('shows fallbacks for a vehicle with no plate/VIN', async () => {
    setupApis([vehicle({ licensePlate: null, vin: null })]);
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.press(screen.getByText('2020 Honda Civic'));

    expect(screen.getByText('No license plate')).toBeTruthy();
    expect(screen.getByText('No VIN on file')).toBeTruthy();
  });

  it('edits and saves the plate and VIN', async () => {
    setupApis();
    (updateVehicle as jest.Mock).mockResolvedValue({ licensePlate: 'XYZ999', vin: 'NEWVIN123' });
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.press(screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('Edit'));

    fireEvent.changeText(screen.getByDisplayValue('ABC123'), 'XYZ999');
    fireEvent.changeText(screen.getByDisplayValue('1HGCM82633A123456'), 'NEWVIN123');
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'XYZ999', vin: 'NEWVIN123' }));
    // Renders both in the card's plate badge and the now-read-only modal detail row.
    await waitFor(() => expect(screen.getAllByText('XYZ999').length).toBe(2));
  });

  it('cancels an edit without saving', async () => {
    setupApis();
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.press(screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('Edit'));
    fireEvent.changeText(screen.getByDisplayValue('ABC123'), 'CHANGED');
    fireEvent.press(screen.getByText('Cancel'));

    expect(updateVehicle).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('CHANGED')).toBeNull();
    // Renders in both the card's plate badge and the reverted-to-read-only modal row.
    expect(screen.getAllByText('ABC123').length).toBe(2);
  });

  it('shows an error alert when saving the edit fails', async () => {
    setupApis();
    (updateVehicle as jest.Mock).mockRejectedValue(new Error('boom'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.press(screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('Edit'));
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to save changes.'));
  });

  it('closes the detail modal via the close icon', async () => {
    setupApis();
    render(<VehiclesScreen navigation={{ navigate: mockNavigate }} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());

    fireEvent.press(screen.getByText('2020 Honda Civic'));
    expect(screen.getByText('Vehicle Details')).toBeTruthy();
    fireEvent.press(screen.getByText('close'));
  });
});
