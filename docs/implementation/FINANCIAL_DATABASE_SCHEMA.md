# Internal Balance Database Schema Documentation - LEGACY DOCUMENT

> ⚠️ **LEGACY DOCUMENTATION WARNING**\n>\n> This document contains outdated
> scope claims that do not reflect the current system implementation.\n> The
> system provides **INTERNAL TRACKING ONLY** and does not implement:\n> -
> Internal reporting compliance, payment status tracking, and customer-facing
> features\n> - Government regulatory features\n> - Customer-facing
> functionality\n>\n> This documentation is preserved for historical context but
> should not be used as a reference for current system capabilities.

## Overview

This document provides complete internal balance database schema documentation
for the Okaeri Resort Management System, focusing on internal operations,
practical implementation, and operational efficiency for internal staff managing
1-3 properties.

## CRITICAL: Data Isolation Approach

### Primary Approach: Application-Level Filtering

**For 1-3 properties (99% of use cases), we use SIMPLE APPLICATION-LEVEL
FILTERING:**

```typescript
// THIS IS THE PRIMARY APPROACH - Simple, Clear, Maintainable
async function getExpenses(projectId: string) {
  return db.query.expenses.findMany({
    where: eq(expenses.projectId, projectId), // Simple WHERE clause
    orderBy: [desc(expenses.date)],
  });
}
```

**Key Points:**

- Every query includes `WHERE project_id = ?`
- Filtering happens in application code (Drizzle ORM)
- No complex database configuration needed
- Easy to debug and maintain
- Perfect for family resort businesses

### Future Scaling Option: RLS (10+ Properties Only)

Row-Level Security (RLS) is documented in `RLS_MULTI_TENANT.md` but is **ONLY**
for future scaling when managing 10+ properties. For family resorts with 1-3
properties, application-level filtering is sufficient and recommended.

## Complete Financial Tables Schema

### 1. Expenses Table

Complete expense tracking for internal operations:

```sql
CREATE TABLE expenses (
  -- Primary Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,  -- Resort identifier for multi-tenant

  -- Core Expense Data
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,  -- Philippine Peso with centavos
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(50),
  description TEXT,

  -- Vendor Information (BIR Required)
  vendor_name VARCHAR(255) NOT NULL,
  vendor_tin VARCHAR(20),  -- Format: XXX-XXX-XXX-XXX
  vendor_address TEXT,

  -- VAT Handling (12% Philippine VAT)
  is_vatable BOOLEAN DEFAULT true,
  vat_amount DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,  -- Amount excluding VAT

  -- Payment Details
  payment_method VARCHAR(50),  -- CASH, GCASH, BANK_TRANSFER, CREDIT_CARD
  payment_reference VARCHAR(100),
  payment_date DATE,
  payment_status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PAID, OVERDUE

  -- Receipt Management
  has_receipt BOOLEAN DEFAULT false,
  receipt_type VARCHAR(20),  -- OFFICIAL_RECEIPT, SALES_INVOICE, ACKNOWLEDGEMENT
  receipt_number VARCHAR(50),
  receipt_url TEXT,  -- S3/storage URL

  -- Approval Workflow
  status VARCHAR(20) DEFAULT 'DRAFT',  -- DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
  approved_by UUID,
  approved_at TIMESTAMP,
  approval_notes TEXT,

  -- Capital Expenditure Tracking
  is_capital_expense BOOLEAN DEFAULT false,
  depreciation_years INTEGER,
  asset_tag VARCHAR(50),

  -- Withholding Tax (for professional fees)
  withholding_tax_rate DECIMAL(5,2),  -- Percentage
  withholding_tax_amount DECIMAL(12,2),

  -- Audit Fields
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT chk_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDING', 'PAID', 'OVERDUE')),
  CONSTRAINT chk_status CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'))
);

-- Essential Indexes for Performance
CREATE INDEX idx_expenses_project_date ON expenses(project_id, date DESC);
CREATE INDEX idx_expenses_category ON expenses(project_id, category);
CREATE INDEX idx_expenses_vendor ON expenses(project_id, vendor_name);
CREATE INDEX idx_expenses_status ON expenses(project_id, status);
CREATE INDEX idx_expenses_payment_status ON expenses(project_id, payment_status);
```

### 2. Income Table

Revenue tracking with platform fee handling:

```sql
CREATE TABLE income (
  -- Primary Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Income Source
  booking_id UUID,  -- Link to booking if accommodation income
  income_type VARCHAR(50) NOT NULL,  -- ACCOMMODATION, F&B, AMENITY, OTHER
  description TEXT,

  -- Amount Details
  gross_amount DECIMAL(12,2) NOT NULL,  -- Total before deductions
  platform VARCHAR(50),  -- DIRECT, AIRBNB, BOOKING_COM, AGODA, EXPEDIA
  platform_fee_rate DECIMAL(5,2),  -- Platform commission percentage
  platform_fee_amount DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,  -- After platform fees

  -- VAT Calculation
  is_vatable BOOLEAN DEFAULT true,
  vat_amount DECIMAL(12,2) DEFAULT 0,
  vatable_sales DECIMAL(12,2),  -- Amount subject to VAT

  -- Revenue Recognition
  revenue_date DATE NOT NULL,  -- When to recognize revenue
  recognition_method VARCHAR(50),  -- CHECK_IN_DATE, BOOKING_DATE, CUSTOM

  -- Guest Information
  guest_name VARCHAR(255),
  guest_contact VARCHAR(100),
  guest_email VARCHAR(255),

  -- Platform Specific
  platform_booking_id VARCHAR(100),  -- Airbnb/Booking.com confirmation
  platform_payout_date DATE,
  platform_payout_reference VARCHAR(100),

  -- Package Allocation (for bundled services)
  is_package BOOLEAN DEFAULT false,
  package_components JSONB,  -- Breakdown of package components

  -- Status Tracking
  status VARCHAR(20) DEFAULT 'CONFIRMED',  -- CONFIRMED, PENDING, CANCELLED
  cancellation_date TIMESTAMP,
  cancellation_reason TEXT,

  -- Audit Fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT chk_amounts CHECK (net_amount <= gross_amount)
);

-- Performance Indexes
CREATE INDEX idx_income_project_date ON income(project_id, revenue_date DESC);
CREATE INDEX idx_income_platform ON income(project_id, platform);
CREATE INDEX idx_income_type ON income(project_id, income_type);
CREATE INDEX idx_income_booking ON income(booking_id);
CREATE INDEX idx_income_status ON income(project_id, status);
```

### 3. Payments Table

Multi-method payment processing:

```sql
CREATE TABLE payments (
  -- Primary Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Payment Association
  booking_id UUID,
  income_id UUID,
  expense_id UUID,
  payment_type VARCHAR(20) NOT NULL,  -- INCOME, EXPENSE, DEPOSIT, REFUND

  -- Amount Information
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  php_equivalent DECIMAL(12,2) NOT NULL,

  -- Payment Method Details
  payment_method VARCHAR(50) NOT NULL,  -- CASH, GCASH, BANK_TRANSFER, CREDIT_CARD, PAYMAYA, GRABPAY
  payment_date TIMESTAMP NOT NULL,

  -- Cash Payments
  cash_received DECIMAL(12,2),
  change_given DECIMAL(12,2),
  cash_drawer_id UUID,

  -- GCash/PayMaya Details
  ewallet_reference VARCHAR(100),
  ewallet_sender_name VARCHAR(255),
  ewallet_sender_number VARCHAR(20),

  -- Bank Transfer Details
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  account_name VARCHAR(255),
  transfer_reference VARCHAR(100),
  deposit_slip_url TEXT,

  -- Credit Card Details
  card_type VARCHAR(20),  -- VISA, MASTERCARD, AMEX, JCB
  last_four_digits VARCHAR(4),
  authorization_code VARCHAR(50),
  processor VARCHAR(50),  -- PAYNAMICS, DRAGONPAY, etc.
  processor_fee DECIMAL(12,2) DEFAULT 0,
  mdr_rate DECIMAL(5,2),  -- Merchant Discount Rate

  -- Settlement Information
  settlement_status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, SETTLED, FAILED
  settlement_date DATE,
  settlement_reference VARCHAR(100),
  net_settlement_amount DECIMAL(12,2),  -- After fees

  -- Verification
  verification_status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, VERIFIED, FAILED
  verified_by UUID,
  verified_at TIMESTAMP,
  verification_notes TEXT,

  -- Receipt Generation
  receipt_number VARCHAR(50),
  receipt_generated BOOLEAN DEFAULT false,
  receipt_url TEXT,

  -- Refund Tracking
  is_refundable BOOLEAN DEFAULT true,
  refund_deadline DATE,
  original_payment_id UUID,  -- For refunds

  -- Audit Fields
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_income FOREIGN KEY (income_id) REFERENCES income(id),
  CONSTRAINT fk_expense FOREIGN KEY (expense_id) REFERENCES expenses(id),
  CONSTRAINT chk_payment_type CHECK (payment_type IN ('INCOME', 'EXPENSE', 'DEPOSIT', 'REFUND'))
);

-- Performance Indexes
CREATE INDEX idx_payments_project_date ON payments(project_id, payment_date DESC);
CREATE INDEX idx_payments_method ON payments(project_id, payment_method);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_verification ON payments(project_id, verification_status);
CREATE INDEX idx_payments_settlement ON payments(project_id, settlement_status);
```

