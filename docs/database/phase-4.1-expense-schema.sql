-- ================================================================
-- PHASE 4.1: EXPENSE TRACKING DATABASE SCHEMA
-- Philippine Compliance-Ready Financial Management System
-- ================================================================
-- 
-- This schema design implements comprehensive expense tracking with:
-- - Philippine BIR (Bureau of Internal Revenue) compliance
-- - Multi-tenant isolation via project_id
-- - 5-year audit trail retention capability
-- - VAT and withholding tax support
-- - Immutable audit logging
-- 
-- All monetary amounts use DECIMAL(12,2) for Philippine Peso precision
-- Tax rates use DECIMAL(5,4) for accuracy (e.g., 12.0000% VAT)
-- ================================================================

-- ================================================================
-- 1. EXPENSE CATEGORIES TABLE
-- ================================================================
-- BIR-compliant expense categories with budget tracking
-- Based on Philippine Chart of Accounts for small businesses
-- ================================================================

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    
    -- Category Information
    code VARCHAR(20) NOT NULL,                    -- BIR category code (e.g., "5001", "6001")
    name VARCHAR(100) NOT NULL,                   -- Category name
    description TEXT,                              -- Detailed description
    parent_category_id UUID REFERENCES expense_categories(id),  -- For sub-categories
    
    -- Budget Management
    monthly_budget DECIMAL(12,2),                 -- Monthly budget allocation
    quarterly_budget DECIMAL(12,2),               -- Quarterly budget allocation
    annual_budget DECIMAL(12,2),                  -- Annual budget allocation
    
    -- Tax Configuration
    vat_applicable BOOLEAN DEFAULT true,          -- Subject to 12% VAT
    withholding_tax_rate DECIMAL(5,4),           -- EWT rate if applicable (1%, 2%, 5%, 10%, 15%)
    is_capital BOOLEAN DEFAULT false,             -- Capital/asset expense flag
    depreciation_years INTEGER,                   -- For capital expenses
    
    -- Configuration
    requires_approval BOOLEAN DEFAULT false,      -- Requires manager approval
    approval_threshold DECIMAL(12,2),            -- Amount threshold for approval
    is_active BOOLEAN DEFAULT true,              -- Soft delete flag
    display_order INTEGER DEFAULT 0,             -- UI display ordering
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,                    -- References users.id
    updated_by UUID,                             -- References users.id
    
    -- Constraints
    CONSTRAINT unique_category_code_per_project UNIQUE (project_id, code),
    CONSTRAINT valid_withholding_rate CHECK (
        withholding_tax_rate IS NULL OR 
        withholding_tax_rate IN (0.01, 0.02, 0.05, 0.10, 0.15)
    ),
    CONSTRAINT valid_depreciation CHECK (
        (is_capital = false AND depreciation_years IS NULL) OR
        (is_capital = true AND depreciation_years > 0)
    )
);

-- Indexes for category queries
CREATE INDEX idx_expense_categories_project ON expense_categories(project_id);
CREATE INDEX idx_expense_categories_parent ON expense_categories(parent_category_id);
CREATE INDEX idx_expense_categories_active ON expense_categories(project_id, is_active) WHERE is_active = true;

