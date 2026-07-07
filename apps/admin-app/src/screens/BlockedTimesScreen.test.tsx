import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import BlockedTimesScreen from './BlockedTimesScreen';
import { listBlockedTimes, createBlockedTime, deleteBlockedTime } from '../api/blockedTimes';
import { listLocations } from '../api/locations';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  // BlockedTimesScreen fires two useFocusEffects, one of which must re-run when
  // selectedLocationId changes — depend on the effect's own (useCallback) identity
  // so it reruns exactly when the real deps array the caller built would change.
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function DateTimePicker(props: { onChange: (e: unknown, d: Date) => void }) {
    return React.createElement(Text, { testID: 'ios-date-picker', onPress: () => props.onChange({ type: 'set' }, new Date(2026, 2, 1)) }, 'picker');
  }
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: { open: jest.fn() },
  };
});
jest.mock('../api/blockedTimes', () => ({
  listBlockedTimes: jest.fn(),
  createBlockedTime: jest.fn(),
  deleteBlockedTime: jest.fn(),
}));
jest.mock('../api/locations', () => ({ listLocations: jest.fn() }));

function location(overrides: Record<string, unknown> = {}) {
  return { locationId: 'loc1', tenantId: 't1', name: 'Main St', address: '123 Main', isActive: true, createdAt: 'c', updatedAt: 'c', ...overrides };
}

function blockedTime(overrides: Record<string, unknown> = {}) {
  return { blockedTimeId: 'bt1', tenantId: 't1', locationId: 'loc1', label: 'Holiday', startDate: '2026-07-04', endDate: '2026-07-04', createdAt: 'c', ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('BlockedTimesScreen', () => {
  it('shows an alert when loading locations fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listLocations as jest.Mock).mockRejectedValue(new Error('down'));
    render(<BlockedTimesScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load locations.'));
  });

  it('shows the empty state once locations and blocked times load', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([]);
    render(<BlockedTimesScreen />);

    await waitFor(() => expect(screen.getByText('No Blocked Times')).toBeTruthy());
    expect(screen.getByText('Main St')).toBeTruthy();
  });

  it('shows an alert when loading blocked times fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockRejectedValue(new Error('down'));
    render(<BlockedTimesScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load blocked times.'));
  });

  it('lists blocked times with a formatted single-day range', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([blockedTime()]);
    render(<BlockedTimesScreen />);

    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());
    expect(screen.getByText('Jul 4, 2026')).toBeTruthy();
  });

  it('formats a multi-day range with an en-dash', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([blockedTime({ startDate: '2026-07-04', endDate: '2026-07-06' })]);
    render(<BlockedTimesScreen />);

    await waitFor(() => expect(screen.getByText('Jul 4, 2026 – Jul 6, 2026')).toBeTruthy());
  });

  it('switches locations via the chip row and reloads', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location(), location({ locationId: 'loc2', name: 'Second St', isActive: true })]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([]);
    render(<BlockedTimesScreen />);

    await waitFor(() => expect(screen.getByText('Second St')).toBeTruthy());
    fireEvent.press(screen.getByText('Second St'));

    await waitFor(() => expect(listBlockedTimes).toHaveBeenCalledWith('loc2'));
  });

  it('validates the label is required', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([]);
    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('No Blocked Times')).toBeTruthy());

    fireEvent.press(screen.getByText('add'));
    fireEvent.press(screen.getByText('Save'));

    expect(screen.getByText('Label is required.')).toBeTruthy();
  });

  it('creates a new blocked time and closes the modal', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([]);
    (createBlockedTime as jest.Mock).mockResolvedValue(blockedTime());
    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('No Blocked Times')).toBeTruthy());

    fireEvent.press(screen.getByText('add'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Independence Day, Staff Training'), 'Holiday');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(createBlockedTime).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());
  });

  it('shows a save error on failure', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([]);
    (createBlockedTime as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('No Blocked Times')).toBeTruthy());

    fireEvent.press(screen.getByText('add'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Independence Day, Staff Training'), 'Holiday');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
  });

  it('opens and applies the iOS start-date picker', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([]);
    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('No Blocked Times')).toBeTruthy());

    fireEvent.press(screen.getByText('add'));
    fireEvent.press(screen.getAllByText('calendar-outline')[0]);
    fireEvent.press(screen.getByTestId('ios-date-picker'));

    expect(screen.getByText('Mar 1, 2026')).toBeTruthy();
  });

  it('closes the modal via the close icon', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([]);
    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('No Blocked Times')).toBeTruthy());

    fireEvent.press(screen.getByText('add'));
    expect(screen.getByText('Block Dates')).toBeTruthy();
    fireEvent.press(screen.getByText('close'));
  });

  it('deletes a blocked time after confirmation', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([blockedTime()]);
    (deleteBlockedTime as jest.Mock).mockResolvedValue({ blockedTimeId: 'bt1' });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const del = buttons?.find(b => b.text === 'Remove');
      del?.onPress?.();
    });

    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());

    fireEvent.press(screen.getByText('trash-outline'));

    await waitFor(() => expect(deleteBlockedTime).toHaveBeenCalledWith('bt1'));
    await waitFor(() => expect(screen.queryByText('Holiday')).toBeNull());
  });

  it('shows an error alert when delete fails', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([blockedTime()]);
    (deleteBlockedTime as jest.Mock).mockRejectedValue(new Error('fail'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Remove Block') {
        const del = buttons?.find(b => b.text === 'Remove');
        del?.onPress?.();
      }
    });

    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());

    fireEvent.press(screen.getByText('trash-outline'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to remove blocked time.'));
  });

  it('does not delete when cancelled', async () => {
    (listLocations as jest.Mock).mockResolvedValue([location()]);
    (listBlockedTimes as jest.Mock).mockResolvedValue([blockedTime()]);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find(b => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    render(<BlockedTimesScreen />);
    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());

    fireEvent.press(screen.getByText('trash-outline'));

    expect(deleteBlockedTime).not.toHaveBeenCalled();
  });
});
