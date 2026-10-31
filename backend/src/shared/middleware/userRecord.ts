import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../utils/dynamodb.js';
import type { UserRole } from '../types/index.js';

export interface UserRecordAuthFields {
  status?: string;
  role?: UserRole;
  locationIds?: string[];
}

// Isolated in its own module (rather than inlined in tenant.ts) so the Jest
// setup file can stub it for every handler test — those tests mock all of
// GetCommand with one blanket response, which this per-request lookup would
// otherwise swallow. See jest.setup.ts.
export async function getUserRecord(tenantId: string, userId: string): Promise<UserRecordAuthFields | undefined> {
  const result = await db.send(new GetCommand({
    TableName: TABLE.USERS,
    Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
    ProjectionExpression: '#status, #role, locationIds',
    ExpressionAttributeNames: { '#status': 'status', '#role': 'role' },
  }));
  return result.Item as UserRecordAuthFields | undefined;
}