-- ================================================================
-- 2. VENDORS TABLE
-- ================================================================
-- Supplier/vendor management with Philippine tax requirements
-- ================================================================

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    
    -- Vendor Information
    vendor_code VARCHAR(50) NOT NULL,            -- Internal vendor code
    name VARCHAR(200) NOT NULL,                  -- Legal business name
    trade_name VARCHAR(200),                     -- DBA/trade name
    
    -- Tax Information (Philippine Requirements)
    tin VARCHAR(20),                             -- TIN format: XXX-XXX-XXX-XXX
    is_vat_registered BOOLEAN DEFAULT false,     -- VAT registration status
    withholding_tax_type VARCHAR(20),           -- 'EWT', 'CWT', 'NONE'
    withholding_tax_rate DECIMAL(5,4),          -- Applicable withholding rate
    
    -- Contact Information
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    barangay VARCHAR(100),                      -- Philippine address component
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),
    country VARCHAR(50) DEFAULT 'Philippines',
    
    -- Communication
    contact_person VARCHAR(200),
    email VARCHAR(255),
    phone_primary VARCHAR(50),
    phone_secondary VARCHAR(50),
    
    -- Payment Terms
    payment_terms INTEGER DEFAULT 30,           -- Days (e.g., 30 = Net 30)
    payment_method VARCHAR(50),                 -- 'CASH', 'CHECK', 'BANK_TRANSFER', 'GCASH'
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(200),
    gcash_number VARCHAR(20),                   -- GCash business number
    
    -- Financial Settings
    credit_limit DECIMAL(12,2),
    current_balance DECIMAL(12,2) DEFAULT 0,
    total_purchases_ytd DECIMAL(12,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',        -- 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED'
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID,
    
    -- Constraints
    CONSTRAINT unique_vendor_code_per_project UNIQUE (project_id, vendor_code),
    CONSTRAINT unique_vendor_tin_per_project UNIQUE (project_id, tin),
    CONSTRAINT valid_tin_format CHECK (
        tin IS NULL OR 
        tin ~ '^\d{3}-\d{3}-\d{3}-\d{3}$'
    ),
    CONSTRAINT valid_withholding_type CHECK (
        withholding_tax_type IS NULL OR 
        withholding_tax_type IN ('EWT', 'CWT', 'NONE')
    )
);

-- Indexes for vendor queries
CREATE INDEX idx_vendors_project ON vendors(project_id);
CREATE INDEX idx_vendors_status ON vendors(project_id, status) WHERE is_active = true;
CREATE INDEX idx_vendors_tin ON vendors(tin) WHERE tin IS NOT NULL;
CREATE INDEX idx_vendors_name_search ON vendors(project_id, name);

-- ================================================================
-- 3. EXPENSES TABLE
-- ================================================================
-- Main expense records with complete financial tracking
-- ================================================================

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    
    -- Expense Identification
    expense_number VARCHAR(50) NOT NULL,         -- Format: EXP-YYYY-MM-XXXXX
    reference_number VARCHAR(100),               -- External reference (invoice, receipt)
    
    -- Financial Information
    category_id UUID NOT NULL REFERENCES expense_categories(id),
    vendor_id UUID REFERENCES vendors(id),
    amount DECIMAL(12,2) NOT NULL,              -- Base amount before tax
    
    -- Tax Calculations (Philippine Requirements)
    vat_amount DECIMAL(12,2) DEFAULT 0,         -- 12% VAT
    vat_type VARCHAR(20) DEFAULT 'VAT_INCLUSIVE', -- 'VAT_INCLUSIVE', 'VAT_EXCLUSIVE', 'VAT_EXEMPT', 'ZERO_RATED'
    withholding_tax_amount DECIMAL(12,2) DEFAULT 0,  -- EWT/CWT amount
    withholding_tax_rate DECIMAL(5,4),          -- Applied withholding rate
    net_amount DECIMAL(12,2) NOT NULL,          -- Total amount after all calculations
    
    -- Expense Details
    expense_date DATE NOT NULL,                 -- Transaction date
    description TEXT NOT NULL,                  -- Detailed description
    payment_method VARCHAR(50),                 -- 'CASH', 'CHECK', 'BANK_TRANSFER', 'CREDIT_CARD', 'GCASH', 'PETTY_CASH'
    payment_reference VARCHAR(100),             -- Check number, transfer reference, etc.
    
    -- Receipt Information (BIR Requirements)
    receipt_type VARCHAR(50),                   -- 'OFFICIAL_RECEIPT', 'SALES_INVOICE', 'CASH_INVOICE', 'PROVISIONAL', 'ACKNOWLEDGEMENT'
    receipt_number VARCHAR(100),                -- Official receipt/invoice number
    receipt_date DATE,                          -- Date on receipt (may differ from expense_date)
    
    -- Status and Workflow
    status VARCHAR(20) DEFAULT 'DRAFT',         -- 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED'
    approval_status VARCHAR(20),                -- 'NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'
    approval_level VARCHAR(20),                 -- 'AUTO', 'MANAGER', 'OWNER'
    approved_by UUID,                           -- References users.id
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Payment Tracking
    is_paid BOOLEAN DEFAULT false,
    paid_date DATE,
    paid_amount DECIMAL(12,2),
    payment_batch_id VARCHAR(50),               -- For batch payment processing
    
    -- Recurring Expense Support
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(20),             -- 'MONTHLY', 'QUARTERLY', 'ANNUALLY'
    recurrence_end_date DATE,
    parent_expense_id UUID REFERENCES expenses(id),  -- Link to original recurring expense
    
    -- Additional Metadata
    cost_center VARCHAR(50),                    -- Department/area allocation
    project_allocation VARCHAR(100),            -- Specific project/event allocation
    tags TEXT[],                                -- Flexible tagging system
    notes TEXT,                                 -- Internal notes
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID,
    
    -- Immutability for approved expenses
    locked_at TIMESTAMPTZ,                      -- Timestamp when expense becomes immutable
    locked_by UUID,                             -- User who locked the record
    
    -- Constraints
    CONSTRAINT unique_expense_number_per_project UNIQUE (project_id, expense_number),
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_vat_amount CHECK (vat_amount >= 0),
    CONSTRAINT valid_withholding_amount CHECK (withholding_tax_amount >= 0),
    CONSTRAINT valid_net_amount CHECK (net_amount > 0),
    CONSTRAINT valid_status CHECK (
        status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED')
    ),
    CONSTRAINT valid_vat_type CHECK (
        vat_type IN ('VAT_INCLUSIVE', 'VAT_EXCLUSIVE', 'VAT_EXEMPT', 'ZERO_RATED')
    ),
    CONSTRAINT valid_payment_method CHECK (
        payment_method IS NULL OR
        payment_method IN ('CASH', 'CHECK', 'BANK_TRANSFER', 'CREDIT_CARD', 'GCASH', 'PETTY_CASH')
    ),
    CONSTRAINT valid_receipt_type CHECK (
        receipt_type IS NULL OR
        receipt_type IN ('OFFICIAL_RECEIPT', 'SALES_INVOICE', 'CASH_INVOICE', 'PROVISIONAL', 'ACKNOWLEDGEMENT')
    ),
    CONSTRAINT immutable_when_locked CHECK (
        locked_at IS NULL OR status IN ('APPROVED', 'PAID')
    )
);

