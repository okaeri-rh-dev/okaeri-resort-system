-- Add status column to payments table for soft-delete support
-- Active = normal payment, Deleted = soft-deleted by manager, Refunded = refunded payment

ALTER TABLE public.payments
  ADD COLUMN status text NOT NULL DEFAULT 'Active';

-- Add check constraint for valid values
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('Active', 'Deleted', 'Refunded'));

-- Index for filtering active payments (most queries will filter by status)
CREATE INDEX idx_payments_status ON public.payments(status);
