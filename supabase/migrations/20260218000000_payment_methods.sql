-- Payment Methods Configuration Table
-- Replaces hardcoded payment details in guest booking and confirmation components
-- Allows admins to manage payment methods (GCash, BDO, etc.) via settings UI

-- ============================================
-- TABLE: payment_methods
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method_type VARCHAR(30) NOT NULL CHECK (method_type IN ('e-wallet', 'bank-transfer', 'cash', 'other')),
    provider_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    account_name VARCHAR(150),
    account_number VARCHAR(100),
    bank_name VARCHAR(100),
    qr_code_url TEXT,
    qr_code_storage_path TEXT,
    icon_name VARCHAR(50) DEFAULT 'CreditCard',
    icon_color VARCHAR(30) DEFAULT 'text-gray-600',
    display_order INTEGER DEFAULT 0,
    instructions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods (is_active, display_order);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_methods_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) can read active payment methods
-- This is needed because the guest booking page is unauthenticated
CREATE POLICY "Anyone can view active payment methods"
    ON payment_methods
    FOR SELECT
    USING (is_active = TRUE);

-- Authenticated users with manager+ role can view ALL methods (including inactive)
-- Uses the app_roles table to check role level
CREATE POLICY "Managers can view all payment methods"
    ON payment_methods
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE app_roles.user_id = auth.uid()
            AND app_roles.is_active = TRUE
            AND app_roles.role IN ('manager', 'owner', 'admin')
        )
    );

-- Only manager+ can insert payment methods
CREATE POLICY "Managers can insert payment methods"
    ON payment_methods
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE app_roles.user_id = auth.uid()
            AND app_roles.is_active = TRUE
            AND app_roles.role IN ('manager', 'owner', 'admin')
        )
    );

-- Only manager+ can update payment methods
CREATE POLICY "Managers can update payment methods"
    ON payment_methods
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE app_roles.user_id = auth.uid()
            AND app_roles.is_active = TRUE
            AND app_roles.role IN ('manager', 'owner', 'admin')
        )
    );

-- Only manager+ can delete payment methods
CREATE POLICY "Managers can delete payment methods"
    ON payment_methods
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE app_roles.user_id = auth.uid()
            AND app_roles.is_active = TRUE
            AND app_roles.role IN ('manager', 'owner', 'admin')
        )
    );

-- ============================================
-- SEED DATA (current hardcoded values)
-- ============================================
INSERT INTO payment_methods (method_type, provider_name, display_name, account_name, account_number, bank_name, icon_name, icon_color, display_order, is_active)
VALUES
    ('e-wallet', 'GCash', 'GCash', 'Okaeri Resort', '0917-123-4567', NULL, 'Smartphone', 'text-blue-600', 0, TRUE),
    ('bank-transfer', 'BDO', 'BDO Bank Transfer', 'Okaeri Resort', '1234-5678-9012', 'BDO Savings', 'Building2', 'text-blue-800', 1, TRUE);

-- ============================================
-- STORAGE BUCKET for QR codes
-- ============================================
-- Note: Storage bucket creation is done via Supabase Dashboard or CLI
-- Run: supabase storage create payment-methods --public
-- The bucket should be public so QR code images are accessible on the guest booking page
