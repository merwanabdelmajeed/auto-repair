declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_COGNITO_USER_POOL_ID: string;
      EXPO_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID: string;
      EXPO_PUBLIC_API_BASE_URL: string;
    }
  }
}

export {};
