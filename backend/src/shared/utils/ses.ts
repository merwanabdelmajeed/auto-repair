import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const FROM_EMAIL = process.env['SES_FROM_EMAIL'] ?? '';

const STATUS_PHRASE: Record<string, string> = {
  confirmed: 'has been confirmed',
  'in-progress': 'is now in progress',
  completed: 'has been completed',
  cancelled: 'has been cancelled',
};

export async function sendAppointmentStatusEmail(params: {
  toEmail: string;
  customerName: string;
  serviceName: string;
  scheduledAt: string;
  status: string;
}): Promise<void> {
  if (!FROM_EMAIL) return;
  const { toEmail, customerName, serviceName, scheduledAt, status } = params;
  const phrase = STATUS_PHRASE[status] ?? `has been updated to ${status}`;
  const displayName = customerName.trim() || 'there';
  const displayDate = new Date(scheduledAt).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  await ses.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: `Your ${serviceName} appointment ${phrase}` },
      Body: {
        Text: {
          Data: [
            `Hi ${displayName},`,
            '',
            `Your ${serviceName} appointment scheduled for ${displayDate} ${phrase}.`,
            '',
            'Thank you for choosing AutoRepair Pro.',
          ].join('\n'),
        },
      },
    },
  }));
}
