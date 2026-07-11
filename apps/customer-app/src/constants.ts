import Constants from 'expo-constants';

export const SHOP_NAME =
  (Constants.expoConfig?.extra?.shopName as string) ?? 'Auto Repair Shop';

export const SHOP_CITY =
  (Constants.expoConfig?.extra?.shopCity as string) ?? '';

export const SHOP_ADDRESS =
  (Constants.expoConfig?.extra?.shopAddress as string) ?? '';

export const PRIVACY_POLICY_URL =
  'https://autorepair-public-docs-998632950185.s3.us-east-1.amazonaws.com/privacy-policy.html';
