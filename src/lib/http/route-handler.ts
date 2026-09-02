/**
 * The wrapper every API route handler is written inside.
 *
 * It exists so that SRS 18.1 ("return consistent JSON error structures") and
 * 24.5 ("technical details are logged server-side, not exposed in the browser")
 * are properties of the framework rather than promises each handler has to
 * keep. A handler throws whatever went wrong and returns only the success
 * case; this file owns every other outcome.
 */
import { type NextResponse } from 'next/server';
import { z } from 'zod';

import { translatePrismaError } from '@/lib/db/prisma-errors';
import { ErrorCode, isAppError, validationFailed, type AppError } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { logger } from '@/lib/logger';

import { errorResponse, toFieldErrors, type ApiErrorBody } from './api-response';

/**
 * Route segment parameters. Next.js delivers these as a promise, so handlers
 * awaiting `context.params` stay correct as the framework evolves.
 */
export interface RouteContext<TParams extends Record<string, string> = Record<string, never>> {
  params: Promise<TParams>;
}

export type RouteHandler<TParams extends Record<string, string> = Record<string, never>> = (
  request: Request,
  context: RouteContext<TParams>,
) => Promise<NextResponse> | NextResponse;

function toErrorResponse(error: unknown, request: Request): NextResponse<ApiErrorBody> {
  const appError: AppError | null = isAppError(error)
    ? error
    : error instanceof z.ZodError
      ? validationFailed(toFieldErrors(error))
      : translatePrismaError(error);

  if (appError) {
    // Expected outcomes are logged at warn without a stack: they are signal
    // about how the system is used, not about it being broken.
    logger.warn('Request rejected', {
      method: request.method,
      path: new URL(request.url).pathname,
      code: appError.code,
      status: appError.status,
    });

    return errorResponse(
      appError.status,
      appError.code,
      appError.message,
      appError.fieldErrors,
    );
  }

  logger.error('Unhandled error in route handler', error, {
    method: request.method,
    path: new URL(request.url).pathname,
  });

  // Deliberately says nothing (SRS 24.5). The detail is in the log line above.
  return errorResponse(500, ErrorCode.INTERNAL_ERROR, ERRORS.internal);
}

/**
 * Wraps a route handler so that any thrown value becomes a correctly shaped
 * JSON error response.
 *
 * ```ts
 * export const POST = withRouteHandler(async (request) => {
 *   const actor = await requireAdmin();
 *   const input = await parseJsonBody(request, createVehicleSchema);
 *   return created(await vehicleService.create(actor, input));
 * });
 * ```
 */
export function withRouteHandler<
  TParams extends Record<string, string> = Record<string, never>,
>(handler: RouteHandler<TParams>): RouteHandler<TParams> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error, request);
    }
  };
}

/**
 * Reads and validates a JSON request body.
 *
 * Malformed JSON and schema failures both surface as one 400 with field-level
 * detail, so a handler never has to distinguish them. Because entity schemas
 * are declared `.strict()`, an unexpected key - `driverId`, `status`,
 * `actualKm` - is rejected here rather than silently dropped, which is what
 * makes the mass-assignment guarantee in SRS 22.4 observable.
 */
export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw validationFailed({ root: [ERRORS.malformedBody] }, ERRORS.unreadableRequest);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed(toFieldErrors(parsed.error));
  }

  return parsed.data;
}

/**
 * Validates query-string parameters.
 *
 * Repeated keys collapse into arrays so a schema can accept either
 * `?status=APPROVED` or `?status=APPROVED&status=PENDING_APPROVAL` without the
 * caller special-casing the difference.
 */
export function parseSearchParams<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): z.output<TSchema> {
  const { searchParams } = new URL(request.url);
  const raw: Record<string, string | string[]> = {};

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    if (values.length === 0) continue;
    raw[key] = values.length > 1 ? values : values[0]!;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed(toFieldErrors(parsed.error), ERRORS.invalidFilters);
  }

  return parsed.data;
}
