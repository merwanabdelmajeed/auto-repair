import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { UserRole, type Campaign } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];
const ses = new SESClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const FROM_EMAIL = process.env['SES_FROM_EMAIL'] ?? '';

function toCampaign(i: Record<string, unknown>): Campaign {
  return {
    campaignId: i.campaignId as string,
    tenantId: i.tenantId as string,
    name: i.name as string,
    subject: i.subject as string,
    body: i.body as string,
    targetAudience: i.targetAudience as Campaign['targetAudience'],
    status: i.status as 'draft' | 'sent',
    sentAt: (i.sentAt as string) ?? null,
    recipientCount: (i.recipientCount as number) ?? null,
    createdAt: i.createdAt as string,
  };
}

async function getTargetEmails(tenantId: string, audience: Campaign['targetAudience']): Promise<string[]> {
  const pk = `TENANT#${tenantId}`;

  // Get all customers
  const usersResult = await db.send(new QueryCommand({
    TableName: TABLE.USERS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    FilterExpression: 'userType = :customer',
    ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'USER#', ':customer': 'CUSTOMER' },
    ProjectionExpression: 'email, userId',
  }));

  const customers = usersResult.Items ?? [];
  if (audience === 'all') return customers.map(c => c.email as string);

  // For inactive audiences, find customers with no recent appointment
  const days = audience === 'inactive_30' ? 30 : audience === 'inactive_60' ? 60 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const apptResult = await db.send(new QueryCommand({
    TableName: TABLE.APPOINTMENTS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    FilterExpression: 'begins_with(scheduledAt, :cutoff) AND #s <> :cancelled',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'APPT#', ':cutoff': cutoffStr.slice(0, 7), ':cancelled': 'cancelled' },
    ProjectionExpression: 'customerId, scheduledAt',
  }));

  // Build set of active customer IDs (had an appointment after cutoff)
  const activeCustomerIds = new Set<string>();
  for (const appt of apptResult.Items ?? []) {
    const apptDate = (appt.scheduledAt as string).slice(0, 10);
    if (apptDate >= cutoffStr) activeCustomerIds.add(appt.customerId as string);
  }

  return customers
    .filter(c => !activeCustomerIds.has(c.userId as string))
    .map(c => c.email as string);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    requireRole(claims, ...ADMIN_ROLES);
    const { tenantId } = claims;
    const method = event.httpMethod;
    const campaignId = event.pathParameters?.campaignId;
    const isSend = event.resource?.endsWith('/send');
    const pk = `TENANT#${tenantId}`;

    // GET /campaigns — list
    if (method === 'GET' && !campaignId) {
      const result = await db.send(new QueryCommand({
        TableName: TABLE.CAMPAIGNS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'CAMPAIGN#' },
        ScanIndexForward: false,
      }));
      return ok((result.Items ?? []).map(toCampaign));
    }

    // POST /campaigns — create draft
    if (method === 'POST' && !campaignId) {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, subject, body: emailBody, targetAudience } = body;
      if (!name || !subject || !emailBody || !targetAudience) return badRequest('name, subject, body, and targetAudience are required');
      const validAudiences = ['all', 'inactive_30', 'inactive_60', 'inactive_90'];
      if (!validAudiences.includes(targetAudience as string)) return badRequest(`targetAudience must be one of: ${validAudiences.join(', ')}`);

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item = {
        PK: pk, SK: `CAMPAIGN#${id}`,
        campaignId: id, tenantId,
        name, subject, body: emailBody,
        targetAudience,
        status: 'draft',
        sentAt: null,
        recipientCount: null,
        createdAt: now,
      };
      await db.send(new PutCommand({ TableName: TABLE.CAMPAIGNS, Item: item }));
      return created(toCampaign(item));
    }

    if (!campaignId) return badRequest('campaignId required');

    // POST /campaigns/{campaignId}/send
    if (method === 'POST' && isSend) {
      // Load campaign
      const campResult = await db.send(new QueryCommand({
        TableName: TABLE.CAMPAIGNS,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: { ':pk': pk, ':sk': `CAMPAIGN#${campaignId}` },
      }));
      const camp = campResult.Items?.[0];
      if (!camp) return notFound('Campaign not found');
      if (camp.status === 'sent') return badRequest('Campaign has already been sent');

      const emails = await getTargetEmails(tenantId, camp.targetAudience as Campaign['targetAudience']);
      if (emails.length === 0) return badRequest('No recipients match the target audience');

      // Send emails (fire in batches to avoid SES throttle — sandbox allows 1/s, production is higher)
      let sent = 0;
      for (const email of emails) {
        try {
          await ses.send(new SendEmailCommand({
            Source: FROM_EMAIL,
            Destination: { ToAddresses: [email] },
            Message: {
              Subject: { Data: camp.subject as string },
              Body: { Text: { Data: camp.body as string } },
            },
          }));
          sent++;
        } catch {
          // Skip individual failures — don't abort the whole campaign
        }
      }

      const now = new Date().toISOString();
      await db.send(new UpdateCommand({
        TableName: TABLE.CAMPAIGNS,
        Key: { PK: pk, SK: `CAMPAIGN#${campaignId}` },
        UpdateExpression: 'SET #s = :sent, sentAt = :now, recipientCount = :count',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':sent': 'sent', ':now': now, ':count': sent },
      }));

      return ok({ sent, total: emails.length });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    console.error(e);
    return serverError();
  }
};
