import { renderHook, act, waitFor } from '@testing-library/react';
import { useVehicleEdit, isDifferentCar, describeDecoded } from './useVehicleEdit';
import { updateVehicle, type Vehicle } from '../api/vehicles';
import { decodeVin, type VinDecodeResult } from '../utils/vin';

vi.mock('../api/vehicles', () => ({ updateVehicle: vi.fn() }));
vi.mock('../utils/vin', async () => {
  const actual = await vi.importActual<typeof import('../utils/vin')>('../utils/vin');
  return { ...actual, decodeVin: vi.fn() };
});

const OLD_VIN = '1HGCM82633A004352';
const NEW_VIN = '4T1B11HK5KU000000';
const camry = { make: 'TOYOTA', model: 'Camry', year: '2019', trim: 'LE' };
const accord = { make: 'HONDA', model: 'Accord', year: '2003', trim: 'EX-V6' };

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    vehicleId: 'v1', customerId: 'c1', make: 'HONDA', model: 'Accord', trim: 'EX-V6', year: 2003,
    licensePlate: 'ABC123', color: 'Silver', vin: OLD_VIN, createdAt: 'c', ...overrides,
  };
}

function setup(v = vehicle()) {
  const onSaved = vi.fn();
  const hook = renderHook(() => useVehicleEdit(onSaved));
  act(() => hook.result.current.start(v));
  return { hook, onSaved };
}

async function typeVin(hook: ReturnType<typeof setup>['hook'], vin: string, result?: VinDecodeResult) {
  if (result) vi.mocked(decodeVin).mockResolvedValue(result);
  act(() => hook.result.current.setVin(vin));
  if (result) await waitFor(() => expect(hook.result.current.lookup.status).not.toBe('decoding'));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateVehicle).mockImplementation(async (_id, data) => ({ ...vehicle(), ...data } as Vehicle));
});

describe('isDifferentCar / describeDecoded', () => {
  it('compares year/make/model only, ignoring case, punctuation and trim', () => {
    expect(isDifferentCar(vehicle(), { make: 'honda', model: 'ACCORD', year: '2003', trim: 'LX' })).toBe(false);
    expect(isDifferentCar(vehicle({ make: 'Ford', model: 'F150' }), { make: 'FORD', model: 'F-150', year: '2003' })).toBe(false);
    expect(isDifferentCar(vehicle(), camry)).toBe(true);
    expect(isDifferentCar(vehicle(), { ...accord, year: '2004' })).toBe(true);
    expect(isDifferentCar(vehicle(), { ...accord, model: 'Civic' })).toBe(true);
  });

  it('describes the decoded vehicle', () => {
    expect(describeDecoded(camry)).toBe('2019 TOYOTA Camry LE');
    expect(describeDecoded({ make: 'A', model: 'B', year: '2000' })).toBe('2000 A B');
  });
});