-- Indexes for expense queries
CREATE INDEX idx_expenses_project ON expenses(project_id);
CREATE INDEX idx_expenses_date ON expenses(project_id, expense_date DESC);
CREATE INDEX idx_expenses_status ON expenses(project_id, status);
CREATE INDEX idx_expenses_vendor ON expenses(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_approval ON expenses(project_id, approval_status) WHERE approval_status = 'PENDING';
CREATE INDEX idx_expenses_unpaid ON expenses(project_id, is_paid) WHERE is_paid = false;
CREATE INDEX idx_expenses_recurring ON expenses(project_id, is_recurring) WHERE is_recurring = true;
CREATE INDEX idx_expenses_month ON expenses(project_id, DATE_TRUNC('month', expense_date));

-- Partial index for active expenses
CREATE INDEX idx_expenses_active ON expenses(project_id, expense_date DESC) 
WHERE status NOT IN ('CANCELLED', 'REJECTED');

-- ================================================================
-- 4. EXPENSE_ATTACHMENTS TABLE
-- ================================================================
-- Document storage for receipts and supporting documents
-- ================================================================

CREATE TABLE expense_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,                   -- Denormalized for query performance
    
    -- File Information
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,                     -- Cloud storage URL
    file_size INTEGER NOT NULL,                 -- Size in bytes
    file_type VARCHAR(50) NOT NULL,            -- MIME type
    thumbnail_url TEXT,                         -- Thumbnail for images
    
    -- Document Classification
    document_type VARCHAR(50) NOT NULL,         -- 'RECEIPT', 'INVOICE', 'CONTRACT', 'APPROVAL', 'OTHER'
    is_primary BOOLEAN DEFAULT false,           -- Primary receipt/document
    
    -- OCR Data (for automated extraction)
    ocr_status VARCHAR(20) DEFAULT 'PENDING',   -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    ocr_extracted_text TEXT,                    -- Full extracted text
    ocr_extracted_amount DECIMAL(12,2),         -- Extracted amount
    ocr_extracted_date DATE,                    -- Extracted date
    ocr_extracted_vendor VARCHAR(200),          -- Extracted vendor name
    ocr_extracted_receipt_number VARCHAR(100),  -- Extracted receipt number
    ocr_confidence_score DECIMAL(3,2),          -- OCR confidence (0.00 to 1.00)
    ocr_processed_at TIMESTAMPTZ,
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,          -- Manual verification flag
    verified_by UUID,                           -- References users.id
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    
    -- Audit Fields
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    uploaded_by UUID NOT NULL,                  -- References users.id
    deleted_at TIMESTAMPTZ,                     -- Soft delete
    deleted_by UUID,
    
    -- Constraints
    CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 10485760), -- Max 10MB
    CONSTRAINT valid_document_type CHECK (
        document_type IN ('RECEIPT', 'INVOICE', 'CONTRACT', 'APPROVAL', 'OTHER')
    ),
    CONSTRAINT valid_ocr_status CHECK (
        ocr_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
    ),
    CONSTRAINT valid_ocr_confidence CHECK (
        ocr_confidence_score IS NULL OR 
        (ocr_confidence_score >= 0 AND ocr_confidence_score <= 1)
    )
);

