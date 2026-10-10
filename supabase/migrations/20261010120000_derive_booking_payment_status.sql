-- Booking payment status is derived from the booking's payments
-- (docs/adr/0001-booking-payment-status-derived-in-database.md).
-- Active payments count toward the total; Deleted payments never count;
-- a booking whose payments were all refunded is Refunded.

CREATE OR REPLACE FUNCTION public.derive_booking_payment_status(p_booking_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN paid.active_total = 0 AND paid.refunded_count > 0 THEN 'Refunded'
    WHEN paid.active_total = 0 THEN 'Pending'
    WHEN paid.active_total < b.total_amount THEN 'Partial'
    ELSE 'Completed'
  END
  FROM public.bookings b
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Active'), 0) AS active_total,
      COUNT(*) FILTER (WHERE p.status = 'Refunded') AS refunded_count
    FROM public.payments p
    WHERE p.booking_id = b.booking_id
  ) paid
  WHERE b.booking_id = p_booking_id;
$function$;

-- Writes only when the status changes, so the audit trigger records real changes only.
CREATE OR REPLACE FUNCTION public.refresh_booking_payment_status(p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_status text := public.derive_booking_payment_status(p_booking_id);
BEGIN
    UPDATE public.bookings
    SET payment_status = v_status
    WHERE booking_id = p_booking_id
      AND payment_status IS DISTINCT FROM v_status;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.derive_booking_payment_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_booking_payment_status(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.payments_refresh_booking_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.booking_id IS NOT NULL THEN
        PERFORM public.refresh_booking_payment_status(OLD.booking_id);
    END IF;

    IF TG_OP = 'INSERT' AND NEW.booking_id IS NOT NULL
       OR TG_OP = 'UPDATE' AND NEW.booking_id IS DISTINCT FROM OLD.booking_id AND NEW.booking_id IS NOT NULL THEN
        PERFORM public.refresh_booking_payment_status(NEW.booking_id);
    END IF;

    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bookings_refresh_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    PERFORM public.refresh_booking_payment_status(NEW.booking_id);
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS refresh_booking_payment_status ON public.payments;
CREATE TRIGGER refresh_booking_payment_status
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.payments_refresh_booking_payment_status();

-- The refresh writes only payment_status, so this cannot re-fire itself.
DROP TRIGGER IF EXISTS refresh_payment_status_on_total_change ON public.bookings;
CREATE TRIGGER refresh_payment_status_on_total_change
    AFTER UPDATE OF total_amount ON public.bookings
    FOR EACH ROW
    WHEN (OLD.total_amount IS DISTINCT FROM NEW.total_amount)
    EXECUTE FUNCTION public.bookings_refresh_payment_status();

-- Backfill: bring every booking in line with its payments.
UPDATE public.bookings b
SET payment_status = public.derive_booking_payment_status(b.booking_id)
WHERE b.payment_status IS DISTINCT FROM public.derive_booking_payment_status(b.booking_id);
