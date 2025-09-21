-- ============================================
-- ROLLBACK: Payment Status Migration
-- Returns to original values: Unpaid, Paid
-- ============================================

BEGIN;

-- Revert payment status values
UPDATE bookings
SET payment_status = CASE
    WHEN payment_status = 'Pending' THEN 'Unpaid'
    WHEN payment_status = 'Completed' THEN 'Paid'
    ELSE payment_status
END
WHERE payment_status IN ('Pending', 'Completed');

-- Drop new constraint
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

-- Add original constraint
ALTER TABLE bookings
ADD CONSTRAINT bookings_payment_status_check
CHECK (payment_status IN ('Unpaid', 'Partial', 'Paid', 'Refunded'));

-- Restore default value
ALTER TABLE bookings
ALTER COLUMN payment_status SET DEFAULT 'Unpaid';

RAISE NOTICE 'Payment status rollback completed';

COMMIT;