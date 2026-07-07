import React from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from './HomeScreen';
import { useAuth } from '../auth/AuthContext';
import { listPromotions } from '../api/promotions';
import { getCapacity } from '../api/capacity';

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { shopName: 'Test Shop', shopCity: 'Test City', shopAddress: '123 Main St, Test City' } },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, []) };
});
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/promotions', () => ({ listPromotions: jest.fn() }));
jest.mock('../api/capacity', () => ({ getCapacity: jest.fn() }));

const mockNavigate = jest.fn();

function promo(overrides: Record<string, unknown> = {}) {
  return { promoId: 'p1', code: 'SAVE10', description: '10% off', type: 'percent', value: 10, expiresAt: null, ...overrides };
}

function capacitySettings(todayHours: Record<string, unknown> | null) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayName = days[new Date().getDay()]!;
  const operatingHours: Record<string, unknown> = {};
  days.forEach(d => { operatingHours[d] = d === todayName ? todayHours : null; });
  return { tenantId: 't1', slotDurationMinutes: 30, maxConcurrent: 2, operatingHours, updatedAt: 'u' };
}

function renderScreen() {
  return render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  (listPromotions as jest.Mock).mockResolvedValue([]);
  (getCapacity as jest.Mock).mockResolvedValue(capacitySettings(null));
});

describe('HomeScreen — welcome banner', () => {
  it('greets by given/family name when available', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' } });
    renderScreen();
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());
  });

  it('falls back to email when name is unavailable', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { email: 'jane@shop.com' } });
    renderScreen();
    await waitFor(() => expect(screen.getByText('jane@shop.com')).toBeTruthy());
  });

  it('navigates to Appointments via Book Appointment', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { email: 'jane@shop.com' } });
    renderScreen();
    fireEvent.press(screen.getByText('Book Appointment'));
    expect(mockNavigate).toHaveBeenCalledWith('Appointments');
  });
});

describe('HomeScreen — quick actions', () => {
  beforeEach(() => (useAuth as jest.Mock).mockReturnValue({ user: { email: 'jane@shop.com' } }));

  it('navigates to each quick action screen', () => {
    renderScreen();
    fireEvent.press(screen.getByText('My Vehicles'));
    expect(mockNavigate).toHaveBeenCalledWith('Vehicles');
    fireEvent.press(screen.getByText('Notifications'));
    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });
});

describe('HomeScreen — location card', () => {
  beforeEach(() => (useAuth as jest.Mock).mockReturnValue({ user: { email: 'jane@shop.com' } }));

  it('shows open hours for today', async () => {
    (getCapacity as jest.Mock).mockResolvedValue(capacitySettings({ open: '07:00', close: '17:30' }));
    renderScreen();
    await waitFor(() => expect(screen.getByText(/7:00 AM/)).toBeTruthy());
  });

  it('shows closed today when there are no hours', async () => {
    (getCapacity as jest.Mock).mockResolvedValue(capacitySettings(null));
    renderScreen();
    await waitFor(() => expect(screen.getByText('Closed today')).toBeTruthy());
  });

  it('does not show the hours row when the capacity load fails', async () => {
    (getCapacity as jest.Mock).mockRejectedValue(new Error('down'));
    renderScreen();
    await waitFor(() => expect(screen.getByText('123 Main St, Test City')).toBeTruthy());
    expect(screen.queryByText('Closed today')).toBeNull();
  });

  it('copies the address and reverts the confirmation after a timeout', async () => {
    jest.useFakeTimers();
    renderScreen();
    await waitFor(() => screen.getByText('Copy'));

    fireEvent.press(screen.getByText('Copy'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('123 Main St, Test City');
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());

    jest.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.queryByText('Copied')).toBeNull());
    jest.useRealTimers();
  });

  it('opens navigation using the supported URL scheme', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    renderScreen();
    await waitFor(() => screen.getByText('Navigate'));

    fireEvent.press(screen.getByText('Navigate'));

    await waitFor(() => expect(openURLSpy).toHaveBeenCalled());
  });

  it('falls back to Google Maps URL when the native scheme is unsupported', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    renderScreen();
    await waitFor(() => screen.getByText('Navigate'));

    fireEvent.press(screen.getByText('Navigate'));

    await waitFor(() => expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining('google.com/maps')));
  });

  it('falls back to Google Maps URL when canOpenURL throws', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockRejectedValue(new Error('no handler'));
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    renderScreen();
    await waitFor(() => screen.getByText('Navigate'));

    fireEvent.press(screen.getByText('Navigate'));

    await waitFor(() => expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining('google.com/maps')));
  });
});

describe('HomeScreen — promotions', () => {
  beforeEach(() => (useAuth as jest.Mock).mockReturnValue({ user: { email: 'jane@shop.com' } }));

  it('shows the empty state when there are no active promotions', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('No active promotions right now.')).toBeTruthy());
  });

  it('renders up to 3 promo cards with percent/fixed badges and expiry', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([
      promo({ promoId: 'p1', code: 'SAVE10', type: 'percent', value: 10, expiresAt: '2026-12-31T00:00:00.000Z' }),
      promo({ promoId: 'p2', code: 'FLAT15', type: 'fixed', value: 15, expiresAt: null }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());
    expect(screen.getByText('10% OFF')).toBeTruthy();
    expect(screen.getByText('FLAT15')).toBeTruthy();
    expect(screen.getByText('$15 OFF')).toBeTruthy();
    expect(screen.getByText(/Expires/)).toBeTruthy();
  });

  it('navigates to Promotions when "See all" or a promo card is pressed', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    renderScreen();
    await waitFor(() => screen.getByText('SAVE10'));

    fireEvent.press(screen.getByText('See all'));
    expect(mockNavigate).toHaveBeenCalledWith('Promotions');

    mockNavigate.mockClear();
    fireEvent.press(screen.getByText('SAVE10'));
    expect(mockNavigate).toHaveBeenCalledWith('Promotions');
  });
});
