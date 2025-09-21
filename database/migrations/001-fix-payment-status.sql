-- ============================================
-- PAYMENT STATUS ALIGNMENT MIGRATION
-- Fixes mismatch between database and TypeScript code
-- Changes: Unpaid -> Pending, Paid -> Completed
-- ============================================

BEGIN;

-- Step 1: Update existing payment status values
UPDATE bookings
SET payment_status = CASE
    WHEN payment_status = 'Unpaid' THEN 'Pending'
    WHEN payment_status = 'Paid' THEN 'Completed'
    ELSE payment_status
END
WHERE payment_status IN ('Unpaid', 'Paid');

-- Log the changes
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % booking records with new payment status values', updated_count;
END $$;

-- Step 2: Drop the old constraint
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

-- Step 3: Add new constraint with updated values
ALTER TABLE bookings
ADD CONSTRAINT bookings_payment_status_check
CHECK (payment_status IN ('Pending', 'Partial', 'Completed', 'Refunded'));

-- Step 4: Update the default value
ALTER TABLE bookings
ALTER COLUMN payment_status SET DEFAULT 'Pending';

-- Verify the migration
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM bookings
    WHERE payment_status NOT IN ('Pending', 'Partial', 'Completed', 'Refunded');

    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % bookings have invalid payment status', invalid_count;
    ELSE
        RAISE NOTICE 'Payment status migration completed successfully';
    END IF;
END $$;

COMMIT;

-- Post-migration verification query
SELECT
    payment_status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM bookings
GROUP BY payment_status
ORDER BY count DESC;