import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

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
