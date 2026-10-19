import { decodeVin, normalizeVin } from './vin';

const realFetch = globalThis.fetch;
let calls: string[] = [];

function stubFetch(response: { ok: boolean; body?: unknown; badJson?: boolean } | Error) {
  calls = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    expect(init?.signal).toBeDefined();
    if (response instanceof Error) throw response;
    return {
      ok: response.ok,
      json: async () => {
        if (response.badJson) throw new SyntaxError('Unexpected token <');
        return response.body;
      },
    } as Response;
  }) as typeof fetch;
}

afterEach(() => { globalThis.fetch = realFetch; });

describe('normalizeVin', () => {
  it('uppercases, strips non-alphanumerics and caps at 17', () => {
    expect(normalizeVin(' 1hgcm-8263 3a004352 ')).toBe('1HGCM82633A004352');
    expect(normalizeVin('1HGCM82633A004352XYZ')).toBe('1HGCM82633A004352');
  });
});

describe('decodeVin', () => {
  it('returns year/make/model/trim from NHTSA', async () => {
    stubFetch({ ok: true, body: { Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', Trim: 'EX-V6' }] } });
    expect(await decodeVin('1HGCM82633A004352')).toEqual({
      status: 'ok', vehicle: { make: 'HONDA', model: 'Accord', year: '2003', trim: 'EX-V6' },
    });
    expect(calls[0]).toBe('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1HGCM82633A004352?format=json');
  });

  it('omits an empty trim', async () => {
    stubFetch({ ok: true, body: { Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', Trim: '' }] } });
    expect(await decodeVin('X')).toEqual({ status: 'ok', vehicle: { make: 'HONDA', model: 'Accord', year: '2003', trim: undefined } });
  });

  it('reports not-found when NHTSA answers but cannot decode the VIN', async () => {
    stubFetch({ ok: true, body: { Results: [{ Make: '', Model: '', ModelYear: '' }] } });
    expect(await decodeVin('BAD')).toEqual({ status: 'not-found' });
    stubFetch({ ok: true, body: {} });
    expect(await decodeVin('BAD')).toEqual({ status: 'not-found' });
  });

  it('times out a hung request as unavailable', async () => {
    let aborted = false;
    globalThis.fetch = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
    })) as typeof fetch;
    expect(await decodeVin('X', 20)).toEqual({ status: 'unavailable' });
    expect(aborted).toBe(true);
  });

  it('reports unavailable on an outage (non-2xx), a non-JSON body, or a network error', async () => {
    stubFetch({ ok: false });
    expect(await decodeVin('X')).toEqual({ status: 'unavailable' });
    stubFetch({ ok: true, badJson: true });
    expect(await decodeVin('X')).toEqual({ status: 'unavailable' });
    stubFetch(new Error('offline'));
    expect(await decodeVin('X')).toEqual({ status: 'unavailable' });
  });
});
