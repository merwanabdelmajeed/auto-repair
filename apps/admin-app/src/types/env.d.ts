// NOTE: this augmentation is the textbook-correct way to type EXPO_PUBLIC_*
// vars, but doesn't actually merge with process.env's resolved type in this
// project's current dependency versions (not fully root-caused; see the
// identical note in customer-app/src/types/env.d.ts). Left in place as
// documentation of intent; the actual fix is inline `as unknown as {...}`
// casts at each process.env.EXPO_PUBLIC_* usage site (CognitoService.ts /
// client.ts).
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_COGNITO_USER_POOL_ID: string;
      EXPO_PUBLIC_COGNITO_ADMIN_CLIENT_ID: string;
      EXPO_PUBLIC_API_BASE_URL: string;
    }
  }
}

export {};
