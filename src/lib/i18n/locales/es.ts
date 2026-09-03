/**
 * Spanish — the client's language, and the default (`docs/open-questions.md` #6).
 *
 * ------------------------------------------------------------------------
 * NEEDS CLIENT CONFIRMATION
 *
 * SRS 6.3 says the mileage field names "must be preserved in V1 because they
 * correspond to the client's operational workflow", and states them in
 * English. The client's own register ("01Servicios") is in Spanish, so the
 * terms in `FIELD_LABELS` are a careful translation, not their originals.
 * Correcting them against the real column headings is an edit to that one
 * object.
 * ------------------------------------------------------------------------
 */
import type { Dictionary } from '../dictionary';

const FIELD_LABELS = {
  serviceCode: 'ID de servicio',
  serviceDate: 'Fecha',
  driver: 'Conductor',
  vehicle: 'Vehículo',
  route: 'Ruta/Contrato',
  origin: 'Origen',
  destination: 'Destino',

  startDashboardKm: 'KM inicial cuadro',
  startBaseKm: 'KM inicial base',
  endBaseKm: 'KM final base',
  endDashboardKm: 'KM final cuadro',

  actualKm: 'KM reales',
  serviceKm: 'KM de servicio',

  departureTime: 'Hora de salida',
  arrivalTime: 'Hora de llegada',
  endsNextDay: 'Llega al día siguiente',
  sites: 'Sitios',
  observations: 'Observaciones',

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
};

/** Referenced by both VALIDATION and the time-violation table. */
const ARRIVAL_BEFORE_DEPARTURE =
  'La hora de llegada es anterior a la hora de salida. Si el servicio terminó al ' +
  'día siguiente, marque «Llega al día siguiente».';

