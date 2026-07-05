-- Expense Categories Configuration Table
-- Replaces hardcoded EXPENSE_CATEGORIES array in useExpenseStore.ts
-- Allows managers to create, edit, archive, and restore expense categories via settings UI

-- ============================================
-- TABLE: expense_categories
-- ============================================
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT expense_categories_name_unique UNIQUE (name),
    CONSTRAINT expense_categories_name_not_empty CHECK (char_length(name) >= 1)
);

-- Index for common queries (active categories sorted by display_order)
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON expense_categories (is_active, display_order);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_expense_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expense_categories_updated_at
    BEFORE UPDATE ON expense_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_expense_categories_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read categories (needed for expense form dropdowns)
CREATE POLICY "Authenticated users can view expense categories"
    ON expense_categories
    FOR SELECT
    TO authenticated
    USING (TRUE);

-- Only manager+ can insert expense categories
CREATE POLICY "Managers can insert expense categories"
    ON expense_categories
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

-- Only manager+ can update expense categories
CREATE POLICY "Managers can update expense categories"
    ON expense_categories
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

-- Only manager+ can delete expense categories
CREATE POLICY "Managers can delete expense categories"
    ON expense_categories
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
-- SEED DATA (current hardcoded values from useExpenseStore.ts)
-- ============================================
INSERT INTO expense_categories (name, display_order, is_active)
VALUES
    ('Utilities', 0, TRUE),
    ('Maintenance & Repairs', 1, TRUE),
    ('Supplies & Inventory', 2, TRUE),
    ('Staff & Payroll', 3, TRUE),
    ('Marketing & Advertising', 4, TRUE),
    ('Food & Beverage', 5, TRUE),
    ('Cleaning & Laundry', 6, TRUE),
    ('Insurance & Permits', 7, TRUE),
    ('Professional Services', 8, TRUE),
    ('Other', 9, TRUE);
