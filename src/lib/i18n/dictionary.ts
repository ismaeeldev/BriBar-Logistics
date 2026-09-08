/**
 * The shape every locale must provide.
 *
 * Declaring it as a type rather than letting each locale be its own shape is
 * the point of the file: adding a string to Spanish without adding it to
 * English is a compile error, not a page that silently renders a key. With two
 * locales maintained by one person that guarantee is worth more than the type
 * annotation costs.
 */

export interface Dictionary {
  /**
   * Field names as shown to the user (SRS 6.3, 23.3, Appendix A).
   *
   * Keyed by the schema field name, so a validation message can be built from
   * the same key the error is reported against.
   */
  FIELD_LABELS: {
    serviceCode: string;
    serviceDate: string;
    driver: string;
    vehicle: string;
    route: string;
    origin: string;
    destination: string;
    startDashboardKm: string;
    startBaseKm: string;
    endBaseKm: string;
    endDashboardKm: string;
    actualKm: string;
    serviceKm: string;
    departureTime: string;
    arrivalTime: string;
    endsNextDay: string;
    sites: string;
    observations: string;
    name: string;
    loginIdentifier: string;
    password: string;
    role: string;
    isActive: string;
    registrationPlate: string;
    referenceName: string;
    routeCode: string;
    routeName: string;
    defaultVehicle: string;
    defaultRoute: string;
    assignments: string;
  };

  SERVICE_STATUS_LABELS: { PENDING_APPROVAL: string; APPROVED: string };
  ROLE_LABELS: { ADMIN: string; DRIVER: string };

  MILEAGE_VIOLATION_MESSAGES: Record<string, (label: string) => string>;
  SERVICE_TIME_VIOLATION_MESSAGES: Record<string, string>;

  VALIDATION: {
    required: (label: string) => string;
    tooShort: (label: string, min: number) => string;
    tooLong: (label: string, max: number) => string;
    invalidReference: string;
    invalidNumber: string;
    invalidTime: string;
    invalidDate: string;
    arrivalBeforeDeparture: string;
    loginIdentifierFormat: string;
    passwordTooShort: (min: number) => string;
    passwordTooLong: (max: number) => string;
    passwordTooCommon: string;
    passwordContainsLogin: string;
    roleRequired: string;
    plateFormat: string;
    routeCodeFormat: string;
    duplicateRoute: string;
    onlyOneDefaultRoute: string;
    adminHasNoVehicle: string;
    adminHasNoRoutes: string;
    dateRangeInverted: string;
    driverRequired: string;
    driverNotAllowed: string;
  };

  ERRORS: {
    validationFailed: string;
    unauthenticated: string;
    accountInactive: string;
    forbidden: string;
    notFound: (entity?: string) => string;
    internal: string;
    malformedBody: string;
    unreadableRequest: string;
    invalidFilters: string;
    serviceApprovedDuringEdit: string;
    serviceLocked: string;
    noDefaultRoute: string;
    noDefaultVehicle: string;
    noActiveVehicles: string;
    routeNotAssigned: string;
    routeInactive: string;
    vehicleInactive: string;
    driverInactive: string;
    userNotDriver: string;
    alreadyApproved: string;
    deleteBlocked: string;
    deleteSelfBlocked: string;
    cannotDeactivateSelf: string;
    cannotDemoteSelf: string;
  };

  CONSTRAINT_MESSAGES: {
    loginIdentifierTaken: string;
    plateTaken: string;
    routeCodeTaken: string;
    serviceCodeTaken: string;
    routeAlreadyAssigned: string;
    onlyOneDefaultRoute: string;
    mileageSequence: string;
    mileageNegative: string;
    actualKmFormula: string;
    serviceKmFormula: string;
    serviceKmWithinActual: string;
    approvalMetadata: string;
    serviceTimes: string;
    valueInUse: string;
    stillReferenced: string;
    brokenRelation: string;
  };

  AUTH: {
    invalidCredentials: string;
    accountInactive: string;
    loginIdentifierRequired: string;
    passwordRequired: string;
  };

