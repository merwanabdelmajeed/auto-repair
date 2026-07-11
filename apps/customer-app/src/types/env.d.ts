// NOTE: this augmentation is the textbook-correct way to type EXPO_PUBLIC_*
// vars, but doesn't actually merge with process.env's resolved type in this
// project's current dependency versions (traced to @expo/metro-config's own
// unrelated internal `env` export shadowing it somehow — not fully root-caused
// given the effort already spent). Left in place as documentation of intent;
// the actual fix is inline `as` casts at each process.env.EXPO_PUBLIC_* usage
// site (see CognitoService.ts / client.ts in this app and admin-app).
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
