/**
 * The application's error taxonomy (SRS 18.7, 24).
 *
 * Two kinds of failure exist in this codebase:
 *
 *   1. `AppError` - an expected outcome the caller is allowed to know about.
 *      Its `message` is written for a human and is safe to render verbatim.
 *   2. Everything else - a bug, a dropped connection, a third party misbehaving.
 *      The HTTP layer turns these into a generic 500 and logs the detail
 *      server-side, because SRS 24.5 forbids leaking implementation detail to
 *      the browser.
 *
 * Throwing is deliberate. Business rules live deep in the service layer, and
 * threading a `Result` type through every call would bury the happy path. The
 * single `withRouteHandler` wrapper in `src/lib/http` is the only place that
 * has to know how these map onto status codes.
 */

import { ERRORS } from '@/lib/i18n/messages';

/**
 * Stable, machine-readable failure identifiers. The UI switches on these
 * rather than on prose, so wording can change without breaking a client.
 */
export const ErrorCode = {
  /** Request body or query string failed schema validation. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Input was well-formed but violates a domain rule (SRS 10.3, 11). */
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  /** No valid session (SRS 8.1). */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** Authenticated, but the role or ownership check failed (SRS 22.3). */
  FORBIDDEN: 'FORBIDDEN',
  /** Absent, or deliberately invisible to this caller (SRS 18.7, 24.3). */
  NOT_FOUND: 'NOT_FOUND',
  /** The record moved underneath the caller (SRS 24.4). */
  CONFLICT: 'CONFLICT',
  /** Admin has not finished configuring something the action needs (SRS 24.2). */
  CONFIGURATION_REQUIRED: 'CONFIGURATION_REQUIRED',
  /** Unexpected. Never carries detail to the client. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Per-field messages, keyed by the field path the client submitted. */
export type FieldErrors = Record<string, string[]>;

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 400,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.CONFIGURATION_REQUIRED]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

export interface AppErrorOptions {
  /** Field-level detail, surfaced next to the relevant input (SRS 24.1). */
  fieldErrors?: FieldErrors | undefined;
  /** Underlying cause. Logged, never serialised to the client. */
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors | undefined;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = options.fieldErrors;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// ---------------------------------------------------------------------------
// Factories
//
// Named functions rather than static methods: they read better at the call
// site (`throw forbidden()`) and tree-shake individually.
// ---------------------------------------------------------------------------

export function validationFailed(
  fieldErrors: FieldErrors,
  message: string = ERRORS.validationFailed,
): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message, { fieldErrors });
}

/**
 * A rule the schema cannot express on its own - mileage ordering, an
 * unassigned route, an inactive vehicle.
 */
export function businessRuleViolation(message: string, fieldErrors?: FieldErrors): AppError {
  return new AppError(ErrorCode.BUSINESS_RULE_VIOLATION, message, { fieldErrors });
}

export function unauthenticated(message: string = ERRORS.unauthenticated): AppError {
  return new AppError(ErrorCode.UNAUTHENTICATED, message);
}

export function forbidden(message: string = ERRORS.forbidden): AppError {
  return new AppError(ErrorCode.FORBIDDEN, message);
}

/**
 * Also the correct answer when a record exists but belongs to someone else.
 * SRS 18.7 defines 404 as "not found *or not visible to caller*", and 24.3
 * forbids confirming that a protected record exists. Repositories scope reads
 * by owner so this falls out naturally rather than needing a decision at each
 * call site.
 */
export function notFound(entity?: string): AppError {
  return new AppError(ErrorCode.NOT_FOUND, ERRORS.notFound(entity));
}

/**
 * The canonical use is SRS 24.4: a driver edits a pending service that an
 * administrator approved between page load and save.
 */
export function conflict(message: string): AppError {
  return new AppError(ErrorCode.CONFLICT, message);
}

/**
 * SRS 24.2: the driver has no default route or no usable vehicle. The message
 * must tell them what an administrator needs to do, not just that something
 * is missing.
 */
export function configurationRequired(message: string): AppError {
  return new AppError(ErrorCode.CONFIGURATION_REQUIRED, message);
}

/**
 * Wraps an unexpected failure. The message is intentionally generic; the cause
 * is preserved for the server-side log only (SRS 24.5).
 */
export function internalError(cause?: unknown): AppError {
  return new AppError(ErrorCode.INTERNAL_ERROR, ERRORS.internal, { cause });
}
