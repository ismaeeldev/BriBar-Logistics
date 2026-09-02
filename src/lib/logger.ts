/**
 * Structured server-side logging.
 *
 * Deliberately dependency-free: the application needs one line of JSON per
 * event so a hosting provider's log drain can index it, and nothing more.
 * Swapping in pino later means reimplementing this file's four functions.
 *
 * The redaction pass is the part that matters. SRS 22.7 forbids credential
 * secrets in audit data, and the same reasoning applies to logs - a stack
 * trace that happens to carry a `passwordHash` in its context object is a
 * credential leak into a third-party log index.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Compared case-insensitively against the *normalised* key, so
 * `passwordHash`, `password_hash` and `PASSWORD_HASH` all match one entry.
 */
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'passwordconfirmation',
  'secret',
  'authsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'apikey',
  'authorization',
  'cookie',
  'setcookie',
  'databaseurl',
  'directdatabaseurl',
]);

const REDACTION = '[redacted]';
const MAX_DEPTH = 6;

function normaliseKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[max depth]';
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED_KEYS.has(normaliseKey(key)) ? REDACTION : redact(item, depth + 1);
  }
  return out;
}

/** Errors do not survive `JSON.stringify`; unwrap them by hand. */
function serialiseError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: redact(error) };

  return {
    error: {
      name: error.name,
      message: error.message,
      // Stacks are server-side only and never reach the browser (SRS 24.5).
      stack: error.stack,
      ...(error.cause !== undefined ? { cause: serialiseError(error.cause)['error'] } : {}),
    },
  };
}

export type LogContext = Record<string, unknown>;

function minimumLevel(): LogLevel {
  const configured = process.env['LOG_LEVEL']?.toLowerCase();
  if (configured && configured in LEVEL_ORDER) return configured as LogLevel;
  return process.env['NODE_ENV'] === 'production' ? 'info' : 'debug';
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel()]) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? (redact(context) as LogContext) : {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),

  /**
   * `error` takes the thrown value separately so callers never have to
   * remember to unwrap a stack trace themselves.
   */
  error: (message: string, error?: unknown, context?: LogContext) =>
    write('error', message, {
      ...(context ? (redact(context) as LogContext) : {}),
      ...(error !== undefined ? serialiseError(error) : {}),
    }),
};
