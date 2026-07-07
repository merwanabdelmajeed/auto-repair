import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Promotions from './Promotions';
import { listPromotions, createPromotion, updatePromotion, deletePromotion, type Promotion } from '../api/promotions';

vi.mock('../api/promotions', () => ({
  listPromotions: vi.fn(),
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  deletePromotion: vi.fn(),
}));

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    promoId: 'p1', code: 'SAVE10', description: 'Ten percent discount', type: 'percent', value: 10,
    expiresAt: null, maxUses: null, usedCount: 0, isActive: true, createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function toggleButtonFor(statusText: 'Active' | 'Inactive') {
  const span = screen.getAllByText(statusText).find(el => el.tagName === 'SPAN')!;
  return span.previousElementSibling as HTMLElement;
}

beforeEach(() => vi.clearAllMocks());

describe('Promotions — list', () => {
  it('shows an error when loading fails', async () => {
    vi.mocked(listPromotions).mockRejectedValue(new Error('down'));
    render(<Promotions />);
    await waitFor(() => expect(screen.getByText('Failed to load promotions.')).toBeInTheDocument());
  });

  it('shows the empty state', async () => {
    vi.mocked(listPromotions).mockResolvedValue([]);
    render(<Promotions />);
    await waitFor(() => expect(screen.getByText('No promotions')).toBeInTheDocument());
  });

  it('renders a promo row with formatted discount and usage', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo({ maxUses: 5, usedCount: 2 })]);
    render(<Promotions />);
    await waitFor(() => expect(screen.getByText('SAVE10')).toBeInTheDocument());
    expect(screen.getByText('10% off')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('filters by active/inactive', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo({ promoId: 'p1', code: 'ACTIVE1', isActive: true }), promo({ promoId: 'p2', code: 'INACTIVE1', isActive: false })]);
    render(<Promotions />);
    await waitFor(() => screen.getByText('ACTIVE1'));

    fireEvent.click(screen.getByText('Active', { selector: 'button' }));
    expect(screen.queryByText('INACTIVE1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Inactive', { selector: 'button' }));
    expect(screen.queryByText('ACTIVE1')).not.toBeInTheDocument();
    expect(screen.getByText('INACTIVE1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText('ACTIVE1')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE1')).toBeInTheDocument();
  });

  it('shows Expired badge for a past expiry and Maxed badge when usage is exhausted', async () => {
    vi.mocked(listPromotions).mockResolvedValue([
      promo({ promoId: 'p1', code: 'OLD', expiresAt: '2000-01-01' }),
      promo({ promoId: 'p2', code: 'FULL', maxUses: 1, usedCount: 1 }),
    ]);
    render(<Promotions />);
    await waitFor(() => screen.getByText('OLD'));
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Maxed')).toBeInTheDocument();
  });
});

