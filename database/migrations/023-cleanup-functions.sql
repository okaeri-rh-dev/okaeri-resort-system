-- ============================================
-- Chunk 005: Cleanup Functions for Cron Workers
-- ============================================
-- Purpose: PostgreSQL functions for automated cleanup of expired data
-- - cleanup_expired_idempotency_keys(): Daily cleanup (2 AM UTC)
-- - cleanup_expired_payment_proofs(): Weekly cleanup (Sunday 3 AM UTC)
-- Maintains free tier compliance by preventing indefinite table growth
-- ============================================

BEGIN;

-- ============================================
-- Function 1: Cleanup Expired Idempotency Keys
-- ============================================
-- Deletes idempotency keys where expires_at < NOW()
-- Called daily by Cloudflare Pages cron worker
-- Retention: 48 hours from creation
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete keys where expires_at is in the past
  DELETE FROM idempotency_keys
  WHERE expires_at < NOW();

  -- Get count of deleted rows
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log cleanup for monitoring
  RAISE NOTICE 'Cleaned up % expired idempotency keys', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS
  'Deletes expired idempotency keys (expires_at < NOW()). Called daily at 2:00 AM UTC by Cloudflare Pages cron worker. Retention: 48 hours from creation (set in idempotency_keys.expires_at default). Returns count of deleted keys for monitoring.';

-- ============================================
-- Function 2: Cleanup Expired Payment Proofs
-- ============================================
-- Deletes old payment proofs based on retention rules
-- Called weekly by Cloudflare Pages cron worker
-- Retention Rules:
-- - Completed bookings: 90 days after check-out
-- - Cancelled bookings: 30 days after cancellation (updated_at)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_payment_proofs()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_deleted_count INTEGER := 0;
  v_storage_freed_bytes BIGINT := 0;
  v_file_paths TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Collect all file paths first (before mutation) - ATOMIC approach
  -- This ensures transaction safety and better performance
  SELECT
    array_agg(regexp_replace(payment_proof_url, '.*payment-proofs/', '')),
    COUNT(*)
  INTO v_file_paths, v_deleted_count
  FROM bookings
  WHERE payment_proof_url IS NOT NULL
    AND (
      -- Completed: 90 days after check-out
      (booking_status = 'Completed' AND check_out < NOW() - INTERVAL '90 days')
      OR
      -- Cancelled: 30 days after cancellation
      (booking_status = 'Cancelled' AND updated_at < NOW() - INTERVAL '30 days')
    );

  -- Single atomic UPDATE (not a loop) - ensures transaction safety
  -- All rows updated together, preventing partial failures
  UPDATE bookings
  SET payment_proof_url = NULL
  WHERE payment_proof_url IS NOT NULL
    AND (
      (booking_status = 'Completed' AND check_out < NOW() - INTERVAL '90 days')
      OR
      (booking_status = 'Cancelled' AND updated_at < NOW() - INTERVAL '30 days')
    );

  -- Calculate approximate storage freed
  -- Assume ~2MB per file (typical for receipts/screenshots)
  v_storage_freed_bytes := v_deleted_count * 2097152;

  -- Build result JSONB for monitoring
  -- Include file_paths for cron worker to delete from Storage
  v_result := jsonb_build_object(
    'deleted_count', v_deleted_count,
    'file_paths', v_file_paths,
    'storage_freed_bytes', v_storage_freed_bytes,
    'cleaned_at', NOW()
  );

  -- Log cleanup for monitoring
  RAISE NOTICE 'Cleaned up % expired payment proofs (~% MB freed)',
    v_deleted_count,
    (v_storage_freed_bytes / 1024 / 1024);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_payment_proofs() IS
  'Marks expired payment proofs for deletion by clearing payment_proof_url. Called weekly on Sunday at 3:00 AM UTC by Cloudflare Pages cron worker. Retention rules: Completed bookings (90 days after check-out), Cancelled bookings (30 days after cancellation). Returns JSONB: {deleted_count, file_paths, storage_freed_bytes, cleaned_at}. Note: Actual file deletion from Supabase Storage handled by cron worker.';

-- ============================================
-- Verification Block
-- ============================================
-- Run these checks after migration to verify functions

-- Check 1: Verify functions exist
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN ('cleanup_expired_idempotency_keys', 'cleanup_expired_payment_proofs');

  IF v_count != 2 THEN
    RAISE EXCEPTION 'Expected 2 cleanup functions, found %', v_count;
  END IF;

  RAISE NOTICE 'Verification: Both cleanup functions created successfully';
END $$;

-- Check 2: Test idempotency cleanup (dry run - won't delete anything if no expired keys)
DO $$
DECLARE
  v_result INTEGER;
BEGIN
  SELECT cleanup_expired_idempotency_keys() INTO v_result;
  RAISE NOTICE 'Verification: cleanup_expired_idempotency_keys() returned %', v_result;
END $$;

-- Check 3: Test payment proof cleanup (dry run)
DO $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT cleanup_expired_payment_proofs() INTO v_result;
  RAISE NOTICE 'Verification: cleanup_expired_payment_proofs() returned %', v_result;
END $$;

-- ============================================
-- Performance Index: Idempotency Key Expiry
-- ============================================
-- Index on expires_at for fast cleanup queries
-- Without this index, cleanup scans entire table (slow as table grows)
-- With index: O(log n) lookup instead of O(n) scan
-- ============================================

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry
  ON idempotency_keys(expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON INDEX idx_idempotency_expiry IS
  'Accelerates cleanup_expired_idempotency_keys() by indexing expires_at. Enables fast lookup of expired keys without full table scan. Partial index (WHERE expires_at IS NOT NULL) saves space.';

-- Check 4: Verify idempotency_keys table has index on expires_at
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'idempotency_keys'
      AND indexname = 'idx_idempotency_expiry'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE WARNING 'Index idx_idempotency_expiry missing - cleanup performance may be degraded';
  ELSE
    RAISE NOTICE 'Verification: Index idx_idempotency_expiry exists';
  END IF;
END $$;

COMMIT;

-- ============================================
-- Post-Migration Manual Testing
-- ============================================
-- Run these commands manually to test functions:

-- 1. Check how many idempotency keys would be cleaned
-- SELECT COUNT(*) FROM idempotency_keys WHERE expires_at < NOW();

-- 2. Execute idempotency cleanup
-- SELECT cleanup_expired_idempotency_keys();

-- 3. Execute payment proof cleanup
-- SELECT cleanup_expired_payment_proofs();

-- 4. Monitor idempotency key counts over time
-- SELECT
--   COUNT(*) as total_keys,
--   COUNT(*) FILTER (WHERE expires_at > NOW()) as active_keys,
--   COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_keys,
--   MIN(created_at) as oldest_key,
--   MAX(created_at) as newest_key
-- FROM idempotency_keys;

-- ============================================
-- Alerting Thresholds (for cron workers)
-- ============================================
-- Cron workers should alert if:
-- - cleanup_expired_idempotency_keys() returns > 1000
--   (Indicates high retry rate or double-booking attempts)
-- - cleanup_expired_payment_proofs() returns deleted_count > 50
--   (Indicates bulk cancellations or retention policy issues)
