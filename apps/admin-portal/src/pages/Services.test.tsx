import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Services from './Services';
import { listServices, createService, updateService, deleteService } from '../api/services';

vi.mock('../api/services', () => ({
  listServices: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
}));

function service(overrides: Partial<Awaited<ReturnType<typeof listServices>>[number]> = {}) {
  return { serviceId: 's1', name: 'Oil Change', description: 'Quick oil change', durationMinutes: 30, price: 49.99, isActive: true, ...overrides };
}

beforeEach(() => vi.clearAllMocks());

describe('Services', () => {
  it('shows an error when loading fails', async () => {
    vi.mocked(listServices).mockRejectedValue(new Error('down'));
    render(<Services />);
    await waitFor(() => expect(screen.getByText('Failed to load services.')).toBeInTheDocument());
  });

  it('shows the empty state when there are no services', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    render(<Services />);
    await waitFor(() => expect(screen.getByText('No services yet')).toBeInTheDocument());
  });

  it('renders the service list', async () => {
    vi.mocked(listServices).mockResolvedValue([service()]);
    render(<Services />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeInTheDocument());
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('validates the Add Service form before saving', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    render(<Services />);
    await waitFor(() => screen.getByText('+ Add Service'));

    fireEvent.click(screen.getByText('+ Add Service'));
    fireEvent.click(screen.getByText('Add Service', { selector: 'button' }));

    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(createService).not.toHaveBeenCalled();
  });

  it('creates a new service and prepends it to the list', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    vi.mocked(createService).mockResolvedValue(service({ serviceId: 'new1', name: 'Tire Rotation' }));
    render(<Services />);
    await waitFor(() => screen.getByText('+ Add Service'));

    fireEvent.click(screen.getByText('+ Add Service'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), { target: { value: 'Tire Rotation' } });
    fireEvent.click(screen.getByText('Add Service', { selector: 'button' }));

    await waitFor(() => expect(screen.getByText('Tire Rotation')).toBeInTheDocument());
  });

  it('opens the edit modal pre-filled when a row is clicked, and saves the update', async () => {
    vi.mocked(listServices).mockResolvedValue([service()]);
    vi.mocked(updateService).mockResolvedValue({ serviceId: 's1' });
    render(<Services />);
    await waitFor(() => screen.getByText('Oil Change'));

    fireEvent.click(screen.getByText('Oil Change'));
    expect(screen.getByText('Edit Service')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Oil Change')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateService).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'Oil Change' })));
  });

  it('shows a save error when the API call fails', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    vi.mocked(createService).mockRejectedValue(new Error('boom'));
    render(<Services />);
    await waitFor(() => screen.getByText('+ Add Service'));

    fireEvent.click(screen.getByText('+ Add Service'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Add Service', { selector: 'button' }));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument());
  });

  it('does not delete when the confirm dialog is declined', async () => {
    vi.mocked(listServices).mockResolvedValue([service()]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Services />);
    await waitFor(() => screen.getByText('Delete'));

    fireEvent.click(screen.getByText('Delete'));

    expect(deleteService).not.toHaveBeenCalled();
  });

  it('deletes a service after confirmation', async () => {
    vi.mocked(listServices).mockResolvedValue([service()]);
    vi.mocked(deleteService).mockResolvedValue({ serviceId: 's1' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Services />);
    await waitFor(() => screen.getByText('Delete'));

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(screen.getByText('No services yet')).toBeInTheDocument());
  });

  it('alerts when delete fails', async () => {
    vi.mocked(listServices).mockResolvedValue([service()]);
    vi.mocked(deleteService).mockRejectedValue(new Error('nope'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Services />);
    await waitFor(() => screen.getByText('Delete'));

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to delete service.'));
  });

  it('closes the modal on Cancel without saving', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    render(<Services />);
    await waitFor(() => screen.getByText('+ Add Service'));

    fireEvent.click(screen.getByText('+ Add Service'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Add Service', { selector: 'h2' })).not.toBeInTheDocument();
  });
});
