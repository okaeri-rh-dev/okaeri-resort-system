-- Migration: Create discount_rules table (if missing) and update RLS for manager/owner/admin access.
-- Self-contained: safe to run whether or not the table already exists.

-- ============================================
-- 1. CREATE TABLE (idempotent)
-- ============================================
CREATE TABLE IF NOT EXISTS discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage'
        CHECK (discount_type IN ('percentage', 'fixed', 'per_night')),
    discount_value DECIMAL(10, 2) NOT NULL,
    max_discount DECIMAL(10, 2),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_discount_value CHECK (
        discount_value > 0 AND (discount_type != 'percentage' OR discount_value <= 100)
    )
);

-- Indexes (IF NOT EXISTS prevents errors when table already has them)
CREATE INDEX IF NOT EXISTS idx_discount_rules_active ON discount_rules(is_active, priority DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_discount_rules_conditions ON discount_rules USING gin(conditions);

-- ============================================
-- 2. ENABLE RLS (idempotent - no error if already enabled)
-- ============================================
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. SEED default data (only if table is empty)
-- ============================================
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
SELECT name, description, conditions, discount_type, discount_value, priority FROM (
    SELECT 'Week Stay Discount'    AS name, '5% off for 7+ nights'  AS description, '[{"type": "min_nights", "value": 7}]'::JSONB  AS conditions, 'percentage' AS discount_type, 5.00  AS discount_value, 1 AS priority
    UNION ALL
    SELECT 'Two Week Discount',     '10% off for 14+ nights', '[{"type": "min_nights", "value": 14}]'::JSONB, 'percentage', 10.00, 2
    UNION ALL
    SELECT 'Three Week Discount',   '15% off for 21+ nights', '[{"type": "min_nights", "value": 21}]'::JSONB, 'percentage', 15.00, 3
    UNION ALL
    SELECT 'Monthly Stay Discount', '20% off for 28+ nights', '[{"type": "min_nights", "value": 28}]'::JSONB, 'percentage', 20.00, 4
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM discount_rules LIMIT 1);

-- ============================================
-- 4. REPLACE RLS POLICIES for manager/owner/admin access
-- ============================================
-- Drop old restrictive policies (safe even if they don't exist)
DROP POLICY IF EXISTS discount_rules_admin_policy ON discount_rules;
DROP POLICY IF EXISTS discount_rules_select_policy ON discount_rules;
-- Also drop our own in case this migration is re-run
DROP POLICY IF EXISTS discount_rules_public_select_policy ON discount_rules;
DROP POLICY IF EXISTS discount_rules_staff_policy ON discount_rules;

-- Allow anon/public to see active discount rules only (for pricing calculations)
CREATE POLICY discount_rules_public_select_policy ON discount_rules
    FOR SELECT TO anon
    USING (is_active = TRUE);

-- Allow manager, owner, and admin full access (including inactive rules)
CREATE POLICY discount_rules_staff_policy ON discount_rules
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1)
        IN ('manager', 'owner', 'admin')
    )
    WITH CHECK (
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1)
        IN ('manager', 'owner', 'admin')
    );

-- ============================================
-- 5. GRANT permissions
-- ============================================
GRANT SELECT ON discount_rules TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON discount_rules TO authenticated;
GRANT ALL ON discount_rules TO service_role;
