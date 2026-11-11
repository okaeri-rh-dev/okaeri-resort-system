-- Document numbers and the letterhead move from each device into the database
-- (issue 404, ADR 0008). Each document type counts on its own, and the count
-- restarts each Manila calendar year. Gaps are allowed. Only manager+ may take
-- a number or read and edit the letterhead, like the documents route guard.
-- The 2026 counts start at 0: no real document was issued before this change.

BEGIN;

CREATE TABLE public.document_number_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL CONSTRAINT document_number_sequences_type_check CHECK (
        document_type IN ('quotation', 'invoice')
    ),
    year INTEGER NOT NULL,
    last_number INTEGER NOT NULL CONSTRAINT document_number_sequences_last_number_check CHECK (
        last_number > 0
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_number_sequences_type_year_key UNIQUE (document_type, year)
);

CREATE TRIGGER trg_document_number_sequences_updated_at
    BEFORE UPDATE ON public.document_number_sequences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER audit_document_number_sequences_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.document_number_sequences
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_func();

-- No policies: only the functions below touch the counts.
ALTER TABLE public.document_number_sequences ENABLE ROW LEVEL SECURITY;

-- The upsert takes a row lock, so two calls at the same moment get different numbers.
CREATE FUNCTION public.next_document_number(p_document_type TEXT, p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_number INTEGER;
BEGIN
    INSERT INTO public.document_number_sequences (document_type, year, last_number)
    VALUES (p_document_type, p_year, 1)
    ON CONFLICT (document_type, year)
        DO UPDATE SET last_number = public.document_number_sequences.last_number + 1
    RETURNING last_number INTO v_number;

    -- Prefixes match DOCUMENT_PREFIX_MAP in the app.
    RETURN CASE p_document_type WHEN 'quotation' THEN 'QUO' ELSE 'INV' END
        || '-' || p_year
        || '-' || lpad(v_number::TEXT, GREATEST(4, length(v_number::TEXT)), '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(TEXT, INTEGER) TO service_role;

CREATE FUNCTION public.allocate_document_number(p_document_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can take a document number' USING ERRCODE = '42501';
    END IF;

    RETURN public.next_document_number(
        p_document_type,
        EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Manila')::INTEGER
    );
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_document_number(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_document_number(TEXT) TO authenticated, service_role;

-- One row for the resort. No row yet means the app shows the default letterhead
-- with the active contact channels' phone and email.
CREATE TABLE public.letterhead (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CONSTRAINT letterhead_single_row CHECK (id),
    resort_name TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '',
    -- Matches LOGO_BASE64_MAX_BYTES in the app.
    logo_base64 TEXT NOT NULL DEFAULT '' CONSTRAINT letterhead_logo_size_check CHECK (
        char_length(logo_base64) <= 307200
    ),
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    website TEXT NOT NULL DEFAULT '',
    tin TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_letterhead_updated_at
    BEFORE UPDATE ON public.letterhead
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER audit_letterhead_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.letterhead
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_func();

ALTER TABLE public.letterhead ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view the letterhead"
    ON public.letterhead
    FOR SELECT
    TO authenticated
    USING (public.is_manager_or_above());

CREATE POLICY "Managers can insert the letterhead"
    ON public.letterhead
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_manager_or_above());

CREATE POLICY "Managers can update the letterhead"
    ON public.letterhead
    FOR UPDATE
    TO authenticated
    USING (public.is_manager_or_above())
    WITH CHECK (public.is_manager_or_above());

COMMIT;