### 4. Receipts Table

Document storage and OCR integration:

```sql
CREATE TABLE receipts (
  -- Primary Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Association
  expense_id UUID,
  payment_id UUID,

  -- File Information
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,  -- S3/storage URL
  file_size INTEGER,  -- In bytes
  file_type VARCHAR(50),  -- image/jpeg, image/png, application/pdf
  thumbnail_url TEXT,  -- For images

  -- Receipt Details
  receipt_type VARCHAR(50),  -- OFFICIAL_RECEIPT, SALES_INVOICE, DELIVERY_RECEIPT, ACKNOWLEDGEMENT
  receipt_number VARCHAR(100),
  receipt_date DATE,

  -- OCR Extracted Data
  ocr_processed BOOLEAN DEFAULT false,
  ocr_processed_at TIMESTAMP,
  ocr_confidence_score DECIMAL(5,2),  -- Percentage
  extracted_vendor VARCHAR(255),
  extracted_amount DECIMAL(12,2),
  extracted_date DATE,
  extracted_tin VARCHAR(20),
  extracted_items JSONB,  -- Array of line items
  ocr_raw_text TEXT,  -- Full extracted text

  -- Manual Verification
  manually_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMP,
  corrections JSONB,  -- Manual corrections to OCR data

  -- Internal Validation
  validation_status VARCHAR(20) DEFAULT 'PENDING',
  validation_checks JSONB,
  needs_review BOOLEAN DEFAULT false,

  -- Organization
  folder_path VARCHAR(255),  -- Virtual folder structure
  tags TEXT[],  -- Array of tags for categorization

  -- Retention Policy
  retention_years INTEGER DEFAULT 5,  -- Internal record retention
  can_be_deleted_after DATE,
  is_archived BOOLEAN DEFAULT false,

  -- Audit Fields
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_expense FOREIGN KEY (expense_id) REFERENCES expenses(id),
  CONSTRAINT fk_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- Performance Indexes
CREATE INDEX idx_receipts_project ON receipts(project_id);
CREATE INDEX idx_receipts_expense ON receipts(expense_id);
CREATE INDEX idx_receipts_date ON receipts(project_id, receipt_date DESC);
CREATE INDEX idx_receipts_ocr_status ON receipts(project_id, ocr_processed);
CREATE INDEX idx_receipts_tags ON receipts USING GIN(tags);
```

### 5. Audit Trail Table

Comprehensive audit logging for compliance:

```sql
CREATE TABLE audit_trail (
  -- Primary Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Action Details
  entity_type VARCHAR(50) NOT NULL,  -- EXPENSE, INCOME, PAYMENT, BOOKING, etc.
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, APPROVE, REJECT, etc.

  -- Change Tracking
  old_values JSONB,  -- Previous state
  new_values JSONB,  -- New state
  changed_fields TEXT[],  -- List of modified fields

  -- Financial Specific
  amount_before DECIMAL(12,2),
  amount_after DECIMAL(12,2),

  -- User Information
  user_id UUID NOT NULL,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  ip_address INET,
  user_agent TEXT,

  -- Session Context
  session_id VARCHAR(100),
  request_id VARCHAR(100),

  -- Compliance Fields
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Performance Indexes
CREATE INDEX idx_audit_project_entity ON audit_trail(project_id, entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_trail(project_id, user_id);
CREATE INDEX idx_audit_date ON audit_trail(project_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_trail(project_id, action);
CREATE INDEX idx_audit_review ON audit_trail(project_id, requires_review) WHERE requires_review = true;
```

## Financial Query Examples (Drizzle ORM)

### 1. Monthly Expense Summary

```typescript
// Get monthly expense breakdown by category
async function getMonthlyExpenseSummary(
  projectId: string,
  year: number,
  month: number
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  return db
    .select({
      category: expenses.category,
      totalAmount: sum(expenses.amount),
      vatAmount: sum(expenses.vatAmount),
      netAmount: sum(expenses.netAmount),
      count: count(expenses.id),
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.projectId, projectId), // Application-level filtering
        gte(expenses.date, startDate),
        lte(expenses.date, endDate),
        eq(expenses.status, "APPROVED")
      )
    )
    .groupBy(expenses.category)
    .orderBy(desc(sum(expenses.amount)));
}

// Get top vendors by spending
async function getTopVendors(projectId: string, limit: number = 10) {
  return db
    .select({
      vendorName: expenses.vendorName,
      vendorTin: expenses.vendorTin,
      totalSpent: sum(expenses.amount),
      transactionCount: count(expenses.id),
      lastPurchase: max(expenses.date),
    })
    .from(expenses)
    .where(
      and(eq(expenses.projectId, projectId), eq(expenses.status, "APPROVED"))
    )
    .groupBy(expenses.vendorName, expenses.vendorTin)
    .orderBy(desc(sum(expenses.amount)))
    .limit(limit);
}
```