-- Indexes for attachment queries
CREATE INDEX idx_expense_attachments_expense ON expense_attachments(expense_id);
CREATE INDEX idx_expense_attachments_project ON expense_attachments(project_id);
CREATE INDEX idx_expense_attachments_primary ON expense_attachments(expense_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_expense_attachments_ocr ON expense_attachments(ocr_status) WHERE ocr_status = 'PENDING';

-- ================================================================
-- 5. EXPENSE_APPROVALS TABLE
-- ================================================================
-- Approval workflow and history tracking
-- ================================================================

CREATE TABLE expense_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,                   -- Denormalized for query performance
    
    -- Approval Details
    approval_level VARCHAR(20) NOT NULL,        -- 'MANAGER', 'OWNER', 'FINANCE'
    approval_sequence INTEGER NOT NULL,         -- Order in approval chain
    
    -- Approver Information
    approver_id UUID NOT NULL,                  -- References users.id
    approver_role VARCHAR(50) NOT NULL,         -- Role at time of approval
    
    -- Decision
    decision VARCHAR(20),                       -- 'APPROVED', 'REJECTED', 'RETURNED'
    decision_date TIMESTAMPTZ,
    comments TEXT,
    
    -- Conditions
    conditions TEXT,                            -- Any conditions for approval
    amount_limit DECIMAL(12,2),                -- Approval limit for this approver
    
    -- Delegation
    delegated_to UUID,                          -- References users.id if delegated
    delegated_at TIMESTAMPTZ,
    delegation_reason TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',       -- 'PENDING', 'COMPLETED', 'SKIPPED', 'EXPIRED'
    expires_at TIMESTAMPTZ,                     -- Auto-approval/rejection deadline
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notified_at TIMESTAMPTZ,                    -- When approver was notified
    reminded_at TIMESTAMPTZ,                    -- Last reminder sent
    reminder_count INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT valid_approval_level CHECK (
        approval_level IN ('MANAGER', 'OWNER', 'FINANCE')
    ),
    CONSTRAINT valid_decision CHECK (
        decision IS NULL OR 
        decision IN ('APPROVED', 'REJECTED', 'RETURNED')
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('PENDING', 'COMPLETED', 'SKIPPED', 'EXPIRED')
    ),
    CONSTRAINT valid_sequence CHECK (approval_sequence > 0)
);

-- Indexes for approval queries
CREATE INDEX idx_expense_approvals_expense ON expense_approvals(expense_id);
CREATE INDEX idx_expense_approvals_project ON expense_approvals(project_id);
CREATE INDEX idx_expense_approvals_approver ON expense_approvals(approver_id, status) WHERE status = 'PENDING';
CREATE INDEX idx_expense_approvals_pending ON expense_approvals(project_id, status) WHERE status = 'PENDING';
CREATE INDEX idx_expense_approvals_expires ON expense_approvals(expires_at) WHERE status = 'PENDING' AND expires_at IS NOT NULL;

-- ================================================================
-- 6. PETTY_CASH_FUNDS TABLE
-- ================================================================
-- Petty cash fund management
-- ================================================================

