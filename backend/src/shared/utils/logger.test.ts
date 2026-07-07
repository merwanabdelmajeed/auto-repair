import { logger } from './logger.js';

describe('logger', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('emits INFO lines via console.log as structured JSON', () => {
    logger.info('something happened', { userId: 'u1' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({ level: 'INFO', message: 'something happened', userId: 'u1' });
    expect(typeof entry.timestamp).toBe('string');
  });

  it('emits WARN lines via console.warn', () => {
    logger.warn('careful');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(entry.level).toBe('WARN');
  });

  it('emits ERROR lines via console.error, serializing an Error object under `error`', () => {
    logger.error('it broke', { error: new Error('boom'), requestId: 'r1' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(entry.level).toBe('ERROR');
    expect(entry.requestId).toBe('r1');
    expect(entry.error).toMatchObject({ name: 'Error', message: 'boom' });
    expect(typeof entry.error.stack).toBe('string');
  });

  it('serializes a non-Error thrown value via String()', () => {
    logger.error('rejected with a string', { error: 'plain string rejection' });

    const entry = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(entry.error).toEqual({ message: 'plain string rejection' });
  });

  it('omits the error field entirely when no error is passed', () => {
    logger.info('no error here');

    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.error).toBeUndefined();
  });
});
