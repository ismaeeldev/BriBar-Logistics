/**
 * The single JSON shape every API route speaks (SRS 18.1, 18.7).
 *
 * Success and failure are distinguished by which key is present, not by
 * inspecting the status code, so a client can narrow the union without a
 * second lookup:
 *
 *   { "data": { ... }, "meta"?: { ... } }
 *   { "error": { "code": "...", "message": "...", "fieldErrors"?: { ... } } }
 *
 * `message` is always safe to show a user. `fieldErrors` is keyed by the field
 * path the client submitted, which lets react-hook-form apply server-side
 * validation results without a translation step (SRS 24.1).
 */
import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { type ErrorCode, type FieldErrors } from '@/lib/errors/app-error';

/** Cursor/offset metadata for paginated list endpoints (SRS 23.8). */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fieldErrors?: FieldErrors;
  };
}

export type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export function ok<T>(data: T, meta?: PaginationMeta): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json(meta ? { data, meta } : { data }, { status: 200 });
}

export function created<T>(data: T): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data }, { status: 201 });
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: fieldErrors ? { code, message, fieldErrors } : { code, message } },
    { status },
  );
}

/**
 * Flattens Zod issues into `fieldErrors`.
 *
 * Paths are joined with dots so nested and array shapes survive
 * (`assignments.0.routeId`), matching how react-hook-form names inputs.
 * Issues with an empty path are form-level and land under `root`, again
 * following the react-hook-form convention.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : 'root';
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}
