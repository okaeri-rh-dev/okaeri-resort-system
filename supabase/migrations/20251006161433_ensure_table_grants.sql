-- ============================================
-- ENSURE TABLE GRANTS ARE PROPERLY APPLIED
-- ============================================
-- Purpose: Ensure authenticated role has proper table permissions
-- Issue: Previous migrations had grants but they weren't applied correctly
-- This migration explicitly grants permissions to ensure RLS works
-- ============================================

-- Grant permissions to authenticated role for all main tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.maintenance_logs TO authenticated;

-- Grant sequence usage (needed for auto-incrementing IDs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Optional: Grant to service_role for admin operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
