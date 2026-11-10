-- Verify payment in one step (issue 336): record the online downpayment, assign the
-- cabins and confirm, all or nothing. Manager and above only. The booking row lock in
-- assign_units_to_booking makes a second concurrent call find no pending booking and fail.
-- Overlaps and blocked nights are refused by the booking_unit_availability insert.
BEGIN;

CREATE OR REPLACE FUNCTION public.verify_and_confirm_booking(p_booking_id uuid, p_unit_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
BEGIN
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can verify a payment' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE booking_id = p_booking_id
      AND is_guest_booking
      AND booking_status = 'Pending'
      AND unit_assignment_status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found or already confirmed', p_booking_id
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.payments WHERE booking_id = p_booking_id AND status = 'Active'
    ) THEN
        IF v_booking.downpayment_required IS NULL THEN
            RAISE EXCEPTION 'Booking % has no downpayment to record', p_booking_id;
        END IF;

        INSERT INTO public.payments (
            booking_id, amount, payment_method, proof_url, status, kind, notes
        ) VALUES (
            p_booking_id, v_booking.downpayment_required, v_booking.payment_method,
            v_booking.payment_proof_url, 'Active', 'online_downpayment', 'Online booking downpayment'
        );
    END IF;

    PERFORM public.assign_units_to_booking(p_booking_id, p_unit_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_confirm_booking(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_and_confirm_booking(uuid, uuid[]) TO authenticated, service_role;

COMMIT;
