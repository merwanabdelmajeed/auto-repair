import type { ScheduledEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import * as notify from '../../../shared/utils/notify.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => {
  ddbMock.reset();
  jest.restoreAllMocks();
});

function apptAt(hoursFromNow: number, overrides: Record<string, unknown> = {}) {
  const scheduledAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
  return {
    tenantId: 't1', customerId: 'cust-1', appointmentId: 'a1', serviceName: 'Oil Change', scheduledAt,
    ...overrides,
  };
}

describe('Notification reminder scan', () => {
  it('sends a 24h reminder and claims the send slot atomically', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [apptAt(24)] });
    ddbMock.on(UpdateCommand).resolves({});
    const notifyUserSpy = jest.spyOn(notify, 'notifyUser').mockResolvedValue();

    await handler({} as ScheduledEvent);

    expect(notifyUserSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'appointment_reminder_24h', appointmentId: 'a1' }));
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(updateCall?.UpdateExpression).toContain('reminder24hSentAt');
  });

  it('sends a 2h reminder', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [apptAt(2)] });
    ddbMock.on(UpdateCommand).resolves({});
    const notifyUserSpy = jest.spyOn(notify, 'notifyUser').mockResolvedValue();

    await handler({} as ScheduledEvent);

    expect(notifyUserSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'appointment_reminder_2h' }));
  });

  it('skips sending when the slot was already claimed (ConditionalCheckFailedException)', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [apptAt(24)] });
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
    const notifyUserSpy = jest.spyOn(notify, 'notifyUser').mockResolvedValue();

    await handler({} as ScheduledEvent);

    expect(notifyUserSpy).not.toHaveBeenCalled();
  });

  it('does nothing for appointments outside both reminder windows', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [apptAt(10)] });
    const notifyUserSpy = jest.spyOn(notify, 'notifyUser').mockResolvedValue();

    await handler({} as ScheduledEvent);

    expect(notifyUserSpy).not.toHaveBeenCalled();
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('logs and continues when notifyUser rejects', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [apptAt(24)] });
    ddbMock.on(UpdateCommand).resolves({});
    jest.spyOn(notify, 'notifyUser').mockRejectedValue(new Error('push failed'));

    await expect(handler({} as ScheduledEvent)).resolves.toBeUndefined();
  });

  it('scans the whole table for appointments in either reminder window, excluding cancelled/completed', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    await handler({} as ScheduledEvent);

    const scanCall = ddbMock.commandCalls(ScanCommand)[0]?.args[0].input;
    expect(scanCall?.TableName).toBe(TABLE.APPOINTMENTS);
    expect(scanCall?.FilterExpression).toContain('NOT (#s IN (:cancelled, :completed))');
  });
});
