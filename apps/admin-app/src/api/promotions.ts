import { api } from './client';

export interface Promotion {
  promoId: string;
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface PromotionInput {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  expiresAt?: string | null;
  maxUses?: number | null;
}

export interface PromotionUpdate {
  description?: string;
  isActive?: boolean;
  type?: 'percent' | 'fixed';
  value?: number;
  expiresAt?: string | null;
  maxUses?: number | null;
}

export const listPromotions = () => api.get<Promotion[]>('/promotions');
export const createPromotion = (data: PromotionInput) => api.post<Promotion>('/promotions', data);
export const updatePromotion = (promoId: string, data: PromotionUpdate) =>
  api.put<Promotion>(`/promotions/${promoId}`, data);
export const deletePromotion = (promoId: string) =>
  api.delete<{ deleted: boolean }>(`/promotions/${promoId}`);