CREATE TABLE petty_cash_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    
    -- Fund Information
    fund_name VARCHAR(100) NOT NULL,            -- e.g., "Front Desk Petty Cash"
    fund_code VARCHAR(50) NOT NULL,             -- Internal code
    
    -- Custodian
    custodian_id UUID NOT NULL,                 -- References users.id
    custodian_name VARCHAR(200) NOT NULL,       -- Denormalized for reporting
    
    -- Fund Amounts
    initial_amount DECIMAL(12,2) NOT NULL,      -- Starting fund amount
    current_balance DECIMAL(12,2) NOT NULL,     -- Current available balance
    replenishment_threshold DECIMAL(12,2),      -- Auto-alert threshold
    max_transaction_amount DECIMAL(12,2),       -- Maximum per transaction
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',        -- 'ACTIVE', 'SUSPENDED', 'CLOSED'
    is_active BOOLEAN DEFAULT true,
    
    -- Reconciliation
    last_reconciled_date DATE,
    last_reconciled_by UUID,                    -- References users.id
    reconciliation_frequency VARCHAR(20),       -- 'WEEKLY', 'MONTHLY'
    next_reconciliation_date DATE,
    
    -- Audit Fields
    established_date DATE NOT NULL,
    established_by UUID NOT NULL,               -- References users.id
    closed_date DATE,
    closed_by UUID,                             -- References users.id
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_fund_code_per_project UNIQUE (project_id, fund_code),
    CONSTRAINT valid_amounts CHECK (
        initial_amount > 0 AND 
        current_balance >= 0 AND
        (replenishment_threshold IS NULL OR replenishment_threshold > 0) AND
        (max_transaction_amount IS NULL OR max_transaction_amount > 0)
    ),
    CONSTRAINT valid_fund_status CHECK (
        status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')
    )
);

-- Indexes for petty cash fund queries
CREATE INDEX idx_petty_cash_funds_project ON petty_cash_funds(project_id);
CREATE INDEX idx_petty_cash_funds_custodian ON petty_cash_funds(custodian_id);
CREATE INDEX idx_petty_cash_funds_active ON petty_cash_funds(project_id, is_active) WHERE is_active = true;

-- ================================================================
-- 7. PETTY_CASH_TRANSACTIONS TABLE
-- ================================================================
-- Individual petty cash transactions
-- ================================================================

CREATE TABLE petty_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    fund_id UUID NOT NULL REFERENCES petty_cash_funds(id),
    
    -- Transaction Information
    transaction_type VARCHAR(20) NOT NULL,      -- 'DISBURSEMENT', 'REPLENISHMENT', 'ADJUSTMENT'
    voucher_number VARCHAR(50) NOT NULL,        -- Format: PCV-YYYY-MM-XXXXX
    transaction_date DATE NOT NULL,
    
    -- Financial Details
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    
    -- Disbursement Details (when type = 'DISBURSEMENT')
    expense_category_id UUID REFERENCES expense_categories(id),
    description TEXT,
    received_by VARCHAR(200),                   -- Person who received cash
    approved_by UUID,                           -- References users.id
    
    -- Replenishment Details (when type = 'REPLENISHMENT')
    replenishment_method VARCHAR(50),           -- 'CASH', 'CHECK', 'BANK_TRANSFER'
    replenishment_reference VARCHAR(100),       -- Check number, transfer reference
    
    -- Supporting Documents
    has_receipt BOOLEAN DEFAULT false,
    receipt_number VARCHAR(100),
    
    -- Status
    status VARCHAR(20) DEFAULT 'COMPLETED',     -- 'PENDING', 'COMPLETED', 'CANCELLED'
    
    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_date DATE,
    reconciled_by UUID,                         -- References users.id
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,                   -- References users.id
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,                          -- References users.id
    cancellation_reason TEXT,
    
    -- Constraints
    CONSTRAINT unique_voucher_per_project UNIQUE (project_id, voucher_number),
    CONSTRAINT valid_transaction_type CHECK (
        transaction_type IN ('DISBURSEMENT', 'REPLENISHMENT', 'ADJUSTMENT')
    ),
    CONSTRAINT valid_amount CHECK (
        (transaction_type = 'DISBURSEMENT' AND amount > 0) OR
        (transaction_type = 'REPLENISHMENT' AND amount > 0) OR
        (transaction_type = 'ADJUSTMENT')
    ),
    CONSTRAINT valid_balance CHECK (
        balance_after = balance_before - amount OR  -- For disbursement
        balance_after = balance_before + amount OR  -- For replenishment
        transaction_type = 'ADJUSTMENT'
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('PENDING', 'COMPLETED', 'CANCELLED')
    )
);

