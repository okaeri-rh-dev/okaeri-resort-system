-- Before the needs-action view, nobody checked guests in or out, so past stays are still
-- Confirmed (160 on prod, 2026-11-10). This closes the ones whose check-out day has
-- passed. Stays still in progress stay Confirmed for staff to check in.
--
-- A CheckedOut proof is no longer deleted 90 days after check-out: proofs now live
-- until guest anonymization (anonymize_booking, 24 months) deletes them, so closing
-- these stays deletes no proof files. Cancelled proofs still go after 30 days.
BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_expired_payment_proofs()
RETURNS TABLE(file_path text)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH expired AS (
        SELECT b.booking_id, b.payment_proof_url
        FROM public.bookings b
        WHERE b.payment_proof_url IS NOT NULL
          AND b.booking_status = 'Cancelled'
          AND b.updated_at < NOW() - INTERVAL '30 days'
    ),
    cleared_payments AS (
        UPDATE public.payments p
        SET proof_url = NULL
        FROM expired e
        WHERE p.booking_id = e.booking_id
          AND p.proof_url = e.payment_proof_url
    ),
    cleared_bookings AS (
        UPDATE public.bookings b
        SET payment_proof_url = NULL
        FROM expired e
        WHERE b.booking_id = e.booking_id
        RETURNING e.payment_proof_url
    )
    SELECT regexp_replace(
        split_part(payment_proof_url, '?', 1),
        '^.*/storage/v1/object/(public|sign|authenticated)/payment-proofs/',
        ''
    )
    FROM cleared_bookings;
END;
$$;

-- Runs with no request JWT, so the status rules (docs/adr/0007) do not apply.
UPDATE public.bookings
SET booking_status = 'CheckedOut'
WHERE booking_status = 'Confirmed'
  AND (check_out AT TIME ZONE 'Asia/Manila')::date < (now() AT TIME ZONE 'Asia/Manila')::date;

COMMIT;
