import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Capacity from './Capacity';
import { getCapacity, updateCapacity } from '../api/capacity';
import { listLocations } from '../api/locations';

vi.mock('../api/capacity', () => ({ getCapacity: vi.fn(), updateCapacity: vi.fn() }));
vi.mock('../api/locations', () => ({ listLocations: vi.fn() }));

function loc(overrides: Record<string, unknown> = {}) {
  return { locationId: 'loc1', tenantId: 't1', name: 'Main St', address: '1 Main St', isActive: true, createdAt: 'c', updatedAt: 'u', ...overrides };
}

const defaultHours = {
  monday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
  tuesday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
  wednesday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
  thursday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
  friday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
  saturday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
  sunday: null,
};

function settings(overrides: Record<string, unknown> = {}) {
  return { tenantId: 't1', locationId: 'loc1', slotDurationMinutes: 30, maxConcurrent: 2, operatingHours: defaultHours, updatedAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

beforeEach(() => vi.clearAllMocks());

describe('Capacity', () => {
  it('shows a placeholder when there are no locations', async () => {
    vi.mocked(listLocations).mockResolvedValue([]);
    render(<Capacity />);
    await waitFor(() => expect(screen.getByText('No locations yet — add one in Settings first.')).toBeInTheDocument());
  });

  it('falls back to the no-locations placeholder when loading locations fails', async () => {
    // The error state is set, but with no selectedLocationId the "no locations"
    // branch takes precedence in the render tree, so the error text itself never shows.
    vi.mocked(listLocations).mockRejectedValue(new Error('down'));
    render(<Capacity />);
    await waitFor(() => expect(screen.getByText('No locations yet — add one in Settings first.')).toBeInTheDocument());
  });

  it('shows an error when loading capacity settings fails', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockRejectedValue(new Error('down'));
    render(<Capacity />);
    await waitFor(() => expect(screen.getByText('Failed to load capacity settings.')).toBeInTheDocument());
  });

  it('loads settings for the auto-selected active location', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockResolvedValue(settings());
    render(<Capacity />);
    await waitFor(() => expect(getCapacity).toHaveBeenCalledWith('loc1'));
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('reloads settings when switching locations', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc({ locationId: 'loc1', name: 'Shop A' }), loc({ locationId: 'loc2', name: 'Shop B', isActive: false })]);
    vi.mocked(getCapacity).mockResolvedValue(settings());
    render(<Capacity />);
    await waitFor(() => expect(getCapacity).toHaveBeenCalledWith('loc1'));

    fireEvent.click(screen.getByText('Shop B'));

    await waitFor(() => expect(getCapacity).toHaveBeenCalledWith('loc2'));
  });

  it('changes slot duration and max concurrent bookings, clamped to [1,10]', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockResolvedValue(settings({ maxConcurrent: 1 }));
    render(<Capacity />);
    await waitFor(() => screen.getByText('1h'));

    fireEvent.click(screen.getByText('1h'));
    expect(screen.getByText('−')).toBeDisabled();

    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('toggles a day closed and back open', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockResolvedValue(settings());
    render(<Capacity />);
    await waitFor(() => screen.getByText('Monday'));

    const mondayRow = screen.getByText('Monday').closest('tr')!;
    const checkbox = mondayRow.querySelector('input[type="checkbox"]')!;
    fireEvent.click(checkbox);
    expect(mondayRow).toHaveTextContent('Closed');

    fireEvent.click(checkbox);
    expect(mondayRow).toHaveTextContent('Open');
  });

  it('rejects an open time on or after the close time', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockResolvedValue(settings());
    render(<Capacity />);
    await waitFor(() => screen.getByText('Monday'));

    const mondayRow = screen.getByText('Monday').closest('tr')!;
    const [openInput] = mondayRow.querySelectorAll('input[type="time"]');
    fireEvent.change(openInput, { target: { value: '18:00' } });
    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.getByText(/Open time must be before close time for Monday/)).toBeInTheDocument();
    expect(updateCapacity).not.toHaveBeenCalled();
  });

  it('rejects a last-appointment time outside the open/close window', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockResolvedValue(settings());
    render(<Capacity />);
    await waitFor(() => screen.getByText('Monday'));

    const mondayRow = screen.getByText('Monday').closest('tr')!;
    const lastApptInput = mondayRow.querySelectorAll('input[type="time"]')[2];
    fireEvent.change(lastApptInput, { target: { value: '20:00' } });
    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.getByText(/Last appointment time must be between open and close for Monday/)).toBeInTheDocument();
  });

  it('saves successfully and shows a confirmation that clears after a timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockResolvedValue(settings());
    vi.mocked(updateCapacity).mockResolvedValue(settings({ updatedAt: '2026-02-01T00:00:00.000Z' }));
    render(<Capacity />);
    await waitFor(() => screen.getByText('Monday'));

    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => expect(screen.getByText('✓ Settings saved successfully.')).toBeInTheDocument());

    vi.advanceTimersByTime(3000);
    await waitFor(() => expect(screen.queryByText('✓ Settings saved successfully.')).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it('shows an error when saving fails', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(getCapacity).mockResolvedValue(settings());
    vi.mocked(updateCapacity).mockRejectedValue(new Error('boom'));
    render(<Capacity />);
    await waitFor(() => screen.getByText('Monday'));

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save settings.')).toBeInTheDocument());
  });
});
