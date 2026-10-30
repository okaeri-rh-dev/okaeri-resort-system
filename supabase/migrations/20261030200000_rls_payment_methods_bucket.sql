-- Only managers and above can change the payment QR codes; guests still read them.
-- The prod "Auth ..." policies were dashboard-created and admitted any authenticated
-- user, including self-signed-up users awaiting approval.

-- The bucket was created by hand on prod; create it here for local and fresh databases.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-methods', 'payment-methods', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read payment-methods" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload payment-methods" ON storage.objects;
DROP POLICY IF EXISTS "Auth update payment-methods" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete payment-methods" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can read payment methods" ON storage.objects;
DROP POLICY IF EXISTS "Managers can upload payment methods" ON storage.objects;
DROP POLICY IF EXISTS "Managers can update payment methods" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete payment methods" ON storage.objects;

CREATE POLICY "Anyone can read payment methods" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'payment-methods');

CREATE POLICY "Managers can upload payment methods" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payment-methods' AND public.is_manager_or_above());

CREATE POLICY "Managers can update payment methods" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'payment-methods' AND public.is_manager_or_above())
    WITH CHECK (bucket_id = 'payment-methods' AND public.is_manager_or_above());

CREATE POLICY "Managers can delete payment methods" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'payment-methods' AND public.is_manager_or_above());
