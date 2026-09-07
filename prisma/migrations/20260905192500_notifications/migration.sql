-- Notifications.
--
-- Not an SRS requirement (SRS 29 excludes a reporting/comms module) — added to
-- shorten the gap between "something happened" and someone noticing, on the
-- two events the workflow already has: a service entering PENDING_APPROVAL,
-- and a service being APPROVED.

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('SERVICE_PENDING_APPROVAL', 'SERVICE_APPROVED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "service_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications"("recipient_user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_service_id_idx" ON "notifications"("service_id");

-- AddForeignKey
--
-- Cascade, not Restrict: unlike every historical-record reference elsewhere in
-- this schema, a notification is not the record of what happened — AuditLog
-- and ServiceStatusHistory are — so it has no reason to block a deletion, and
-- no meaning once its service or recipient is gone (same reasoning as
-- service_status_history's own foreign key to services, below).
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
