# Sub-Phase 3.1: Financial Data Model & Architecture

## Overview
This sub-phase establishes the foundational data model and architecture for the financial management system, including expense tracking, income consolidation, category management, and financial reporting structures optimized for serverless PostgreSQL.

## Objectives
1. Design comprehensive expense and income schemas
2. Create financial API endpoint specifications
3. Implement Zod validation schemas for all financial entities
4. Setup category and payment method management
5. Establish financial calculation standards

## Technical Requirements

### Core Dependencies
```json
{
  "dependencies": {
    "zod": "^3.24.0",
    "decimal.js": "^10.4.0",
    "date-fns": "^4.1.0",
    "nanoid": "^5.0.9",
    "@types/node": "^20.17.0"
  }
}
```

### Database Schema
```sql
-- Expense Categories
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B7280',
  icon VARCHAR(50),
  parent_id UUID REFERENCES expense_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, slug)
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  category_id UUID NOT NULL REFERENCES expense_categories(id),
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  payment_method VARCHAR(50),
  vendor VARCHAR(255),
  receipt_url TEXT,
  receipt_metadata JSONB,
  tags TEXT[],
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_expenses_project_date (project_id, expense_date),
  INDEX idx_expenses_category (category_id)
);

-- Income Records
CREATE TABLE income_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  booking_id UUID REFERENCES bookings(id),
  source VARCHAR(50) NOT NULL, -- 'airbnb', 'direct', 'fb_messenger'
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  income_date DATE NOT NULL,
  payment_method VARCHAR(50),
  commission_amount DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL,
  reference_number VARCHAR(255),
  notes TEXT,
  metadata JSONB,
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_income_project_date (project_id, income_date),
  INDEX idx_income_source (source),
  INDEX idx_income_booking (booking_id)
);

-- Financial Summaries (Materialized View)
CREATE MATERIALIZED VIEW financial_summaries AS
SELECT 
  project_id,
  DATE_TRUNC('month', expense_date) as period,
  SUM(amount) as total_expenses,
  COUNT(*) as expense_count,
  AVG(amount) as avg_expense
FROM expenses
GROUP BY project_id, DATE_TRUNC('month', expense_date);

CREATE INDEX idx_financial_summaries ON financial_summaries(project_id, period);
```

## Agent Validation Checklist

### postgres-serverless-architect Validation
- [ ] Schema optimized for serverless connection patterns
- [ ] Proper indexing for common query patterns
- [ ] Materialized views for expensive aggregations
- [ ] Transaction boundaries well-defined
- [ ] Connection pooling considerations addressed
- [ ] Data types appropriate for financial precision
- [ ] Backup and recovery strategy defined
- [ ] Multi-tenant isolation properly enforced

### resort-finance-architect Validation
- [ ] Decimal precision adequate for currency calculations
- [ ] Commission calculation fields comprehensive
- [ ] Tax handling provisions included
- [ ] Multiple currency support structure
- [ ] Audit trail fields present
- [ ] Financial period alignment correct
- [ ] Reconciliation workflow supported
- [ ] Philippine business requirements met

## Implementation Details

### 1. Type Definitions
```typescript
// src/types/financial.ts
import { z } from 'zod';
import Decimal from 'decimal.js';

// Expense Category Types
export const ExpenseCategorySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().max(50).optional(),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

// Expense Types
export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.string().transform(val => new Decimal(val)),
  currency: z.enum(['PHP', 'USD', 'EUR']).default('PHP'),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  expenseDate: z.date(),
  paymentMethod: z.enum(['cash', 'gcash', 'bank_transfer', 'credit_card', 'other']).optional(),
  vendor: z.string().max(255).optional(),
  receiptUrl: z.string().url().optional(),
  receiptMetadata: z.object({
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
    uploadedAt: z.date()
  }).optional(),
  tags: z.array(z.string()).default([]),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().min(1),
    endDate: z.date().optional()
  }).optional(),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type Expense = z.infer<typeof ExpenseSchema>;

// Income Types
export const IncomeRecordSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  source: z.enum(['airbnb', 'direct', 'fb_messenger', 'other']),
  amount: z.string().transform(val => new Decimal(val)),
  currency: z.enum(['PHP', 'USD', 'EUR']).default('PHP'),
  incomeDate: z.date(),
  paymentMethod: z.enum(['cash', 'gcash', 'bank_transfer', 'platform', 'other']).optional(),
  commissionAmount: z.string().transform(val => new Decimal(val)).default('0'),
  netAmount: z.string().transform(val => new Decimal(val)),
  referenceNumber: z.string().max(255).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  reconciled: z.boolean().default(false),
  reconciledAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type IncomeRecord = z.infer<typeof IncomeRecordSchema>;

// Financial Summary Types
export interface FinancialSummary {
  projectId: string;
  period: Date;
  totalExpenses: Decimal;
  totalIncome: Decimal;
  netProfit: Decimal;
  expensesByCategory: Record<string, Decimal>;
  incomeBySource: Record<string, Decimal>;
  topExpenses: Expense[];
  metrics: {
    avgDailyExpense: Decimal;
    avgDailyIncome: Decimal;
    occupancyRate: number;
    avgBookingValue: Decimal;
  };
}
```

