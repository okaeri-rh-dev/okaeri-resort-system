-- Guest statistics run as the function owner. Only managers and above may
-- update guests, so a staff cancel or check-out matched 0 guest rows and left
-- total_bookings and total_spent stale. Moving a booking to another guest now
-- recomputes the old guest too.
--
-- Account balances compare Manila calendar days. Payment dates are stored as
-- noon Manila and expense dates read as 08:00 Manila, so a payment recorded at
-- 09:00 did not count until 12:00.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_guest_statistics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_guest_id uuid;
BEGIN
    -- OLD is NULL on INSERT and NEW is NULL on DELETE.
    FOR v_guest_id IN
        SELECT DISTINCT id FROM unnest(ARRAY[OLD.guest_id, NEW.guest_id]) AS id
        WHERE id IS NOT NULL
    LOOP
        UPDATE public.guests
        SET
            total_bookings = (
                SELECT COUNT(*) FROM public.bookings
                WHERE guest_id = v_guest_id
                  AND booking_status NOT IN ('Cancelled', 'NoShow')
            ),
            total_spent = (
                SELECT COALESCE(SUM(total_amount), 0) FROM public.bookings
                WHERE guest_id = v_guest_id
                  AND booking_status NOT IN ('Cancelled', 'NoShow')
            ),
            updated_at = NOW()
        WHERE guest_id = v_guest_id;
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_account_balances(p_as_of_date timestamp with time zone DEFAULT now())
 RETURNS TABLE(
    account_id uuid,
    account_name character varying,
    account_code character varying,
    account_type character varying,
    description text,
    is_active boolean,
    display_order integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    initial_balance numeric,
    total_payments numeric,
    total_expenses numeric,
    transfers_in numeric,
    transfers_out numeric,
    current_balance numeric
 )
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
    v_as_of_day date := (p_as_of_date AT TIME ZONE 'Asia/Manila')::date;
BEGIN
    RETURN QUERY
    SELECT
        a.account_id,
        a.account_name,
        a.account_code,
        a.account_type,
        a.description,
        COALESCE(a.is_active, TRUE) AS is_active,
        COALESCE(a.display_order, 0) AS display_order,
        a.created_at,
        a.updated_at,
        COALESCE(a.initial_balance, 0)::DECIMAL(12,2) AS initial_balance,
        COALESCE(pay.total, 0)::DECIMAL(12,2) AS total_payments,
        COALESCE(exp.total, 0)::DECIMAL(12,2) AS total_expenses,
        COALESCE(trf_in.total, 0)::DECIMAL(12,2) AS transfers_in,
        COALESCE(trf_out.total, 0)::DECIMAL(12,2) AS transfers_out,
        (
            COALESCE(a.initial_balance, 0) +
            COALESCE(pay.total, 0) -
            COALESCE(exp.total, 0) +
            COALESCE(trf_in.total, 0) -
            COALESCE(trf_out.total, 0)
        )::DECIMAL(12,2) AS current_balance
    FROM public.accounts a
    LEFT JOIN (
        SELECT p.account_id, SUM(p.amount) AS total
        FROM public.payments p
        WHERE p.account_id IS NOT NULL
          AND p.status = 'Active'
          AND (p.payment_date IS NULL OR (p.payment_date AT TIME ZONE 'Asia/Manila')::date <= v_as_of_day)
        GROUP BY p.account_id
    ) pay ON pay.account_id = a.account_id
    LEFT JOIN (
        SELECT e.account_id, SUM(e.amount) AS total
        FROM public.expenses e
        WHERE e.account_id IS NOT NULL
          AND (e.expense_date IS NULL OR e.expense_date <= v_as_of_day)
        GROUP BY e.account_id
    ) exp ON exp.account_id = a.account_id
    LEFT JOIN (
        SELECT t.to_account_id, SUM(t.amount) AS total
        FROM public.account_transfers t
        WHERE (t.transfer_date AT TIME ZONE 'Asia/Manila')::date <= v_as_of_day
        GROUP BY t.to_account_id
    ) trf_in ON trf_in.to_account_id = a.account_id
    LEFT JOIN (
        SELECT t.from_account_id, SUM(t.amount) AS total
        FROM public.account_transfers t
        WHERE (t.transfer_date AT TIME ZONE 'Asia/Manila')::date <= v_as_of_day
        GROUP BY t.from_account_id
    ) trf_out ON trf_out.from_account_id = a.account_id
    ORDER BY a.display_order, a.account_name;
END;
$function$;

COMMIT;
