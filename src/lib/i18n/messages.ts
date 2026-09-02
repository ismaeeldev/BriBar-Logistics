/**
 * Every string a user can see, in one file.
 *
 * The interface is Spanish (client decision, `docs/open-questions.md` #6).
 * SRS 29 excludes a multi-language UI, so there is no locale switching and no
 * i18n library - but the strings are still centralised rather than scattered
 * through schemas and handlers, for three reasons:
 *
 *   1. The client can review the entire wording of the application by reading
 *      one file, and correct terminology without touching logic.
 *   2. SRS 23.3 requires the client's own operational terminology. Keeping the
 *      field labels together makes an inconsistency visible.
 *   3. If a second language is ever added, this is the seam.
 *
 * ------------------------------------------------------------------------
 * NEEDS CLIENT CONFIRMATION
 *
 * SRS 6.3 says the mileage field names "must be preserved in V1 because they
 * correspond to the client's operational workflow", and the SRS states them in
 * English. The client's own spreadsheet ("01Servicios") is in Spanish, so the
 * Spanish terms below are a careful translation, not the client's originals.
 *
 * `FIELD_LABELS` is the only place they appear. Correcting them against the
 * real column headings from 01Servicios is a single edit to this object.
 * ------------------------------------------------------------------------
 */

/** Hoisted so both VALIDATION and SERVICE_TIME_VIOLATION_MESSAGES can use it. */
const VALIDATION_ARRIVAL_BEFORE_DEPARTURE =
  'La hora de llegada es anterior a la hora de salida. Si el servicio terminó al ' +
  'día siguiente, marque «Llega al día siguiente».';

/**
 * Field names as shown to the user (SRS 6.3, 23.3, Appendix A).
 *
 * Keyed by the schema field name, so a validation message can be built from
 * the same key the error is reported against.
 */
export const FIELD_LABELS = {
  // Identity and automatic fields (SRS 9.2)
  serviceCode: 'ID de servicio',
  serviceDate: 'Fecha',
  driver: 'Conductor',
  vehicle: 'Vehículo',
  route: 'Ruta/Contrato',
  origin: 'Origen',
  destination: 'Destino',

  // The four odometer readings (SRS 6.3)
  startDashboardKm: 'KM inicial cuadro',
  startBaseKm: 'KM inicial base',
  endBaseKm: 'KM final base',
  endDashboardKm: 'KM final cuadro',

  // Calculated (SRS 6.4)
  actualKm: 'KM reales',
  serviceKm: 'KM de servicio',

  // Driver inputs (SRS 9.3, 9.4)
  departureTime: 'Hora de salida',
  arrivalTime: 'Hora de llegada',
  endsNextDay: 'Llega al día siguiente',
  sites: 'Sitios',
  observations: 'Observaciones',

  // Master data
  name: 'Nombre',
  loginIdentifier: 'Usuario',
  password: 'Contraseña',
  role: 'Rol',
  isActive: 'Activo',
  registrationPlate: 'Matrícula',
  referenceName: 'Nombre del vehículo',
  routeCode: 'Código de ruta',
  routeName: 'Nombre de la ruta/contrato',
  defaultVehicle: 'Vehículo predeterminado',
  defaultRoute: 'Ruta predeterminada',
  assignments: 'Rutas asignadas',
} as const;

export type FieldKey = keyof typeof FIELD_LABELS;

/** SRS 11.1, shown on badges and filters. */
export const SERVICE_STATUS_LABELS = {
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
} as const;

/** SRS 8.2. */
export const ROLE_LABELS = {
  ADMIN: 'Administrador',
  DRIVER: 'Conductor',
} as const;

/**
 * Mileage rule violations (SRS 10.3).
 *
 * The domain layer returns a code and the field it belongs to; the message
 * lives here. That is what keeps `modules/services/domain/mileage.ts` free of
 * any dependency, including this one.
 */
/**
 * Every entry takes the offending field's label, whether or not it uses it.
 * The uniform signature is what lets a caller look the message up by code and
 * apply it without a per-code branch.
 */
