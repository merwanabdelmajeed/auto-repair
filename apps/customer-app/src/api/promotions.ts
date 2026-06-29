import { api } from './client';

export interface PromoValidation {
  promoId: string;
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
}

export interface PublicPromotion extends PromoValidation {
  expiresAt: string | null;
}

export const listPromotions = () => api.get<PublicPromotion[]>('/promotions');
export const validatePromoCode = (code: string) =>
  api.get<PromoValidation>(`/promotions/validate?code=${encodeURIComponent(code)}`);
