import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AddVehicleForm from './AddVehicleForm';
import { addVehicleForCustomer } from '../api/vehicles';
import { decodeVin } from '../utils/vin';

jest.mock('../api/vehicles', () => ({ addVehicleForCustomer: jest.fn() }));
jest.mock('../utils/vin', () => ({ ...jest.requireActual('../utils/vin'), decodeVin: jest.fn() }));

const VIN = '1HGCM82633A004352';
const onAdded = jest.fn();
const onCancel = jest.fn();

beforeEach(() => jest.clearAllMocks());

function renderForm() {
  render(<AddVehicleForm customerId="c1" onAdded={onAdded} onCancel={onCancel} />);
}

const input = (label: string) => screen.getByLabelText(label);

async function enterDecodedVin() {
  (decodeVin as jest.Mock).mockResolvedValue({ status: 'ok', vehicle: { make: 'HONDA', model: 'Accord', year: '2003', trim: 'EX-V6' } });
  fireEvent.changeText(input('VIN'), VIN.toLowerCase());
  await waitFor(() => expect(input('Make').props.value).toBe('HONDA'));
}

describe('AddVehicleForm (admin app)', () => {
  it('keeps every field editable from the start, and offers no plate lookup', () => {
    renderForm();
    for (const label of ['Year', 'Make', 'Model', 'Trim', 'Color', 'License plate']) expect(input(label).props.editable).not.toBe(false);
    expect(screen.queryByText(/look ?up/i)).toBeNull();
    expect(screen.queryByText(/state/i)).toBeNull();
  });

  it('pre-fills and immediately decodes an initial VIN', async () => {
    (decodeVin as jest.Mock).mockResolvedValue({ status: 'ok', vehicle: { make: 'TOYOTA', model: 'Camry', year: '2019', trim: 'LE' } });
    render(<AddVehicleForm customerId="c1" initialVin="4t1b11hk5ku000000" onAdded={onAdded} onCancel={onCancel} />);
    expect(input('VIN').props.value).toBe('4T1B11HK5KU000000');
    await waitFor(() => expect(input('Make').props.value).toBe('TOYOTA'));
    expect(decodeVin).toHaveBeenCalledWith('4T1B11HK5KU000000');
  });

  it('only decodes once the VIN reaches 17 characters', () => {
    renderForm();
    fireEvent.changeText(input('VIN'), '1HGCM826');
    expect(decodeVin).not.toHaveBeenCalled();
    expect(screen.getByText('8/17 characters')).toBeTruthy();
  });

  it('decodes the VIN, fills the details, and adds the vehicle for the customer', async () => {
    const vehicle = { vehicleId: 'v9', customerId: 'c1', make: 'HONDA', model: 'Accord', year: 2003, licensePlate: '7ABC123', color: 'Silver', createdAt: 'c' };
    (addVehicleForCustomer as jest.Mock).mockResolvedValue(vehicle);
    renderForm();

    await enterDecodedVin();
    expect(decodeVin).toHaveBeenCalledWith(VIN);
    expect(input('Year').props.value).toBe('2003');
    fireEvent.changeText(input('Color'), ' Silver ');
    fireEvent.changeText(input('License plate'), '7abc123');
    fireEvent.press(screen.getByTestId('add-vehicle-save'));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(vehicle));
    expect(addVehicleForCustomer).toHaveBeenCalledWith({
      customerId: 'c1', vin: VIN, year: 2003, make: 'HONDA', model: 'Accord', trim: 'EX-V6', color: 'Silver', licensePlate: '7ABC123',
    });
  });

  it('lets the admin enter the details by hand when the VIN does not decode', async () => {
    (decodeVin as jest.Mock).mockResolvedValue({ status: 'not-found' });
    (addVehicleForCustomer as jest.Mock).mockResolvedValue({ vehicleId: 'v9' });
    renderForm();
    fireEvent.changeText(input('VIN'), VIN);
    await waitFor(() => expect(screen.getByText("Couldn't decode this VIN — check it or enter the details manually.")).toBeTruthy());

    fireEvent.changeText(input('Year'), '2019');
    fireEvent.changeText(input('Make'), 'Toyota');
    fireEvent.changeText(input('Model'), 'Camry');
    fireEvent.changeText(input('Color'), 'Blue');
    fireEvent.press(screen.getByTestId('add-vehicle-save'));

    await waitFor(() => expect(addVehicleForCustomer).toHaveBeenCalledWith({
      customerId: 'c1', vin: VIN, year: 2019, make: 'Toyota', model: 'Camry', trim: undefined, color: 'Blue', licensePlate: undefined,
    }));
  });

  it('says the lookup is unavailable (not that the VIN is wrong) during an NHTSA outage', async () => {
    (decodeVin as jest.Mock).mockResolvedValue({ status: 'unavailable' });
    renderForm();
    fireEvent.changeText(input('VIN'), VIN);
    await waitFor(() => expect(screen.getByText('VIN lookup is unavailable right now — enter the details manually.')).toBeTruthy());
    expect(screen.queryByText(/Couldn't decode/)).toBeNull();
  });

  it('still requires a 17-character VIN', () => {
    renderForm();
    fireEvent.changeText(input('VIN'), '1HGCM826');
    for (const [label, value] of [['Year', '2019'], ['Make', 'Toyota'], ['Model', 'Camry'], ['Color', 'Blue']]) {
      fireEvent.changeText(input(label), value);
    }
    fireEvent.press(screen.getByTestId('add-vehicle-save'));
    expect(screen.getByText('VIN must be 17 characters.')).toBeTruthy();
    expect(addVehicleForCustomer).not.toHaveBeenCalled();
  });

  it('names only the missing fields, and requires a valid year', async () => {
    renderForm();
    await enterDecodedVin();

    fireEvent.press(screen.getByTestId('add-vehicle-save'));
    expect(screen.getByText('Color is required.')).toBeTruthy();

    fireEvent.changeText(input('Model'), '');
    fireEvent.press(screen.getByTestId('add-vehicle-save'));
    expect(screen.getByText('Model and color are required.')).toBeTruthy();

    fireEvent.changeText(input('Model'), 'Accord');
    fireEvent.changeText(input('Color'), 'Silver');
    fireEvent.changeText(input('Year'), '1800');
    fireEvent.press(screen.getByTestId('add-vehicle-save'));
    expect(screen.getByText('Please enter a valid year.')).toBeTruthy();
    expect(addVehicleForCustomer).not.toHaveBeenCalled();
  });

  it('shows an error when saving fails', async () => {
    (addVehicleForCustomer as jest.Mock).mockRejectedValue(new Error('down'));
    renderForm();
    await enterDecodedVin();
    fireEvent.changeText(input('Color'), 'Silver');
    fireEvent.press(screen.getByTestId('add-vehicle-save'));

    await waitFor(() => expect(screen.getByText('Failed to add vehicle. Please try again.')).toBeTruthy());
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('cancels', () => {
    renderForm();
    fireEvent.press(screen.getByTestId('add-vehicle-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