describe('useVehicleEdit', () => {
  it('starts pre-filled, normalizes input, and cancels', () => {
    const { hook } = setup();
    expect(hook.result.current).toMatchObject({ editing: true, plate: 'ABC123', vin: OLD_VIN, canSave: true });
    act(() => hook.result.current.setPlate('xyz 9'));
    act(() => hook.result.current.setVin(' 4t1b-11hk5ku0000'));
    expect(hook.result.current.plate).toBe('XYZ 9');
    expect(hook.result.current.vin).toBe('4T1B11HK5KU0000');
    act(() => hook.result.current.cancel());
    expect(hook.result.current.editing).toBe(false);
  });

  it('only looks up a changed VIN once it reaches 17 characters', () => {
    const { hook } = setup();
    act(() => hook.result.current.setVin('4T1B11HK5KU'));
    act(() => hook.result.current.setVin(OLD_VIN));
    expect(decodeVin).not.toHaveBeenCalled();
    expect(hook.result.current.lookup.status).toBe('idle');
  });

  it('holds Save while the lookup runs', async () => {
    let resolve!: (r: VinDecodeResult) => void;
    vi.mocked(decodeVin).mockReturnValue(new Promise(r => { resolve = r; }));
    const { hook } = setup();
    act(() => hook.result.current.setVin(NEW_VIN));
    expect(hook.result.current.lookup.status).toBe('decoding');
    expect(hook.result.current.canSave).toBe(false);
    await act(() => hook.result.current.save());
    expect(updateVehicle).not.toHaveBeenCalled();

    await act(async () => resolve({ status: 'unavailable' }));
    expect(hook.result.current.canSave).toBe(true);
  });

  it('blocks saving a VIN that belongs to a different car', async () => {
    const { hook } = setup();
    await typeVin(hook, NEW_VIN, { status: 'ok', vehicle: camry });

    expect(hook.result.current.lookup).toEqual({ status: 'different-car', decoded: camry });
    expect(hook.result.current.canSave).toBe(false);
    await act(() => hook.result.current.save());
    expect(hook.result.current.error).toBe('This VIN belongs to a different car — add it as a new vehicle instead.');
    expect(updateVehicle).not.toHaveBeenCalled();
  });

  it('"Add as new vehicle" leaves this vehicle untouched and hands the VIN to the add form', async () => {
    const { hook, onSaved } = setup();
    await typeVin(hook, NEW_VIN, { status: 'ok', vehicle: camry });

    act(() => hook.result.current.startAddAsNew());
    expect(hook.result.current.addNew).toEqual({ customerId: 'c1', vin: NEW_VIN });
    expect(hook.result.current.editing).toBe(false);
    expect(updateVehicle).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();

    act(() => hook.result.current.closeAddAsNew());
    expect(hook.result.current.addNew).toBeNull();
  });

  it('starting a new edit clears a pending add-as-new; startAddAsNew is a no-op when not editing', () => {
    const { hook } = setup();
    act(() => hook.result.current.cancel());
    act(() => hook.result.current.startAddAsNew());
    expect(hook.result.current.addNew).toBeNull();
  });

  it('backing out: changing the VIN back clears the lookup, nothing saved', async () => {
    const { hook } = setup();
    await typeVin(hook, NEW_VIN, { status: 'ok', vehicle: camry });
    act(() => hook.result.current.setVin(OLD_VIN));
    expect(hook.result.current.lookup.status).toBe('idle');
    expect(hook.result.current.canSave).toBe(true);
    expect(updateVehicle).not.toHaveBeenCalled();
  });

  it('ignores a stale lookup that finishes after the VIN changed', async () => {
    let resolveFirst!: (r: VinDecodeResult) => void;
    vi.mocked(decodeVin).mockReturnValueOnce(new Promise(r => { resolveFirst = r; }));
    const { hook } = setup();
    act(() => hook.result.current.setVin(NEW_VIN));
    act(() => hook.result.current.setVin(OLD_VIN));
    await act(async () => resolveFirst({ status: 'ok', vehicle: camry }));
    expect(hook.result.current.lookup.status).toBe('idle');
  });

  it('saves a corrected VIN for the same car (trim differences ignored), or when the lookup fails', async () => {
    for (const [result, status] of [
      [{ status: 'ok', vehicle: { ...accord, trim: 'LX' } }, 'match'],
      [{ status: 'not-found' }, 'not-found'],
      [{ status: 'unavailable' }, 'unavailable'],
    ] as [VinDecodeResult, string][]) {
      vi.mocked(updateVehicle).mockClear();
      const { hook } = setup();
      await typeVin(hook, NEW_VIN, result);
      expect(hook.result.current.lookup.status).toBe(status);
      expect(hook.result.current.canSave).toBe(true);
      await act(() => hook.result.current.save());
      expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'ABC123', vin: NEW_VIN });
    }
  });

  it('saves a plate-only change — even with a legacy non-17-char VIN — without a lookup', async () => {
    const { hook, onSaved } = setup(vehicle({ vin: 'old-vin' }));
    act(() => hook.result.current.setPlate(' new1 '));
    await act(() => hook.result.current.save());
    expect(decodeVin).not.toHaveBeenCalled();
    expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'NEW1', vin: 'old-vin' });
    expect(onSaved).toHaveBeenCalled();
  });

  it('rejects a changed VIN that is not 17 characters, and clears an emptied one', async () => {
    const { hook } = setup();
    act(() => hook.result.current.setVin('ABC'));
    await act(() => hook.result.current.save());
    expect(hook.result.current.error).toBe('VIN must be 17 characters.');
    expect(updateVehicle).not.toHaveBeenCalled();

    act(() => hook.result.current.setVin(''));
    await act(() => hook.result.current.save());
    expect(updateVehicle).toHaveBeenCalledWith('v1', { licensePlate: 'ABC123', vin: null });
  });

  it('shows an error and stays editing when the save fails', async () => {
    vi.mocked(updateVehicle).mockRejectedValue(new Error('down'));
    const { hook, onSaved } = setup();
    await act(() => hook.result.current.save());
    expect(hook.result.current.error).toBe('Failed to save.');
    expect(hook.result.current.editing).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does nothing when saving without having started', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useVehicleEdit(onSaved));
    await act(() => result.current.save());
    expect(updateVehicle).not.toHaveBeenCalled();
  });
});