export const es: Dictionary = {
  FIELD_LABELS,

  SERVICE_STATUS_LABELS: {
    PENDING_APPROVAL: 'Pendiente de aprobación',
    APPROVED: 'Aprobado',
  },

  ROLE_LABELS: { ADMIN: 'Administrador', DRIVER: 'Conductor' },

  MILEAGE_VIOLATION_MESSAGES: {
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
  },

  SERVICE_TIME_VIOLATION_MESSAGES: {
    ARRIVAL_NOT_AFTER_DEPARTURE: ARRIVAL_BEFORE_DEPARTURE,
    OVERNIGHT_SPAN_TOO_LONG:
      `Si el servicio termina al día siguiente, la ${FIELD_LABELS.arrivalTime.toLowerCase()} ` +
      `debe ser anterior a la ${FIELD_LABELS.departureTime.toLowerCase()}. ` +
      'Un servicio no puede durar 24 horas o más.',
  },

  VALIDATION: {
    required: (label) => `${label} es obligatorio.`,
    tooShort: (label, min) => `${label} debe tener al menos ${min} caracteres.`,
    tooLong: (label, max) => `${label} no puede superar los ${max} caracteres.`,
    invalidReference: 'La referencia del registro no es válida.',
    invalidNumber: 'Introduzca un número entero de kilómetros.',
    invalidTime: 'Introduzca una hora en formato de 24 horas HH:MM, por ejemplo 07:45.',
    invalidDate: 'Introduzca una fecha con el formato AAAA-MM-DD.',
    arrivalBeforeDeparture: ARRIVAL_BEFORE_DEPARTURE,
    loginIdentifierFormat:
      'El usuario solo puede contener letras minúsculas, números, puntos, guiones y guiones bajos.',
    passwordTooShort: (min) => `Utilice al menos ${min} caracteres.`,
    passwordTooLong: (max) => `Utilice como máximo ${max} caracteres.`,
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
  },

  ERRORS: {
    validationFailed: 'Revise los campos marcados.',
    unauthenticated: 'Inicie sesión para continuar.',
    accountInactive: 'Su cuenta está desactivada. Póngase en contacto con un administrador.',
    forbidden: 'No tiene permiso para realizar esta acción.',
    notFound: (entity = 'El registro solicitado') => `${entity} no se ha encontrado.`,
    internal: 'Se ha producido un error. Inténtelo de nuevo.',
    malformedBody: 'El contenido de la solicitud no es JSON válido.',
    unreadableRequest: 'No se ha podido leer la solicitud.',
    invalidFilters: 'Algunos filtros no son válidos.',
    serviceApprovedDuringEdit:
      'Este servicio ha sido aprobado por un administrador y ya no se puede modificar.',
    serviceLocked: 'Este servicio está aprobado y solo un administrador puede modificarlo.',
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
    deleteBlocked:
      'No se puede eliminar: hay servicios que dependen de este registro. Desactívelo en su lugar.',
    deleteSelfBlocked: 'No puede eliminar su propia cuenta.',
    cannotDeactivateSelf: 'No puede desactivar su propia cuenta.',
    cannotDemoteSelf: 'No puede quitarse a sí mismo el rol de administrador.',
  },

  CONSTRAINT_MESSAGES: {
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
  },

  AUTH: {
    invalidCredentials: 'Usuario o contraseña incorrectos.',
    accountInactive: 'Esta cuenta está desactivada. Póngase en contacto con un administrador.',
    loginIdentifierRequired: 'Introduzca su usuario.',
    passwordRequired: 'Introduzca su contraseña.',
  },

  UI: {
    common: {
      delete: 'Eliminar',
      deleting: 'Eliminando…',
      deleteTitle: 'Eliminar registro',
      deleteConfirm: (name) => `Se eliminará «${name}» de forma permanente.`,
      deleteIrreversible: 'Esta acción no se puede deshacer.',
      deleteBlockedTitle: 'No se puede eliminar',
      deleteBlockedHint: 'Desactívelo para retirarlo del uso conservando el historial.',
      deleteCascade: (count) =>
        count === 1
          ? 'Se retirará también 1 asignación de ruta.'
          : `Se retirarán también ${count} asignaciones de ruta.`,
      blockerServices: (count) =>
        count === 1 ? '1 servicio lo utiliza' : `${count} servicios lo utilizan`,
      blockerApprovals: (count) =>
        count === 1
          ? '1 servicio aprobado por esta cuenta'
          : `${count} servicios aprobados por esta cuenta`,
      blockerStatusChanges: (count) =>
        count === 1
          ? '1 cambio de estado registrado'
          : `${count} cambios de estado registrados`,
      blockerDefaultForUsers: (count) =>
        count === 1
          ? '1 conductor lo tiene por defecto'
          : `${count} conductores lo tienen por defecto`,
      dangerZone: 'Eliminar registro',
      servicesShort: (count) => `${count} serv.`,
      today: 'Hoy',
      yesterday: 'Ayer',
      delta: (value) => `${value > 0 ? '+' : '−'}${Math.abs(value)}`,
      noChange: 'Sin cambios',
      vsYesterday: 'frente a ayer',
      vsPreviousWeek: 'frente a la semana anterior',
      viewAll: 'Ver todo',
      appName: 'BRIBAR Logistics',
      back: 'Volver',
      edit: 'Editar',
      save: 'Guardar cambios',
      saving: 'Guardando…',
      cancel: 'Cancelar',
      create: 'Crear',
      new: 'Nuevo',
      newFeminine: 'Nueva',
      active: 'Activo',
      inactive: 'Inactivo',
      activeFeminine: 'Activa',
      inactiveFeminine: 'Inactiva',
      status: 'Estado',
      optional: '(opcional)',
      all: 'Todos',
      allFeminine: 'Todas',
      none: '—',
      signOut: 'Cerrar sesión',
      pagination: 'Paginación',
      previous: 'Anterior',
      next: 'Siguiente',
      pageOf: (page, total) => `Página ${page} de ${total}`,
      goToPage: (page) => `Ir a la página ${page}`,
      showing: (from, to, total) => `${from}-${to} de ${total}`,
      theme: 'Tema',
      themeLight: 'Claro',
      themeDark: 'Oscuro',
      themeSystem: 'Sistema',
      deactivated: '(dado de baja)',
      inactiveMarker: '(inactiva)',
      you: '(usted)',
      total: (count) => `${count} en total`,
    },

    auth: {
      internalAccess: 'Acceso interno',
      signIn: 'Iniciar sesión',
      checking: 'Comprobando…',
      panelHeadline: 'Las hojas de ruta, sin papel.',
      panelSubhead:
        'Registre cada servicio desde el móvil y deje que la oficina lo apruebe el mismo día.',
      forgotPassword: 'Si ha olvidado su contraseña, contacte con un administrador.',
    },

    driver: {
      greeting: (firstName) => `Hola, ${firstName}`,
      panelSubtitle: 'Panel del conductor',
      addService: 'Añadir servicio',
      noPending: 'No hay servicios pendientes',
      noPendingHint:
        'Los servicios que envíe aparecerán aquí hasta que un administrador los apruebe.',
      recentlyApproved: 'Aprobados recientemente',
      viewHistory: 'Ver historial',
      noApproved: 'Todavía no hay servicios aprobados',
      noApprovedHint: 'Aquí verá sus últimos servicios aprobados.',
      myServices: 'Mis servicios',
      serviceDetail: 'Detalle del servicio',
      history: 'Historial',
      serviceCount: (count) => `${count} ${count === 1 ? 'servicio' : 'servicios'}`,
      noServices: 'No hay servicios',
      noServicesFiltered: 'Pruebe con otro filtro.',
      noServicesHint: 'Los servicios que registre aparecerán aquí.',
    },

    service: {
      addTitle: 'Añadir servicio',
      addSubtitle: 'Registre la hoja de ruta del servicio completado.',
      editTitle: 'Editar servicio',
      submit: 'Enviar servicio',
      detailsSection: 'Datos del servicio',
      detailsHint: 'Rellenados automáticamente',
      idOnSave: 'Se asignará al guardar',
      routeSection: 'Ruta y vehículo',
      vehicleHint: 'Puede cambiarlo si hoy conduce otro vehículo.',
      mileageSection: 'Kilometraje',
      mileageHint: 'Lecturas del cuentakilómetros, en orden de la ruta',
      calculatedHint: 'Calculado automáticamente. El servidor vuelve a calcularlo al guardar.',
      timesSection: 'Horario',
      overnightHint: 'Marque esta casilla si el servicio terminó después de medianoche.',
      notesSection: 'Notas',
      driverNotesSection: 'Notas del conductor',
      onlyOneRoute:
        'Solo tiene una ruta asignada. Si necesita otra, pídasela a un administrador.',
      configurationRequired: 'Configuración pendiente',
      submitted: 'Servicio enviado',
      submittedHint: 'Su servicio está pendiente de aprobación.',
      saved: 'Cambios guardados',
      approvedReadOnly:
        'Este servicio está aprobado. Para cualquier corrección, contacte con un administrador.',
      journeySection: 'Recorrido',
      legApproach: 'Aproximación',
      legReturn: 'Regreso',
      legEmpty: 'En vacío',
      legStart: 'inicio',
      legEnd: 'fin',
      productiveShare: (percent: number) => `${percent}% del recorrido`,
      record: 'Registro',
      created: 'Creado',
      lastUpdated: 'Última modificación',
      approvedAt: 'Aprobado',
      nextDay: '(día siguiente)',
      backToService: 'Volver al servicio',
    },

    admin: {
      panelTitle: 'Panel de administración',
      pendingSummary: (count) =>
        `${count} ${count === 1 ? 'servicio pendiente' : 'servicios pendientes'} de revisión.`,
      nothingPending: 'No hay servicios pendientes de revisión.',
      approvalQueue: 'Cola de aprobación',
      allClear: 'Todo al día',
      allClearHint: 'No queda ningún servicio pendiente de aprobación.',
      viewAllServices: 'Ver todos los servicios',
      review: 'Revisar',

      awaitingReview: 'Esperando revisión',
      allTime: 'Histórico',
      lastDays: (days: number) => `Últimos ${days} días`,
      activityTitle: 'Actividad diaria',
      activityChartLabel: (days) => `Actividad diaria: ${days} días`,
      peakDay: (label, services) => `Máximo ${label} · ${services} serv.`,
      topRoutesTitle: 'Rutas más activas',
      noRouteActivity: 'Sin actividad en este periodo',
      servicesTitle: 'Servicios',
      noServicesMatch: 'Ningún servicio coincide con los filtros aplicados.',
      filters: 'Filtros',
      clearFilters: 'Limpiar',
      applyFilters: 'Aplicar filtros',
      from: 'Desde',
      to: 'Hasta',

      reviewTitle: 'Revisar servicio',
      approve: 'Aprobar servicio',
      approving: 'Aprobando…',
      confirmApprove: '¿Aprobar este servicio?',
      confirmApproveHint:
        'Una vez aprobado, el conductor ya no podrá modificarlo. Solo un administrador podrá corregirlo.',
      confirmApproveAction: 'Confirmar aprobación',
      approveFailed: 'No se ha podido aprobar el servicio.',
      auditSection: 'Auditoría',
      statusHistory: 'Historial de estados',
      pending: 'Pendiente',
      editingApproved: 'Este servicio ya está aprobado',
      editingApprovedHint:
        'La modificación quedará registrada en la auditoría. El servicio seguirá aprobado y el conductor no recuperará permiso de edición.',

      vehiclesTitle: 'Vehículos',
      newVehicle: 'Nuevo vehículo',
      editVehicle: 'Editar vehículo',
      vehicleCreated: 'Vehículo creado',
      vehicleUpdated: 'Vehículo actualizado',
      vehicleDeleted: 'Vehículo eliminado',
      noVehicles: 'No hay vehículos',
      noVehiclesHint:
        'Dé de alta un vehículo para que los conductores puedan registrar servicios.',
      plateHint: 'Se guarda en mayúsculas. Debe ser única.',
      vehicleNameHint: 'Una referencia interna, por ejemplo «Volvo FH16 - Unidad 1».',
      vehicleActiveHint:
        'Un vehículo inactivo no se ofrece para nuevos servicios, pero sigue asociado a los servicios ya registrados.',

      routesTitle: 'Rutas / Contratos',
      newRoute: 'Nueva ruta / contrato',
      editRoute: 'Editar ruta / contrato',
      routeCreated: 'Ruta creada',
      routeUpdated: 'Ruta actualizada',
      routeDeleted: 'Ruta eliminada',
      noRoutes: 'No hay rutas',
      noRoutesHint:
        'Cree una ruta y asígnela a un conductor para que pueda registrar servicios.',
      routeCodeHint: 'Se guarda en mayúsculas. Debe ser único.',
      routeSnapshotNote:
        'Cambiar el origen o el destino solo afecta a los servicios que se registren a partir de ahora. Los servicios ya existentes conservan los valores con los que se crearon.',
      routeActiveHint:
        'Una ruta inactiva no se ofrece para nuevos servicios, pero sigue asociada a los servicios ya registrados.',
      routeActiveHintWithDrivers: (count) =>
        `Al desactivarla dejará de estar disponible para ${count} ${count === 1 ? 'conductor' : 'conductores'}. Los servicios ya registrados no cambian.`,

      usersTitle: 'Conductores y administradores',
      accountCount: (count) => `${count} ${count === 1 ? 'cuenta' : 'cuentas'}`,
      newAccount: 'Nueva cuenta',
      editAccount: 'Editar cuenta',
      accountCreated: 'Cuenta creada',
      accountUpdated: 'Cuenta actualizada',
      accountDeleted: 'Cuenta eliminada',
      noAccounts: 'No hay cuentas',
      loginHint: 'Minúsculas, sin espacios. Se usa para iniciar sesión.',
      passwordHintCreate: 'Mínimo 12 caracteres. Comuníquesela al conductor de forma segura.',
      passwordHintEdit: 'Déjelo en blanco para no cambiar la contraseña actual.',
      defaultVehicleHint:
        'Se preselecciona al crear un servicio. El conductor puede cambiarlo.',
      assignmentsHint: 'El conductor solo podrá elegir entre las rutas marcadas aquí.',
      assignedColumn: 'Asignada',
      defaultColumn: 'Predet.',
      distanceColumn: 'Real / servicio',

      attentionRequired: 'Requiere atención',
      operationsOverview: 'Resumen de operaciones',
      serviceManagement: 'Gestión de servicios',
      exceptionPendingTitle: (count) =>
        count === 1
          ? '1 servicio pendiente de aprobación'
          : `${count} servicios pendientes de aprobación`,
      exceptionPendingDetail: 'Revíselos antes de la próxima salida.',
      exceptionStaleTitle: (days) =>
        days === 1
          ? 'Un servicio lleva 1 día esperando'
          : `Un servicio lleva ${days} días esperando`,
      exceptionStaleDetail: (date) => `El más antiguo es del ${date}.`,
      exceptionDistanceTitle: (serviceCode) =>
        `El servicio #${serviceCode} recorrió más de lo habitual`,
      exceptionDistanceDetail: (routeCode, actualKm, baselineKm) =>
        `${routeCode} · ${actualKm} km reales frente a una media de ${baselineKm} km.`,
      servicesToday: 'Servicios hoy',
      approvedToday: 'Aprobados hoy',
      distanceThisWeek: 'KM de servicio',
      recentServices: 'Servicios recientes',
      ofTodaysServices: (total) => `de ${total} hoy`,
      routeColumn: 'Ruta',
      noActiveRoutes: 'No hay rutas activas. Cree una ruta antes de asignarla a un conductor.',
      noDefaultWarning:
        'Sin ruta predeterminada, el conductor tendrá que elegirla en cada servicio.',
      selfEditNotice:
        'No puede cambiar su propio rol ni desactivar su cuenta. Pida a otro administrador que lo haga.',
      inactiveRoutesTitle: 'Rutas inactivas asignadas',
      inactiveRoutesHint: (count) =>
        `Este conductor tiene ${count} ${count === 1 ? 'ruta desactivada' : 'rutas desactivadas'}. No aparecerán al crear un servicio hasta que se reactiven.`,
      accountActiveHint:
        'Una cuenta inactiva no puede iniciar sesión. Sus servicios anteriores se conservan.',
      createAccount: 'Crear cuenta',
      createVehicle: 'Crear vehículo',
      createRoute: 'Crear ruta',
    },

    nav: {
      adminLabel: 'Administración',
      driverLabel: 'Principal',
      panel: 'Panel',
      dashboard: 'Resumen',
      sectionOperations: 'Operaciones',
      sectionMasterData: 'Datos maestros',
      services: 'Servicios',
      drivers: 'Conductores',
      vehicles: 'Vehículos',
      routes: 'Rutas',
    },

    errors: {
      notFoundTitle: 'No se ha encontrado la página',
      notFoundHint:
        'El enlace puede haber caducado, o el registro no está disponible para su cuenta.',
      backHome: 'Volver al inicio',
      errorTitle: 'Se ha producido un error',
      errorHint: 'No hemos podido completar la operación. Inténtelo de nuevo en unos momentos.',
      retry: 'Reintentar',
      reference: 'Ref.',
    },
  },
};
