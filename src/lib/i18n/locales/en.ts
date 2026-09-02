/**
 * English — a development and review locale, not a product feature.
 *
 * SRS 29 excludes a multi-language interface and the client's language is
 * Spanish, so there is deliberately **no language switcher in the application**.
 * This locale exists because the people building and testing the system need to
 * read what they are checking: a behaviour you cannot read is a behaviour you
 * cannot verify.
 *
 * Selected with `NEXT_PUBLIC_APP_LOCALE=en` (see `pnpm dev:en`). Spanish is the
 * default everywhere else, including any production build.
 *
 * The mileage terms below use the SRS's own English wording verbatim (SRS 6.3),
 * which is the one place English is authoritative rather than a translation.
 */
import type { Dictionary } from '../dictionary';

const FIELD_LABELS = {
  serviceCode: 'Service ID',
  serviceDate: 'Date',
  driver: 'Driver',
  vehicle: 'Vehicle',
  route: 'Route/Contract',
  origin: 'Origin',
  destination: 'Destination',

  // SRS 6.3, verbatim.
  startDashboardKm: 'Start Dashboard KM',
  startBaseKm: 'Start Base KM',
  endBaseKm: 'End Base KM',
  endDashboardKm: 'End Dashboard KM',

  actualKm: 'Actual Km',
  serviceKm: 'Service Km',

  departureTime: 'Departure Time',
  arrivalTime: 'Arrival Time',
  endsNextDay: 'Arrives the next day',
  sites: 'Sites',
  observations: 'Observations',

  name: 'Name',
  loginIdentifier: 'Username',
  password: 'Password',
  role: 'Role',
  isActive: 'Active',
  registrationPlate: 'Registration plate',
  referenceName: 'Vehicle name',
  routeCode: 'Route code',
  routeName: 'Route/Contract name',
  defaultVehicle: 'Default vehicle',
  defaultRoute: 'Default route',
  assignments: 'Assigned routes',
};

const ARRIVAL_BEFORE_DEPARTURE =
  'The arrival time is earlier than the departure time. If the service finished ' +
  'the next day, tick “Arrives the next day”.';

