/**
 * User/driver administration schemas (SRS 12, 19.3, 19.6, 22.1).
 */
import { z } from 'zod';

import { AUTH, FIELD_LABELS, VALIDATION } from '@/lib/i18n/messages';
import { booleanSchema, requiredText, uuidSchema } from '@/modules/shared/schemas/common';
import { Role } from '@/modules/services/domain/service-status';

export const NAME_MAX_LENGTH = 120;
export const LOGIN_IDENTIFIER_MAX_LENGTH = 64;

/**
 * Password policy, following NIST SP 800-63B.
 *
 * Length is the control that matters; composition rules ("one uppercase, one
 * symbol") measurably push people towards `Password1!` and are explicitly
 * discouraged by current guidance, so there are none here. What the policy
 * does check is the failure mode that actually shows up in small internal
 * deployments: an account created as `driver1 / driver1`.
 *
 * The 128-character ceiling bounds the work an unauthenticated request can ask
 * the Argon2 hasher to do at the login endpoint.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const OBVIOUS_PASSWORDS = new Set([
  'password',
  'password123',
  'passw0rd',
  '123456789012',
  'qwertyuiop',
  'administrator',
  'bribarlogistics',
  'letmein12345',
]);

export const passwordSchema = z
  .string({ error: VALIDATION.required(FIELD_LABELS.password) })
  .min(PASSWORD_MIN_LENGTH, VALIDATION.passwordTooShort(PASSWORD_MIN_LENGTH))
  .max(PASSWORD_MAX_LENGTH, VALIDATION.passwordTooLong(PASSWORD_MAX_LENGTH))
  .refine((value) => !OBVIOUS_PASSWORDS.has(value.toLowerCase()), VALIDATION.passwordTooCommon);

/**
 * Login identifier (SRS 19.3).
 *
 * Lower-cased on the way in so `Admin` and `admin` cannot become two accounts.
 * Normalising at the schema means the unique index does the rest, with no need
 * for a functional index or a case-insensitive collation.
 */
export const loginIdentifierSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z
    .string({ error: VALIDATION.required(FIELD_LABELS.loginIdentifier) })
    .min(3, VALIDATION.tooShort(FIELD_LABELS.loginIdentifier, 3))
    .max(
      LOGIN_IDENTIFIER_MAX_LENGTH,
      VALIDATION.tooLong(FIELD_LABELS.loginIdentifier, LOGIN_IDENTIFIER_MAX_LENGTH),
    )
    .regex(/^[a-z0-9][a-z0-9._-]*$/, VALIDATION.loginIdentifierFormat),
);

export const roleSchema = z.enum(Role, { error: VALIDATION.roleRequired });

/** One row of `driver_routes` (SRS 12.6, 19.6). */
export const routeAssignmentSchema = z.strictObject({
  routeId: uuidSchema,
  isDefault: z.boolean().default(false),
});

export type RouteAssignmentInput = z.output<typeof routeAssignmentSchema>;

/**
 * The two invariants of a driver's route set (SRS 12.6, 19.6).
 *
 * At *most* one default, not exactly one: SRS 9.2 anticipates a driver with no
 * default configured yet and requires Add Service to show a configuration
 * message rather than treating it as impossible. Rejecting a defaultless set
 * here would make an administrator unable to save partial progress.
 *
 * PostgreSQL enforces the same rule with a partial unique index, so a
 * concurrent pair of requests each setting a different default cannot both
 * succeed.
 */
function checkRouteAssignments(
  assignments: RouteAssignmentInput[],
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  assignments.forEach((assignment, index) => {
    if (seen.has(assignment.routeId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignments', index, 'routeId'],
        message: VALIDATION.duplicateRoute,
      });
    }
    seen.add(assignment.routeId);
  });

  if (assignments.filter((assignment) => assignment.isDefault).length > 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['assignments'],
      message: VALIDATION.onlyOneDefaultRoute,
    });
  }
}

/** Body of `PUT /api/admin/users/[id]/routes` - a full replacement (SRS 18.4). */
export const replaceRouteAssignmentsSchema = z
  .strictObject({
    assignments: z.array(routeAssignmentSchema).max(200),
  })
  .superRefine((value, ctx) => checkRouteAssignments(value.assignments, ctx));

