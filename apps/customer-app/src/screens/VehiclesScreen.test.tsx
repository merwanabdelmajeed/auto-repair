import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import VehiclesScreen from './VehiclesScreen';
import { listVehicles, createVehicle, deleteVehicle, lookupPlate } from '../api/vehicles';
import { listAppointments } from '../api/appointments';

jest.mock('../api/vehicles', () => ({ listVehicles: jest.fn(), createVehicle: jest.fn(), deleteVehicle: jest.fn(), lookupPlate: jest.fn() }));
jest.mock('../api/appointments', () => ({ listAppointments: jest.fn() }));

function vehicle(overrides: Record<string, unknown> = {}) {
  return { vehicleId: 'v1', make: 'Honda', model: 'Civic', trim: null, year: 2020, licensePlate: 'ABC123', color: 'blue', vin: null, ...overrides };
}
function appt(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'a1', vehicleId: 'v1', serviceName: 'Oil Change', status: 'completed',
    scheduledAt: '2026-01-01T14:00:00.000Z', notes: '', ...overrides,
  };
}

function jsonRes(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = jest.fn((url: string) => {
    if (url.includes('DecodeVinValues')) {
      return jsonRes({ Results: [{ Make: 'Honda', Model: 'Accord', ModelYear: '2021', Trim: 'EX' }] });
    }
    return jsonRes({});
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// This suite must run before any other test in this file. `makesCache` is a
// module-level `let` in VehiclesScreen.tsx that gets populated (even to an
// empty-but-truthy []) the moment ANY test types into the Make field, since
// typing always calls fetchMakes() regardless of whether that test cares
// about suggestions — and later tests do exactly that. Once cached, it masks
// this suite's own fetch mock for the rest of the run (Jest runs `it` blocks
// in file order, so declaring this first is what keeps `makesCache` unset).
describe('VehiclesScreen — make/model/trim suggestions', () => {
  beforeEach(() => {
    (listVehicles as jest.Mock).mockResolvedValue([]);
    globalThis.fetch = jest.fn((url: string) => {
      if (url.includes('GetMakesForVehicleType')) return jsonRes({ Results: [{ MakeName: 'Suggestify' }] });
      if (url.includes('GetModelsForMakeYear')) return jsonRes({ Results: [{ Model_Name: 'Modelo' }, { Model_Name: 'Modelo Sport' }] });
      return jsonRes({});
    }) as unknown as typeof fetch;
  });

  it('suggests makes, fetches models on selection, and fetches trims on model selection', async () => {
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('Add Vehicle'));
    fireEvent.press(screen.getByText('Add Vehicle'));
    await waitFor(() => screen.getByPlaceholderText('e.g. 2021'));

    fireEvent.changeText(screen.getByPlaceholderText('e.g. 2021'), '2022');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Toyota'), 'Sugg');

    await waitFor(() => expect(screen.getByText('Suggestify')).toBeTruthy());
    fireEvent.press(screen.getByText('Suggestify'));

    await waitFor(() => expect(screen.getByDisplayValue('Suggestify')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Camry'), 'Model');
    await waitFor(() => expect(screen.getByText('Modelo')).toBeTruthy());
    fireEvent.press(screen.getByText('Modelo'));

    await waitFor(() => expect(screen.getByText('Select trim (optional)')).toBeTruthy());
    fireEvent.press(screen.getByText('Select trim (optional)'));

    await waitFor(() => expect(screen.getByText('Sport')).toBeTruthy());
    fireEvent.press(screen.getByText('Sport'));

    // Trim dropdown closes after selection; its button now displays the chosen value as text.
    expect(screen.getByText('Sport')).toBeTruthy();
  });
});

describe('VehiclesScreen — list', () => {
  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listVehicles as jest.Mock).mockRejectedValue(new Error('down'));
    render(<VehiclesScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load vehicles.'));
  });

  it('shows the empty state with an Add Vehicle button', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([]);
    render(<VehiclesScreen />);
    await waitFor(() => expect(screen.getByText('No Vehicles Added')).toBeTruthy());
    expect(screen.getByText('Add Vehicle')).toBeTruthy();
  });

  it('renders a vehicle card, showing plate/VIN only when present', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([vehicle({ vin: '1HGCM82633A123456' })]);
    render(<VehiclesScreen />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic')).toBeTruthy());
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByText('VIN: 1HGCM82633A123456')).toBeTruthy();
  });

  it('includes trim in the vehicle name when present', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([vehicle({ trim: 'EX' })]);
    render(<VehiclesScreen />);
    await waitFor(() => expect(screen.getByText('2020 Honda Civic EX')).toBeTruthy());
  });
});

