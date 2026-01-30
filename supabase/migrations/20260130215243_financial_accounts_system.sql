-- ============================================
-- Migration 024: Financial Accounts System
-- Description: Add financial accounts tracking with running balances and inter-account transfers
-- Author: Claude AI Assistant
-- Created: 2026-01-30
-- ============================================

BEGIN;

-- ============================================
-- 1. CREATE ACCOUNTS TABLE
-- ============================================
-- Tracks all financial accounts (banks, e-wallets, cash)
CREATE TABLE IF NOT EXISTS accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name VARCHAR(100) NOT NULL,
    account_code VARCHAR(20) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('Bank', 'E-Wallet', 'Cash')),
    description TEXT,
    initial_balance DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT accounts_name_unique UNIQUE (account_name),
    CONSTRAINT accounts_code_unique UNIQUE (account_code),
    CONSTRAINT accounts_initial_balance_positive CHECK (initial_balance >= 0)
);

-- Add index for active accounts (commonly queried)
CREATE INDEX idx_accounts_active ON accounts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_accounts_display_order ON accounts(display_order, account_name);

-- Add updated_at trigger
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE accounts IS 'Financial accounts for tracking money flow (banks, e-wallets, cash)';
COMMENT ON COLUMN accounts.account_code IS 'Short code for the account (e.g., BDO-SAV, GCASH, PETTY)';
COMMENT ON COLUMN accounts.initial_balance IS 'Starting balance when account was added to the system';
COMMENT ON COLUMN accounts.display_order IS 'Order in which accounts appear in UI (lower = first)';

-- ============================================
-- 2. CREATE ACCOUNT_TRANSFERS TABLE
-- ============================================
-- Tracks money transfers between accounts
CREATE TABLE IF NOT EXISTS account_transfers (
    transfer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_reference VARCHAR(20) NOT NULL,
    from_account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    to_account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    amount DECIMAL(12,2) NOT NULL,
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT account_transfers_reference_unique UNIQUE (transfer_reference),
    CONSTRAINT account_transfers_amount_positive CHECK (amount > 0),
    CONSTRAINT account_transfers_different_accounts CHECK (from_account_id != to_account_id)
);

-- Indexes for transfer queries
CREATE INDEX idx_transfers_from_account ON account_transfers(from_account_id);
CREATE INDEX idx_transfers_to_account ON account_transfers(to_account_id);
CREATE INDEX idx_transfers_date ON account_transfers(transfer_date DESC);

COMMENT ON TABLE account_transfers IS 'Records of money transfers between accounts';
COMMENT ON COLUMN account_transfers.transfer_reference IS 'Auto-generated reference (TRF-YYYYMMDD-XXXX)';

-- ============================================
-- 3. ADD ACCOUNT_ID TO PAYMENTS TABLE
-- ============================================
-- First add the column as nullable
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(account_id) ON DELETE RESTRICT;

-- Add index for account-based queries
CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_id);

COMMENT ON COLUMN payments.account_id IS 'Account that received this payment';

-- ============================================
-- 4. ADD ACCOUNT_ID TO EXPENSES TABLE
-- ============================================
-- First add the column as nullable
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(account_id) ON DELETE RESTRICT;

-- Add index for account-based queries
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);

COMMENT ON COLUMN expenses.account_id IS 'Account used to pay this expense';

-- ============================================
-- 5. TRANSFER REFERENCE GENERATOR FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION generate_transfer_reference()
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    random_part TEXT;
    reference TEXT;
    counter INTEGER := 0;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');

    LOOP
        counter := counter + 1;
        random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || counter::TEXT), 1, 4));
        reference := 'TRF-' || date_part || '-' || random_part;

        -- Check if reference exists
        IF NOT EXISTS (SELECT 1 FROM account_transfers WHERE transfer_reference = reference) THEN
            RETURN reference;
        END IF;

        -- Safety: prevent infinite loop (very unlikely)
        IF counter > 100 THEN
            RAISE EXCEPTION 'Could not generate unique transfer reference after 100 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_transfer_reference IS 'Generates unique transfer reference in format TRF-YYYYMMDD-XXXX';

