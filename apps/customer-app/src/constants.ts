import Constants from 'expo-constants';

export const SHOP_NAME =
  (Constants.expoConfig?.extra?.shopName as string) ?? 'Auto Repair Shop';

export const SHOP_CITY =
  (Constants.expoConfig?.extra?.shopCity as string) ?? '';

export const SHOP_ADDRESS =
  (Constants.expoConfig?.extra?.shopAddress as string) ?? '';

export const PRIVACY_POLICY_URL =
  'https://autorepair-public-docs-998632950185.s3.us-east-1.amazonaws.com/privacy-policy.html';

export const TERMS_OF_SERVICE_URL =
  'https://autorepair-public-docs-998632950185.s3.us-east-1.amazonaws.com/terms.html';

export const SUPPORT_URL =
  'https://autorepair-public-docs-998632950185.s3.us-east-1.amazonaws.com/support.html';

// For MVP, tenant ID is hardcoded — single-tenant deployment, no invitation-code
// flow yet (Phase 12). Used both at registration and for guest browsing, since
// unauthenticated requests have no JWT to derive it from.
export const DEFAULT_TENANT_ID = 'purrfect-17';
