import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BlockedTimes from './BlockedTimes';
import { listBlockedTimes, createBlockedTime, deleteBlockedTime } from '../api/blockedTimes';
import { listLocations } from '../api/locations';

vi.mock('../api/blockedTimes', () => ({
  listBlockedTimes: vi.fn(),
  createBlockedTime: vi.fn(),
  deleteBlockedTime: vi.fn(),
}));
vi.mock('../api/locations', () => ({ listLocations: vi.fn() }));

function loc(overrides: Partial<Awaited<ReturnType<typeof listLocations>>[number]> = {}) {
  return { locationId: 'loc1', tenantId: 't1', name: 'Main St', address: '1 Main St', isActive: true, createdAt: 'c', updatedAt: 'u', ...overrides };
}
function bt(overrides: Partial<Awaited<ReturnType<typeof listBlockedTimes>>[number]> = {}) {
  return { blockedTimeId: 'b1', tenantId: 't1', locationId: 'loc1', label: 'Holiday', startDate: '2026-12-25', endDate: '2026-12-25', createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

beforeEach(() => vi.clearAllMocks());

describe('BlockedTimes', () => {
  it('disables Add Block and stops loading when there are no locations', async () => {
    vi.mocked(listLocations).mockResolvedValue([]);
    render(<BlockedTimes />);
    await waitFor(() => expect(screen.getByText('+ Add Block')).toBeDisabled());
  });

  it('auto-selects the first active location and loads its blocked times', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc({ locationId: 'inactive', isActive: false }), loc({ locationId: 'active1', isActive: true, name: 'Active Shop' })]);
    vi.mocked(listBlockedTimes).mockResolvedValue([bt()]);

    render(<BlockedTimes />);

    await waitFor(() => expect(listBlockedTimes).toHaveBeenCalledWith('active1'));
    expect(screen.getByText('Holiday')).toBeInTheDocument();
  });

  it('shows the empty state when there are no blocked times', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(listBlockedTimes).mockResolvedValue([]);
    render(<BlockedTimes />);
    await waitFor(() => expect(screen.getByText('No blocked times')).toBeInTheDocument());
  });

  it('switches location and reloads when a location button is clicked', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc({ locationId: 'loc1', name: 'Shop A' }), loc({ locationId: 'loc2', name: 'Shop B', isActive: false })]);
    vi.mocked(listBlockedTimes).mockResolvedValue([]);
    render(<BlockedTimes />);
    await waitFor(() => expect(listBlockedTimes).toHaveBeenCalledWith('loc1'));

    fireEvent.click(screen.getByText('Shop B'));

    await waitFor(() => expect(listBlockedTimes).toHaveBeenCalledWith('loc2'));
  });

  it('validates the Add Block form', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(listBlockedTimes).mockResolvedValue([]);
    render(<BlockedTimes />);
    await waitFor(() => screen.getByText('+ Add Block'));

    fireEvent.click(screen.getByText('+ Add Block'));
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Label is required.')).toBeInTheDocument();
    expect(createBlockedTime).not.toHaveBeenCalled();
  });

  it('rejects a start date after the end date', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(listBlockedTimes).mockResolvedValue([]);
    render(<BlockedTimes />);
    await waitFor(() => screen.getByText('+ Add Block'));

    fireEvent.click(screen.getByText('+ Add Block'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Independence Day, Staff Training'), { target: { value: 'Holiday' } });
    const [startInput, endInput] = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(startInput, { target: { value: '2026-12-31' } });
    fireEvent.change(endInput, { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Start date must be on or before end date.')).toBeInTheDocument();
  });

  it('creates a blocked time and closes the modal', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(listBlockedTimes).mockResolvedValue([]);
    vi.mocked(createBlockedTime).mockResolvedValue(bt({ label: 'New Year' }));
    render(<BlockedTimes />);
    await waitFor(() => screen.getByText('+ Add Block'));

    fireEvent.click(screen.getByText('+ Add Block'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Independence Day, Staff Training'), { target: { value: 'New Year' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('New Year')).toBeInTheDocument());
  });

  it('shows a save error when creation fails', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(listBlockedTimes).mockResolvedValue([]);
    vi.mocked(createBlockedTime).mockRejectedValue(new Error('boom'));
    render(<BlockedTimes />);
    await waitFor(() => screen.getByText('+ Add Block'));

    fireEvent.click(screen.getByText('+ Add Block'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Independence Day, Staff Training'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument());
  });

  it('does not delete when declined, deletes when confirmed, alerts on failure', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(listBlockedTimes).mockResolvedValue([bt()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<BlockedTimes />);
    await waitFor(() => screen.getByText('Remove'));

    fireEvent.click(screen.getByText('Remove'));
    expect(deleteBlockedTime).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    vi.mocked(deleteBlockedTime).mockRejectedValue(new Error('nope'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to remove blocked time.'));

    vi.mocked(deleteBlockedTime).mockResolvedValue({ blockedTimeId: 'b1' });
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => expect(screen.getByText('No blocked times')).toBeInTheDocument());
  });

  it('closes the modal on Cancel', async () => {
    vi.mocked(listLocations).mockResolvedValue([loc()]);
    vi.mocked(listBlockedTimes).mockResolvedValue([]);
    render(<BlockedTimes />);
    await waitFor(() => screen.getByText('+ Add Block'));

    fireEvent.click(screen.getByText('+ Add Block'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Block Dates')).not.toBeInTheDocument();
  });

  it('silently stops loading when listLocations rejects', async () => {
    vi.mocked(listLocations).mockRejectedValue(new Error('down'));
    render(<BlockedTimes />);
    await waitFor(() => expect(screen.getByText('No blocked times')).toBeInTheDocument());
  });
});