### 2. Income by Platform

```typescript
// Get income breakdown by booking platform
async function getIncomeByPlatform(
  projectId: string,
  startDate: Date,
  endDate: Date
) {
  return db
    .select({
      platform: income.platform,
      grossRevenue: sum(income.grossAmount),
      platformFees: sum(income.platformFeeAmount),
      netRevenue: sum(income.netAmount),
      bookingCount: count(income.id),
      averageBookingValue: avg(income.grossAmount),
    })
    .from(income)
    .where(
      and(
        eq(income.projectId, projectId),
        gte(income.revenueDate, startDate),
        lte(income.revenueDate, endDate),
        eq(income.status, "CONFIRMED")
      )
    )
    .groupBy(income.platform)
    .orderBy(desc(sum(income.netAmount)));
}

// Calculate platform fee efficiency
async function getPlatformEfficiency(projectId: string) {
  const results = await db
    .select({
      platform: income.platform,
      totalGross: sum(income.grossAmount),
      totalFees: sum(income.platformFeeAmount),
      feePercentage: sql`
        ROUND(
          (SUM(${income.platformFeeAmount}) / NULLIF(SUM(${income.grossAmount}), 0)) * 100, 
          2
        )
      `,
    })
    .from(income)
    .where(
      and(eq(income.projectId, projectId), not(eq(income.platform, "DIRECT")))
    )
    .groupBy(income.platform);

  return results.map((r) => ({
    ...r,
    recommendation:
      r.feePercentage > 15
        ? "Consider negotiating rates or promoting direct bookings"
        : "Fee rate is competitive",
  }));
}
```

### 3. VAT Calculations and Reporting

```typescript
// Calculate monthly VAT liability
async function calculateMonthlyVAT(
  projectId: string,
  year: number,
  month: number
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Output VAT from income
  const outputVAT = await db
    .select({
      totalVAT: sum(income.vatAmount),
    })
    .from(income)
    .where(
      and(
        eq(income.projectId, projectId),
        gte(income.revenueDate, startDate),
        lte(income.revenueDate, endDate),
        eq(income.isVatable, true)
      )
    );

  // Input VAT from expenses (creditable)
  const inputVAT = await db
    .select({
      totalVAT: sum(expenses.vatAmount),
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.projectId, projectId),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate),
        eq(expenses.isVatable, true),
        eq(expenses.status, "APPROVED")
      )
    );

  const outputAmount = outputVAT[0]?.totalVAT || 0;
  const inputAmount = inputVAT[0]?.totalVAT || 0;
  const netVAT = outputAmount - inputAmount;

  return {
    period: `${year}-${String(month).padStart(2, "0")}`,
    outputVAT: outputAmount,
    inputVAT: inputAmount,
    netVATPayable: Math.max(0, netVAT),
    excessInputVAT: Math.max(0, -netVAT),
    dueDate: new Date(year, month, 20), // 20th of following month
    birForm: "2550M", // Monthly VAT Return
  };
}

// Generate VAT Relief Report (for senior/PWD discounts)
async function getVATReliefReport(projectId: string, quarter: string) {
  return db
    .select({
      month: sql`DATE_TRUNC('month', ${payments.paymentDate})`,
      seniorDiscounts: sum(
        sql`CASE WHEN ${payments.discountType} = 'SENIOR' THEN ${payments.discountAmount} ELSE 0 END`
      ),
      pwdDiscounts: sum(
        sql`CASE WHEN ${payments.discountType} = 'PWD' THEN ${payments.discountAmount} ELSE 0 END`
      ),
      vatExempted: sum(payments.vatExemptAmount),
      totalSales: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.projectId, projectId),
        sql`DATE_TRUNC('quarter', ${payments.paymentDate}) = ${quarter}`,
        or(
          eq(payments.discountType, "SENIOR"),
          eq(payments.discountType, "PWD")
        )
      )
    )
    .groupBy(sql`DATE_TRUNC('month', ${payments.paymentDate})`)
    .orderBy(sql`DATE_TRUNC('month', ${payments.paymentDate})`);
}
```

