// Access these as plain process.env.EXPO_PUBLIC_* (no cast/alias). Expo's
// Babel plugin only inlines that exact static dot-access shape at build time;
// wrapping it in a cast or aliasing process.env to a variable defeats the
// pattern match and silently leaves the access as `undefined` at runtime
// (confirmed by inspecting the compiled bundle — see git history on this file
// and on CognitoService.ts / client.ts for the incident this caused).
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
