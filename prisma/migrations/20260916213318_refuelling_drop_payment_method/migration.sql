-- Client change request 2026-09-17: drop `Refuelling.paymentMethodId`,
-- superseding the 2026-09-13 decision that made it mandatory. Historical
-- categorisation on existing rows is intentionally not preserved elsewhere -
-- the field is gone from the product, not just hidden from the form.

-- DropForeignKey
ALTER TABLE "refuellings" DROP CONSTRAINT "refuellings_payment_method_id_fkey";

-- AlterTable
ALTER TABLE "refuellings" DROP COLUMN "payment_method_id";
