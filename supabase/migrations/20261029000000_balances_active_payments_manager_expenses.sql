-- Account balances count only Active payments, the same rule that derives
-- booking payment status (ADR 0001). Deleted and Refunded payments no longer
-- raise a balance.
--
-- No guest needs account balances, so anon loses EXECUTE on both balance
-- functions. Functions grant EXECUTE to PUBLIC by default, so PUBLIC is revoked too.
--
-- Managers can read, add and edit expenses; delete stays owner+. Until now RLS
-- was owner+ for all four, so managers saw an empty Expenses page, and their
-- account balances left expenses out (get_all_account_balances runs as the caller).

BEGIN;

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
          AND (p.payment_date IS NULL OR p.payment_date <= p_as_of_date)
        GROUP BY p.account_id
    ) pay ON pay.account_id = a.account_id
    LEFT JOIN (
        SELECT e.account_id, SUM(e.amount) AS total
        FROM public.expenses e
        WHERE e.account_id IS NOT NULL
          AND (e.expense_date IS NULL OR e.expense_date::TIMESTAMP WITH TIME ZONE <= p_as_of_date)
        GROUP BY e.account_id
    ) exp ON exp.account_id = a.account_id
    LEFT JOIN (
        SELECT t.to_account_id, SUM(t.amount) AS total
        FROM public.account_transfers t
        WHERE t.transfer_date <= p_as_of_date
        GROUP BY t.to_account_id
    ) trf_in ON trf_in.to_account_id = a.account_id
    LEFT JOIN (
        SELECT t.from_account_id, SUM(t.amount) AS total
        FROM public.account_transfers t
        WHERE t.transfer_date <= p_as_of_date
        GROUP BY t.from_account_id
    ) trf_out ON trf_out.from_account_id = a.account_id
    ORDER BY a.display_order, a.account_name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_all_account_balances(timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_account_balances(timestamp with time zone) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_account_balance(uuid, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_account_balance(uuid, timestamp with time zone) TO authenticated, service_role;

DROP POLICY IF EXISTS "expenses_select_owner" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_owner" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_owner" ON public.expenses;

CREATE POLICY "expenses_select_manager" ON public.expenses
    FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "expenses_insert_manager" ON public.expenses
    FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "expenses_update_manager" ON public.expenses
    FOR UPDATE TO authenticated USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());

COMMIT;