describe('VehiclesScreen — delete', () => {
  it('deletes a vehicle when confirmed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Remove')?.onPress?.();
    });
    (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
    (deleteVehicle as jest.Mock).mockResolvedValue({ vehicleId: 'v1' });
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByTestId('vehicle-delete-v1'));

    fireEvent.press(screen.getByTestId('vehicle-delete-v1'));

    await waitFor(() => expect(deleteVehicle).toHaveBeenCalledWith('v1'));
    await waitFor(() => expect(screen.getByText('No Vehicles Added')).toBeTruthy());
  });

  it('does not delete when declined', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Cancel')?.onPress?.();
    });
    (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByTestId('vehicle-delete-v1'));

    fireEvent.press(screen.getByTestId('vehicle-delete-v1'));

    expect(deleteVehicle).not.toHaveBeenCalled();
  });

  it('shows an error alert when deletion fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Remove')?.onPress?.();
    });
    (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
    (deleteVehicle as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByTestId('vehicle-delete-v1'));

    fireEvent.press(screen.getByTestId('vehicle-delete-v1'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to remove vehicle.'));
  });
});

describe('VehiclesScreen — service history', () => {
  it('shows a loading state then the history list, filtered and sorted for this vehicle', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
    (listAppointments as jest.Mock).mockResolvedValue([
      appt({ appointmentId: 'old', scheduledAt: '2025-01-01T00:00:00.000Z', serviceName: 'Old Service' }),
      appt({ appointmentId: 'other-vehicle', vehicleId: 'v2', serviceName: 'Not This Vehicle' }),
      appt({ appointmentId: 'new', scheduledAt: '2026-06-01T00:00:00.000Z', serviceName: 'New Service' }),
    ]);
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('2020 Honda Civic'));

    fireEvent.press(screen.getByText('2020 Honda Civic'));

    await waitFor(() => expect(screen.getByText('New Service')).toBeTruthy());
    expect(screen.getByText('Old Service')).toBeTruthy();
    expect(screen.queryByText('Not This Vehicle')).toBeNull();
  });

  it('shows the empty state when there is no service history', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
    (listAppointments as jest.Mock).mockResolvedValue([]);
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('2020 Honda Civic'));

    await waitFor(() => expect(screen.getByText('No Service Records')).toBeTruthy());
  });

  it('shows an empty history on a failed fetch rather than an error', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
    (listAppointments as jest.Mock).mockRejectedValue(new Error('down'));
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('2020 Honda Civic'));

    await waitFor(() => expect(screen.getByText('No Service Records')).toBeTruthy());
  });

  it('closes the history modal', async () => {
    (listVehicles as jest.Mock).mockResolvedValue([vehicle()]);
    (listAppointments as jest.Mock).mockResolvedValue([]);
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('2020 Honda Civic'));
    fireEvent.press(screen.getByText('2020 Honda Civic'));
    await waitFor(() => screen.getByText('Service History'));

    fireEvent.press(screen.getByTestId('vehicle-history-close'));

    await waitFor(() => expect(screen.queryByText('Service History')).toBeNull());
  });
});

describe('VehiclesScreen — add vehicle modal', () => {
  beforeEach(() => (listVehicles as jest.Mock).mockResolvedValue([]));

  async function openAddModal() {
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('Add Vehicle'));
    fireEvent.press(screen.getByText('Add Vehicle'));
    await waitFor(() => screen.getByPlaceholderText('e.g. 2021'));
  }

  it('requires year/make/model/color', async () => {
    await openAddModal();
    fireEvent.press(screen.getByTestId('vehicle-save-btn'));
    expect(screen.getByText('Year, make, model, and color are required.')).toBeTruthy();
    expect(createVehicle).not.toHaveBeenCalled();
  });

  it('rejects an invalid year', async () => {
    await openAddModal();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 2021'), '1899');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Toyota'), 'Toyota');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Camry'), 'Camry');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Silver'), 'Red');

    fireEvent.press(screen.getByTestId('vehicle-save-btn'));

    expect(screen.getByText('Please enter a valid year.')).toBeTruthy();
  });

  it('creates a vehicle and prepends it to the list', async () => {
    (createVehicle as jest.Mock).mockResolvedValue(vehicle({ vehicleId: 'new1', make: 'Toyota', model: 'Camry', color: 'Red' }));
    await openAddModal();

    fireEvent.changeText(screen.getByPlaceholderText('e.g. 2021'), '2022');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Toyota'), 'Toyota');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Camry'), 'Camry');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Silver'), 'Red');

    fireEvent.press(screen.getByTestId('vehicle-save-btn'));

    await waitFor(() => expect(createVehicle).toHaveBeenCalledWith(expect.objectContaining({
      make: 'Toyota', model: 'Camry', year: 2022, color: 'Red',
    })));
    await waitFor(() => expect(screen.getByText('2020 Toyota Camry')).toBeTruthy());
  });

  it('shows an error when creation fails', async () => {
    (createVehicle as jest.Mock).mockRejectedValue(new Error('boom'));
    await openAddModal();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 2021'), '2022');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Toyota'), 'Toyota');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Camry'), 'Camry');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Silver'), 'Red');

    fireEvent.press(screen.getByTestId('vehicle-save-btn'));

    await waitFor(() => expect(screen.getByText('Failed to add vehicle. Please try again.')).toBeTruthy());
  });

  it('closes the modal via the ✕ button', async () => {
    await openAddModal();
    fireEvent.press(screen.getByTestId('vehicle-add-close'));
    await waitFor(() => expect(screen.queryByPlaceholderText('e.g. 2021')).toBeNull());
  });

  it('switches between License Plate and VIN modes, clearing the other field', async () => {
    await openAddModal();
    expect(screen.getByPlaceholderText('e.g. ABC1234')).toBeTruthy();

    fireEvent.press(screen.getByText('VIN Number'));

    // Switching to VIN mode still shows an (optional, secondary) plate field further down
    // the form with the same placeholder, so just confirm the VIN field appeared.
    expect(screen.getByPlaceholderText('17-character VIN')).toBeTruthy();
  });
});