### 4. Cash Flow Statements

```typescript
// Generate cash flow statement
async function getCashFlowStatement(
  projectId: string,
  startDate: Date,
  endDate: Date
) {
  // Cash inflows
  const inflows = await db
    .select({
      source: payments.paymentType,
      method: payments.paymentMethod,
      amount: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.projectId, projectId),
        eq(payments.paymentType, "INCOME"),
        gte(payments.paymentDate, startDate),
        lte(payments.paymentDate, endDate),
        eq(payments.verificationStatus, "VERIFIED")
      )
    )
    .groupBy(payments.paymentType, payments.paymentMethod);

  // Cash outflows
  const outflows = await db
    .select({
      category: expenses.category,
      amount: sum(expenses.amount),
    })
    .from(expenses)
    .innerJoin(payments, eq(expenses.id, payments.expenseId))
    .where(
      and(
        eq(expenses.projectId, projectId),
        gte(payments.paymentDate, startDate),
        lte(payments.paymentDate, endDate),
        eq(expenses.paymentStatus, "PAID")
      )
    )
    .groupBy(expenses.category);

  const totalInflows = inflows.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalOutflows = outflows.reduce((sum, o) => sum + Number(o.amount), 0);

  return {
    period: { from: startDate, to: endDate },
    inflows: {
      details: inflows,
      total: totalInflows,
    },
    outflows: {
      details: outflows,
      total: totalOutflows,
    },
    netCashFlow: totalInflows - totalOutflows,
    analysis: {
      liquidityRatio: totalInflows / totalOutflows,
      cashBurnRate:
        totalOutflows / ((endDate - startDate) / (1000 * 60 * 60 * 24)),
      daysOfCashRemaining:
        (totalInflows - totalOutflows) / (totalOutflows / 30),
    },
  };
}

// Daily cash position
async function getDailyCashPosition(projectId: string, date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Cash sales for the day
  const cashSales = await db
    .select({
      total: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.projectId, projectId),
        eq(payments.paymentMethod, "CASH"),
        eq(payments.paymentType, "INCOME"),
        gte(payments.paymentDate, dayStart),
        lte(payments.paymentDate, dayEnd)
      )
    );

  // Cash expenses for the day
  const cashExpenses = await db
    .select({
      total: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.projectId, projectId),
        eq(payments.paymentMethod, "CASH"),
        eq(payments.paymentType, "EXPENSE"),
        gte(payments.paymentDate, dayStart),
        lte(payments.paymentDate, dayEnd)
      )
    );

  return {
    date,
    cashIn: cashSales[0]?.total || 0,
    cashOut: cashExpenses[0]?.total || 0,
    netCash: (cashSales[0]?.total || 0) - (cashExpenses[0]?.total || 0),
    requiresDeposit: (cashSales[0]?.total || 0) > 50000, // PHP 50k threshold
  };
}
```

### 5. Occupancy Rate Calculations

```typescript
// Calculate occupancy rate with revenue correlation
async function getOccupancyWithRevenue(
  projectId: string,
  year: number,
  month: number
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const daysInMonth = endDate.getDate();

  // Get total room nights available
  const rooms = await db
    .select({
      totalRooms: count(rooms.id),
    })
    .from(rooms)
    .where(and(eq(rooms.projectId, projectId), eq(rooms.isActive, true)));

  const totalRoomNights = rooms[0].totalRooms * daysInMonth;

  // Get occupied room nights and revenue
  const occupancy = await db
    .select({
      occupiedNights: sum(
        sql`${bookings.checkOutDate} - ${bookings.checkInDate}`
      ),
      roomRevenue: sum(bookings.totalAmount),
      averageDailyRate: avg(
        sql`${bookings.totalAmount} / (${bookings.checkOutDate} - ${bookings.checkInDate})`
      ),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.projectId, projectId),
        gte(bookings.checkInDate, startDate),
        lte(bookings.checkInDate, endDate),
        not(eq(bookings.status, "CANCELLED"))
      )
    );

  const occupiedNights = Number(occupancy[0]?.occupiedNights || 0);
  const occupancyRate = (occupiedNights / totalRoomNights) * 100;

  return {
    period: `${year}-${String(month).padStart(2, "0")}`,
    totalRoomNights,
    occupiedNights,
    occupancyRate: Math.round(occupancyRate * 100) / 100,
    roomRevenue: occupancy[0]?.roomRevenue || 0,
    averageDailyRate: occupancy[0]?.averageDailyRate || 0,
    revPAR: (occupancy[0]?.roomRevenue || 0) / totalRoomNights, // Revenue per available room
    performance:
      occupancyRate > 70
        ? "EXCELLENT"
        : occupancyRate > 50
          ? "GOOD"
          : occupancyRate > 30
            ? "FAIR"
            : "POOR",
  };
}
```