export const MILEAGE_VIOLATION_MESSAGES: Record<string, (label: string) => string> = {
  NOT_A_WHOLE_NUMBER: (label) => `${label} debe ser un número entero de kilómetros.`,
  NEGATIVE_READING: (label) => `${label} no puede ser negativo.`,
  READING_TOO_LARGE: (label) =>
    `${label} parece demasiado alto. Revise la lectura e inténtelo de nuevo.`,
  START_BASE_BEFORE_START_DASHBOARD: () =>
    `${FIELD_LABELS.startBaseKm} no puede ser inferior a ${FIELD_LABELS.startDashboardKm}.`,
  END_BASE_NOT_AFTER_START_BASE: () =>
    `${FIELD_LABELS.endBaseKm} debe ser mayor que ${FIELD_LABELS.startBaseKm}. ` +
    'Un servicio debe recorrer alguna distancia.',
  END_DASHBOARD_BEFORE_END_BASE: () =>
    `${FIELD_LABELS.endDashboardKm} no puede ser inferior a ${FIELD_LABELS.endBaseKm}.`,
  SERVICE_KM_EXCEEDS_ACTUAL_KM: () =>
    `Los ${FIELD_LABELS.serviceKm} no pueden superar los ${FIELD_LABELS.actualKm}.`,
};

/** Departure/arrival ordering violations (see `domain/service-times.ts`). */
export const SERVICE_TIME_VIOLATION_MESSAGES: Record<string, string> = {
  ARRIVAL_NOT_AFTER_DEPARTURE: VALIDATION_ARRIVAL_BEFORE_DEPARTURE,
  OVERNIGHT_SPAN_TOO_LONG:
    `Si el servicio termina al día siguiente, la ${FIELD_LABELS.arrivalTime.toLowerCase()} ` +
    `debe ser anterior a la ${FIELD_LABELS.departureTime.toLowerCase()}. ` +
    'Un servicio no puede durar 24 horas o más.',
};

/** Generic field-shape messages, used across every schema. */
export const VALIDATION = {
  required: (label: string) => `${label} es obligatorio.`,
  tooShort: (label: string, min: number) => `${label} debe tener al menos ${min} caracteres.`,
  tooLong: (label: string, max: number) => `${label} no puede superar los ${max} caracteres.`,
  invalidReference: 'La referencia del registro no es válida.',
  invalidNumber: 'Introduzca un número entero de kilómetros.',
  invalidTime: 'Introduzca una hora en formato de 24 horas HH:MM, por ejemplo 07:45.',
  invalidDate: 'Introduzca una fecha con el formato AAAA-MM-DD.',

  // SRS 31.3 + client decision: an arrival earlier than the departure is a
  // typo unless the service is explicitly marked as ending the next day.
  arrivalBeforeDeparture: VALIDATION_ARRIVAL_BEFORE_DEPARTURE,

  loginIdentifierFormat:
    'El usuario solo puede contener letras minúsculas, números, puntos, guiones y guiones bajos.',
  passwordTooShort: (min: number) => `Utilice al menos ${min} caracteres.`,
  passwordTooLong: (max: number) => `Utilice como máximo ${max} caracteres.`,
  passwordTooCommon: 'Esa contraseña es demasiado fácil de adivinar. Elija otra.',
  passwordContainsLogin: 'La contraseña no puede contener el nombre de usuario.',
  roleRequired: 'Elija Administrador o Conductor.',

  plateFormat: 'La matrícula solo puede contener letras, números, espacios y guiones.',
  routeCodeFormat:
    'El código de ruta solo puede contener letras, números, puntos, guiones y guiones bajos.',

  duplicateRoute: 'Esa ruta ya está en la lista.',
  onlyOneDefaultRoute: 'Solo una ruta puede ser la predeterminada.',
  adminHasNoVehicle: 'Los administradores no tienen vehículo predeterminado.',
  adminHasNoRoutes: 'A los administradores no se les asignan rutas.',
  dateRangeInverted: 'La fecha final no puede ser anterior a la fecha inicial.',

  driverRequired: 'Seleccione el conductor al que pertenece el servicio.',
  driverNotAllowed: 'No puede crear un servicio a nombre de otro conductor.',
} as const;

