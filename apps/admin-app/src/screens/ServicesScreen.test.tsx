import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ServicesScreen from './ServicesScreen';
import { listServices, createService, updateService, deleteService } from '../api/services';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, []) };
});
jest.mock('../api/services', () => ({
  listServices: jest.fn(),
  createService: jest.fn(),
  updateService: jest.fn(),
  deleteService: jest.fn(),
}));

function service(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: 's1', name: 'Oil Change', description: 'Basic oil change',
    price: 49.99, isActive: true,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('ServicesScreen', () => {
  it('shows the empty state and opens the add-service modal from it', async () => {
    (listServices as jest.Mock).mockResolvedValue([]);
    render(<ServicesScreen />);

    await waitFor(() => expect(screen.getByText('No Services Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Add Service'));
    expect(screen.getByText('Service Name *')).toBeTruthy();
  });

  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listServices as jest.Mock).mockRejectedValue(new Error('down'));
    render(<ServicesScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load services.'));
  });

  it('lists services with Active/Inactive badges and no price', async () => {
    (listServices as jest.Mock).mockResolvedValue([service(), service({ serviceId: 's2', name: 'Brake Check', isActive: false, price: null })]);
    render(<ServicesScreen />);

    await waitFor(() => expect(screen.getByText('Services (2)')).toBeTruthy());
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Inactive')).toBeTruthy();
    // Prices are not shown in the admin app — no dollar amount should render.
    expect(screen.queryByText('$49.99')).toBeNull();
  });

  it('validates the name field is required', async () => {
    (listServices as jest.Mock).mockResolvedValue([]);
    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('No Services Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Add Service'));
    fireEvent.press(screen.getAllByText('Add Service')[screen.getAllByText('Add Service').length - 1]);
    expect(screen.getByText('Service name is required.')).toBeTruthy();
  });

  it('creates a new service and prepends it to the list', async () => {
    (listServices as jest.Mock).mockResolvedValue([]);
    (createService as jest.Mock).mockResolvedValue(service({ serviceId: 'new1', name: 'Tire Rotation' }));
    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('No Services Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Add Service'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Oil Change'), 'Tire Rotation');
    fireEvent.press(screen.getAllByText('Add Service')[screen.getAllByText('Add Service').length - 1]);

    await waitFor(() => expect(createService).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Tire Rotation')).toBeTruthy());
  });

  it('opens the edit modal pre-filled, and saves changes', async () => {
    (listServices as jest.Mock).mockResolvedValue([service()]);
    (updateService as jest.Mock).mockResolvedValue({ serviceId: 's1' });
    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    expect(screen.getByText('Edit Service')).toBeTruthy();
    expect(screen.getByDisplayValue('Oil Change')).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue('Oil Change'), 'Oil Change Deluxe');
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateService).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'Oil Change Deluxe' })));
  });

  it('shows a save error on failure and keeps the modal open', async () => {
    (listServices as jest.Mock).mockResolvedValue([service()]);
    (updateService as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
  });

  it('closes the modal via the close icon', async () => {
    (listServices as jest.Mock).mockResolvedValue([service()]);
    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('Oil Change'));
    expect(screen.getByText('Edit Service')).toBeTruthy();
    fireEvent.press(screen.getByText('close'));
  });

  it('deletes a service after confirmation', async () => {
    (listServices as jest.Mock).mockResolvedValue([service()]);
    (deleteService as jest.Mock).mockResolvedValue({ serviceId: 's1' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const del = buttons?.find(b => b.text === 'Delete');
      del?.onPress?.();
    });

    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('trash-outline'));

    expect(alertSpy).toHaveBeenCalledWith('Delete Service', 'Delete "Oil Change"? This cannot be undone.', expect.any(Array));
    await waitFor(() => expect(deleteService).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.queryByText('Oil Change')).toBeNull());
  });

  it('shows an error alert when delete fails', async () => {
    (listServices as jest.Mock).mockResolvedValue([service()]);
    (deleteService as jest.Mock).mockRejectedValue(new Error('fail'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Delete Service') {
        const del = buttons?.find(b => b.text === 'Delete');
        del?.onPress?.();
      }
    });

    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('trash-outline'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to delete service.'));
  });

  it('does not delete when cancelled', async () => {
    (listServices as jest.Mock).mockResolvedValue([service()]);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find(b => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    render(<ServicesScreen />);
    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());

    fireEvent.press(screen.getByText('trash-outline'));

    expect(deleteService).not.toHaveBeenCalled();
  });
});
