import React from 'react';
import { Clipboard } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PromotionsScreen from './PromotionsScreen';
import { listPromotions } from '../api/promotions';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, []) };
});
jest.mock('../api/promotions', () => ({ listPromotions: jest.fn() }));

function promo(overrides: Record<string, unknown> = {}) {
  return { promoId: 'p1', code: 'SAVE10', description: '10% off any service', type: 'percent', value: 10, expiresAt: null, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('PromotionsScreen', () => {
  it('shows the empty state when there are no active promotions', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Active Offers')).toBeTruthy());
  });

  it('renders a promo card with formatted discount and expiry', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ expiresAt: '2026-12-31T00:00:00.000Z' })]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());
    expect(screen.getByText('10% off')).toBeTruthy();
    expect(screen.getByText(/Expires/)).toBeTruthy();
  });

  it('formats a fixed-amount discount', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ type: 'fixed', value: 15 })]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('$15.00 off')).toBeTruthy());
  });

  it('copies the code to the clipboard and shows a confirmation that reverts', async () => {
    jest.useFakeTimers();
    const setStringSpy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    render(<PromotionsScreen />);
    await waitFor(() => screen.getByText('SAVE10'));

    fireEvent.press(screen.getByText('SAVE10'));

    expect(setStringSpy).toHaveBeenCalledWith('SAVE10');
    expect(screen.getByText('Copied!')).toBeTruthy();

    jest.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.queryByText('Copied!')).toBeNull());

    jest.useRealTimers();
  });

  it('silently ignores a failed load', async () => {
    (listPromotions as jest.Mock).mockRejectedValue(new Error('down'));
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Active Offers')).toBeTruthy());
  });
});
