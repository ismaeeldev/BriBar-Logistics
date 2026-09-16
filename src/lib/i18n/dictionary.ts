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
    secondaryDriver: string;
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
    /** The route's admin-only default charge (ERP roadmap Phase 0). */
    defaultRate: string;
    /** A service's admin-only assigned rate; may differ from the route default. */
    rate: string;
    /** ERP roadmap Phase 1: a client's tax identifier (CIF/NIF). */
    taxId: string;
    /** The three `99_Config` operational defaults. */
    oilChangeIntervalKm: string;
    defaultConsumptionMlPer100Km: string;
    defaultFuelPriceCentsPerLiter: string;
    /** ERP roadmap Phase 2 (`02Repostajes`). */
    refuelCode: string;
    refuelDate: string;
    odometerKm: string;
    liters: string;
    total: string;
    vatRate: string;
    baseAmount: string;
    vatAmount: string;
    fuelType: string;
    gasStation: string;
    paymentMethod: string;
    kmSinceLastRefuel: string;
    consumption: string;
    /** ERP roadmap Phase 3 (`03Facturas_Recibidas`). */
    invoiceCode: string;
    invoiceDate: string;
    supplier: string;
    category: string;
    /** Client change request 2026-09-17 (ERP roadmap Phase 3). */
    concept: string;
    expenseType: string;
    invoiceState: string;
    /** ERP roadmap Phase 4. */
    client: string;
    /** Client change request 2026-09-17. */
    endClient: string;
    supplement: string;
    supplementType: string;
    /** ERP roadmap Phase 5. */
    /** A daily-km-log's own date (`DailyKmLog.date`) - generic, unlike the
     *  document-specific `refuelDate`/`invoiceDate`/`performedDate` above. */
    date: string;
    year: string;
    month: string;
    /** A personnel cost's owner - any `User`, not only `Role.DRIVER`, so
     *  distinct from `driver`. */
    employee: string;
    /** A personnel cost's base salary - distinct from `baseAmount`, which is
     *  VAT-taxable-base terminology and reads wrong for a salary field. */
    baseCost: string;
    overtime: string;
    allowances: string;
    otherAmount: string;
    totalCost: string;
    dailyFixedCost: string;
    workedHours: string;
    maintenanceCode: string;
    maintenanceType: string;
    performedDate: string;
    performedKm: string;
    nextDueKm: string;
    nextDueDate: string;
  };

  SERVICE_STATUS_LABELS: { PENDING_APPROVAL: string; APPROVED: string };
  ROLE_LABELS: { ADMIN: string; DRIVER: string };
  /** ERP roadmap Phase 2. */
  VAT_RATE_LABELS: {
    STANDARD: string;
    REDUCED: string;
    SUPER_REDUCED: string;
    ZERO: string;
    EXEMPT: string;
  };
  /** ERP roadmap Phase 3. */
  EXPENSE_TYPE_LABELS: {
    OPERATION: string;
    INVESTMENT: string;
    NON_OPERATING: string;
  };
  /** ERP roadmap Phase 1. The list a `LookupItem` belongs to, by name. */
  LOOKUP_KIND_LABELS: {
    FUEL_TYPE: string;
    PAYMENT_METHOD: string;
    SUPPLEMENT_TYPE: string;
    END_CLIENT: string;
    /** ERP roadmap Phase 2. */
    GAS_STATION: string;
    /** ERP roadmap Phase 3. */
    INVOICE_STATE: string;
    /** ERP roadmap Phase 5. */
    MAINTENANCE_TYPE: string;
    /** How a client pays an issued invoice, distinct from `PAYMENT_METHOD`. */
    CLIENT_PAYMENT_METHOD: string;
  };

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
    invalidMoney: string;
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
    /** ERP roadmap Phase 1: the config screen's consumption field. */
    invalidLiters: string;
    /** ERP roadmap Phase 1: a whole, non-negative km value (oil-change interval). */
    invalidWholeKm: string;
    /** ERP roadmap Phase 2/3: an unrecognised VAT rate value. */
    invalidVatRate: string;
    /** ERP roadmap Phase 4: no services chosen when issuing an invoice. */
    selectAtLeastOneService: string;
    /** ERP roadmap Phase 5: the daily-km log's worked-hours field. */
    invalidWorkedHours: string;
    invalidYear: string;
    invalidMonth: string;
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
    noDefaultVehicle: string;
    noActiveVehicles: string;
    noActiveRoutes: string;
    routeNotAssigned: string;
    secondaryDriverSameAsDriver: string;
    secondaryDriverInvalid: string;
    routeInactive: string;
    vehicleInactive: string;
    driverInactive: string;
    userNotDriver: string;
    /** ERP roadmap Phase 3. */
    supplierInactive: string;
    categoryInactive: string;
    /** ERP roadmap Phase 4: a chosen service is not approved, priced,
     * unbilled, or on this client's routes. */
    serviceNotBillable: string;
    alreadyApproved: string;
    deleteBlocked: string;
    deleteSelfBlocked: string;
    cannotDeactivateSelf: string;
    cannotDemoteSelf: string;
    /** ERP roadmap Phase 2: a fuel type/gas station/payment method id that
     * belongs to a different `LookupKind` than the field expects. */
    lookupKindMismatch: string;
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
    rateNonNegative: string;
    /** ERP roadmap Phase 1. */
    lookupNameTaken: string;
    configInvalidValue: string;
    /** ERP roadmap Phase 2. */
    refuelCodeTaken: string;
    refuelOdometerNegative: string;
    refuelLitersInvalid: string;
    refuelTotalNegative: string;
    refuelBaseVatMismatch: string;
    /** ERP roadmap Phase 3. */
    invoiceCodeTaken: string;
    invoiceBaseNegative: string;
    invoiceVatMismatch: string;
    /** ERP roadmap Phase 5. */
    dailyKmLogDateTaken: string;
    maintenanceCodeTaken: string;
    personnelCostMonthTaken: string;
    workedHoursNegative: string;
    personnelCostAmountsNegative: string;
    personnelCostMonthRange: string;
    personnelCostTotalMismatch: string;
    maintenanceKmNegative: string;
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
      /** ERP roadmap Phase 2. */
      blockerRefuellings: (count: number) => string;
      /** ERP roadmap Phase 3. */
      blockerReceivedInvoices: (count: number) => string;
      /** ERP roadmap Phase 4. */
      blockerRoutes: (count: number) => string;
      blockerIssuedInvoices: (count: number) => string;
      /** ERP roadmap Phase 5. */
      blockerMaintenanceRecords: (count: number) => string;
      blockerDailyKmLogs: (count: number) => string;
      blockerPersonnelCosts: (count: number) => string;
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
      noAssignedRoutesHint: string;
      noSecondaryDriver: string;
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
      /** The route form's admin-only rate field (ERP roadmap Phase 0). */
      defaultRateHint: string;
      /** The route form's admin-only client link (ERP roadmap Phase 4). */
      routeClientHint: string;
      noClientLinked: string;
      /** The route form's admin-only end-client link (client change request 2026-09-17). */
      routeEndClientHint: string;
      noEndClientLinked: string;
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
      /** ERP roadmap Phase 2: placeholder option in the refuelling vehicle picker. */
      chooseVehicle: string;

      /** The service review page's rate card. */
      rateSectionTitle: string;
      rateHint: string;
      noRate: string;
      editRate: string;
      saveRate: string;
      savingRate: string;
      rateUpdated: string;
      rateUpdateFailed: string;

      /** The service review page's supplement editor (ERP roadmap Phase 4). */
      supplementSectionTitle: string;
      supplementHint: string;
      noSupplement: string;
      editSupplement: string;
      saveSupplement: string;
      savingSupplement: string;
      supplementUpdated: string;
      supplementUpdateFailed: string;
      chooseSupplementTypeOptional: string;
      baseSectionTitle: string;
      noBase: string;

      /** Clients master data (ERP roadmap Phase 1). */
      clientsTitle: string;
      newClient: string;
      editClient: string;
      clientCreated: string;
      clientUpdated: string;
      clientDeleted: string;
      noClients: string;
      noClientsHint: string;
      searchClients: string;
      clientTaxIdHint: string;
      clientActiveHint: string;

      /** End clients master data (client change request 2026-09-17). */
      endClientsTitle: string;
      newEndClient: string;
      editEndClient: string;
      endClientCreated: string;
      endClientUpdated: string;
      endClientDeleted: string;
      noEndClients: string;
      noEndClientsHint: string;
      searchEndClients: string;
      endClientTaxIdHint: string;
      endClientActiveHint: string;

      /**
       * The generic simple-lookup lists (fuel types, payment methods,
       * supplement types, end clients — ERP roadmap Phase 1). One set of
       * strings for every kind, parameterised by the kind's own display name,
       * rather than a copy per kind.
       */
      lookup: {
        sectionTitle: string;
        sectionHint: string;
        newItem: string;
        editItem: (kindLabel: string) => string;
        created: string;
        updated: string;
        deleted: string;
        empty: string;
        emptyHint: string;
        nameHint: string;
        activeHint: string;
        search: string;
        backToLists: string;
      };

      /** The single operational-defaults screen (`99_Config`, Phase 1). */
      config: {
        title: string;
        hint: string;
        saved: string;
        oilChangeHint: string;
        consumptionHint: string;
        fuelPriceHint: string;
      };

      /** The refuelling module (`02Repostajes`, ERP roadmap Phase 2). */
      refuelling: {
        title: string;
        newRefuelling: string;
        editRefuelling: string;
        created: string;
        updated: string;
        deleted: string;
        noRefuellings: string;
        noRefuellingsHint: string;
        vehicleHint: string;
        driverHint: string;
        odometerHint: string;
        kmSinceLastUnavailable: string;
        detailSectionTitle: string;
        categorisationSectionTitle: string;
        categorisationHint: string;
        chooseFuelType: string;
        chooseGasStation: string;
      };

      /** Suppliers master data (ERP roadmap Phase 3). */
      suppliersTitle: string;
      newSupplier: string;
      editSupplier: string;
      supplierCreated: string;
      supplierUpdated: string;
      supplierDeleted: string;
      noSuppliers: string;
      noSuppliersHint: string;
      searchSuppliers: string;
      supplierTaxIdHint: string;
      supplierActiveHint: string;

      /** Expense categories master data (ERP roadmap Phase 3). */
      expenseCategories: {
        title: string;
        newItem: string;
        editItem: string;
        created: string;
        updated: string;
        deleted: string;
        empty: string;
        emptyHint: string;
        activeHint: string;
        expenseTypeHint: string;
        defaultVatRateHint: string;
      };

      /** The received-invoices module (ERP roadmap Phase 3). */
      receivedInvoices: {
        title: string;
        newInvoice: string;
        editInvoice: string;
        created: string;
        updated: string;
        deleted: string;
        noInvoices: string;
        noInvoicesHint: string;
        supplierHint: string;
        categoryHint: string;
        vehicleHint: string;
        chooseSupplier: string;
        chooseCategory: string;
        chooseVehicleOptional: string;
        chooseState: string;
        choosePaymentMethod: string;
        detailSectionTitle: string;
      };

      /** The investment summary report (ERP roadmap Phase 3, `07_Inversiones`). */
      investments: {
        title: string;
        hint: string;
        vehicleColumn: string;
        totalColumn: string;
        invoiceCountColumn: string;
        noInvestments: string;
        noInvestmentsHint: string;
        recoveryTitle: string;
        recoveryHint: string;
        investmentColumn: string;
        profitColumn: string;
        recoveryColumn: string;
        outstandingColumn: string;
        recovered: string;
      };

      /** The issued-invoices module (ERP roadmap Phase 4). */
      issuedInvoices: {
        title: string;
        newInvoice: string;
        editInvoice: string;
        created: string;
        deleted: string;
        noInvoices: string;
        noInvoicesHint: string;
        chooseClient: string;
        clientHint: string;
        servicesSectionTitle: string;
        servicesHint: string;
        noBillableServices: string;
        noBillableServicesHint: string;
        selectAll: string;
        selectedCount: (count: number) => string;
        detailSectionTitle: string;
        linkedServicesTitle: string;
      };

      /** The quarterly tax summary (ERP roadmap Phase 4, `06_Impuestos`). */
      taxes: {
        title: string;
        hint: string;
        periodColumn: string;
        vatOutputColumn: string;
        vatInputColumn: string;
        balanceColumn: string;
        balanceDue: string;
        balanceRefund: string;
        noData: string;
        noDataHint: string;
      };

      /** The daily-km-log module (ERP roadmap Phase 5, `00KmDiariosReales`). */
      dailyKm: {
        title: string;
        newLog: string;
        editLog: string;
        created: string;
        updated: string;
        deleted: string;
        noLogs: string;
        noLogsHint: string;
        vehicleHint: string;
        chooseRouteOptional: string;
        chooseDriverOptional: string;
        workedHoursHint: string;
      };

      /** The personnel-cost module (ERP roadmap Phase 5, `04Personal`). */
      personnel: {
        title: string;
        newCost: string;
        editCost: string;
        created: string;
        updated: string;
        deleted: string;
        noCosts: string;
        noCostsHint: string;
        userHint: string;
        totalHint: string;
        dailyFixedCostLabel: string;
      };

      /** The maintenance module (ERP roadmap Phase 5, `05Mantenimiento`). */
      maintenance: {
        title: string;
        newRecord: string;
        editRecord: string;
        created: string;
        updated: string;
        deleted: string;
        noRecords: string;
        noRecordsHint: string;
        vehicleHint: string;
        typeHint: string;
        chooseType: string;
        nextDueHint: string;
        dueSummaryTitle: string;
        dueSummaryHint: string;
        noDue: string;
        /** DetailRow label on the edit page's urgency card. */
        urgencyLabel: string;
        urgency: {
          URGENT: string;
          UPCOMING: string;
          OK: string;
          UNKNOWN: string;
        };
      };

      /** The analytics layer (ERP roadmap Phase 6, `00Dashboard` / `00Análisis`). */
      analytics: {
        title: string;
        hint: string;
        allTime: string;
        periodLabel: string;
        allYears: string;
        allMonths: string;
        /** "Todos" (client decision 2026-09-13). */
        allVehicles: string;
        apply: string;
        /** Headline KPI card labels. */
        revenue: string;
        fuelCost: string;
        personnelCost: string;
        operatingExpense: string;
        margin: string;
        marginRatio: string;
        emptyKm: string;
        avgConsumption: string;
        avgFuelPrice: string;
        /** Section headings. */
        marginTrendTitle: string;
        marginTrendHint: string;
        simulatorTitle: string;
        simulatorHint: string;
        noData: string;
        noDataHint: string;
        actualKmColumn: string;
        /** Scenario simulator field labels and output (matched to the
         * client's own spreadsheet, client decision 2026-09-13). */
        simRevenue: string;
        simEmptyKm: string;
        simServiceKm: string;
        simEmptyKmFuelCost: string;
        simReset: string;
      };
    };

    nav: {
      /** Landmark names, so a screen reader can tell the two navs apart. */
      adminLabel: string;
      driverLabel: string;
      /** Tooltip/label for the desktop sidebar collapse control. */
      toggleSidebar: string;
      panel: string;
      dashboard: string;
      /** ERP roadmap Phase 6: the analytics layer. */
      analytics: string;
      sectionOperations: string;
      sectionMasterData: string;
      /** ERP roadmap Phase 1: clients, lists, config. */
      sectionFinance: string;
      services: string;
      drivers: string;
      vehicles: string;
      routes: string;
      clients: string;
      /** Client change request 2026-09-17. */
      endClients: string;
      suppliers: string;
      lists: string;
      config: string;
      refuellings: string;
      receivedInvoices: string;
      investments: string;
      expenseCategories: string;
      issuedInvoices: string;
      taxes: string;
      /** ERP roadmap Phase 5: daily km logs, personnel costs, maintenance. */
      sectionFleet: string;
      dailyKm: string;
      personnel: string;
      maintenance: string;
      /** ERP roadmap Phase 3: the low-frequency configuration screens. */
      sectionSettings: string;
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
