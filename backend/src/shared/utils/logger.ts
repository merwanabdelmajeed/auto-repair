type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function emit(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const { error, ...rest } = meta;
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...rest,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

// Structured JSON logging so CloudWatch Logs Insights can query fields
// directly (level, message, error.name, etc.) instead of grepping free text.
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emit('INFO', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('WARN', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('ERROR', message, meta),
};
