# Sub-Phase 3.1: Financial Data Model & Architecture

## Overview

This sub-phase establishes the foundational data model and architecture for the
financial management system, including expense tracking, income consolidation,
category management, and financial reporting structures optimized for serverless
PostgreSQL.

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

## Test-First Development Process

### Step 1: Define Test Specifications

- Agent writes comprehensive test suite based on requirements
- Tests cover expected input/output pairs for financial data model
- Include edge cases, error scenarios, and Philippine-specific requirements
- Reference test templates from `/tests/templates/`

### Step 2: Validate Tests Fail

- Run test suite to confirm all tests fail (no implementation exists)
- Command: `npm test financial-data-model.test.ts`
- Expected: All tests should fail with clear error messages
- NO implementation code should be written at this stage

### Step 3: Commit Test Suite

- Tests are committed as the immutable specification
- Commit message: "test: add failing tests for financial data model"
- These tests CANNOT be modified during implementation

### Step 4: Implement Feature

- Agent writes minimal code to pass ALL tests
- Tests remain unchanged - implementation must adapt
- Use repository patterns from `/src/lib/repositories/`
- Apply dependency injection for testability

### Step 5: Independent Verification

- Different specialized agent reviews implementation
- Ensures no overfitting to test cases
- Validates general solution beyond test scenarios
- Confirms best practices and patterns are followed

### Test Coverage Areas

#### Database Schema Tests

```typescript
describe("Financial Schema", () => {
  it("should create expense categories with proper constraints", () => {});
  it("should handle hierarchical categories", () => {});
  it("should maintain referential integrity for expenses", () => {});
  it("should calculate materialized view summaries correctly", () => {});
});
```

#### Type Definition Tests

```typescript
describe("Financial Types", () => {
  it("should validate expense creation with proper decimal handling", () => {});
  it("should enforce currency format validation", () => {});
  it("should validate income record transformations", () => {});
  it("should calculate financial summary metrics", () => {});
});
```

#### Validation Schema Tests

```typescript
describe("Financial Validations", () => {
  it("should validate expense creation data", () => {});
  it("should validate income records", () => {});
  it("should reject invalid amounts", () => {});
  it("should handle Philippine currency formatting", () => {});
});
```

#### API Endpoint Tests

```typescript
describe("Financial API", () => {
  it("should create expense with receipt upload", async () => {});
  it("should reconcile income records correctly", async () => {});
  it("should generate accurate financial summaries", async () => {});
  it("should handle concurrent financial transactions", async () => {});
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

_Sub-Phase 3.1 establishes a robust financial data foundation optimized for
serverless architecture and Philippine business requirements._
