-- Contact channels: the ways a guest can reach the resort (see GLOSSARY.md).
-- Shown to guests on the root page notice and the booking confirmation page,
-- managed by manager+ on the admin Settings page. No real values are seeded
-- here; the owner enters them in production. Fake rows live in seed.sql.
--
-- Stored values: phone kinds hold +639XXXXXXXXX, messenger/facebook/instagram
-- hold a bare handle, email holds the address. The app normalizes on save.

BEGIN;

CREATE TABLE public.contact_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CONSTRAINT contact_channels_kind_check CHECK (
        kind IN ('mobile', 'viber', 'whatsapp', 'messenger', 'email', 'facebook', 'instagram')
    ),
    value TEXT NOT NULL CONSTRAINT contact_channels_value_check CHECK (
        char_length(value) BETWEEN 1 AND 254
    ),
    label TEXT CONSTRAINT contact_channels_label_check CHECK (char_length(label) <= 40),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contact_channels_kind_value_key UNIQUE (kind, value)
);

CREATE INDEX idx_contact_channels_active ON public.contact_channels (is_active, display_order);

CREATE TRIGGER trg_contact_channels_updated_at
    BEFORE UPDATE ON public.contact_channels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER audit_contact_channels_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.contact_channels
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_func();

ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active contact channels"
    ON public.contact_channels
    FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE);

CREATE POLICY "Managers can view all contact channels"
    ON public.contact_channels
    FOR SELECT
    TO authenticated
    USING (public.is_manager_or_above());

CREATE POLICY "Managers can insert contact channels"
    ON public.contact_channels
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_manager_or_above());

CREATE POLICY "Managers can update contact channels"
    ON public.contact_channels
    FOR UPDATE
    TO authenticated
    USING (public.is_manager_or_above())
    WITH CHECK (public.is_manager_or_above());

CREATE POLICY "Managers can delete contact channels"
    ON public.contact_channels
    FOR DELETE
    TO authenticated
    USING (public.is_manager_or_above());

COMMIT;
