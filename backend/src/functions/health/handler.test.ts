import { handler } from './handler';

describe('GET /health', () => {
  it('returns ok status with a timestamp', async () => {
    const result = await handler({} as never);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toMatchObject({ status: 'ok', service: 'autorepair-api' });
    expect(typeof body.data.timestamp).toBe('string');
  });
});
