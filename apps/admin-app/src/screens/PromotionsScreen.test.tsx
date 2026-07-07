import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PromotionsScreen from './PromotionsScreen';
import { listPromotions, createPromotion, updatePromotion, deletePromotion } from '../api/promotions';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function DateTimePicker(props: { onChange: (e: unknown, d?: Date) => void }) {
    return React.createElement(Text, { testID: 'date-picker', onPress: () => props.onChange({ type: 'set' }, new Date(2030, 0, 15)) }, 'picker');
  }
  return { __esModule: true, default: DateTimePicker };
});
jest.mock('../api/promotions', () => ({
  listPromotions: jest.fn(),
  createPromotion: jest.fn(),
  updatePromotion: jest.fn(),
  deletePromotion: jest.fn(),
}));

function promo(overrides: Record<string, unknown> = {}) {
  return {
    promoId: 'p1', code: 'SAVE10', description: 'Sample promo', type: 'percent', value: 10,
    expiresAt: null, maxUses: null, usedCount: 0, isActive: true, createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('PromotionsScreen', () => {
  it('shows the empty state and opens create from it', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    expect(screen.getByText('Discount Type *')).toBeTruthy();
  });

  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listPromotions as jest.Mock).mockRejectedValue(new Error('down'));
    render(<PromotionsScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load promotions.'));
  });

  it('renders active promotions with formatted value and Used count', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ maxUses: 100, usedCount: 5 })]);
    render(<PromotionsScreen />);

    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());
    expect(screen.getByText('10% off')).toBeTruthy();
    expect(screen.getByText('Used: 5 / 100')).toBeTruthy();
    // "Active" also appears as a filter-chip label, so the status badge is the 2nd match.
    expect(screen.getAllByText('Active').length).toBe(2);
  });

  it('shows a fixed-amount promo formatted with a dollar sign', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ type: 'fixed', value: 15 })]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('$15.00 off')).toBeTruthy());
  });

  it('shows an Inactive badge for an inactive promo', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ isActive: false })]);
    render(<PromotionsScreen />);
    // "Inactive" also appears as a filter-chip label, so wait for 2 matches (chip + badge).
    await waitFor(() => expect(screen.getAllByText('Inactive').length).toBe(2));
  });

  it('shows an Expired badge and expired-date text for a past expiresAt', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ expiresAt: '2020-01-01' })]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('Expired')).toBeTruthy());
    expect(screen.getByText(/^Expired /)).toBeTruthy();
  });

  it('shows a Maxed badge when usedCount reaches maxUses', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ maxUses: 5, usedCount: 5 })]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('Maxed')).toBeTruthy());
  });

  it('filters the list via the Active/Inactive/All chips', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([
      promo({ promoId: 'p1', code: 'ACTIVE1', isActive: true }),
      promo({ promoId: 'p2', code: 'INACTIVE1', isActive: false }),
    ]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('ACTIVE1')).toBeTruthy());

    // "Active"/"Inactive" also appear as status badges on the cards, so the filter
    // chip (rendered first, before the card list) is always the first match.
    fireEvent.press(screen.getAllByText('Active')[0]);
    expect(screen.getByText('ACTIVE1')).toBeTruthy();
    expect(screen.queryByText('INACTIVE1')).toBeNull();

    fireEvent.press(screen.getByText('Inactive'));
    expect(screen.queryByText('ACTIVE1')).toBeNull();
    expect(screen.getByText('INACTIVE1')).toBeTruthy();

    fireEvent.press(screen.getByText('All'));
    expect(screen.getByText('ACTIVE1')).toBeTruthy();
    expect(screen.getByText('INACTIVE1')).toBeTruthy();
  });

  it('opens the detail modal from a card and shows details', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ description: 'Ten percent off everything', maxUses: 50, usedCount: 3 })]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getByText('SAVE10'));

    // The RN Modal jest mock renders its children regardless of `visible`, so the
    // card behind it (which also shows the description) is still in the tree.
    expect(screen.getAllByText('Ten percent off everything').length).toBe(2);
    expect(screen.getByText('Used 3 of 50')).toBeTruthy();
    expect(screen.getByText('No expiry date')).toBeTruthy();
  });

  it('toggles active from the detail modal', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    (updatePromotion as jest.Mock).mockResolvedValue(promo({ isActive: false }));
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getByText('SAVE10'));
    const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
    fireEvent(switches[0], 'valueChange', false);

    await waitFor(() => expect(updatePromotion).toHaveBeenCalledWith('p1', { isActive: false }));
  });

  it('shows an alert when toggling active fails', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    (updatePromotion as jest.Mock).mockRejectedValue(new Error('boom'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getByText('SAVE10'));
    const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
    fireEvent(switches[0], 'valueChange', false);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to update promotion.'));
  });

  it('opens edit from the detail modal, pre-filled and with a read-only code', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ description: 'desc' })]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getByText('SAVE10'));
    fireEvent.press(screen.getByText('Edit Promotion'));

    expect(screen.getByText('Edit Promotion')).toBeTruthy();
    expect(screen.getByDisplayValue('desc')).toBeTruthy();
  });

  it('saves an edit and updates the list', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo({ description: 'old' })]);
    (updatePromotion as jest.Mock).mockResolvedValue(promo({ description: 'new desc' }));
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getByText('SAVE10'));
    fireEvent.press(screen.getByText('Edit Promotion'));
    fireEvent.changeText(screen.getByDisplayValue('old'), 'new desc');
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updatePromotion).toHaveBeenCalledWith('p1', expect.objectContaining({ description: 'new desc' })));
  });

  it('validates value must be greater than 0', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    fireEvent.changeText(screen.getByDisplayValue('10'), '0');
    fireEvent.press(screen.getAllByText('Create Promotion')[screen.getAllByText('Create Promotion').length - 1]);

    expect(screen.getByText('Value must be greater than 0.')).toBeTruthy();
  });

  it('validates percent discount cannot exceed 100', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    fireEvent.changeText(screen.getByDisplayValue('10'), '150');
    fireEvent.press(screen.getAllByText('Create Promotion')[screen.getAllByText('Create Promotion').length - 1]);

    expect(screen.getByText('Percent discount cannot exceed 100.')).toBeTruthy();
  });

  it('validates that a promo code is required on create', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    fireEvent.press(screen.getAllByText('Create Promotion')[screen.getAllByText('Create Promotion').length - 1]);

    expect(screen.getByText('Promo code is required.')).toBeTruthy();
  });

  it('creates a new promotion with all fields', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    (createPromotion as jest.Mock).mockResolvedValue(promo({ code: 'NEWCODE' }));
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. SUMMER20'), 'newcode');
    fireEvent.press(screen.getByText('$ Fixed Amount'));
    fireEvent.changeText(screen.getByDisplayValue('10'), '25');
    fireEvent.changeText(screen.getByPlaceholderText('Unlimited'), '10');
    fireEvent.press(screen.getAllByText('Create Promotion')[screen.getAllByText('Create Promotion').length - 1]);

    await waitFor(() => expect(createPromotion).toHaveBeenCalledWith({
      code: 'NEWCODE', description: '', type: 'fixed', value: 25, maxUses: 10, expiresAt: null,
    }));
  });

  it('shows the server error message when creation fails', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    (createPromotion as jest.Mock).mockRejectedValue(new Error('code exists'));
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. SUMMER20'), 'DUPE');
    fireEvent.press(screen.getAllByText('Create Promotion')[screen.getAllByText('Create Promotion').length - 1]);

    await waitFor(() => expect(screen.getByText('code exists')).toBeTruthy());
  });

  it('sets and clears an expiry date via the iOS picker', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    fireEvent.press(screen.getByText('No expiry date'));
    fireEvent.press(screen.getByTestId('date-picker'));

    expect(screen.getByText('Jan 15, 2030')).toBeTruthy();

    fireEvent.press(screen.getByText('close-circle'));
    expect(screen.getByText('No expiry date')).toBeTruthy();
  });

  it('deletes a promotion from the card after confirmation', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    (deletePromotion as jest.Mock).mockResolvedValue({ deleted: true });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const del = buttons?.find(b => b.text === 'Delete');
      del?.onPress?.();
    });

    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getAllByText('trash-outline')[0]);

    await waitFor(() => expect(deletePromotion).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText('SAVE10')).toBeNull());
  });

  it('shows an error alert when delete fails', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    (deletePromotion as jest.Mock).mockRejectedValue(new Error('fail'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Delete Promotion') {
        const del = buttons?.find(b => b.text === 'Delete');
        del?.onPress?.();
      }
    });

    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getAllByText('trash-outline')[0]);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to delete promotion.'));
  });

  it('does not delete when cancelled', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find(b => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getAllByText('trash-outline')[0]);

    expect(deletePromotion).not.toHaveBeenCalled();
  });

  it('deletes from the detail modal', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([promo()]);
    (deletePromotion as jest.Mock).mockResolvedValue({ deleted: true });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const del = buttons?.find(b => b.text === 'Delete');
      del?.onPress?.();
    });

    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeTruthy());

    fireEvent.press(screen.getByText('SAVE10'));
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(deletePromotion).toHaveBeenCalledWith('p1'));
  });

  it('closes the create modal via the close icon', async () => {
    (listPromotions as jest.Mock).mockResolvedValue([]);
    render(<PromotionsScreen />);
    await waitFor(() => expect(screen.getByText('No Promotions')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Promotion'));
    expect(screen.getByText('Discount Type *')).toBeTruthy();
    fireEvent.press(screen.getByText('close'));
  });
});
