# Decision records

One file per decision that was not obvious, in the format: context, decision,
consequences. A record explains _why_ — the code already shows what.

A decision here is one where a competent developer could reasonably have chosen
otherwise. Choices the SRS dictates (Prisma, Neon, Auth.js, Next.js) are not
recorded; they are requirements.

| #                                                | Decision                                                     | Status   |
| ------------------------------------------------ | ------------------------------------------------------------ | -------- |
| [0001](0001-local-postgres-for-development.md)   | Local Docker PostgreSQL for development, Neon for deployment | Accepted |
| [0002](0002-layered-modules.md)                  | Layered modules with a dependency-free domain core           | Accepted |
| [0003](0003-service-id-from-a-sequence.md)       | Service IDs from a PostgreSQL sequence                       | Accepted |
| [0004](0004-argon2id-for-passwords.md)           | Argon2id rather than bcrypt                                  | Accepted |
| [0005](0005-store-calculated-mileage.md)         | Store calculated mileage, guarded by CHECK constraints       | Accepted |
| [0006](0006-time-of-day-representation.md)       | Clock times as PostgreSQL `time`, mapped to `"HH:MM"`        | Accepted |
| [0007](0007-strict-request-schemas.md)           | Reject unknown request keys rather than stripping them       | Accepted |
| [0008](0008-prisma-7-pinned.md)                  | Pin Prisma to 7.10.0 and use the `pg` driver adapter         | Accepted |
| [0009](0009-centralised-spanish-messages.md)     | One message catalogue rather than inline Spanish strings     | Accepted |
| [0010](0010-administrators-may-file-services.md) | Administrators may file services on a driver's behalf        | Accepted |
| [0011](0011-route-and-service-rate.md)           | Route default rate and per-service rate, admin-only          | Accepted |
| [0012](0012-finance-core-master-data.md)         | Finance-core primitives and master-data extensions (Phase 1) | Accepted |
| [0013](0013-refuelling-module.md)                | The refuelling module (Phase 2)                               | Accepted |
| [0014](0014-received-invoices-and-investments.md)| Received invoices and the investment summary (Phase 3)        | Accepted |
| [0015](0015-issued-invoices-and-taxes.md)        | Issued invoices, service billing, and the tax summary (Phase 4)| Accepted |
| [0016](0016-fleet-and-personnel-logs.md)         | Daily real km, personnel costs, and maintenance (Phase 5)     | Accepted |
| [0017](0017-analytics-and-dashboard.md)          | Analytics and dashboard layer (Phase 6)                       | Accepted |
