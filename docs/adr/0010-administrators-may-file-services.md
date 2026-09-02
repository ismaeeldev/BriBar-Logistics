# 10. Administrators may file services on a driver's behalf

**Status:** Accepted

## Context

SRS 9.5 states that "the Driver field shall always reflect the authenticated user
and cannot be switched manually", and SRS 17.2 leaves administrator access to
`/services/new` to operational need: "Access: DRIVER; ADMIN access may be omitted
unless explicitly needed operationally."

Phase 1 omitted it, which made SRS 9.5 unconditional — no code path existed where
a service's driver was anyone but its creator. The client has since asked for it
(`docs/open-questions.md` #7): an administrator must be able to record a service
for a driver, presumably for paper sheets handed in late or a driver without a
phone to hand.

## Decision

Two schemas rather than one optional field.

```
createServiceSchema        no driverId at all      applied to a DRIVER's request
adminCreateServiceSchema   driverId required       applied to an ADMIN's request
```

The route handler selects between them on the session role. A driver's request is
never parsed with the administrator schema.

`driverId` is **required** on the administrator schema, not optional. Defaulting
to the acting administrator would silently create a service owned by someone who
does not drive — and who has no rows in `driver_routes`, so the route-assignment
check would then fail with a confusing message rather than a clear one.

## Consequences

SRS 9.5 now holds for drivers rather than universally, and the weakening is
bounded in a way that is worth stating precisely.

A driver's schema is a `strictObject` with no `driverId` key, so a driver sending
one is rejected with a 400 naming the field — not stripped, not ignored. The
capability is not "administrators are trusted with an extra field"; it is "a
different schema exists, and only an administrator's request reaches it". The
security tests in SRS 26.8 assert both halves.

Ownership and authorship become distinct, and both are recorded.
`services.driver_id` is the driver the service belongs to; the audit log's
`actor_user_id` is whoever entered it. For a driver-filed service they are the
same person; for an administrator-filed one they are not, and "who entered this?"
stays answerable (SRS 21.1).

Editing does **not** gain the same capability. `updateServiceSchema` has no
`driverId`, so reassigning an existing service to a different driver is
impossible through any endpoint. Rewriting the ownership of an audited record is
a different operation with different consequences; if it is ever needed it should
be its own endpoint with its own audit action, not a side effect of an edit.

The service layer still validates the target: the driver must exist, be active,
and have the chosen route assigned. An administrator can file on someone's
behalf, but not into a configuration the driver could not have used themselves.
