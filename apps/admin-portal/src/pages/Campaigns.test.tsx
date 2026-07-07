import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Campaigns from './Campaigns';
import { listCampaigns, createCampaign, sendCampaign, type Campaign } from '../api/campaigns';

vi.mock('../api/campaigns', () => ({
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
}));

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    campaignId: 'c1', name: 'Summer Sale', subject: 'Come back!', body: 'body', targetAudience: 'all',
    status: 'draft', sentAt: null, recipientCount: null, createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('Campaigns', () => {
  it('shows an error when loading fails', async () => {
    vi.mocked(listCampaigns).mockRejectedValue(new Error('down'));
    render(<Campaigns />);
    await waitFor(() => expect(screen.getByText('Failed to load campaigns.')).toBeInTheDocument());
  });

  it('shows the empty state', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    render(<Campaigns />);
    await waitFor(() => expect(screen.getByText('No campaigns yet')).toBeInTheDocument());
  });

  it('renders draft/sent counts and campaign rows', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([
      campaign(),
      campaign({ campaignId: 'c2', name: 'Old Promo', status: 'sent', sentAt: '2026-01-05T00:00:00.000Z', recipientCount: 42 }),
    ]);
    render(<Campaigns />);
    await waitFor(() => expect(screen.getByText('1 draft · 1 sent')).toBeInTheDocument());
    expect(screen.getByText('Summer Sale')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('validates the new campaign form field by field', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    render(<Campaigns />);
    await waitFor(() => screen.getByText('+ New Campaign'));
    fireEvent.click(screen.getByText('+ New Campaign'));

    fireEvent.click(screen.getByText('Save as Draft'));
    expect(screen.getByText('Campaign name is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. Summer Re-engagement'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Save as Draft'));
    expect(screen.getByText('Subject is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("e.g. We miss you — here's 20% off your next visit"), { target: { value: 'Subj' } });
    fireEvent.click(screen.getByText('Save as Draft'));
    expect(screen.getByText('Body is required.')).toBeInTheDocument();
  });

  it('creates a campaign with the selected audience and prepends it', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(createCampaign).mockResolvedValue(campaign({ campaignId: 'new1', name: 'New Camp' }));
    render(<Campaigns />);
    await waitFor(() => screen.getByText('+ New Campaign'));
    fireEvent.click(screen.getByText('+ New Campaign'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Summer Re-engagement'), { target: { value: 'New Camp' } });
    fireEvent.click(screen.getByText('Inactive 60+ days'));
    fireEvent.change(screen.getByPlaceholderText("e.g. We miss you — here's 20% off your next visit"), { target: { value: 'Subj' } });
    fireEvent.change(screen.getByPlaceholderText('Write the email content here…'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByText('Save as Draft'));

    await waitFor(() => expect(createCampaign).toHaveBeenCalledWith(expect.objectContaining({ targetAudience: 'inactive_60' })));
    expect(screen.getByText('New Camp')).toBeInTheDocument();
  });

  it('shows the Error message from a failed save', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(createCampaign).mockRejectedValue(new Error('quota exceeded'));
    render(<Campaigns />);
    await waitFor(() => screen.getByText('+ New Campaign'));
    fireEvent.click(screen.getByText('+ New Campaign'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Summer Re-engagement'), { target: { value: 'X' } });
    fireEvent.change(screen.getByPlaceholderText("e.g. We miss you — here's 20% off your next visit"), { target: { value: 'S' } });
    fireEvent.change(screen.getByPlaceholderText('Write the email content here…'), { target: { value: 'B' } });
    fireEvent.click(screen.getByText('Save as Draft'));

    await waitFor(() => expect(screen.getByText('quota exceeded')).toBeInTheDocument());
  });

  it('does not send when the confirm dialog is declined', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([campaign()]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Campaigns />);
    await waitFor(() => screen.getByText('▶ Send'));

    fireEvent.click(screen.getByText('▶ Send'));

    expect(sendCampaign).not.toHaveBeenCalled();
  });

  it('sends a campaign and updates its status to sent', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([campaign()]);
    vi.mocked(sendCampaign).mockResolvedValue({ sent: 12, total: 15 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Campaigns />);
    await waitFor(() => screen.getByText('▶ Send'));

    fireEvent.click(screen.getByText('▶ Send'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Sent to 12 recipients.'));
    expect(screen.getByText('Sent', { selector: 'span' })).toBeInTheDocument();
  });

  it('alerts with the error message when sending fails', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([campaign()]);
    vi.mocked(sendCampaign).mockRejectedValue(new Error('smtp down'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Campaigns />);
    await waitFor(() => screen.getByText('▶ Send'));

    fireEvent.click(screen.getByText('▶ Send'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('smtp down'));
  });

  it('closes the modal via the ✕ button', async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    render(<Campaigns />);
    await waitFor(() => screen.getByText('+ New Campaign'));
    fireEvent.click(screen.getByText('+ New Campaign'));
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('New Campaign', { selector: 'h2' })).not.toBeInTheDocument();
  });
});
