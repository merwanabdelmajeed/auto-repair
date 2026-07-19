import { ok, paginated, created, badRequest, unauthorized, forbidden, notFound, conflict, tooManyRequests, serverError } from './response.js';

function body(result: { body: string }) {
  return JSON.parse(result.body);
}

describe('response helpers', () => {
  it('ok wraps data with success: true and status 200', () => {
    const r = ok({ x: 1 });
    expect(r.statusCode).toBe(200);
    expect(body(r)).toEqual({ success: true, data: { x: 1 } });
  });

  it('paginated wraps items + nextCursor', () => {
    const r = paginated([1, 2], 'cursor-1');
    expect(r.statusCode).toBe(200);
    expect(body(r)).toEqual({ success: true, data: { items: [1, 2], nextCursor: 'cursor-1' } });
  });

  it('created returns status 201', () => {
    const r = created({ id: 1 });
    expect(r.statusCode).toBe(201);
  });

  it('badRequest returns status 400 with the given error', () => {
    const r = badRequest('bad input');
    expect(r.statusCode).toBe(400);
    expect(body(r)).toEqual({ success: false, error: 'bad input' });
  });

  it('unauthorized defaults its message when called with no argument', () => {
    const r = unauthorized();
    expect(r.statusCode).toBe(401);
    expect(body(r).error).toBe('Unauthorized');
  });

  it('unauthorized accepts a custom message', () => {
    expect(body(unauthorized('bad token')).error).toBe('bad token');
  });

  it('forbidden defaults its message when called with no argument', () => {
    const r = forbidden();
    expect(r.statusCode).toBe(403);
    expect(body(r).error).toBe('Forbidden');
  });

  it('notFound defaults its message when called with no argument', () => {
    const r = notFound();
    expect(r.statusCode).toBe(404);
    expect(body(r).error).toBe('Not found');
  });

  it('conflict returns status 409 with the given error', () => {
    const r = conflict('slot taken');
    expect(r.statusCode).toBe(409);
    expect(body(r).error).toBe('slot taken');
  });

  it('tooManyRequests returns status 429, defaulting its message', () => {
    expect(tooManyRequests().statusCode).toBe(429);
    expect(body(tooManyRequests()).error).toBe('Too many requests');
    expect(body(tooManyRequests('slow down')).error).toBe('slow down');
  });

  it('serverError defaults its message when called with no argument', () => {
    const r = serverError();
    expect(r.statusCode).toBe(500);
    expect(body(r).error).toBe('Internal server error');
  });

  it('every response sets JSON content-type and CORS headers', () => {
    const r = ok({});
    expect(r.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
  });
});
