-- Master-data deletion becomes an auditable action.
--
-- A vehicle, route or account that no service ever referenced can be removed
-- outright; anything a service points at is refused by the existing
-- `ON DELETE RESTRICT` foreign keys and must be deactivated instead. Either
-- way the attempt is attributable, which is what SRS 21.1 asks of every
-- state change.
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'DELETE';
