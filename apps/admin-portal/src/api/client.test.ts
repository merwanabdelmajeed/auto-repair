import { api, ApiError } from './client';

vi.mock('../auth/CognitoService', () => ({
  getIdToken: vi.fn(),
}));

import { getIdToken } from '../auth/CognitoService';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
  vi.mocked(getIdToken).mockResolvedValue(null);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe('api client', () => {
  it('GET sends no body and no Authorization header when there is no token', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ success: true, data: { x: 1 } }));

    const data = await api.get<{ x: number }>('/thing');

    expect(data).toEqual({ x: 1 });
    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(options?.headers).not.toHaveProperty('Authorization');
  });

  it('attaches the Authorization header when a token is available', async () => {
    vi.mocked(getIdToken).mockResolvedValue('id-token-123');
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ success: true, data: {} }));

    await api.get('/thing');

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(options?.headers).toMatchObject({ Authorization: 'id-token-123' });
  });

  it('post/put/patch send the method and JSON-stringified body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ success: true, data: {} }));

    await api.post('/thing', { a: 1 });
    let [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(options).toMatchObject({ method: 'POST', body: JSON.stringify({ a: 1 }) });

    await api.put('/thing', { a: 2 });
    [, options] = vi.mocked(globalThis.fetch).mock.calls[1];
    expect(options).toMatchObject({ method: 'PUT', body: JSON.stringify({ a: 2 }) });

    await api.patch('/thing', { a: 3 });
    [, options] = vi.mocked(globalThis.fetch).mock.calls[2];
    expect(options).toMatchObject({ method: 'PATCH', body: JSON.stringify({ a: 3 }) });
  });

  it('delete sends no body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ success: true, data: {} }));
    await api.delete('/thing');
    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(options).toMatchObject({ method: 'DELETE' });
    expect(options).not.toHaveProperty('body');
  });

  it('throws ApiError with the server-provided message on a non-OK HTTP response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ success: false, error: 'nope' }, false, 400));

    await expect(api.get('/thing')).rejects.toThrow(ApiError);
    await expect(api.get('/thing')).rejects.toMatchObject({ statusCode: 400, message: 'nope' });
  });

  it('throws ApiError with a default message when the response has no error field', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ success: false }, false, 500));

    await expect(api.get('/thing')).rejects.toMatchObject({ statusCode: 500, message: 'Request failed' });
  });

  it('throws ApiError when HTTP is OK but the body reports success: false', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ success: false, error: 'business rule failed' }, true, 200));

    await expect(api.get('/thing')).rejects.toMatchObject({ statusCode: 200, message: 'business rule failed' });
  });
});
