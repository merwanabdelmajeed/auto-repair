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

export interface Page {
  items: Record<string, unknown>[];
  nextCursor: string | null;
}

// Single-page query for client-facing cursor pagination (unlike queryAll,
// which exists specifically to page through everything server-side). The
// cursor is just DynamoDB's own LastEvaluatedKey, base64-encoded so it's an
// opaque string to clients rather than exposing internal key structure.
export async function queryPage(params: QueryCommandInput & { limit?: number; cursor?: string | null }): Promise<Page> {
  const { limit, cursor, ...rest } = params;
  const exclusiveStartKey = cursor ? (JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Record<string, unknown>) : undefined;
  const result = await db.send(new QueryCommand({ ...rest, Limit: limit ?? 25, ExclusiveStartKey: exclusiveStartKey }));
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey), 'utf-8').toString('base64')
    : null;
  return { items: result.Items ?? [], nextCursor };
}

// Table names are environment-suffixed to match template.yaml's per-environment
// resource naming (empty suffix for prod, so today's live table names are
// unaffected). ENVIRONMENT is set on every Lambda via the SAM template's
// Globals.Function.Environment.Variables block.
const ENV_SUFFIX: Record<string, string> = { dev: '-dev', staging: '-staging', prod: '' };
const suffix = ENV_SUFFIX[process.env.ENVIRONMENT ?? 'prod'] ?? '';

export const TABLE = {
  TENANTS: `autorepair-tenants${suffix}`,
  LOCATIONS: `autorepair-locations${suffix}`,
  USERS: `autorepair-users${suffix}`,
  VEHICLES: `autorepair-vehicles${suffix}`,
  APPOINTMENTS: `autorepair-appointments${suffix}`,
  SERVICES: `autorepair-services${suffix}`,
  PROMOTIONS: `autorepair-promotions${suffix}`,
  CAMPAIGNS: `autorepair-campaigns${suffix}`,
  CAPACITY: `autorepair-capacity${suffix}`,
  BLOCKED_TIMES: `autorepair-blocked-times${suffix}`,
  NOTIFICATIONS: `autorepair-notifications${suffix}`,
  ANALYTICS: `autorepair-analytics${suffix}`,
  VERIFICATIONS: `autorepair-verifications${suffix}`,
} as const;
