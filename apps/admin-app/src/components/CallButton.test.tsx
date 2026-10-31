import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CallButton from './CallButton';

type AlertButtons = { text: string; onPress?: () => void }[];

function pressAlertButton(alertSpy: jest.SpyInstance, text: string) {
  const buttons = alertSpy.mock.calls[0][2] as AlertButtons;
  buttons.find(b => b.text === text)!.onPress?.();
}

let alertSpy: jest.SpyInstance;
let openSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('CallButton', () => {
  it('asks for confirmation before calling', () => {
    render(<CallButton phone="(949) 555-1234" name="Jane Doe" />);
    fireEvent.press(screen.getByLabelText('Call Jane Doe'));

    expect(alertSpy).toHaveBeenCalledWith('Call Jane Doe?', '(949) 555-1234', expect.any(Array));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('dials the digits only once Call is confirmed', () => {
    render(<CallButton phone="+1 (949) 555-1234" name="Jane Doe" />);
    fireEvent.press(screen.getByTestId('call-btn'));
    pressAlertButton(alertSpy, 'Call');

    expect(openSpy).toHaveBeenCalledWith('tel:+19495551234');
  });

  it('does not dial when cancelled', () => {
    render(<CallButton phone="(949) 555-1234" />);
    fireEvent.press(screen.getByLabelText('Call'));
    expect(alertSpy).toHaveBeenCalledWith('Call this number?', '(949) 555-1234', expect.any(Array));
    pressAlertButton(alertSpy, 'Cancel');

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('explains when the device cannot place calls', async () => {
    openSpy.mockRejectedValue(new Error('unsupported'));
    render(<CallButton phone="(949) 555-1234" name="Jane Doe" />);
    fireEvent.press(screen.getByTestId('call-btn'));
    pressAlertButton(alertSpy, 'Call');

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Unable to call', 'This device cannot place phone calls.'));
  });
});