-- Indexes for petty cash transaction queries
CREATE INDEX idx_petty_cash_transactions_project ON petty_cash_transactions(project_id);
CREATE INDEX idx_petty_cash_transactions_fund ON petty_cash_transactions(fund_id);
CREATE INDEX idx_petty_cash_transactions_date ON petty_cash_transactions(project_id, transaction_date DESC);
CREATE INDEX idx_petty_cash_transactions_unreconciled ON petty_cash_transactions(fund_id, is_reconciled) WHERE is_reconciled = false;

-- ================================================================
-- 8. EXPENSE_AUDIT_LOGS TABLE
-- ================================================================
-- Immutable audit trail for all expense-related changes
-- Required for Philippine BIR compliance (5-year retention)
-- ================================================================

CREATE TABLE expense_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    
    -- Entity Reference
    entity_type VARCHAR(50) NOT NULL,           -- 'expense', 'vendor', 'category', 'petty_cash'
    entity_id UUID NOT NULL,                    -- ID of the affected entity
    
    -- Action Details
    action VARCHAR(50) NOT NULL,                -- 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'VOID'
    action_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- User Information
    user_id UUID NOT NULL,                      -- References users.id
    user_name VARCHAR(200) NOT NULL,            -- Denormalized for historical accuracy
    user_role VARCHAR(50) NOT NULL,             -- Role at time of action
    user_ip_address INET,                       -- IP address for security tracking
    user_agent TEXT,                            -- Browser/app information
    
    -- Change Details
    field_name VARCHAR(100),                    -- Specific field changed (for UPDATE)
    old_value JSONB,                           -- Previous value
    new_value JSONB,                           -- New value
    change_reason TEXT,                         -- Reason for change
    
    -- Financial Impact
    amount_changed DECIMAL(12,2),              -- Amount impact of the change
    affects_financial_reports BOOLEAN DEFAULT false,
    
    -- Context
    session_id VARCHAR(100),                   -- User session identifier
    request_id VARCHAR(100),                   -- API request identifier
    
    -- Compliance Fields
    is_compliant BOOLEAN DEFAULT true,         -- Meets compliance requirements
    compliance_notes TEXT,
    requires_review BOOLEAN DEFAULT false,     -- Flagged for compliance review
    reviewed_by UUID,                          -- References users.id
    reviewed_at TIMESTAMPTZ,
    
    -- Immutability
    -- This table should NEVER be updated, only INSERTs allowed
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_entity_type CHECK (
        entity_type IN ('expense', 'vendor', 'category', 'petty_cash', 'approval', 'attachment')
    ),
    CONSTRAINT valid_action CHECK (
        action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'VOID', 'RESTORE', 'LOCK', 'UNLOCK')
    )
);

-- Indexes for audit log queries
CREATE INDEX idx_expense_audit_logs_project ON expense_audit_logs(project_id);
CREATE INDEX idx_expense_audit_logs_entity ON expense_audit_logs(entity_type, entity_id);
CREATE INDEX idx_expense_audit_logs_user ON expense_audit_logs(user_id);
CREATE INDEX idx_expense_audit_logs_timestamp ON expense_audit_logs(project_id, action_timestamp DESC);
CREATE INDEX idx_expense_audit_logs_review ON expense_audit_logs(requires_review) WHERE requires_review = true;

-- Partition by year for long-term retention (5+ years)
-- Note: Partitioning syntax varies by PostgreSQL version
-- This is a template for PostgreSQL 11+
-- CREATE TABLE expense_audit_logs_2024 PARTITION OF expense_audit_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- ================================================================
-- 9. EXPENSE_BUDGET_TRACKING TABLE
-- ================================================================
-- Track budget vs actual for categories
-- ================================================================