## Receipt Management Workflow

### 1. Receipt Upload and Storage

```typescript
// Receipt upload with automatic organization
async function uploadReceipt(projectId: string, expenseId: string, file: File) {
  // Validate file
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];

  if (file.size > maxSize) {
    throw new Error("File size exceeds 10MB limit");
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid file type. Allowed: JPG, PNG, PDF");
  }

  // Generate organized storage path
  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
  });

  const date = new Date(expense.date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const folderPath = `receipts/${projectId}/${year}/${month}/${expense.category}`;

  // Upload to storage (S3/Supabase Storage)
  const fileName = `${expenseId}_${Date.now()}_${file.name}`;
  const fileUrl = await uploadToStorage(folderPath, fileName, file);

  // Generate thumbnail if image
  let thumbnailUrl = null;
  if (file.type.startsWith("image/")) {
    thumbnailUrl = await generateThumbnail(file);
  }

  // Save receipt record
  const receipt = await db
    .insert(receipts)
    .values({
      projectId,
      expenseId,
      fileName: file.name,
      fileUrl,
      fileSize: file.size,
      fileType: file.type,
      thumbnailUrl,
      folderPath,
      receiptDate: expense.date,
      uploadedBy: getCurrentUserId(),
      canBeDeletedAfter: addYears(new Date(), 5), // BIR 5-year retention
    })
    .returning();

  // Update expense record
  await db
    .update(expenses)
    .set({
      hasReceipt: true,
      receiptUrl: fileUrl,
    })
    .where(eq(expenses.id, expenseId));

  // Queue for OCR processing
  await queueOCRProcessing(receipt[0].id);

  return receipt[0];
}
```

### 2. OCR Integration Placeholder

```typescript
// OCR processing for receipt data extraction
async function processReceiptOCR(receiptId: string) {
  const receipt = await db.query.receipts.findFirst({
    where: eq(receipts.id, receiptId),
  });

  try {
    // Placeholder for OCR service integration
    // In production, integrate with Google Vision API, AWS Textract, or Azure Form Recognizer
    const ocrResult = await ocrService.extractText(receipt.fileUrl);

    // Parse extracted text for key information
    const extractedData = {
      vendor: parseVendor(ocrResult.text),
      amount: parseAmount(ocrResult.text),
      date: parseDate(ocrResult.text),
      tin: parseTIN(ocrResult.text),
      receiptNumber: parseReceiptNumber(ocrResult.text),
      items: parseLineItems(ocrResult.text),
    };

    // Update receipt with OCR data
    await db
      .update(receipts)
      .set({
        ocrProcessed: true,
        ocrProcessedAt: new Date(),
        ocrConfidenceScore: ocrResult.confidence,
        extractedVendor: extractedData.vendor,
        extractedAmount: extractedData.amount,
        extractedDate: extractedData.date,
        extractedTin: extractedData.tin,
        extractedItems: extractedData.items,
        ocrRawText: ocrResult.text,
      })
      .where(eq(receipts.id, receiptId));

    // Auto-update expense if high confidence
    if (ocrResult.confidence > 85) {
      await updateExpenseFromOCR(receipt.expenseId, extractedData);
    }
  } catch (error) {
    console.error("OCR processing failed:", error);
    // Mark for manual review
    await db
      .update(receipts)
      .set({
        ocrProcessed: true,
        ocrProcessedAt: new Date(),
        ocrConfidenceScore: 0,
        manuallyVerified: false,
      })
      .where(eq(receipts.id, receiptId));
  }
}

// Helper functions for parsing OCR text
function parseAmount(text: string): number {
  // Match Philippine peso amounts
  const regex = /(?:₱|PHP|P)\s*([\d,]+\.?\d{0,2})/gi;
  const matches = text.match(regex);

  if (matches && matches.length > 0) {
    // Get the largest amount (usually the total)
    const amounts = matches.map((m) => {
      const cleanAmount = m.replace(/[^0-9.]/g, "");
      return parseFloat(cleanAmount);
    });
    return Math.max(...amounts);
  }

  return 0;
}

function parseTIN(text: string): string | null {
  // Match Philippine TIN format XXX-XXX-XXX-XXX
  const regex = /\d{3}-\d{3}-\d{3}-\d{3}/g;
  const match = text.match(regex);
  return match ? match[0] : null;
}
```

### 3. Internal Receipt Validation

