-- Idempotent version of add_payment_method — safe to run multiple times.

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'gcash', 'maya', 'card', 'bank', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod",
  ADD COLUMN IF NOT EXISTS "paidAmount" INTEGER NOT NULL DEFAULT 0;
