# Sub-Phase 3.2: Expense Management System

## Overview

This sub-phase implements a comprehensive expense management system with CRUD
operations, intelligent categorization, receipt upload to Cloudflare R2, and
bulk operations for efficient financial tracking.

## Objectives

1. Implement expense CRUD operations with optimistic updates
2. Create intelligent categorization with auto-suggestions
3. Build receipt upload system with image optimization
4. Add bulk expense operations for efficiency
5. Implement expense search and filtering

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.71.10",
    "zustand": "^5.0.2",
    "react-dropzone": "^14.3.5",
    "sharp": "^0.33.5",
    "@aws-sdk/client-s3": "^3.716.0",
    "@aws-sdk/s3-request-presigner": "^3.716.0"
  }
}
```

## Test-First Development Process

### Step 1: Define Test Specifications

- Agent writes comprehensive test suite based on requirements
- Tests cover expected input/output pairs for expense management system
- Include edge cases, error scenarios, and Philippine-specific requirements
- Reference test templates from `/tests/templates/`

### Step 2: Validate Tests Fail

- Run test suite to confirm all tests fail (no implementation exists)
- Command: `npm test expense-management.test.ts`
- Expected: All tests should fail with clear error messages
- NO implementation code should be written at this stage

### Step 3: Commit Test Suite

- Tests are committed as the immutable specification
- Commit message: "test: add failing tests for expense management system"
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

## Agent Validation Checklist

### modern-form-validation-expert Validation

- [ ] Expense form with React Hook Form configured
- [ ] Zod validation for amount, date, category
- [ ] File upload validation for receipts
- [ ] Multi-currency input handling
- [ ] Date picker with range validation
- [ ] Category selection with auto-complete
- [ ] Bulk import form validation
- [ ] Error recovery and field persistence

### vercel-resort-api-architect Validation

- [ ] API endpoints optimized for serverless execution
- [ ] Receipt upload uses presigned URLs efficiently
- [ ] Bulk operations handle large datasets
- [ ] Error handling comprehensive with retry logic
- [ ] Pagination implemented for list endpoints
- [ ] Search functionality uses appropriate indexes
- [ ] File upload limits enforced (10MB)
- [ ] Response times < 200ms for CRUD operations

### security-compliance-auditor Validation

- [ ] Receipt files validated for type and size
- [ ] Presigned URLs expire appropriately (15 min)
- [ ] No sensitive data in logs or responses
- [ ] Input sanitization prevents injection
- [ ] File upload scans for malicious content
- [ ] Access control enforces project isolation
- [ ] Audit trail maintained for all operations
- [ ] PII handling compliant with regulations

## Success Criteria

1. **CRUD Operations** - All expense operations < 200ms
2. **Receipt Upload** - Images optimized and stored in < 2s
3. **Categorization** - Auto-suggestions with 90% accuracy
4. **Bulk Import** - Process 100 expenses in < 5s
5. **Search** - Filter results in < 100ms
6. **Validation** - 100% of inputs validated
7. **Security** - Zero vulnerabilities in upload flow
8. **Performance** - UI updates optimistically

## Deliverables

- [ ] Expense CRUD API implementation
- [ ] Receipt upload with presigned URLs
- [ ] Image optimization pipeline
- [ ] Bulk import functionality
- [ ] Category auto-suggestion system
- [ ] Search and filter implementation
- [ ] Optimistic UI updates
- [ ] Comprehensive test suite

---

_Sub-Phase 3.2 implements secure and efficient expense management optimized for
serverless architecture._
