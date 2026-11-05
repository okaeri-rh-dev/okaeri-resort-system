-- Role-based access for the payment-proofs and receipts buckets and seasonal_rates,
-- and drop booking_pricing_analytics (no security_invoker, granted to anon, unused).
-- Sign-up is open, so "authenticated" alone admits users awaiting approval.

-- ============================================
-- storage.objects — SELECT/INSERT staff+, UPDATE/DELETE manager+
-- Guest uploads use signed upload URLs, which storage runs with elevated rights.
-- ============================================
DROP POLICY IF EXISTS "Allow uploads via signed URLs" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1lnm9mj_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1lnm9mj_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1lnm9mj_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1lnm9mj_3" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder w1pnpy_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder w1pnpy_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder w1pnpy_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder w1pnpy_3" ON storage.objects;

DROP POLICY IF EXISTS "Staff can read proofs and receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload proofs and receipts" ON storage.objects;
DROP POLICY IF EXISTS "Managers can update proofs and receipts" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete proofs and receipts" ON storage.objects;

CREATE POLICY "Staff can read proofs and receipts" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id IN ('payment-proofs', 'receipts') AND public.is_staff_or_above());

CREATE POLICY "Staff can upload proofs and receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('payment-proofs', 'receipts') AND public.is_staff_or_above());

CREATE POLICY "Managers can update proofs and receipts" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id IN ('payment-proofs', 'receipts') AND public.is_manager_or_above())
    WITH CHECK (bucket_id IN ('payment-proofs', 'receipts') AND public.is_manager_or_above());

CREATE POLICY "Managers can delete proofs and receipts" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id IN ('payment-proofs', 'receipts') AND public.is_manager_or_above());

-- ============================================
-- seasonal_rates — SELECT staff+, writes manager+ (matches discount_rules).
-- The table is absent on prod (schema drift), so skip it there.
-- ============================================
DO $$
BEGIN
    IF to_regclass('public.seasonal_rates') IS NULL THEN
        RAISE NOTICE 'public.seasonal_rates not found, skipped';
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "Authenticated users can view seasonal rates" ON public.seasonal_rates;
    DROP POLICY IF EXISTS "Authenticated users can insert seasonal rates" ON public.seasonal_rates;
    DROP POLICY IF EXISTS "Authenticated users can update seasonal rates" ON public.seasonal_rates;
    DROP POLICY IF EXISTS "Authenticated users can delete seasonal rates" ON public.seasonal_rates;
    DROP POLICY IF EXISTS seasonal_rates_staff_select ON public.seasonal_rates;
    DROP POLICY IF EXISTS seasonal_rates_manager_write ON public.seasonal_rates;

    CREATE POLICY seasonal_rates_staff_select ON public.seasonal_rates
        FOR SELECT TO authenticated
        USING (public.is_staff_or_above());

    CREATE POLICY seasonal_rates_manager_write ON public.seasonal_rates
        FOR ALL TO authenticated
        USING (public.is_manager_or_above())
        WITH CHECK (public.is_manager_or_above());
END;
$$;

DROP VIEW IF EXISTS public.booking_pricing_analytics;