### 2. API Endpoint Specifications
```typescript
// src/api/financial/routes.ts

// Expense Endpoints
POST   /api/expenses                 // Create expense
GET    /api/expenses                 // List expenses with filters
GET    /api/expenses/:id            // Get expense details
PUT    /api/expenses/:id            // Update expense
DELETE /api/expenses/:id            // Delete expense
POST   /api/expenses/bulk           // Bulk create expenses
POST   /api/expenses/:id/receipt    // Upload receipt

// Income Endpoints
POST   /api/income                  // Create income record
GET    /api/income                  // List income with filters
GET    /api/income/:id             // Get income details
PUT    /api/income/:id             // Update income
POST   /api/income/reconcile       // Reconcile income records
GET    /api/income/pending         // Get unreconciled income

// Category Endpoints
GET    /api/categories              // List categories
POST   /api/categories              // Create category
PUT    /api/categories/:id         // Update category
DELETE /api/categories/:id         // Delete category

// Summary Endpoints
GET    /api/financial/summary      // Get financial summary
GET    /api/financial/metrics      // Get KPI metrics
GET    /api/financial/trends       // Get trend analysis
```

### 3. Validation Schemas
```typescript
// src/validations/financial.ts
import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    expenseDate: z.string().datetime(),
    paymentMethod: z.enum(['cash', 'gcash', 'bank_transfer', 'credit_card', 'other']).optional(),
    vendor: z.string().max(255).optional(),
    tags: z.array(z.string()).optional()
  })
});

export const ExpenseFilterSchema = z.object({
  query: z.object({
    projectId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    minAmount: z.string().optional(),
    maxAmount: z.string().optional(),
    paymentMethod: z.string().optional(),
    search: z.string().optional(),
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20')
  })
});
```

## Testing Requirements

### Unit Tests
```typescript
describe('Financial Calculations', () => {
  it('should calculate net income correctly', () => {});
  it('should handle currency conversions', () => {});
  it('should aggregate expenses by category', () => {});
  it('should calculate financial metrics', () => {});
});

describe('Validation Schemas', () => {
  it('should validate expense creation data', () => {});
  it('should validate income records', () => {});
  it('should reject invalid amounts', () => {});
});
```

### Integration Tests
```typescript
describe('Financial API', () => {
  it('should create expense with receipt', async () => {});
  it('should reconcile income records', async () => {});
  it('should generate financial summary', async () => {});
  it('should handle concurrent transactions', async () => {});
});
```

## Success Criteria
1. **Data Model** - All schemas created and optimized
2. **Type Safety** - 100% TypeScript coverage with no `any`
3. **Validation** - All inputs validated with Zod
4. **Performance** - Queries execute in < 100ms
5. **Accuracy** - Financial calculations precise to 2 decimal places
6. **Multi-tenancy** - Project isolation enforced
7. **Audit Trail** - All financial records traceable
8. **Testing** - 90% test coverage achieved

## Deliverables
- [ ] Complete database schema with migrations
- [ ] TypeScript type definitions
- [ ] Zod validation schemas
- [ ] API endpoint specifications
- [ ] Financial calculation utilities
- [ ] Category management system
- [ ] Unit and integration tests
- [ ] Performance benchmarks

---

*Sub-Phase 3.1 establishes a robust financial data foundation optimized for serverless architecture and Philippine business requirements.*