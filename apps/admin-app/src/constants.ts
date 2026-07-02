import Constants from 'expo-constants';

export const SHOP_NAME =
  (Constants.expoConfig?.extra?.shopName as string) ?? 'Auto Repair Shop';

export const SHOP_CITY =
  (Constants.expoConfig?.extra?.shopCity as string) ?? '';
