'use client';

import { useState } from 'react';

import type { FormState } from '@/app/(app)/admin/actions';
import { ActiveToggle, EntityForm } from '@/components/admin/entity-form';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { FIELD_LABELS, ROLE_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { Role } from '@/modules/services/domain/service-status';

export interface RouteOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface VehicleOption {
  id: string;
  registrationPlate: string;
  referenceName: string | null;
}

export interface UserFormInitial {
  name: string;
  loginIdentifier: string;
  role: Role;
  isActive: boolean;
  defaultVehicleId: string | null;
  assignments: { routeId: string; isDefault: boolean }[];
}

/**
 * Create/edit a user (SRS 12.2, 12.3, 12.5, 12.6).
 *
 * ## Why the role gates the rest of the form
 *
 * SRS 3.2 gives administrators no vehicle and no routes, and SRS 19.6 defines
 * `driver_routes.driver_id` as referencing a DRIVER. The schema rejects an
 * administrator carrying either, so the fields are hidden rather than left to
 * submit values the server will refuse — the role selector drives it live,
 * because an administrator switching the role mid-form should see the
 * consequence immediately.
 *
 * ## Why assignments are checkboxes plus one radio
 *
 * SRS 12.6: a driver has zero or more assigned routes, of which at most one is
 * the default, and "the default route must also be an assigned route". A radio
 * group expresses "at most one" natively, and selecting a default implies the
 * assignment — the action treats a defaulted-but-unchecked route as assigned,
 * because unchecking the box while leaving the radio selected is a slip rather
 * than an instruction.
 */
export function UserForm({
  action,
  submitLabel,
  routes,
  vehicles,
  initial,
  isSelf,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  routes: RouteOption[];
  vehicles: VehicleOption[];
  initial?: UserFormInitial;
  /** True when an administrator is editing their own account. */
  isSelf?: boolean;
}) {
  const [role, setRole] = useState<Role>(initial?.role ?? Role.DRIVER);
  const [defaultRouteId, setDefaultRouteId] = useState(
    initial?.assignments.find((assignment) => assignment.isDefault)?.routeId ?? '',
  );
  const [assigned, setAssigned] = useState<Set<string>>(
    new Set(initial?.assignments.map((assignment) => assignment.routeId) ?? []),
  );

  const isEditing = Boolean(initial);
  const isDriver = role === Role.DRIVER;

  function toggle(routeId: string, checked: boolean) {
    setAssigned((current) => {
      const next = new Set(current);
      if (checked) next.add(routeId);
      else {
        next.delete(routeId);
        // Dropping the route that was the default clears the default too,
        // rather than leaving a radio pointing at nothing.
        if (defaultRouteId === routeId) setDefaultRouteId('');
      }
      return next;
    });
  }

  return (
    <EntityForm
      action={action}
      submitLabel={submitLabel}
      footer={
        isDriver ? (
          <Card>
            <CardHeader>
              <CardTitle>{FIELD_LABELS.assignments}</CardTitle>
              <p className="text-muted-foreground text-xs">{UI.admin.assignmentsHint}</p>
            </CardHeader>
            <CardBody className="space-y-3">
              {routes.length === 0 ? (
                <Alert tone="warning">{UI.admin.noActiveRoutes}</Alert>
              ) : (
                <>
                  <div className="text-muted-foreground grid grid-cols-[auto_auto_1fr] items-center gap-x-3 px-1 text-xs font-medium">
                    <span>{UI.admin.assignedColumn}</span>
                    <span>{UI.admin.defaultColumn}</span>
                    <span>{UI.admin.routeColumn}</span>
                  </div>

                  <ul className="divide-y rounded-lg border">
                    {routes.map((route) => {
                      const isAssigned = assigned.has(route.id);
                      return (
                        <li
                          key={route.id}
                          className={cn(
                            'grid grid-cols-[auto_auto_1fr] items-center gap-x-3 px-3 py-2.5',
                            !isAssigned && 'opacity-60',
                          )}
                        >
                          <input
                            type="checkbox"
                            name={`route:${route.id}`}
                            aria-label={`${UI.admin.assignedColumn}: ${route.code}`}
                            checked={isAssigned}
                            onChange={(event) => toggle(route.id, event.target.checked)}
                            className="border-input accent-primary size-5 rounded"
                          />
                          <input
                            type="radio"
                            name="defaultRouteId"
                            value={route.id}
                            aria-label={`${FIELD_LABELS.defaultRoute}: ${route.code}`}
                            checked={defaultRouteId === route.id}
                            onChange={() => {
                              setDefaultRouteId(route.id);
                              // Choosing a default assigns the route as well;
                              // the two cannot disagree.
                              setAssigned((current) => new Set(current).add(route.id));
                            }}
                            className="border-input accent-primary size-5"
                          />
                          <span className="min-w-0 text-sm">
                            <span className="font-mono font-medium">{route.code}</span>
                            <span className="text-muted-foreground"> · {route.name}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {assigned.size > 0 && !defaultRouteId ? (
                    <Alert tone="warning">{UI.admin.noDefaultWarning}</Alert>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>
        ) : null
      }
    >
      {({ fieldErrors, values }) => (
        <>
          <Field label={FIELD_LABELS.name} required errors={fieldErrors?.['name']}>
            {(props) => (
              <Input
                {...props}
                name="name"
                required
                autoComplete="off"
                defaultValue={values?.['name'] ?? initial?.name ?? ''}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.loginIdentifier}
            required
            errors={fieldErrors?.['loginIdentifier']}
            hint={UI.admin.loginHint}
          >
            {(props) => (
              <Input
                {...props}
                name="loginIdentifier"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                defaultValue={values?.['loginIdentifier'] ?? initial?.loginIdentifier ?? ''}
              />
            )}
          </Field>

          {/*
            On create the password is required; on edit it is optional and an
            empty box leaves the existing one untouched. The client resets
            forgotten passwords themselves (docs/open-questions.md #5), so this
            is the only place a password is ever set.
          */}
          <Field
            label={FIELD_LABELS.password}
            required={!isEditing}
            optional={isEditing}
            errors={fieldErrors?.['password']}
            hint={isEditing ? UI.admin.passwordHintEdit : UI.admin.passwordHintCreate}
          >
            {(props) => (
              <Input
                {...props}
                name="password"
                type="password"
                required={!isEditing}
                autoComplete="new-password"
              />
            )}
          </Field>

          <Field label={FIELD_LABELS.role} required errors={fieldErrors?.['role']}>
            {(props) => (
              <Select
                {...props}
                name="role"
                value={role}
                disabled={isSelf}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value={Role.DRIVER}>{ROLE_LABELS.DRIVER}</option>
                <option value={Role.ADMIN}>{ROLE_LABELS.ADMIN}</option>
              </Select>
            )}
          </Field>

          {isSelf ? <Alert tone="info">{UI.admin.selfEditNotice}</Alert> : null}

          {isDriver ? (
            <Field
              label={FIELD_LABELS.defaultVehicle}
              optional
              errors={fieldErrors?.['defaultVehicleId']}
              hint={UI.admin.defaultVehicleHint}
            >
              {(props) => (
                <Select
                  {...props}
                  name="defaultVehicleId"
                  defaultValue={values?.['defaultVehicleId'] ?? initial?.defaultVehicleId ?? ''}
                >
                  <option value="">{UI.common.none}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registrationPlate}
                      {vehicle.referenceName ? ` — ${vehicle.referenceName}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          <ActiveToggle
            defaultChecked={values ? values['isActive'] === 'on' : (initial?.isActive ?? true)}
            hint={UI.admin.accountActiveHint}
          />
        </>
      )}
    </EntityForm>
  );
}
