import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddVehicleForm from './AddVehicleForm';
import { addVehicleForCustomer } from '../api/vehicles';
import { decodeVin } from '../utils/vin';

vi.mock('../api/vehicles', () => ({ addVehicleForCustomer: vi.fn() }));
vi.mock('../utils/vin', async () => {
  const actual = await vi.importActual<typeof import('../utils/vin')>('../utils/vin');
  return { ...actual, decodeVin: vi.fn() };
});

const VIN = '1HGCM82633A004352';
const onAdded = vi.fn();
const onCancel = vi.fn();

beforeEach(() => vi.clearAllMocks());

function renderForm() {
  render(<AddVehicleForm customerId="c1" onAdded={onAdded} onCancel={onCancel} />);
}

async function enterDecodedVin() {
  vi.mocked(decodeVin).mockResolvedValue({ status: 'ok', vehicle: { make: 'HONDA', model: 'Accord', year: '2003', trim: 'EX-V6' } });
  fireEvent.change(screen.getByLabelText('VIN'), { target: { value: VIN.toLowerCase() } });
  await waitFor(() => expect(screen.getByLabelText('Make')).toHaveValue('HONDA'));
}

describe('AddVehicleForm', () => {
  it('keeps every field editable from the start, and offers no plate lookup', () => {
    renderForm();
    for (const label of ['Year', 'Make', 'Model', 'Trim', 'Color', 'License plate']) expect(screen.getByLabelText(label)).toBeEnabled();
    expect(screen.queryByText(/look ?up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/state/i)).not.toBeInTheDocument();
  });

  it('pre-fills and immediately decodes an initial VIN', async () => {
    vi.mocked(decodeVin).mockResolvedValue({ status: 'ok', vehicle: { make: 'TOYOTA', model: 'Camry', year: '2019', trim: 'LE' } });
    render(<AddVehicleForm customerId="c1" initialVin="4t1b11hk5ku000000" onAdded={onAdded} onCancel={onCancel} />);
    expect(screen.getByLabelText('VIN')).toHaveValue('4T1B11HK5KU000000');
    await waitFor(() => expect(screen.getByLabelText('Make')).toHaveValue('TOYOTA'));
    expect(decodeVin).toHaveBeenCalledWith('4T1B11HK5KU000000');
  });

  it('only decodes once the VIN reaches 17 characters', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('VIN'), { target: { value: '1HGCM826' } });
    expect(decodeVin).not.toHaveBeenCalled();
    expect(screen.getByText('8/17 characters')).toBeInTheDocument();
  });

  it('decodes the VIN, fills the details, and adds the vehicle for the customer', async () => {
    const vehicle = { vehicleId: 'v9', customerId: 'c1', make: 'HONDA', model: 'Accord', trim: 'EX-V6', year: 2003, licensePlate: '7ABC123', color: 'Silver', createdAt: 'c' };
    vi.mocked(addVehicleForCustomer).mockResolvedValue(vehicle);
    renderForm();

    await enterDecodedVin();
    expect(decodeVin).toHaveBeenCalledWith(VIN);
    expect(screen.getByLabelText('Year')).toHaveValue('2003');
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: ' Silver ' } });
    fireEvent.change(screen.getByLabelText('License plate'), { target: { value: '7abc123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(vehicle));
    expect(addVehicleForCustomer).toHaveBeenCalledWith({
      customerId: 'c1', vin: VIN, year: 2003, make: 'HONDA', model: 'Accord', trim: 'EX-V6', color: 'Silver', licensePlate: '7ABC123',
    });
  });

  it('lets the admin enter the details by hand when the VIN does not decode', async () => {
    vi.mocked(decodeVin).mockResolvedValue({ status: 'not-found' });
    vi.mocked(addVehicleForCustomer).mockResolvedValue({ vehicleId: 'v9' } as never);
    renderForm();
    fireEvent.change(screen.getByLabelText('VIN'), { target: { value: VIN } });
    await waitFor(() => expect(screen.getByText("Couldn't decode this VIN — check it or enter the details manually.")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2019' } });
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Toyota' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Camry' } });
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'Blue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));

    await waitFor(() => expect(addVehicleForCustomer).toHaveBeenCalledWith({
      customerId: 'c1', vin: VIN, year: 2019, make: 'Toyota', model: 'Camry', trim: undefined, color: 'Blue', licensePlate: undefined,
    }));
  });

  it('says the lookup is unavailable (not that the VIN is wrong) during an NHTSA outage', async () => {
    vi.mocked(decodeVin).mockResolvedValue({ status: 'unavailable' });
    renderForm();
    fireEvent.change(screen.getByLabelText('VIN'), { target: { value: VIN } });
    await waitFor(() => expect(screen.getByText('VIN lookup is unavailable right now — enter the details manually.')).toBeInTheDocument());
    expect(screen.queryByText(/Couldn't decode/)).not.toBeInTheDocument();
  });

  it('still requires a 17-character VIN', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('VIN'), { target: { value: '1HGCM826' } });
    for (const [label, value] of [['Year', '2019'], ['Make', 'Toyota'], ['Model', 'Camry'], ['Color', 'Blue']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(screen.getByRole('alert')).toHaveTextContent('VIN must be 17 characters.');
    expect(addVehicleForCustomer).not.toHaveBeenCalled();
  });

  it('names only the missing fields, and requires a valid year', async () => {
    renderForm();
    await enterDecodedVin();

    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/^Color is required\.$/);

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/^Model and color are required\.$/);

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Accord' } });
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'Silver' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '1800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid year.');
    expect(addVehicleForCustomer).not.toHaveBeenCalled();
  });

  it('shows an error when saving fails', async () => {
    vi.mocked(addVehicleForCustomer).mockRejectedValue(new Error('down'));
    renderForm();
    await enterDecodedVin();
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'Silver' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to add vehicle. Please try again.'));
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('cancels via the button or Escape', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(screen.getByLabelText('VIN'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
