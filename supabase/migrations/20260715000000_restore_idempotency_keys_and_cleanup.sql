-- ============================================
-- Restore idempotency_keys table + daily cleanup function
-- ============================================
-- Context: migration 20251104184719_multi_unit_guest_booking_schema.sql is
-- recorded as applied on production (supabase_migrations.schema_migrations) but
-- its objects never materialized there (schema-history drift). This forward,
-- idempotent migration re-creates ONLY the objects the daily "Cleanup
-- Idempotency Keys" cron depends on:
--   - public.idempotency_keys                (table + indexes + RLS + grants)
--   - public.cleanup_expired_idempotency_keys()  (function called by the cron)
--
-- Verified against production 2026-07-15 (supabase db query --linked):
--   - bookings.booking_id is the PRIMARY KEY -> foreign key target is valid
--   - idempotency_keys table and the function do not currently exist
--
-- Intentionally OUT OF SCOPE (needs a separate, considered port):
--   cleanup_expired_payment_proofs() references bookings.check_out_date and
--   booking_status IN ('Completed','CheckedOut'); production bookings uses
--   check_out and statuses Confirmed/Cancelled/Pending. Copying it verbatim
--   would fail or silently no-op, and any status remapping mutates real booking
--   data, so it is deferred pending a decision on the intended retention rule.

BEGIN;

-- --------------------------------------------
-- idempotency_keys table (48-hour dedup window for guest bookings)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_booking ON idempotency_keys(booking_id);

COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate bookings. Client-generated UUIDs with 48-hour expiry. Cleaned daily at 2:00 AM UTC.';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Automatic expiry 48 hours after creation. cleanup_expired_idempotency_keys() removes expired keys daily.';

-- RLS: service_role only (both the cron and the guest-booking API use the
-- service role key; no authenticated/anon access to raw idempotency keys).
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idempotency_keys_service_policy ON idempotency_keys;
CREATE POLICY idempotency_keys_service_policy ON idempotency_keys
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON idempotency_keys TO service_role;

-- --------------------------------------------
-- Daily cleanup function (POST /api/cron/cleanup-idempotency)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW();

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Removes expired idempotency keys. Called daily at 2:00 AM UTC via cron. Keys expire 48 hours after creation.';

GRANT EXECUTE ON FUNCTION cleanup_expired_idempotency_keys() TO service_role;

COMMIT;

-- Ask PostgREST to reload its schema cache so supabase.rpc() can resolve the
-- newly created function immediately (Supabase also auto-reloads on DDL).
NOTIFY pgrst, 'reload schema';