-- ============================================
-- 6. BALANCE CALCULATION FUNCTION
-- ============================================
-- Returns all account balances with component breakdown
CREATE OR REPLACE FUNCTION get_all_account_balances(p_as_of_date TIMESTAMP WITH TIME ZONE DEFAULT NOW())
RETURNS TABLE (
    account_id UUID,
    account_name VARCHAR(100),
    account_code VARCHAR(20),
    account_type VARCHAR(20),
    initial_balance DECIMAL(12,2),
    total_payments DECIMAL(12,2),
    total_expenses DECIMAL(12,2),
    transfers_in DECIMAL(12,2),
    transfers_out DECIMAL(12,2),
    current_balance DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.account_id,
        a.account_name,
        a.account_code,
        a.account_type,
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
    FROM accounts a

    -- Payments received into this account
    LEFT JOIN (
        SELECT p.account_id, SUM(p.amount) AS total
        FROM payments p
        WHERE p.account_id IS NOT NULL
          AND (p.payment_date IS NULL OR p.payment_date <= p_as_of_date)
        GROUP BY p.account_id
    ) pay ON pay.account_id = a.account_id

    -- Expenses paid from this account
    LEFT JOIN (
        SELECT e.account_id, SUM(e.amount) AS total
        FROM expenses e
        WHERE e.account_id IS NOT NULL
          AND (e.expense_date IS NULL OR e.expense_date::TIMESTAMP WITH TIME ZONE <= p_as_of_date)
        GROUP BY e.account_id
    ) exp ON exp.account_id = a.account_id

    -- Transfers received into this account
    LEFT JOIN (
        SELECT t.to_account_id, SUM(t.amount) AS total
        FROM account_transfers t
        WHERE t.transfer_date <= p_as_of_date
        GROUP BY t.to_account_id
    ) trf_in ON trf_in.to_account_id = a.account_id

    -- Transfers sent from this account
    LEFT JOIN (
        SELECT t.from_account_id, SUM(t.amount) AS total
        FROM account_transfers t
        WHERE t.transfer_date <= p_as_of_date
        GROUP BY t.from_account_id
    ) trf_out ON trf_out.from_account_id = a.account_id

    WHERE a.is_active = TRUE
    ORDER BY a.display_order, a.account_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_all_account_balances IS 'Calculate running balances for all active accounts as of a specific date';

-- ============================================
-- 7. SINGLE ACCOUNT BALANCE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_account_balance(
    p_account_id UUID,
    p_as_of_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_balance DECIMAL(12,2);
BEGIN
    SELECT current_balance INTO v_balance
    FROM get_all_account_balances(p_as_of_date)
    WHERE account_id = p_account_id;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_account_balance IS 'Get current balance for a single account';

-- ============================================
-- 8. CREATE LEGACY ACCOUNT FOR MIGRATION
-- ============================================
-- Insert a "Legacy/Unassigned" account for existing payments and expenses
INSERT INTO accounts (
    account_name,
    account_code,
    account_type,
    description,
    initial_balance,
    is_active,
    display_order
) VALUES (
    'Legacy/Unassigned',
    'LEGACY',
    'Cash',
    'Placeholder account for payments and expenses recorded before the accounts system was implemented',
    0,
    TRUE,
    999  -- Show at bottom
) ON CONFLICT (account_code) DO NOTHING;

-- ============================================
-- 9. SEED DEFAULT ACCOUNTS
-- ============================================
-- Insert common accounts for a small resort business in the Philippines
INSERT INTO accounts (account_name, account_code, account_type, description, initial_balance, display_order)
VALUES
    ('BDO Savings', 'BDO-SAV', 'Bank', 'BDO Savings Account for main operations', 0, 1),
    ('BPI Checking', 'BPI-CHK', 'Bank', 'BPI Checking Account for business expenses', 0, 2),
    ('GCash Business', 'GCASH', 'E-Wallet', 'GCash Business Account for digital payments', 0, 3),
    ('Maya Business', 'MAYA', 'E-Wallet', 'Maya (PayMaya) Business Account', 0, 4),
    ('Petty Cash', 'PETTY', 'Cash', 'On-site petty cash for small expenses', 0, 5)
ON CONFLICT (account_code) DO NOTHING;

-- ============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS for new tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to accounts
CREATE POLICY "Authenticated users can view accounts"
    ON accounts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert accounts"
    ON accounts FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update accounts"
    ON accounts FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete accounts"
    ON accounts FOR DELETE
    TO authenticated
    USING (true);

-- Allow authenticated users full access to transfers
CREATE POLICY "Authenticated users can view transfers"
    ON account_transfers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert transfers"
    ON account_transfers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transfers"
    ON account_transfers FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- MIGRATION AUDIT LOG
-- ============================================
INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    description,
    category,
    severity,
    source
) VALUES (
    'INSERT',
    'schema_migrations',
    NULL,
    'Migration 024: Added financial accounts system with accounts table, account_transfers table, and balance calculation functions',
    'SYSTEM',
    'INFO',
    'db'
);

COMMIT;

-- ============================================
-- POST-MIGRATION NOTES
-- ============================================
--
-- After running this migration:
--
-- 1. Update existing payments to use the legacy account:
--    UPDATE payments SET account_id = (SELECT account_id FROM accounts WHERE account_code = 'LEGACY')
--    WHERE account_id IS NULL;
--
-- 2. Update existing expenses to use the legacy account:
--    UPDATE expenses SET account_id = (SELECT account_id FROM accounts WHERE account_code = 'LEGACY')
--    WHERE account_id IS NULL;
--
-- 3. Once all existing records are migrated, make account_id NOT NULL:
--    ALTER TABLE payments ALTER COLUMN account_id SET NOT NULL;
--    ALTER TABLE expenses ALTER COLUMN account_id SET NOT NULL;
--
-- 4. Update the initial_balance for each account to match your actual balances
--    before the system was implemented.
--
-- ============================================
