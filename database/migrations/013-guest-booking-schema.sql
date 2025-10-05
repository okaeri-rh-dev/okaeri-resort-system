-- Migration: 013-guest-booking-schema.sql
-- Purpose: Add guest booking support to existing bookings table
-- Date: 2025-01

-- Add columns for guest booking support
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
ADD COLUMN IF NOT EXISTS upload_status TEXT CHECK (upload_status IN ('pending', 'uploaded', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS upload_expires_at TIMESTAMPTZ;

-- Add indexes for guest booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_is_guest_booking ON bookings(is_guest_booking);
CREATE INDEX IF NOT EXISTS idx_bookings_upload_status ON bookings(upload_status);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
CREATE INDEX IF NOT EXISTS idx_bookings_reference_email ON bookings(booking_reference, email);

-- Add comments for documentation
COMMENT ON COLUMN bookings.is_guest_booking IS 'True for bookings created via guest portal, requiring admin review';
COMMENT ON COLUMN bookings.payment_proof_url IS 'Storage path for uploaded payment proof (receipts, screenshots)';
COMMENT ON COLUMN bookings.upload_status IS 'Status of payment proof upload: pending, uploaded, verified, rejected';
COMMENT ON COLUMN bookings.upload_expires_at IS 'Expiration time for payment proof upload (cleanup after this time)';

-- Create a function to check unit availability (for atomic checks)
CREATE OR REPLACE FUNCTION check_unit_availability(
  p_unit_id UUID,
  p_check_in TIMESTAMPTZ,
  p_check_out TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM bookings
    WHERE unit_id = p_unit_id
      AND booking_status != 'Cancelled'
      AND (
        (check_in < p_check_out AND check_out > p_check_in)
      )
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_unit_availability TO authenticated;

-- Ensure audit logging works for guest bookings
-- The existing audit triggers will automatically capture changes to these new columns