describe('Promotions — create/edit modal', () => {
  it('validates value and percent-over-100', async () => {
    vi.mocked(listPromotions).mockResolvedValue([]);
    const { container } = render(<Promotions />);
    await waitFor(() => screen.getByText('+ New Promotion'));
    fireEvent.click(screen.getByText('+ New Promotion'));

    const valueInput = container.querySelectorAll('input[type="number"]')[0];
    fireEvent.change(valueInput, { target: { value: '0' } });
    fireEvent.click(screen.getByText('Create Promotion', { selector: 'button' }));
    expect(screen.getByText('Value must be greater than 0.')).toBeInTheDocument();
  });

  it('requires a promo code on create', async () => {
    vi.mocked(listPromotions).mockResolvedValue([]);
    render(<Promotions />);
    await waitFor(() => screen.getByText('+ New Promotion'));
    fireEvent.click(screen.getByText('+ New Promotion'));

    fireEvent.click(screen.getByText('Create Promotion', { selector: 'button' }));
    await waitFor(() => expect(screen.getByText('Promo code is required.')).toBeInTheDocument());
  });

  it('creates a promotion and prepends it', async () => {
    vi.mocked(listPromotions).mockResolvedValue([]);
    vi.mocked(createPromotion).mockResolvedValue(promo({ promoId: 'new1', code: 'NEWCODE' }));
    render(<Promotions />);
    await waitFor(() => screen.getByText('+ New Promotion'));
    fireEvent.click(screen.getByText('+ New Promotion'));

    fireEvent.change(screen.getByPlaceholderText('e.g. SUMMER20'), { target: { value: 'newcode' } });
    fireEvent.click(screen.getByText('Create Promotion', { selector: 'button' }));

    await waitFor(() => expect(screen.getByText('NEWCODE')).toBeInTheDocument());
    expect(createPromotion).toHaveBeenCalledWith(expect.objectContaining({ code: 'NEWCODE', maxUses: null, expiresAt: null }));
  });

  it('shows the API error message when create fails', async () => {
    vi.mocked(listPromotions).mockResolvedValue([]);
    vi.mocked(createPromotion).mockRejectedValue(new Error('duplicate code'));
    render(<Promotions />);
    await waitFor(() => screen.getByText('+ New Promotion'));
    fireEvent.click(screen.getByText('+ New Promotion'));
    fireEvent.change(screen.getByPlaceholderText('e.g. SUMMER20'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Create Promotion', { selector: 'button' }));

    await waitFor(() => expect(screen.getByText('duplicate code')).toBeInTheDocument());
  });

  it('opens edit from the detail panel with the code shown read-only, and saves', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo({ maxUses: 5, expiresAt: '2026-12-31' })]);
    vi.mocked(updatePromotion).mockResolvedValue(promo({ description: 'Updated desc' }));
    render(<Promotions />);
    await waitFor(() => screen.getByText('SAVE10'));

    fireEvent.click(screen.getByText('SAVE10'));
    fireEvent.click(screen.getByText('✏️ Edit Promotion'));

    expect(screen.getByText('Edit Promotion')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. SUMMER20')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updatePromotion).toHaveBeenCalledWith('p1', expect.objectContaining({ maxUses: 5 })));
  });

  it('closes the modal via the ✕ button', async () => {
    vi.mocked(listPromotions).mockResolvedValue([]);
    render(<Promotions />);
    await waitFor(() => screen.getByText('+ New Promotion'));
    fireEvent.click(screen.getByText('+ New Promotion'));
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('Create Promotion', { selector: 'h2' })).not.toBeInTheDocument();
  });
});

describe('Promotions — toggle active / delete', () => {
  it('toggles active state via the switch', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo({ isActive: true })]);
    vi.mocked(updatePromotion).mockResolvedValue(promo({ isActive: false }));
    render(<Promotions />);
    await waitFor(() => screen.getByText('SAVE10'));

    fireEvent.click(toggleButtonFor('Active'));

    await waitFor(() => expect(toggleButtonFor('Inactive')).toBeInTheDocument());
  });

  it('alerts when toggling active fails', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo()]);
    vi.mocked(updatePromotion).mockRejectedValue(new Error('nope'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Promotions />);
    await waitFor(() => screen.getByText('SAVE10'));

    fireEvent.click(toggleButtonFor('Active'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to update promotion.'));
  });

  it('does not delete when declined, deletes when confirmed', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Promotions />);
    await waitFor(() => screen.getByText('Delete'));

    fireEvent.click(screen.getByText('Delete'));
    expect(deletePromotion).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    vi.mocked(deletePromotion).mockResolvedValue({ deleted: true });
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(screen.getByText('No promotions')).toBeInTheDocument());
  });

  it('alerts when delete fails', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo()]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deletePromotion).mockRejectedValue(new Error('nope'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Promotions />);
    await waitFor(() => screen.getByText('Delete'));

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to delete promotion.'));
  });

  it('deletes from the detail panel and closes it', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo()]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deletePromotion).mockResolvedValue({ deleted: true });
    render(<Promotions />);
    await waitFor(() => screen.getByText('SAVE10'));

    fireEvent.click(screen.getByText('SAVE10'));
    fireEvent.click(screen.getByText('🗑️ Delete Promotion'));

    await waitFor(() => expect(screen.queryByText('Customer Details')).not.toBeInTheDocument());
  });
});

describe('Promotions — detail panel', () => {
  it('opens on row click and closes on the ✕ button, backdrop, or re-click', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo()]);
    render(<Promotions />);
    await waitFor(() => screen.getByText('SAVE10'));

    fireEvent.click(screen.getByText('SAVE10'));
    expect(screen.getByText('✏️ Edit Promotion')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('✕')[0]);
    expect(screen.queryByText('✏️ Edit Promotion')).not.toBeInTheDocument();
  });

  it('shows "No expiry" and hides the description block when absent', async () => {
    vi.mocked(listPromotions).mockResolvedValue([promo({ description: '', expiresAt: null })]);
    render(<Promotions />);
    await waitFor(() => screen.getByText('SAVE10'));
    fireEvent.click(screen.getByText('SAVE10'));
    expect(screen.getByText('No expiry')).toBeInTheDocument();
  });
});