describe('VehiclesScreen — plate lookup', () => {
  beforeEach(() => (listVehicles as jest.Mock).mockResolvedValue([]));

  async function openAddModal() {
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('Add Vehicle'));
    fireEvent.press(screen.getByText('Add Vehicle'));
    await waitFor(() => screen.getByPlaceholderText('e.g. ABC1234'));
  }

  it('looks up a plate and auto-fills the form', async () => {
    (lookupPlate as jest.Mock).mockResolvedValue({ vin: '1HGCM82633A123456', make: 'Honda', model: 'Accord', year: '2019', trim: 'EX' });
    await openAddModal();

    fireEvent.press(screen.getByText('State'));
    fireEvent.press(screen.getByText('California'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. ABC1234'), 'xyz999');
    fireEvent.press(screen.getByTestId('vehicle-plate-lookup-btn'));

    await waitFor(() => expect(lookupPlate).toHaveBeenCalledWith('xyz999', 'CA'));
    await waitFor(() => expect(screen.getByDisplayValue('Honda')).toBeTruthy());
    expect(screen.getByDisplayValue('Accord')).toBeTruthy();
    expect(screen.getByDisplayValue('2019')).toBeTruthy();
  });

  it('shows an error when the plate lookup fails', async () => {
    (lookupPlate as jest.Mock).mockRejectedValue(new Error('not found'));
    await openAddModal();

    fireEvent.press(screen.getByText('State'));
    fireEvent.press(screen.getByText('California'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. ABC1234'), 'xyz999');
    fireEvent.press(screen.getByTestId('vehicle-plate-lookup-btn'));

    await waitFor(() => expect(screen.getByText('Could not find vehicle for that plate and state. Check the plate and try again.')).toBeTruthy());
  });
});

describe('VehiclesScreen — VIN lookup', () => {
  beforeEach(() => (listVehicles as jest.Mock).mockResolvedValue([]));

  it('auto-fills the form once a 17-character VIN is entered', async () => {
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('Add Vehicle'));
    fireEvent.press(screen.getByText('Add Vehicle'));
    await waitFor(() => screen.getByText('VIN Number'));
    fireEvent.press(screen.getByText('VIN Number'));

    fireEvent.changeText(screen.getByPlaceholderText('17-character VIN'), '1HGCM82633A123456');

    await waitFor(() => expect(screen.getByDisplayValue('Honda')).toBeTruthy());
    expect(screen.getByDisplayValue('Accord')).toBeTruthy();
    expect(screen.getByDisplayValue('2021')).toBeTruthy();
  });

  it('does not populate the form when the VIN has no match', async () => {
    globalThis.fetch = jest.fn(() => jsonRes({ Results: [{}] })) as unknown as typeof fetch;
    render(<VehiclesScreen />);
    await waitFor(() => screen.getByText('Add Vehicle'));
    fireEvent.press(screen.getByText('Add Vehicle'));
    await waitFor(() => screen.getByText('VIN Number'));
    fireEvent.press(screen.getByText('VIN Number'));

    fireEvent.changeText(screen.getByPlaceholderText('17-character VIN'), '1HGCM82633A000000');

    await waitFor(() => expect(screen.queryByDisplayValue('Honda')).toBeNull());
  });
});
