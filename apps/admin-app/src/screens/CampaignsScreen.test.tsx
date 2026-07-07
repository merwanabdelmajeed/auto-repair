import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CampaignsScreen from './CampaignsScreen';
import { listCampaigns, createCampaign, sendCampaign } from '../api/campaigns';

jest.mock('../api/campaigns', () => ({
  listCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  sendCampaign: jest.fn(),
}));

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: 'c1', name: 'Win Back', subject: 'We miss you', body: 'Come back!',
    targetAudience: 'inactive_30', status: 'draft', sentAt: null, recipientCount: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('CampaignsScreen', () => {
  it('shows the empty state and opens the create modal from it', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([]);
    render(<CampaignsScreen />);

    await waitFor(() => expect(screen.getByText('No Campaigns Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Campaign'));
    expect(screen.getByText('Campaign Name *')).toBeTruthy();
  });

  it('shows an alert when loading fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (listCampaigns as jest.Mock).mockRejectedValue(new Error('down'));
    render(<CampaignsScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load campaigns.'));
  });

  it('splits campaigns into Draft and Sent sections', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([
      campaign(),
      campaign({ campaignId: 'c2', name: 'Summer Sale', status: 'sent', sentAt: '2026-02-01T12:00:00.000Z', recipientCount: 42 }),
    ]);
    render(<CampaignsScreen />);

    await waitFor(() => expect(screen.getByText('Drafts (1)')).toBeTruthy());
    expect(screen.getByText('Sent (1)')).toBeTruthy();
    expect(screen.getByText('Sent Feb 1, 2026')).toBeTruthy();
    expect(screen.getByText('42 recipients')).toBeTruthy();
    expect(screen.getByText('DRAFT')).toBeTruthy();
    expect(screen.getByText('SENT')).toBeTruthy();
  });

  it('shows singular "recipient" for a count of exactly 1', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([
      campaign({ status: 'sent', sentAt: '2026-02-01T12:00:00.000Z', recipientCount: 1 }),
    ]);
    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('1 recipient')).toBeTruthy());
  });

  it('validates all three required fields in order', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([]);
    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('No Campaigns Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Campaign'));
    fireEvent.press(screen.getByText('Save as Draft'));
    expect(screen.getByText('Campaign name is required.')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Summer Re-engagement'), 'Win Back');
    fireEvent.press(screen.getByText('Save as Draft'));
    expect(screen.getByText('Email subject is required.')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("e.g. We miss you — here's 20% off"), 'Subject');
    fireEvent.press(screen.getByText('Save as Draft'));
    expect(screen.getByText('Email body is required.')).toBeTruthy();
  });

  it('creates a new campaign, selecting a non-default audience', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([]);
    (createCampaign as jest.Mock).mockResolvedValue(campaign({ campaignId: 'new1', name: 'New Campaign' }));
    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('No Campaigns Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Campaign'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Summer Re-engagement'), 'New Campaign');
    fireEvent.press(screen.getByText('Inactive 60+ days'));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. We miss you — here's 20% off"), 'Subject');
    fireEvent.changeText(screen.getByPlaceholderText('Write the email content here…'), 'Body text');
    fireEvent.press(screen.getByText('Save as Draft'));

    await waitFor(() => expect(createCampaign).toHaveBeenCalledWith({
      name: 'New Campaign', subject: 'Subject', body: 'Body text', targetAudience: 'inactive_60',
    }));
    await waitFor(() => expect(screen.getByText('New Campaign')).toBeTruthy());
  });

  it('shows the server error message when creation fails', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([]);
    (createCampaign as jest.Mock).mockRejectedValue(new Error('duplicate name'));
    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('No Campaigns Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Campaign'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Summer Re-engagement'), 'X');
    fireEvent.changeText(screen.getByPlaceholderText("e.g. We miss you — here's 20% off"), 'Y');
    fireEvent.changeText(screen.getByPlaceholderText('Write the email content here…'), 'Z');
    fireEvent.press(screen.getByText('Save as Draft'));

    await waitFor(() => expect(screen.getByText('duplicate name')).toBeTruthy());
  });

  it('falls back to a generic error message for a non-Error rejection on create', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([]);
    (createCampaign as jest.Mock).mockRejectedValue('oops');
    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('No Campaigns Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Campaign'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Summer Re-engagement'), 'X');
    fireEvent.changeText(screen.getByPlaceholderText("e.g. We miss you — here's 20% off"), 'Y');
    fireEvent.changeText(screen.getByPlaceholderText('Write the email content here…'), 'Z');
    fireEvent.press(screen.getByText('Save as Draft'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
  });

  it('closes the create modal via the close icon', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([]);
    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('No Campaigns Yet')).toBeTruthy());

    fireEvent.press(screen.getByText('Create Campaign'));
    expect(screen.getByText('New Campaign')).toBeTruthy();
    fireEvent.press(screen.getByText('close'));
  });

  it('sends a draft campaign after confirmation and shows a delivery confirmation', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([campaign()]);
    (sendCampaign as jest.Mock).mockResolvedValue({ sent: 5, total: 5 });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Send Campaign') {
        const send = buttons?.find(b => b.text === 'Send Now');
        send?.onPress?.();
      }
    });

    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('Win Back')).toBeTruthy());

    fireEvent.press(screen.getByText('Send Campaign'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Send Campaign',
      'Send "Win Back" to Inactive 30+ days? This will send emails immediately and cannot be undone.',
      expect.any(Array),
    );
    await waitFor(() => expect(sendCampaign).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Sent!', 'Campaign delivered to 5 recipients.'));
  });

  it('does not send when cancelled', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([campaign()]);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find(b => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('Win Back')).toBeTruthy());

    fireEvent.press(screen.getByText('Send Campaign'));

    expect(sendCampaign).not.toHaveBeenCalled();
  });

  it('shows an error alert when sending fails', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([campaign()]);
    (sendCampaign as jest.Mock).mockRejectedValue(new Error('smtp down'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Send Campaign') {
        const send = buttons?.find(b => b.text === 'Send Now');
        send?.onPress?.();
      }
    });

    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('Win Back')).toBeTruthy());

    fireEvent.press(screen.getByText('Send Campaign'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'smtp down'));
  });

  it('shows a singular "recipient" wording in the sent confirmation for a count of 1', async () => {
    (listCampaigns as jest.Mock).mockResolvedValue([campaign()]);
    (sendCampaign as jest.Mock).mockResolvedValue({ sent: 1, total: 1 });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Send Campaign') {
        const send = buttons?.find(b => b.text === 'Send Now');
        send?.onPress?.();
      }
    });

    render(<CampaignsScreen />);
    await waitFor(() => expect(screen.getByText('Win Back')).toBeTruthy());

    fireEvent.press(screen.getByText('Send Campaign'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Sent!', 'Campaign delivered to 1 recipient.'));
  });
});
