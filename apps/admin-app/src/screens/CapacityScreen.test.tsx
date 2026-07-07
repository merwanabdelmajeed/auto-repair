import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CapacityScreen from './CapacityScreen';
import { getCapacity, updateCapacity } from '../api/capacity';
import { listLocations } from '../api/locations';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('../api/capacity', () => ({ getCapacity: jest.fn(), updateCapacity: jest.fn() }));
jest.mock('../api/locations', () => ({ listLocations: jest.fn() }));

function location(overrides: Record<string, unknown> = {}) {
  return { locationId: 'loc1', tenantId: 't1', name: 'Main St', address: '123 Main', isActive: true, createdAt: 'c', updatedAt: 'c', ...overrides };
}

function capacity(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1', locationId: 'loc1', slotDurationMinutes: 30, maxConcurrent: 2,
    operatingHours: {
      monday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
      tuesday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
      wednesday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
      thursday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
      friday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
      saturday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
      sunday: null,
    },
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('CapacityScreen', () => {
  it('shows an alert when loading locations fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listLocations as jest.Mock).mockRejectedValue(new Error('down'));
    render(<CapacityScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load locations.'));
  });

  it('loads settings and renders operating hours in 12h format', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity());
    render(<CapacityScreen />);

    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());
    expect(screen.getAllByText('7:00 AM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5:00 PM').length).toBeGreaterThan(0);
    expect(screen.getByText('Closed')).toBeTruthy();
    expect(screen.getByText('Last saved ' + new Date(capacity().updatedAt).toLocaleString())).toBeTruthy();
  });

  it('shows an alert when loading capacity settings fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockRejectedValue(new Error('down'));
    render(<CapacityScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load capacity settings.'));
  });

  it('switches locations via the chip row and reloads settings', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location(), location({ locationId: 'loc2', name: 'Second St' })]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity());
    render(<CapacityScreen />);

    await waitFor(() => expect(screen.getByText('Second St')).toBeTruthy());
    fireEvent.press(screen.getByText('Second St'));

    await waitFor(() => expect(getCapacity).toHaveBeenCalledWith('loc2'));
  });

  it('changes slot duration via the chip row', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity());
    render(<CapacityScreen />);
    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());

    fireEvent.press(screen.getByText('1h'));
    fireEvent.press(screen.getByText('Save Changes'));

    (updateCapacity as jest.Mock).mockResolvedValue(capacity());
    await waitFor(() => expect(updateCapacity).toHaveBeenCalledWith('loc1', expect.objectContaining({ slotDurationMinutes: 60 })));
  });

  it('increments and decrements max concurrent within 1-10 bounds', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity({ maxConcurrent: 1 }));
    render(<CapacityScreen />);
    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());

    expect(screen.getByText('1')).toBeTruthy();
    fireEvent.press(screen.getByText('remove'));
    expect(screen.getByText('1')).toBeTruthy();

    fireEvent.press(screen.getByText('add'));
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('toggles a day open/closed', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity());
    render(<CapacityScreen />);
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());
    expect(screen.getByText('Closed')).toBeTruthy();

    const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
    fireEvent(switches[switches.length - 1], 'valueChange', true);

    expect(screen.queryByText('Closed')).toBeNull();
  });

  it('edits a time field by tapping it, typing, and blurring', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity());
    render(<CapacityScreen />);
    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());

    fireEvent.press(screen.getAllByText('7:00 AM')[0]);
    const input = screen.getByDisplayValue('07:00');
    fireEvent.changeText(input, '0800');
    fireEvent(input, 'blur');

    expect(screen.getAllByText('8:00 AM').length).toBeGreaterThan(0);
  });

  it('shows Invalid Hours when open is not before close', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity({
      operatingHours: { ...capacity().operatingHours, monday: { open: '17:00', close: '07:00', lastAppointment: '07:00' } },
    }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<CapacityScreen />);
    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());

    fireEvent.press(screen.getByText('Save Changes'));

    expect(alertSpy).toHaveBeenCalledWith('Invalid Hours', 'Open time must be before close time for Monday.');
  });

  it('shows Invalid Hours when the last appointment time is outside open/close', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity({
      operatingHours: { ...capacity().operatingHours, monday: { open: '07:00', close: '17:00', lastAppointment: '18:00' } },
    }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<CapacityScreen />);
    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());

    fireEvent.press(screen.getByText('Save Changes'));

    expect(alertSpy).toHaveBeenCalledWith('Invalid Hours', 'Last appointment time must be between open and close for Monday.');
  });

  it('saves successfully and shows a confirmation alert', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity());
    (updateCapacity as jest.Mock).mockResolvedValue(capacity({ updatedAt: '2026-02-01T00:00:00.000Z' }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<CapacityScreen />);
    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Saved', 'Capacity settings updated.'));
  });

  it('shows an error alert when saving fails', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (getCapacity as jest.Mock).mockResolvedValue(capacity());
    (updateCapacity as jest.Mock).mockRejectedValue(new Error('boom'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<CapacityScreen />);
    // "Monday" also exists in the component's pre-load default state, so it's not
    // a reliable load signal — wait on the "Last saved" text, which only renders
    // once `settings` has actually been populated from the mocked API response.
    await waitFor(() => expect(screen.getByText(/^Last saved /)).toBeTruthy());

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to save settings.'));
  });
});
