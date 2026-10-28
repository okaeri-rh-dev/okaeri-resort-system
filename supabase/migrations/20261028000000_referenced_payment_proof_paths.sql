-- Payment-proof files that a booking or payment still links to, as bucket paths.
-- The weekly cleanup-payment-proofs cron deletes old TEMP- uploads that are not in this set
-- (issue 93); Postgres cannot delete storage objects, so the compare and delete run in the Worker.
CREATE OR REPLACE FUNCTION public.referenced_payment_proof_paths()
RETURNS TABLE(file_path text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT DISTINCT public._payment_proof_path(s.url)
    FROM (
        SELECT b.payment_proof_url AS url FROM public.bookings b
        UNION ALL
        SELECT p.proof_url FROM public.payments p
    ) s
    WHERE s.url IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.referenced_payment_proof_paths() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referenced_payment_proof_paths() TO service_role;
