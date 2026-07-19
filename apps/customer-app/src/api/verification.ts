import { api } from './client';

export interface SendCodeResult {
  sent: boolean;
  resendInSeconds: number;
  expiresInSeconds: number;
}

export interface ConfirmCodeResult {
  verified: boolean;
  phone: string;
}

// Sends a 6-digit OTP to the given phone from the shop's toll-free number.
export const sendPhoneCode = (phone: string) =>
  api.post<SendCodeResult>('/verification/phone/send', { phone });

// Confirms the OTP; on success the phone is marked verified on the account.
export const confirmPhoneCode = (phone: string, code: string) =>
  api.post<ConfirmCodeResult>('/verification/phone/confirm', { phone, code });
