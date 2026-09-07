-- Adds payment tracking columns to Order.
-- Assumes add_orders.sql has already been applied.

CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'gcash', 'maya', 'card', 'bank', 'other');

ALTER TABLE "Order"
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "paidAmount" INTEGER NOT NULL DEFAULT 0;