CREATE TABLE expense_budget_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    category_id UUID NOT NULL REFERENCES expense_categories(id),
    
    -- Period
    period_type VARCHAR(20) NOT NULL,           -- 'MONTHLY', 'QUARTERLY', 'ANNUAL'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Budget Information
    budgeted_amount DECIMAL(12,2) NOT NULL,
    
    -- Actual Tracking
    actual_amount DECIMAL(12,2) DEFAULT 0,
    committed_amount DECIMAL(12,2) DEFAULT 0,   -- Approved but unpaid
    pending_amount DECIMAL(12,2) DEFAULT 0,     -- Pending approval
    
    -- Variance Analysis
    variance_amount DECIMAL(12,2) GENERATED ALWAYS AS (budgeted_amount - actual_amount) STORED,
    variance_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN budgeted_amount = 0 THEN 0 
            ELSE ((budgeted_amount - actual_amount) / budgeted_amount * 100)
        END
    ) STORED,
    
    -- Alerts
    alert_threshold_percentage DECIMAL(5,2) DEFAULT 80, -- Alert at 80% of budget
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMPTZ,
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_calculated_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_budget_period UNIQUE (project_id, category_id, period_type, period_start),
    CONSTRAINT valid_period_type CHECK (
        period_type IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')
    ),
    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT valid_amounts CHECK (
        budgeted_amount >= 0 AND
        actual_amount >= 0 AND
        committed_amount >= 0 AND
        pending_amount >= 0
    )
);

-- Indexes for budget tracking queries
CREATE INDEX idx_expense_budget_tracking_project ON expense_budget_tracking(project_id);
CREATE INDEX idx_expense_budget_tracking_category ON expense_budget_tracking(category_id);
CREATE INDEX idx_expense_budget_tracking_period ON expense_budget_tracking(project_id, period_start, period_end);
CREATE INDEX idx_expense_budget_tracking_alerts ON expense_budget_tracking(project_id, alert_sent) WHERE alert_sent = false;

-- ================================================================
-- TRIGGERS FOR AUDIT LOGGING
-- ================================================================

