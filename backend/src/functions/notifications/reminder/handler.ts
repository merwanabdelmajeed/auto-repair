import type { ScheduledEvent } from 'aws-lambda';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { notifyUser } from '../../../shared/utils/notify.js';
import type { NotifType } from '../../../shared/utils/notify.js';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  const now = new Date();

  // 24h window: appointments 23–25h from now
  const h24From = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
  const h24To   = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
  // 2h window: appointments 1–3h from now
  const h2From  = new Date(now.getTime() +  1 * 60 * 60 * 1000).toISOString();
  const h2To    = new Date(now.getTime() +  3 * 60 * 60 * 1000).toISOString();

  const result = await db.send(new ScanCommand({
    TableName: TABLE.APPOINTMENTS,
    FilterExpression:
      '(scheduledAt BETWEEN :h24f AND :h24t OR scheduledAt BETWEEN :h2f AND :h2t) ' +
      'AND #s NOT IN (:cancelled, :completed)',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':h24f': h24From, ':h24t': h24To,
      ':h2f': h2From,   ':h2t': h2To,
      ':cancelled': 'cancelled', ':completed': 'completed',
    },
  }));

  await Promise.all((result.Items ?? []).map(appt => processAppt(appt, now)));
};

async function processAppt(appt: Record<string, unknown>, now: Date): Promise<void> {
  const scheduledAt = appt.scheduledAt as string;
  const hoursUntil = (new Date(scheduledAt).getTime() - now.getTime()) / (60 * 60 * 1000);

  const tasks: Promise<void>[] = [];
  if (hoursUntil >= 23 && hoursUntil <= 25) tasks.push(sendReminder(appt, '24h'));
  if (hoursUntil >= 1  && hoursUntil <= 3)  tasks.push(sendReminder(appt, '2h'));
  await Promise.all(tasks);
}

async function sendReminder(appt: Record<string, unknown>, window: '24h' | '2h'): Promise<void> {
  const tenantId     = appt.tenantId as string;
  const customerId   = appt.customerId as string;
  const appointmentId = appt.appointmentId as string;
  const serviceName  = appt.serviceName as string;
  const scheduledAt  = appt.scheduledAt as string;

  const attr = window === '24h' ? 'reminder24hSentAt' : 'reminder2hSentAt';

  // Atomically claim the send slot — skip if already sent
  try {
    await db.send(new UpdateCommand({
      TableName: TABLE.APPOINTMENTS,
      Key: { PK: `TENANT#${tenantId}`, SK: `APPT#${appointmentId}` },
      UpdateExpression: `SET ${attr} = :now`,
      ConditionExpression: `attribute_exists(PK) AND attribute_not_exists(${attr})`,
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));
  } catch (e) {
    if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return;
    throw e;
  }

  const timeStr = new Date(scheduledAt).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const title = window === '24h' ? 'Appointment Tomorrow' : 'Appointment in 2 Hours';
  const body  = `${serviceName} — ${timeStr}`;
  const type: NotifType = window === '24h' ? 'appointment_reminder_24h' : 'appointment_reminder_2h';

  await notifyUser({ tenantId, userId: customerId, type, title, body, appointmentId })
    .catch(err => console.error(`Reminder ${window} failed for`, appointmentId, ':', err));
}