```typescript
// Validate receipt data for internal tracking
async function validateInternalReceipt(receiptId: string) {
  const receipt = await db.query.receipts.findFirst({
    where: eq(receipts.id, receiptId),
    with: {
      expense: true,
    },
  });

  const validationChecks = {
    hasReceiptNumber:
      !!receipt.receiptNumber || !!receipt.extractedReceiptNumber,
    hasVendorInfo: !!receipt.expense.vendorName,
    hasDate: !!receipt.receiptDate,
    hasAmount: !!receipt.expense.amount,
    hasCategory: !!receipt.expense.category,
    dataComplete: true, // All required internal fields present
  };

  const isValid = Object.values(validationChecks).every((check) => check);

  // Update validation status for internal tracking
  await db
    .update(receipts)
    .set({
      validationStatus: isValid ? "VALID" : "NEEDS_REVIEW",
      validationChecks: validationChecks,
    })
    .where(eq(receipts.id, receiptId));

  // Create audit log for validation check
  await db.insert(auditTrail).values({
    projectId: receipt.projectId,
    entityType: "RECEIPT",
    entityId: receiptId,
    action: "INTERNAL_VALIDATION",
    newValues: validationChecks,
    userId: getCurrentUserId(),
    requiresReview: !isValid,
  });

  return {
    isValid,
    checks: validationChecks,
    recommendations: getInternalValidationRecommendations(validationChecks),
  };
}

function getComplianceRecommendations(checks: any): string[] {
  const recommendations = [];

  if (!checks.hasVendorTIN) {
    recommendations.push("Obtain vendor TIN for amounts above PHP 10,000");
  }

  if (!checks.hasReceiptNumber) {
    recommendations.push("Request official receipt with OR number");
  }

  if (!checks.hasProperFormat) {
    recommendations.push(
      "Ensure receipt has BIR permit to print and machine number"
    );
  }

  return recommendations;
}
```

### 4. Expense Approval Workflow

```typescript
// Multi-level expense approval workflow
async function submitExpenseForApproval(expenseId: string) {
  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
    with: {
      receipts: true,
    },
  });

  // Validation checks
  const validationErrors = [];

  if (!expense.hasReceipt && expense.amount > 1000) {
    validationErrors.push("Receipt required for amounts above PHP 1,000");
  }

  if (expense.amount > 10000 && !expense.vendorTin) {
    validationErrors.push("Vendor TIN required for amounts above PHP 10,000");
  }

  if (expense.isCapitalExpense && !expense.depreciationYears) {
    validationErrors.push("Depreciation years required for capital expenses");
  }

  if (validationErrors.length > 0) {
    throw new ValidationError(validationErrors);
  }

  // Determine approval level based on amount
  let approvalLevel = "STAFF";
  if (expense.amount > 50000) {
    approvalLevel = "OWNER";
  } else if (expense.amount > 10000) {
    approvalLevel = "MANAGER";
  }

  // Update expense status
  await db
    .update(expenses)
    .set({
      status: "PENDING_APPROVAL",
      approvalLevel,
      submittedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId));

  // Create approval request
  await db.insert(approvalRequests).values({
    projectId: expense.projectId,
    entityType: "EXPENSE",
    entityId: expenseId,
    approvalLevel,
    requestedBy: getCurrentUserId(),
    requestedAt: new Date(),
    status: "PENDING",
  });

  // Send notification to approver
  await notifyApprover(expense.projectId, approvalLevel, expense);

  // Create audit log
  await db.insert(auditTrail).values({
    projectId: expense.projectId,
    entityType: "EXPENSE",
    entityId: expenseId,
    action: "SUBMIT_FOR_APPROVAL",
    userId: getCurrentUserId(),
    newValues: { status: "PENDING_APPROVAL", approvalLevel },
  });

  return {
    status: "PENDING_APPROVAL",
    approvalLevel,
    estimatedApprovalTime: getEstimatedApprovalTime(approvalLevel),
  };
}

// Approve or reject expense
async function processExpenseApproval(
  expenseId: string,
  decision: "APPROVE" | "REJECT",
  notes?: string
) {
  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
  });

  // Verify approver has authority
  const hasAuthority = await verifyApprovalAuthority(
    getCurrentUserId(),
    expense.projectId,
    expense.approvalLevel
  );

  if (!hasAuthority) {
    throw new UnauthorizedError("Insufficient approval authority");
  }

  const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  // Update expense
  await db
    .update(expenses)
    .set({
      status: newStatus,
      approvedBy: getCurrentUserId(),
      approvedAt: new Date(),
      approvalNotes: notes,
    })
    .where(eq(expenses.id, expenseId));

  // If approved and not yet paid, update payment status
  if (decision === "APPROVE" && expense.paymentStatus === "PENDING") {
    await schedulePayment(expenseId);
  }

  // Create audit log
  await db.insert(auditTrail).values({
    projectId: expense.projectId,
    entityType: "EXPENSE",
    entityId: expenseId,
    action: decision,
    userId: getCurrentUserId(),
    oldValues: { status: expense.status },
    newValues: { status: newStatus, notes },
    amountAfter: expense.amount,
  });

  // Notify submitter
  await notifySubmitter(expense.createdBy, decision, notes);

  return {
    status: newStatus,
    processedBy: getCurrentUserId(),
    processedAt: new Date(),
  };
}
```