-- Function to automatically log changes to expense_audit_logs
CREATE OR REPLACE FUNCTION log_expense_change()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT operations
    IF TG_OP = 'INSERT' THEN
        INSERT INTO expense_audit_logs (
            project_id,
            entity_type,
            entity_id,
            action,
            user_id,
            user_name,
            user_role,
            new_value,
            affects_financial_reports
        ) VALUES (
            NEW.project_id,
            TG_TABLE_NAME,
            NEW.id,
            'CREATE',
            NEW.created_by,
            'System User', -- This should be resolved from users table in application
            'System', -- This should be resolved from user context
            to_jsonb(NEW),
            true
        );
        RETURN NEW;
    END IF;
    
    -- For UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        -- Log only if there are actual changes
        IF NEW IS DISTINCT FROM OLD THEN
            INSERT INTO expense_audit_logs (
                project_id,
                entity_type,
                entity_id,
                action,
                user_id,
                user_name,
                user_role,
                old_value,
                new_value,
                affects_financial_reports
            ) VALUES (
                NEW.project_id,
                TG_TABLE_NAME,
                NEW.id,
                'UPDATE',
                COALESCE(NEW.updated_by, NEW.created_by),
                'System User',
                'System',
                to_jsonb(OLD),
                to_jsonb(NEW),
                true
            );
        END IF;
        RETURN NEW;
    END IF;
    
    -- For DELETE operations
    IF TG_OP = 'DELETE' THEN
        INSERT INTO expense_audit_logs (
            project_id,
            entity_type,
            entity_id,
            action,
            user_id,
            user_name,
            user_role,
            old_value,
            affects_financial_reports
        ) VALUES (
            OLD.project_id,
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            OLD.created_by, -- Use creator as we don't have delete context
            'System User',
            'System',
            to_jsonb(OLD),
            true
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to main tables
CREATE TRIGGER audit_expenses_changes
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION log_expense_change();

CREATE TRIGGER audit_vendors_changes
    AFTER INSERT OR UPDATE OR DELETE ON vendors
    FOR EACH ROW EXECUTE FUNCTION log_expense_change();

CREATE TRIGGER audit_expense_categories_changes
    AFTER INSERT OR UPDATE OR DELETE ON expense_categories
    FOR EACH ROW EXECUTE FUNCTION log_expense_change();

CREATE TRIGGER audit_petty_cash_funds_changes
    AFTER INSERT OR UPDATE OR DELETE ON petty_cash_funds
    FOR EACH ROW EXECUTE FUNCTION log_expense_change();

CREATE TRIGGER audit_petty_cash_transactions_changes
    AFTER INSERT OR UPDATE OR DELETE ON petty_cash_transactions
    FOR EACH ROW EXECUTE FUNCTION log_expense_change();

-- ================================================================
-- FUNCTION: Update timestamp on record modification
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON expense_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_petty_cash_funds_updated_at BEFORE UPDATE ON petty_cash_funds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_budget_tracking_updated_at BEFORE UPDATE ON expense_budget_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- VIEWS FOR COMMON QUERIES
-- ================================================================

-- View for expense summary with vendor and category details
CREATE VIEW expense_summary_view AS
SELECT 
    e.id,
    e.project_id,
    e.expense_number,
    e.expense_date,
    e.description,
    e.amount,
    e.vat_amount,
    e.withholding_tax_amount,
    e.net_amount,
    e.status,
    e.is_paid,
    ec.name AS category_name,
    ec.code AS category_code,
    v.name AS vendor_name,
    v.tin AS vendor_tin,
    e.created_at,
    e.created_by
FROM expenses e
LEFT JOIN expense_categories ec ON e.category_id = ec.id
LEFT JOIN vendors v ON e.vendor_id = v.id;

-- View for budget vs actual analysis
CREATE VIEW budget_vs_actual_view AS
SELECT 
    bt.project_id,
    bt.category_id,
    ec.name AS category_name,
    bt.period_type,
    bt.period_start,
    bt.period_end,
    bt.budgeted_amount,
    bt.actual_amount,
    bt.committed_amount,
    bt.variance_amount,
    bt.variance_percentage,
    CASE 
        WHEN bt.actual_amount >= bt.budgeted_amount THEN 'OVER_BUDGET'
        WHEN bt.actual_amount >= (bt.budgeted_amount * bt.alert_threshold_percentage / 100) THEN 'WARNING'
        ELSE 'ON_TRACK'
    END AS budget_status
FROM expense_budget_tracking bt
JOIN expense_categories ec ON bt.category_id = ec.id;

-- ================================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON TABLE expenses IS 'Main expense tracking table with Philippine BIR compliance fields';
COMMENT ON TABLE expense_categories IS 'BIR-compliant expense categories based on Philippine Chart of Accounts';
COMMENT ON TABLE vendors IS 'Supplier management with Philippine TIN and withholding tax requirements';
COMMENT ON TABLE expense_attachments IS 'Receipt and document storage with OCR support for automated data extraction';
COMMENT ON TABLE expense_approvals IS 'Multi-level approval workflow tracking';
COMMENT ON TABLE petty_cash_funds IS 'Petty cash fund establishment and management';
COMMENT ON TABLE petty_cash_transactions IS 'Individual petty cash disbursements and replenishments';
COMMENT ON TABLE expense_audit_logs IS 'Immutable audit trail for 5+ year BIR retention requirement';
COMMENT ON TABLE expense_budget_tracking IS 'Budget vs actual tracking by category and period';

COMMENT ON COLUMN expenses.tin IS 'Philippine Tax Identification Number in format XXX-XXX-XXX-XXX';
COMMENT ON COLUMN expenses.vat_amount IS '12% Value Added Tax as per Philippine tax law';
COMMENT ON COLUMN expenses.withholding_tax_amount IS 'Expanded Withholding Tax (EWT) or Creditable Withholding Tax (CWT)';
COMMENT ON COLUMN expenses.receipt_type IS 'BIR-prescribed receipt types for Philippine businesses';
COMMENT ON COLUMN expense_categories.withholding_tax_rate IS 'EWT rates: 1% (goods), 2% (services), 5% (rental), 10% (professional), 15% (others)';

-- ================================================================
-- END OF PHASE 4.1 EXPENSE TRACKING SCHEMA
-- ================================================================