/** Default messages for each error in the taxonomy (SRS 24). */
export const ERRORS = {
  validationFailed: 'Revise los campos marcados.',
  unauthenticated: 'Inicie sesión para continuar.',
  accountInactive: 'Su cuenta está desactivada. Póngase en contacto con un administrador.',
  forbidden: 'No tiene permiso para realizar esta acción.',
  notFound: (entity = 'El registro solicitado') => `${entity} no se ha encontrado.`,
  internal: 'Se ha producido un error. Inténtelo de nuevo.',
  malformedBody: 'El contenido de la solicitud no es JSON válido.',
  unreadableRequest: 'No se ha podido leer la solicitud.',
  invalidFilters: 'Algunos filtros no son válidos.',

  // SRS 24.4: the driver's edit lost a race with the administrator's approval.
  serviceApprovedDuringEdit:
    'Este servicio ha sido aprobado por un administrador y ya no se puede modificar.',
  serviceLocked: 'Este servicio está aprobado y solo un administrador puede modificarlo.',

  // SRS 24.2: the message must say what an administrator needs to do.
  noDefaultRoute:
    'No tiene ninguna ruta asignada. Pida a un administrador que le asigne una ruta antes de crear un servicio.',
  noDefaultVehicle:
    'No tiene ningún vehículo predeterminado. Pida a un administrador que le asigne uno antes de crear un servicio.',
  noActiveVehicles:
    'No hay vehículos activos disponibles. Pida a un administrador que dé de alta un vehículo.',

  routeNotAssigned: 'Esa ruta no está asignada a este conductor.',
  routeInactive: 'Esa ruta ya no está disponible para nuevos servicios.',
  vehicleInactive: 'Ese vehículo ya no está disponible para nuevos servicios.',
  driverInactive: 'Esa cuenta de conductor está desactivada.',
  userNotDriver: 'Solo se pueden asignar rutas y vehículos a conductores.',
  alreadyApproved: 'Este servicio ya está aprobado.',
  cannotDeactivateSelf: 'No puede desactivar su propia cuenta.',
  cannotDemoteSelf: 'No puede quitarse a sí mismo el rol de administrador.',
} as const;

/** Messages for database constraint violations (see `lib/db/prisma-errors.ts`). */
export const CONSTRAINT_MESSAGES = {
  loginIdentifierTaken: 'Ese nombre de usuario ya está en uso.',
  plateTaken: 'Esa matrícula ya está registrada.',
  routeCodeTaken: 'Ese código de ruta ya está en uso.',
  serviceCodeTaken: 'Ese ID de servicio ya se había emitido. Vuelva a enviarlo.',
  routeAlreadyAssigned: 'Esa ruta ya está asignada a este conductor.',
  onlyOneDefaultRoute: 'Un conductor solo puede tener una ruta predeterminada.',
  mileageSequence: 'Las lecturas del cuentakilómetros no son coherentes.',
  mileageNegative: 'Las lecturas del cuentakilómetros no pueden ser negativas.',
  actualKmFormula: `Los ${FIELD_LABELS.actualKm} deben ser ${FIELD_LABELS.endDashboardKm} menos ${FIELD_LABELS.startDashboardKm}.`,
  serviceKmFormula: `Los ${FIELD_LABELS.serviceKm} deben ser ${FIELD_LABELS.endBaseKm} menos ${FIELD_LABELS.startBaseKm}.`,
  serviceKmWithinActual: `Los ${FIELD_LABELS.serviceKm} no pueden superar los ${FIELD_LABELS.actualKm}.`,
  approvalMetadata: 'Los datos de aprobación no concuerdan con el estado del servicio.',
  serviceTimes:
    'Las horas de salida y llegada no son coherentes con el indicador de llegada al día siguiente.',
  valueInUse: 'Ese valor ya está en uso.',
  stillReferenced:
    'Ese registro sigue en uso por datos existentes. Desactívelo en lugar de eliminarlo.',
  brokenRelation: 'Ese cambio rompería una relación necesaria entre registros.',
} as const;

/** Sign-in screen and session feedback (SRS 17.1). */
export const AUTH = {
  invalidCredentials: 'Usuario o contraseña incorrectos.',
  accountInactive: 'Esta cuenta está desactivada. Póngase en contacto con un administrador.',
  loginIdentifierRequired: 'Introduzca su usuario.',
  passwordRequired: 'Introduzca su contraseña.',
} as const;
