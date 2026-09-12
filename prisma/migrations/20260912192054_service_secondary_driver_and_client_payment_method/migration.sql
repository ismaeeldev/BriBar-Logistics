-- AlterEnum
ALTER TYPE "lookup_kind" ADD VALUE 'CLIENT_PAYMENT_METHOD';

-- AlterTable
ALTER TABLE "app_config" ALTER COLUMN "id" SET DEFAULT 'default';

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "secondary_driver_id" UUID;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_secondary_driver_id_fkey" FOREIGN KEY ("secondary_driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
