import { api } from './client';

// Persists the display name to the DynamoDB USERS record (the admin-users team
// list reads names from there). The client updates Cognito separately via
// CognitoService.updateProfile; this keeps the two in sync.
export const updateProfileName = (firstName: string, lastName: string) =>
  api.put<{ firstName: string; lastName: string }>('/users/me', { firstName, lastName });
