-- AlterEnum
ALTER TYPE "audit_entity_type" ADD VALUE 'END_CLIENT';

-- AlterTable
ALTER TABLE "routes" ADD COLUMN     "end_client_id" UUID;

-- CreateTable
CREATE TABLE "end_clients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "tax_id" VARCHAR(32),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "end_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "end_clients_is_active_idx" ON "end_clients"("is_active");

-- CreateIndex
CREATE INDEX "routes_end_client_id_idx" ON "routes"("end_client_id");

-- Data migration (client change request 2026-09-17): carry over any end
-- clients an administrator already entered as a `LookupKind.END_CLIENT`
-- named list, reusing the same primary keys so nothing needs re-linking.
-- No route referenced one yet (see the enum's old doc comment), so this is
-- purely a name/id carry-over, not a re-link.
INSERT INTO "end_clients" (id, name, tax_id, is_active, created_at, updated_at)
SELECT id, name, NULL, is_active, created_at, updated_at
FROM "lookup_items"
WHERE kind = 'END_CLIENT';

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_end_client_id_fkey" FOREIGN KEY ("end_client_id") REFERENCES "end_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
