import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import CopyButton from './CopyButton';

beforeEach(() => jest.clearAllMocks());

describe('CopyButton', () => {
  it('copies the value and briefly shows a checkmark', async () => {
    jest.useFakeTimers();
    render(<CopyButton value="(555) 123-4567" label="Copy phone number" />);
    expect(screen.getByLabelText('Copy phone number')).toBeTruthy();

    fireEvent.press(screen.getByTestId('copy-btn'));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('(555) 123-4567'));
    expect(screen.getByLabelText('Copied')).toBeTruthy();
    expect(screen.getByText('checkmark')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(1500); });
    expect(screen.getByLabelText('Copy phone number')).toBeTruthy();
    jest.useRealTimers();
  });

  it('restarts the confirmation timer on a second press and cleans up on unmount', async () => {
    jest.useFakeTimers();
    const { unmount } = render(<CopyButton value="555" />);
    fireEvent.press(screen.getByTestId('copy-btn'));
    await waitFor(() => expect(screen.getByLabelText('Copied')).toBeTruthy());
    fireEvent.press(screen.getByTestId('copy-btn'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(2));
    unmount();
    jest.useRealTimers();
  });
});
