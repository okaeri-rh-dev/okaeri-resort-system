-- Add pricing_metadata column to bookings table
-- This stores the full pricing breakdown including seasonal rates applied

-- Add pricing_metadata JSON column
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS pricing_metadata JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN bookings.pricing_metadata IS 'Stores complete pricing breakdown including seasonal rates, nightly breakdown, and calculation details. Structure: { nights, subtotal, extraPersons, extraPersonTotal, total, downpayment, balance, currency, hasSeasonalRates, seasonNames, nightlyBreakdown[], calculatedAt }';

-- Create index for querying bookings with seasonal rates
CREATE INDEX IF NOT EXISTS idx_bookings_has_seasonal_rates
ON bookings ((pricing_metadata->'hasSeasonalRates'));

-- Create index for querying by season names
CREATE INDEX IF NOT EXISTS idx_bookings_season_names
ON bookings USING GIN ((pricing_metadata->'seasonNames'));

-- Add helpful view for pricing analytics
CREATE OR REPLACE VIEW booking_pricing_analytics AS
SELECT
  booking_id,
  booking_reference,
  check_in,
  check_out,
  total_amount,
  (pricing_metadata->>'nights')::int AS nights,
  (pricing_metadata->>'hasSeasonalRates')::boolean AS has_seasonal_rates,
  pricing_metadata->'seasonNames' AS season_names,
  (pricing_metadata->>'subtotal')::numeric AS subtotal,
  (pricing_metadata->>'extraPersonTotal')::numeric AS extra_person_total,
  (pricing_metadata->>'downpayment')::numeric AS downpayment_calculated,
  pricing_metadata->>'currency' AS currency,
  pricing_metadata->>'calculatedAt' AS pricing_calculated_at,
  created_at
FROM bookings
WHERE pricing_metadata IS NOT NULL;

-- Grant access to view
GRANT SELECT ON booking_pricing_analytics TO authenticated;
GRANT SELECT ON booking_pricing_analytics TO anon;

-- Add comment to view
COMMENT ON VIEW booking_pricing_analytics IS 'Analytics view for booking pricing data with seasonal rates breakdown';