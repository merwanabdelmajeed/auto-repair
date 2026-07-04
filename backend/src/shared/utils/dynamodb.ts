import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, type QueryCommandInput, type ScanCommandInput } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// DynamoDB Query/Scan cap a single response at 1MB and return LastEvaluatedKey
// when more data exists. Callers that need the *complete* result set (not a
// paginated API response) must loop on it — otherwise results are silently
// truncated with no error. These helpers do that looping.
export async function queryAll(params: QueryCommandInput): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({ ...params, ExclusiveStartKey: lastEvaluatedKey }));
    items.push(...(result.Items ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return items;
}

export async function scanAll(params: ScanCommandInput): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new ScanCommand({ ...params, ExclusiveStartKey: lastEvaluatedKey }));
    items.push(...(result.Items ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return items;
}

// `Select: 'COUNT'` queries are just as subject to the 1MB-per-page limit as
// regular queries — a single page's Count is only a partial total if there's
// more data behind LastEvaluatedKey. This sums Count across all pages.
export async function queryCount(params: QueryCommandInput): Promise<number> {
  let count = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({ ...params, Select: 'COUNT', ExclusiveStartKey: lastEvaluatedKey }));
    count += result.Count ?? 0;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return count;
}

export const TABLE = {
  TENANTS: 'autorepair-tenants',
  LOCATIONS: 'autorepair-locations',
  USERS: 'autorepair-users',
  VEHICLES: 'autorepair-vehicles',
  APPOINTMENTS: 'autorepair-appointments',
  SERVICES: 'autorepair-services',
  PROMOTIONS: 'autorepair-promotions',
  CAMPAIGNS: 'autorepair-campaigns',
  CAPACITY: 'autorepair-capacity',
  BLOCKED_TIMES: 'autorepair-blocked-times',
  NOTIFICATIONS: 'autorepair-notifications',
  ANALYTICS: 'autorepair-analytics',
} as const;