export const en: Dictionary = {
  FIELD_LABELS,

  SERVICE_STATUS_LABELS: {
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
  },

  ROLE_LABELS: { ADMIN: 'Administrator', DRIVER: 'Driver' },

  MILEAGE_VIOLATION_MESSAGES: {
    NOT_A_WHOLE_NUMBER: (label) => `${label} must be a whole number of kilometres.`,
    NEGATIVE_READING: (label) => `${label} cannot be negative.`,
    READING_TOO_LARGE: (label) => `${label} looks too large. Check the reading and try again.`,
    START_BASE_BEFORE_START_DASHBOARD: () =>
      `${FIELD_LABELS.startBaseKm} cannot be lower than ${FIELD_LABELS.startDashboardKm}.`,
    END_BASE_NOT_AFTER_START_BASE: () =>
      `${FIELD_LABELS.endBaseKm} must be greater than ${FIELD_LABELS.startBaseKm}. ` +
      'A service has to cover some distance.',
    END_DASHBOARD_BEFORE_END_BASE: () =>
      `${FIELD_LABELS.endDashboardKm} cannot be lower than ${FIELD_LABELS.endBaseKm}.`,
    SERVICE_KM_EXCEEDS_ACTUAL_KM: () =>
      `${FIELD_LABELS.serviceKm} cannot exceed ${FIELD_LABELS.actualKm}.`,
  },

  SERVICE_TIME_VIOLATION_MESSAGES: {
    ARRIVAL_NOT_AFTER_DEPARTURE: ARRIVAL_BEFORE_DEPARTURE,
    OVERNIGHT_SPAN_TOO_LONG:
      'If the service ends the next day, the arrival time must be earlier than the ' +
      'departure time. A service cannot run for 24 hours or more.',
  },

  VALIDATION: {
    required: (label) => `${label} is required.`,
    tooShort: (label, min) => `${label} must be at least ${min} characters.`,
    tooLong: (label, max) => `${label} must be ${max} characters or fewer.`,
    invalidReference: 'That record reference is not valid.',
    invalidNumber: 'Enter a whole number of kilometres.',
    invalidTime: 'Enter a time in 24-hour HH:MM format, for example 07:45.',
    invalidDate: 'Enter a date as YYYY-MM-DD.',
    arrivalBeforeDeparture: ARRIVAL_BEFORE_DEPARTURE,
    loginIdentifierFormat:
      'The username may contain only lowercase letters, numbers, dots, hyphens and underscores.',
    passwordTooShort: (min) => `Use at least ${min} characters.`,
    passwordTooLong: (max) => `Use ${max} characters or fewer.`,
    passwordTooCommon: 'That password is too easy to guess. Choose another.',
    passwordContainsLogin: 'The password must not contain the username.',
    roleRequired: 'Choose either Administrator or Driver.',
    plateFormat:
      'The registration plate may contain only letters, numbers, spaces and hyphens.',
    routeCodeFormat:
      'The route code may contain only letters, numbers, dots, hyphens and underscores.',
    duplicateRoute: 'That route is already in the list.',
    onlyOneDefaultRoute: 'Only one route can be the default.',
    adminHasNoVehicle: 'Administrators do not have a default vehicle.',
    adminHasNoRoutes: 'Administrators are not assigned routes.',
    dateRangeInverted: 'The end date cannot be before the start date.',
    driverRequired: 'Select the driver this service belongs to.',
    driverNotAllowed: 'You cannot create a service on behalf of another driver.',
  },

  ERRORS: {
    validationFailed: 'Some fields need attention.',
    unauthenticated: 'Sign in to continue.',
    accountInactive: 'Your account is deactivated. Please contact an administrator.',
    forbidden: 'You do not have permission to perform this action.',
    notFound: (entity = 'The requested record') => `${entity} could not be found.`,
    internal: 'Something went wrong. Please try again.',
    malformedBody: 'The request body was not valid JSON.',
    unreadableRequest: 'The request could not be read.',
    invalidFilters: 'Some filters were not valid.',
    serviceApprovedDuringEdit:
      'This service has been approved by an administrator and can no longer be changed.',
    serviceLocked: 'This service is approved and only an administrator can change it.',
    noDefaultRoute:
      'You have no assigned routes. Ask an administrator to assign you a route before creating a service.',
    noDefaultVehicle:
      'You have no default vehicle. Ask an administrator to assign you one before creating a service.',
    noActiveVehicles:
      'There are no active vehicles available. Ask an administrator to add one.',
    routeNotAssigned: 'That route is not assigned to this driver.',
    routeInactive: 'That route is no longer available for new services.',
    vehicleInactive: 'That vehicle is no longer available for new services.',
    driverInactive: 'That driver account is deactivated.',
    userNotDriver: 'Only drivers can be assigned routes and vehicles.',
    alreadyApproved: 'This service is already approved.',
    cannotDeactivateSelf: 'You cannot deactivate your own account.',
    cannotDemoteSelf: 'You cannot remove your own administrator role.',
  },

  CONSTRAINT_MESSAGES: {
    loginIdentifierTaken: 'That username is already in use.',
    plateTaken: 'That registration plate is already registered.',
    routeCodeTaken: 'That route code is already in use.',
    serviceCodeTaken: 'That Service ID was already issued. Please submit again.',
    routeAlreadyAssigned: 'That route is already assigned to this driver.',
    onlyOneDefaultRoute: 'A driver can only have one default route.',
    mileageSequence: 'The odometer readings are not consistent.',
    mileageNegative: 'Odometer readings cannot be negative.',
    actualKmFormula: `${FIELD_LABELS.actualKm} must equal ${FIELD_LABELS.endDashboardKm} minus ${FIELD_LABELS.startDashboardKm}.`,
    serviceKmFormula: `${FIELD_LABELS.serviceKm} must equal ${FIELD_LABELS.endBaseKm} minus ${FIELD_LABELS.startBaseKm}.`,
    serviceKmWithinActual: `${FIELD_LABELS.serviceKm} cannot exceed ${FIELD_LABELS.actualKm}.`,
    approvalMetadata: 'The approval details do not match the service status.',
    serviceTimes:
      'The departure and arrival times are not consistent with the next-day arrival flag.',
    valueInUse: 'That value is already in use.',
    stillReferenced:
      'That record is still referenced by existing data. Deactivate it instead of deleting it.',
    brokenRelation: 'That change would break a required relationship between records.',
  },

  AUTH: {
    invalidCredentials: 'Incorrect username or password.',
    accountInactive: 'This account is deactivated. Please contact an administrator.',
    loginIdentifierRequired: 'Enter your username.',
    passwordRequired: 'Enter your password.',
  },

  UI: {
    common: {
      appName: 'BRIBAR Logistics',
      back: 'Back',
      edit: 'Edit',
      save: 'Save changes',
      saving: 'Saving…',
      cancel: 'Cancel',
      create: 'Create',
      new: 'New',
      newFeminine: 'New',
      active: 'Active',
      inactive: 'Inactive',
      activeFeminine: 'Active',
      inactiveFeminine: 'Inactive',
      status: 'Status',
      optional: '(optional)',
      all: 'All',
      allFeminine: 'All',
      none: '—',
      signOut: 'Sign out',
      pagination: 'Pagination',
      previous: 'Previous',
      next: 'Next',
      pageOf: (page, total) => `Page ${page} of ${total}`,
      deactivated: '(deactivated)',
      inactiveMarker: '(inactive)',
      you: '(you)',
      total: (count) => `${count} in total`,
    },

    auth: {
      internalAccess: 'Internal access',
      signIn: 'Sign in',
      checking: 'Checking…',
      forgotPassword: 'If you have forgotten your password, contact an administrator.',
    },

    driver: {
      greeting: (firstName) => `Hello, ${firstName}`,
      panelSubtitle: 'Driver panel',
      addService: 'Add service',
      noPending: 'No services pending',
      noPendingHint: 'Services you submit appear here until an administrator approves them.',
      recentlyApproved: 'Recently approved',
      viewHistory: 'View history',
      noApproved: 'No approved services yet',
      noApprovedHint: 'Your most recently approved services will appear here.',
      myServices: 'My services',
      serviceDetail: 'Service detail',
      history: 'History',
      serviceCount: (count) => `${count} ${count === 1 ? 'service' : 'services'}`,
      noServices: 'No services',
      noServicesFiltered: 'Try a different filter.',
      noServicesHint: 'Services you record will appear here.',
    },

    service: {
      addTitle: 'Add service',
      addSubtitle: 'Record the route sheet for the completed service.',
      editTitle: 'Edit service',
      submit: 'Submit service',
      detailsSection: 'Service details',
      detailsHint: 'Filled in automatically',
      idOnSave: 'Assigned on save',
      routeSection: 'Route and vehicle',
      vehicleHint: 'Change it if you are driving a different vehicle today.',
      mileageSection: 'Mileage',
      mileageHint: 'Odometer readings, in route order',
      calculatedHint: 'Calculated automatically. The server recalculates it on save.',
      timesSection: 'Times',
      overnightHint: 'Tick this box if the service finished after midnight.',
      notesSection: 'Notes',
      driverNotesSection: 'Driver notes',
      onlyOneRoute:
        'You only have one assigned route. Ask an administrator if you need another.',
      configurationRequired: 'Configuration required',
      submitted: 'Service submitted',
      submittedHint: 'Your service is pending approval.',
      saved: 'Changes saved',
      approvedReadOnly:
        'This service is approved. Contact an administrator for any correction.',
      record: 'Record',
      created: 'Created',
      lastUpdated: 'Last updated',
      approvedAt: 'Approved',
      nextDay: '(next day)',
      backToService: 'Back to service',
    },

    admin: {
      panelTitle: 'Administration panel',
      pendingSummary: (count) =>
        `${count} ${count === 1 ? 'service' : 'services'} pending review.`,
      nothingPending: 'No services pending review.',
      approvalQueue: 'Approval queue',
      allClear: 'All clear',
      allClearHint: 'Nothing is waiting for approval.',
      viewAllServices: 'View all services',
      review: 'Review',

      servicesTitle: 'Services',
      noServicesMatch: 'No service matches the filters applied.',
      filters: 'Filters',
      clearFilters: 'Clear',
      applyFilters: 'Apply filters',
      from: 'From',
      to: 'To',

      reviewTitle: 'Review service',
      approve: 'Approve service',
      approving: 'Approving…',
      confirmApprove: 'Approve this service?',
      confirmApproveHint:
        'Once approved, the driver can no longer change it. Only an administrator will be able to correct it.',
      confirmApproveAction: 'Confirm approval',
      approveFailed: 'The service could not be approved.',
      auditSection: 'Audit',
      statusHistory: 'Status history',
      pending: 'Pending',
      editingApproved: 'This service is already approved',
      editingApprovedHint:
        'The change will be recorded in the audit trail. The service stays approved and the driver does not regain edit permission.',

      vehiclesTitle: 'Vehicles',
      newVehicle: 'New vehicle',
      editVehicle: 'Edit vehicle',
      vehicleCreated: 'Vehicle created',
      vehicleUpdated: 'Vehicle updated',
      noVehicles: 'No vehicles',
      noVehiclesHint: 'Add a vehicle so drivers can record services.',
      plateHint: 'Stored in upper case. Must be unique.',
      vehicleNameHint: 'An internal reference, for example “Volvo FH16 - Unit 1”.',
      vehicleActiveHint:
        'An inactive vehicle is not offered for new services, but stays attached to the services already recorded.',

      routesTitle: 'Routes / Contracts',
      newRoute: 'New route / contract',
      editRoute: 'Edit route / contract',
      routeCreated: 'Route created',
      routeUpdated: 'Route updated',
      noRoutes: 'No routes',
      noRoutesHint: 'Create a route and assign it to a driver so they can record services.',
      routeCodeHint: 'Stored in upper case. Must be unique.',
      routeSnapshotNote:
        'Changing the origin or destination only affects services recorded from now on. Services that already exist keep the values they were created with.',
      routeActiveHint:
        'An inactive route is not offered for new services, but stays attached to the services already recorded.',
      routeActiveHintWithDrivers: (count) =>
        `Deactivating it will remove it from ${count} ${count === 1 ? 'driver' : 'drivers'}. Services already recorded do not change.`,

      usersTitle: 'Drivers and administrators',
      accountCount: (count) => `${count} ${count === 1 ? 'account' : 'accounts'}`,
      newAccount: 'New account',
      editAccount: 'Edit account',
      accountCreated: 'Account created',
      accountUpdated: 'Account updated',
      noAccounts: 'No accounts',
      loginHint: 'Lower case, no spaces. Used to sign in.',
      passwordHintCreate: 'At least 12 characters. Pass it to the driver securely.',
      passwordHintEdit: 'Leave blank to keep the current password.',
      defaultVehicleHint: 'Preselected when creating a service. The driver can change it.',
      assignmentsHint: 'The driver can only choose from the routes ticked here.',
      assignedColumn: 'Assigned',
      defaultColumn: 'Default',
      routeColumn: 'Route',
      noActiveRoutes: 'There are no active routes. Create one before assigning it to a driver.',
      noDefaultWarning:
        'Without a default route, the driver has to choose one on every service.',
      selfEditNotice:
        'You cannot change your own role or deactivate your account. Ask another administrator to do it.',
      inactiveRoutesTitle: 'Inactive routes assigned',
      inactiveRoutesHint: (count) =>
        `This driver has ${count} deactivated ${count === 1 ? 'route' : 'routes'}. They will not appear when creating a service until reactivated.`,
      accountActiveHint:
        'An inactive account cannot sign in. Their previous services are preserved.',
      createAccount: 'Create account',
      createVehicle: 'Create vehicle',
      createRoute: 'Create route',
    },

    nav: {
      services: 'Services',
      drivers: 'Drivers',
      vehicles: 'Vehicles',
      routes: 'Routes',
    },

    errors: {
      notFoundTitle: 'Page not found',
      notFoundHint:
        'The link may have expired, or the record is not available to your account.',
      backHome: 'Back to start',
      errorTitle: 'Something went wrong',
      errorHint: 'We could not complete the operation. Please try again in a moment.',
      retry: 'Retry',
      reference: 'Ref.',
    },
  },
};