export type ReplaceRouteAssignmentsInput = z.output<typeof replaceRouteAssignmentsSchema>;

/**
 * Cross-field rules shared by create and update.
 *
 * Both only apply when the relevant fields are present, which is why they are
 * written against optional values - `updateUserSchema` is a partial.
 */
interface UserShape {
  role?: Role | undefined;
  loginIdentifier?: string | undefined;
  password?: string | undefined;
  defaultVehicleId?: string | null | undefined;
  assignments?: RouteAssignmentInput[] | undefined;
}

function checkUserShape(value: UserShape, ctx: z.RefinementCtx): void {
  // An account whose password is its own username is the failure mode this
  // policy exists to catch.
  if (
    value.password &&
    value.loginIdentifier &&
    value.password.toLowerCase().includes(value.loginIdentifier.toLowerCase())
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['password'],
      message: VALIDATION.passwordContainsLogin,
    });
  }

  // SRS 19.6 defines `driver_routes.driver_id` as referencing a user with the
  // DRIVER role, and 3.2 gives administrators no route or vehicle of their
  // own. PostgreSQL cannot express "foreign key to rows where role = DRIVER",
  // so the rule is enforced here and again in the service layer.
  if (value.role === Role.ADMIN) {
    if (value.defaultVehicleId) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultVehicleId'],
        message: VALIDATION.adminHasNoVehicle,
      });
    }
    if (value.assignments && value.assignments.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignments'],
        message: VALIDATION.adminHasNoRoutes,
      });
    }
  }
}

/**
 * SRS 12.2. Route assignments and the default vehicle are accepted alongside
 * the account so an administrator can configure a driver in one step; the
 * service layer writes all of it in a single transaction.
 */
export const createUserSchema = z
  .strictObject({
    name: requiredText(FIELD_LABELS.name, NAME_MAX_LENGTH, 2),
    loginIdentifier: loginIdentifierSchema,
    password: passwordSchema,
    role: roleSchema,
    isActive: booleanSchema.default(true),
    defaultVehicleId: uuidSchema.nullish(),
    assignments: z.array(routeAssignmentSchema).max(200).default([]),
  })
  .superRefine((value, ctx) => {
    checkUserShape(value, ctx);
    checkRouteAssignments(value.assignments, ctx);
  });

export type CreateUserInput = z.output<typeof createUserSchema>;

/**
 * SRS 12.3, 12.4.
 *
 * `password` is optional: an administrator resetting a forgotten credential is
 * in scope (12.2 covers issuing one), while self-service reset is not a V1
 * feature. Omitting it leaves the existing hash untouched.
 *
 * `defaultVehicleId` is nullable rather than merely optional so that clearing
 * a driver's default vehicle is expressible - `null` means "remove it",
 * absent means "leave it alone". Route assignments are not editable here; they
 * have their own endpoint (18.4) because replacing a set and patching fields
 * are different operations with different failure modes.
 */
export const updateUserSchema = z
  .strictObject({
    name: requiredText(FIELD_LABELS.name, NAME_MAX_LENGTH, 2).optional(),
    loginIdentifier: loginIdentifierSchema.optional(),
    password: passwordSchema.optional(),
    role: roleSchema.optional(),
    isActive: booleanSchema.optional(),
    defaultVehicleId: uuidSchema.nullish(),
  })
  .superRefine(checkUserShape);

export type UpdateUserInput = z.output<typeof updateUserSchema>;

/**
 * The sign-in form (SRS 17.1).
 *
 * Length limits only. Applying the full password policy here would tell an
 * attacker that a submitted string could not possibly be a valid password,
 * and SRS 22.1 requires login errors not to expose unnecessary information.
 */
export const credentialsSchema = z.object({
  loginIdentifier: z
    .string()
    .min(1, AUTH.loginIdentifierRequired)
    .max(LOGIN_IDENTIFIER_MAX_LENGTH),
  password: z.string().min(1, AUTH.passwordRequired).max(PASSWORD_MAX_LENGTH),
});

export type CredentialsInput = z.output<typeof credentialsSchema>;
