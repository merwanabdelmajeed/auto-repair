import { api } from './client';

export interface Campaign {
  campaignId: string;
  name: string;
  subject: string;
  body: string;
  targetAudience: 'all' | 'inactive_30' | 'inactive_60' | 'inactive_90';
  status: 'draft' | 'sent';
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
}

export interface CampaignInput {
  name: string;
  subject: string;
  body: string;
  targetAudience: 'all' | 'inactive_30' | 'inactive_60' | 'inactive_90';
}

export const listCampaigns = () => api.get<Campaign[]>('/campaigns');
export const createCampaign = (data: CampaignInput) => api.post<Campaign>('/campaigns', data);
export const sendCampaign = (campaignId: string) =>
  api.post<{ sent: number; total: number }>(`/campaigns/${campaignId}/send`, {});