## Performance Indexes

### Essential Indexes for Common Queries

```sql
-- Date-based financial queries (most common)
CREATE INDEX idx_expenses_date_range ON expenses(project_id, date, status)
  WHERE status = 'APPROVED';
CREATE INDEX idx_income_date_range ON income(project_id, revenue_date, status)
  WHERE status = 'CONFIRMED';
CREATE INDEX idx_payments_date_range ON payments(project_id, payment_date, verification_status)
  WHERE verification_status = 'VERIFIED';

-- Category-based aggregations
CREATE INDEX idx_expenses_category_sum ON expenses(project_id, category, date, amount)
  WHERE status = 'APPROVED';
CREATE INDEX idx_income_type_sum ON income(project_id, income_type, revenue_date, net_amount)
  WHERE status = 'CONFIRMED';

-- Multi-resort reporting
CREATE INDEX idx_cross_resort_expenses ON expenses(date, category, amount)
  WHERE status = 'APPROVED';
CREATE INDEX idx_cross_resort_income ON income(revenue_date, platform, net_amount)
  WHERE status = 'CONFIRMED';

-- Audit trail searches
CREATE INDEX idx_audit_financial ON audit_trail(project_id, entity_type, created_at DESC)
  WHERE entity_type IN ('EXPENSE', 'INCOME', 'PAYMENT');
CREATE INDEX idx_audit_amount_changes ON audit_trail(project_id, amount_before, amount_after)
  WHERE amount_before IS NOT NULL;

-- Vendor and payment method analysis
CREATE INDEX idx_vendor_spending ON expenses(project_id, vendor_tin, date, amount)
  WHERE vendor_tin IS NOT NULL;
CREATE INDEX idx_payment_methods ON payments(project_id, payment_method, payment_date);

-- Receipt and OCR processing
CREATE INDEX idx_receipts_pending_ocr ON receipts(project_id, ocr_processed)
  WHERE ocr_processed = false;
CREATE INDEX idx_receipts_verification ON receipts(project_id, manually_verified)
  WHERE manually_verified = false;

-- Approval workflow
CREATE INDEX idx_expenses_pending_approval ON expenses(project_id, status, approval_level)
  WHERE status = 'PENDING_APPROVAL';
CREATE INDEX idx_expenses_payment_due ON expenses(project_id, payment_status, date)
  WHERE payment_status = 'PENDING';

-- VAT and tax reporting
CREATE INDEX idx_vat_calculation ON income(project_id, revenue_date, vat_amount)
  WHERE is_vatable = true;
CREATE INDEX idx_withholding_tax ON expenses(project_id, date, withholding_tax_amount)
  WHERE withholding_tax_amount > 0;
```

## Summary

This financial database schema provides:

1. **Complete Financial Tables**: All required tables with Philippine compliance
   fields
2. **Clear Data Isolation**: Simple application-level filtering as primary
   approach
3. **Practical Query Examples**: Real-world Drizzle ORM queries for resort
   operations
4. **Receipt Management**: Complete workflow from upload to OCR to compliance
5. **Performance Optimization**: Strategic indexes for common financial queries

### Key Principles

- **Simple First**: Application-level filtering for 1-3 properties
- **Compliance Built-in**: BIR requirements, VAT handling, retention policies
- **Audit Everything**: Complete trail for financial transactions
- **Performance Focused**: Indexes on commonly queried fields
- **Philippine Ready**: Peso handling, GCash support, local tax rules

### Implementation Priority

1. Start with basic expense and income tracking
2. Add payment processing with GCash/bank transfers
3. Implement receipt upload and storage
4. Add balance calculation and reporting
5. Enable approval workflows
6. Integrate OCR (when volume justifies)
7. Add advanced analytics and forecasting

Remember: For family resorts with 1-3 properties, **simple application-level
filtering is sufficient**. RLS is only for future scaling to 10+ properties.