  /**
   * Interface chrome: headings, buttons, hints, empty states.
   *
   * Grouped by screen rather than by widget, because that is how the client
   * will review it — reading down this object should feel like walking through
   * the application.
   */
  UI: {
    common: {
      appName: string;
      delete: string;
      deleting: string;
      deleteTitle: string;
      deleteConfirm: (name: string) => string;
      deleteIrreversible: string;
      deleteBlockedTitle: string;
      deleteBlockedHint: string;
      deleteCascade: (count: number) => string;
      blockerServices: (count: number) => string;
      blockerApprovals: (count: number) => string;
      blockerStatusChanges: (count: number) => string;
      blockerDefaultForUsers: (count: number) => string;
      dangerZone: string;
      /** The abbreviated count used inside charts, where room is scarce. */
      servicesShort: (count: number) => string;
      today: string;
      yesterday: string;
      delta: (value: number) => string;
      noChange: string;
      vsYesterday: string;
      vsPreviousWeek: string;
      viewAll: string;
      back: string;
      edit: string;
      save: string;
      saving: string;
      cancel: string;
      create: string;
      new: string;
      newFeminine: string;
      active: string;
      inactive: string;
      activeFeminine: string;
      inactiveFeminine: string;
      status: string;
      optional: string;
      all: string;
      allFeminine: string;
      none: string;
      signOut: string;
      pagination: string;
      previous: string;
      next: string;
      pageOf: (page: number, total: number) => string;
      goToPage: (page: number) => string;
      showing: (from: number, to: number, total: number) => string;
      theme: string;
      themeLight: string;
      themeDark: string;
      themeSystem: string;
      deactivated: string;
      inactiveMarker: string;
      you: string;
      total: (count: number) => string;
      searchPlaceholder: string;
      clearSearch: string;
      code: string;
    };

    auth: {
      internalAccess: string;
      signIn: string;
      checking: string;
      forgotPassword: string;
      /** Sign-in panel copy, shown only on a wide screen. */
      panelHeadline: string;
      panelSubhead: string;
    };

    driver: {
      greeting: (firstName: string) => string;
      panelSubtitle: string;
      addService: string;
      noPending: string;
      noPendingHint: string;
      recentlyApproved: string;
      viewHistory: string;
      noApproved: string;
      noApprovedHint: string;
      myServices: string;
      serviceDetail: string;
      history: string;
      serviceCount: (count: number) => string;
      noServices: string;
      noServicesFiltered: string;
      noServicesHint: string;
    };

    service: {
      addTitle: string;
      addSubtitle: string;
      editTitle: string;
      submit: string;
      detailsSection: string;
      detailsHint: string;
      idOnSave: string;
      routeSection: string;
      vehicleHint: string;
      mileageSection: string;
      mileageHint: string;
      calculatedHint: string;
      timesSection: string;
      overnightHint: string;
      notesSection: string;
      driverNotesSection: string;
      onlyOneRoute: string;
      configurationRequired: string;
      submitted: string;
      submittedHint: string;
      saved: string;
      approvedReadOnly: string;
      journeySection: string;
      legApproach: string;
      legReturn: string;
      legEmpty: string;
      legStart: string;
      legEnd: string;
      productiveShare: (percent: number) => string;
      record: string;
      created: string;
      lastUpdated: string;
      approvedAt: string;
      nextDay: string;
      backToService: string;
    };

    admin: {
      panelTitle: string;
      pendingSummary: (count: number) => string;
      nothingPending: string;
      approvalQueue: string;
      allClear: string;
      allClearHint: string;
      viewAllServices: string;
      review: string;

      awaitingReview: string;
      allTime: string;
      lastDays: (days: number) => string;
      activityTitle: string;
      activityChartLabel: (days: number) => string;
      peakDay: (label: string, services: number) => string;
      topRoutesTitle: string;
      todayBreakdownTitle: string;
      noRouteActivity: string;
      servicesTitle: string;
      noServicesMatch: string;

      /** Admin list search-box placeholders (SRS 16.3, 23.3). */
      searchServices: string;
      searchUsers: string;
      searchVehicles: string;
      searchRoutes: string;

      /** Extra columns on the vehicle list. */
      assignedDriversColumn: string;
      totalServicesColumn: string;
      noReference: string;
      driverUnit: (count: number) => string;
      servicesUnit: string;

      filters: string;
      clearFilters: string;
      applyFilters: string;
      from: string;
      to: string;

      reviewTitle: string;
      approve: string;
      approving: string;
      confirmApprove: string;
      confirmApproveHint: string;
      confirmApproveAction: string;
      approveFailed: string;
      auditSection: string;
      statusHistory: string;
      pending: string;
      editingApproved: string;
      editingApprovedHint: string;

      vehiclesTitle: string;
      newVehicle: string;
      editVehicle: string;
      vehicleCreated: string;
      vehicleUpdated: string;
      vehicleDeleted: string;
      noVehicles: string;
      noVehiclesHint: string;
      plateHint: string;
      vehicleNameHint: string;
      vehicleActiveHint: string;

      routesTitle: string;
      newRoute: string;
      editRoute: string;
      routeCreated: string;
      routeUpdated: string;
      routeDeleted: string;
      noRoutes: string;
      noRoutesHint: string;
      routeCodeHint: string;
      routeSnapshotNote: string;
      routeActiveHint: string;
      routeActiveHintWithDrivers: (count: number) => string;

      usersTitle: string;
      accountCount: (count: number) => string;
      newAccount: string;
      editAccount: string;
      accountCreated: string;
      accountUpdated: string;
      accountDeleted: string;
      noAccounts: string;
      loginHint: string;
      passwordHintCreate: string;
      passwordHintEdit: string;
      defaultVehicleHint: string;
      assignmentsHint: string;
      assignedColumn: string;
      defaultColumn: string;
      routeColumn: string;
      distanceColumn: string;

      /** The exceptions panel (see `AttentionPanel`). */
      attentionRequired: string;
      operationsOverview: string;
      serviceManagement: string;
      exceptionPendingTitle: (count: number) => string;
      exceptionPendingDetail: string;
      exceptionStaleTitle: (days: number) => string;
      exceptionStaleDetail: (date: string) => string;
      exceptionDistanceTitle: (serviceCode: string) => string;
      exceptionDistanceDetail: (
        routeCode: string,
        actualKm: number,
        baselineKm: number,
      ) => string;
      servicesToday: string;
      approvedToday: string;
      distanceThisWeek: string;
      recentServices: string;
      ofTodaysServices: (total: number) => string;
      noActiveRoutes: string;
      noDefaultWarning: string;
      selfEditNotice: string;
      inactiveRoutesTitle: string;
      inactiveRoutesHint: (count: number) => string;
      accountActiveHint: string;
      createAccount: string;
      createVehicle: string;
      createRoute: string;
      /** Prompt shown on the admin Add Service page before a driver is chosen. */
      selectDriverToStart: string;
      /** Placeholder option in the admin Add Service driver picker. */
      chooseDriver: string;
    };

    nav: {
      /** Landmark names, so a screen reader can tell the two navs apart. */
      adminLabel: string;
      driverLabel: string;
      /** Tooltip/label for the desktop sidebar collapse control. */
      toggleSidebar: string;
      panel: string;
      dashboard: string;
      sectionOperations: string;
      sectionMasterData: string;
      services: string;
      drivers: string;
      vehicles: string;
      routes: string;
    };

    /** The bell dropdown, both roles (SRS-free — see `prisma/schema.prisma`). */
    notifications: {
      title: string;
      empty: string;
      emptyHint: string;
      markAllRead: string;
      unreadAriaLabel: (count: number) => string;
      servicePendingTitle: (serviceCode: string) => string;
      servicePendingBody: (driverName: string, routeCode: string) => string;
      serviceApprovedTitle: (serviceCode: string) => string;
      serviceApprovedBody: (routeCode: string) => string;
      justNow: string;
    };

    errors: {
      notFoundTitle: string;
      notFoundHint: string;
      backHome: string;
      errorTitle: string;
      errorHint: string;
      retry: string;
      reference: string;
    };
  };
}
