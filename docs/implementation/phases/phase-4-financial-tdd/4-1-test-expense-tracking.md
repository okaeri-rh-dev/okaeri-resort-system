# Phase 4.1: Test Expense Tracking (RED Phase)

## Overview

This document defines comprehensive test specifications for the expense tracking
module, focusing on Philippine resort operational expenses and BIR compliance
requirements. All tests must fail initially as no implementation exists yet.

## Agent Responsibility

**Financial Systems Architect**: Design and validate all expense-related test
cases ensuring Philippine regulatory compliance and resort-specific
requirements.

## Test Categories

### 1. Expense CRUD Operations

#### Test Suite: ExpenseManagement

```typescript
describe("ExpenseManagement", () => {
  describe("Expense Creation", () => {
    it("should create an expense with all required fields", async () => {
      const expense = {
        date: new Date("2025-01-15"),
        category: "UTILITIES",
        subcategory: "Electricity",
        vendor: "Meralco",
        description: "Monthly electricity bill",
        amount: 15750.0,
        vatAmount: 1687.5,
        netAmount: 14062.5,
        paymentMethod: "BANK_TRANSFER",
        referenceNumber: "OR-2025-0001",
        attachments: ["receipt-001.pdf"],
      };

      const result = await expenseService.create(expense);

      expect(result.id).toBeDefined();
      expect(result.amount).toBe(15750.0);
      expect(result.vatAmount).toBe(1687.5);
      expect(result.auditLog).toHaveLength(1);
    });

    it("should validate Philippine peso amounts (2 decimal places)", async () => {
      const invalidExpense = {
        amount: 1000.555, // Invalid: 3 decimal places
      };

      await expect(expenseService.create(invalidExpense)).rejects.toThrow(
        "Amount must have maximum 2 decimal places"
      );
    });

    it("should require vendor TIN for amounts above PHP 10,000", async () => {
      const expense = {
        amount: 15000.0,
        vendor: "Supplier Inc.",
        vendorTin: null,
      };

      await expect(expenseService.create(expense)).rejects.toThrow(
        "Vendor TIN required for amounts above PHP 10,000"
      );
    });
  });

  describe("Expense Categories", () => {
    it("should categorize expenses according to resort operations", async () => {
      const categories = await expenseService.getCategories();

      expect(categories).toEqual(
        expect.arrayContaining([
          {
            code: "UTILITIES",
            name: "Utilities",
            subcategories: ["Electricity", "Water", "Internet", "Gas"],
          },
          {
            code: "SUPPLIES",
            name: "Supplies",
            subcategories: ["Housekeeping", "Kitchen", "Office", "Pool"],
          },
          {
            code: "MAINTENANCE",
            name: "Maintenance",
            subcategories: [
              "Repairs",
              "Preventive",
              "Equipment",
              "Landscaping",
            ],
          },
          {
            code: "MARKETING",
            name: "Marketing",
            subcategories: [
              "Online Ads",
              "Commissions",
              "Promotions",
              "Materials",
            ],
          },
          {
            code: "PAYROLL",
            name: "Payroll",
            subcategories: [
              "Salaries",
              "Benefits",
              "SSS",
              "PhilHealth",
              "PagIBIG",
            ],
          },
          {
            code: "PROFESSIONAL",
            name: "Professional Fees",
            subcategories: ["Accounting", "Legal", "Consulting"],
          },
          {
            code: "PERMITS",
            name: "Permits & Licenses",
            subcategories: ["Business Permit", "Tourism", "Health", "Fire"],
          },
          {
            code: "INSURANCE",
            name: "Insurance",
            subcategories: ["Property", "Liability", "Vehicle", "Employee"],
          },
          {
            code: "EQUIPMENT",
            name: "Equipment",
            subcategories: ["Purchase", "Rental", "Software"],
          },
          {
            code: "FOOD_BEVERAGE",
            name: "Food & Beverage",
            subcategories: ["Ingredients", "Beverages", "Packaging"],
          },
        ])
      );
    });

    it("should track capital vs operational expenses", async () => {
      const capitalExpense = {
        category: "EQUIPMENT",
        subcategory: "Purchase",
        description: "New aircon unit",
        amount: 45000.0,
        isCapital: true,
        depreciationYears: 5,
      };

      const result = await expenseService.create(capitalExpense);

      expect(result.isCapital).toBe(true);
      expect(result.monthlyDepreciation).toBe(750.0); // 45000 / (5 * 12)
    });
  });

  describe("Expense Validation", () => {
    it("should validate expense date is not in the future", async () => {
      const futureExpense = {
        date: new Date("2030-01-01"),
        amount: 1000.0,
      };

      await expect(expenseService.create(futureExpense)).rejects.toThrow(
        "Expense date cannot be in the future"
      );
    });

    it("should validate expense amount is positive", async () => {
      const negativeExpense = {
        amount: -500.0,
      };

      await expect(expenseService.create(negativeExpense)).rejects.toThrow(
        "Expense amount must be positive"
      );
    });

    it("should validate required fields based on payment method", async () => {
      const bankTransfer = {
        paymentMethod: "BANK_TRANSFER",
        bankReferenceNumber: null,
      };

      await expect(expenseService.create(bankTransfer)).rejects.toThrow(
        "Bank reference number required for bank transfers"
      );
    });
  });
});
```

### 2. Receipt and Document Handling

#### Test Suite: ReceiptManagement

```typescript
describe("ReceiptManagement", () => {
  describe("Receipt Upload", () => {
    it("should upload and store receipt images", async () => {
      const file = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" });
      const expenseId = "exp-123";

      const result = await receiptService.upload(expenseId, file);

      expect(result.url).toMatch(/^https:\/\/storage.*\/receipts\//);
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.metadata.size).toBeLessThan(10 * 1024 * 1024); // Max 10MB
    });

    it("should validate allowed file types", async () => {
      const invalidFile = new File(["data"], "file.exe", {
        type: "application/exe",
      });

      await expect(
        receiptService.upload("exp-123", invalidFile)
      ).rejects.toThrow("File type not allowed. Allowed types: jpg, png, pdf");
    });

    it("should extract text from receipts using OCR", async () => {
      const receiptImage = await loadTestReceipt("meralco-bill.jpg");

      const extracted = await receiptService.extractText(receiptImage);

      expect(extracted.vendor).toBe("Manila Electric Company");
      expect(extracted.amount).toBe(5750.25);
      expect(extracted.date).toEqual(new Date("2025-01-15"));
      expect(extracted.referenceNumber).toBe("123456789");
    });

    it("should match receipt data with expense entry", async () => {
      const expense = {
        vendor: "Meralco",
        amount: 5750.25,
        date: new Date("2025-01-15"),
      };

      const receipt = {
        extractedVendor: "Manila Electric Company",
        extractedAmount: 5750.25,
        extractedDate: new Date("2025-01-15"),
      };

      const validation = await receiptService.validateMatch(expense, receipt);

      expect(validation.isValid).toBe(true);
      expect(validation.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("Official Receipt Generation", () => {
    it("should generate BIR-compliant official receipts", async () => {
      const expense = {
        id: "exp-123",
        vendor: "ABC Supplies",
        amount: 11200.0,
        vatAmount: 1200.0,
        date: new Date("2025-01-15"),
      };

      const receipt = await receiptService.generateOR(expense);

      expect(receipt.orNumber).toMatch(/^OR-\d{4}-\d{6}$/);
      expect(receipt.tin).toBe("123-456-789-000");
      expect(receipt.permitToPrint).toBe("PTR-2025-001");
      expect(receipt.machineNumber).toBeDefined();
      expect(receipt.vatBreakdown).toEqual({
        vatableSales: 10000.0,
        vatAmount: 1200.0,
        totalAmount: 11200.0,
      });
    });

    it("should handle non-VAT official receipts", async () => {
      const expense = {
        amount: 5000.0,
        isVatable: false,
      };

      const receipt = await receiptService.generateOR(expense);

      expect(receipt.vatBreakdown).toBeNull();
      expect(receipt.totalAmount).toBe(5000.0);
      expect(receipt.footer).toContain("NON-VAT Reg. TIN");
    });
  });

  describe("Document Storage", () => {
    it("should organize receipts by year and month", async () => {
      const expense = {
        date: new Date("2025-01-15"),
        id: "exp-123",
      };

      const path = await receiptService.getStoragePath(expense);

      expect(path).toBe("receipts/2025/01/exp-123/");
    });

    it("should maintain receipt retention for 5 years (BIR requirement)", async () => {
      const oldExpense = {
        date: new Date("2019-01-01"),
        id: "exp-old",
      };

      const retention = await receiptService.checkRetention(oldExpense);

      expect(retention.shouldArchive).toBe(true);
      expect(retention.expiryDate).toEqual(new Date("2024-01-01"));
    });
  });
});
```

### 3. Vendor Management

#### Test Suite: VendorManagement

```typescript
describe("VendorManagement", () => {
  describe("Vendor CRUD", () => {
    it("should create vendor with Philippine business details", async () => {
      const vendor = {
        name: "ABC Supplies Inc.",
        tin: "123-456-789-000",
        address: "123 Main St., Makati City",
        contactPerson: "Juan Dela Cruz",
        contactNumber: "+639171234567",
        email: "purchasing@abcsupplies.ph",
        paymentTerms: "NET_30",
        category: "SUPPLIES",
      };

      const result = await vendorService.create(vendor);

      expect(result.id).toBeDefined();
      expect(result.tin).toMatch(/^\d{3}-\d{3}-\d{3}-\d{3}$/);
    });

    it("should validate Philippine TIN format", async () => {
      const invalidVendor = {
        tin: "123-45-678-900", // Invalid format
      };

      await expect(vendorService.create(invalidVendor)).rejects.toThrow(
        "Invalid TIN format. Use XXX-XXX-XXX-XXX"
      );
    });

    it("should track vendor payment history", async () => {
      const vendorId = "vendor-123";

      const history = await vendorService.getPaymentHistory(vendorId);

      expect(history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(Date),
            amount: expect.any(Number),
            paymentMethod: expect.any(String),
            referenceNumber: expect.any(String),
            status: expect.stringMatching(/^(PAID|PENDING|OVERDUE)$/),
          }),
        ])
      );
    });

    it("should calculate vendor payment analytics", async () => {
      const vendorId = "vendor-123";
      const dateRange = {
        from: new Date("2025-01-01"),
        to: new Date("2025-01-31"),
      };

      const analytics = await vendorService.getAnalytics(vendorId, dateRange);

      expect(analytics).toEqual({
        totalPurchases: expect.any(Number),
        averageAmount: expect.any(Number),
        paymentPerformance: expect.any(Number), // % paid on time
        outstandingBalance: expect.any(Number),
        lastPurchaseDate: expect.any(Date),
      });
    });
  });

  describe("Withholding Tax", () => {
    it("should calculate EWT for professional services", async () => {
      const expense = {
        vendor: "Juan Dela Cruz CPA",
        vendorType: "INDIVIDUAL_PROFESSIONAL",
        category: "PROFESSIONAL",
        amount: 10000.0,
      };

      const withholding = await vendorService.calculateWithholding(expense);

      expect(withholding.rate).toBe(0.1); // 10% for individuals
      expect(withholding.amount).toBe(1000.0);
      expect(withholding.netPayment).toBe(9000.0);
      expect(withholding.form).toBe("2307"); // BIR Form 2307
    });

    it("should calculate EWT for corporate vendors", async () => {
      const expense = {
        vendor: "ABC Consulting Corp.",
        vendorType: "CORPORATION",
        category: "PROFESSIONAL",
        amount: 20000.0,
      };

      const withholding = await vendorService.calculateWithholding(expense);

      expect(withholding.rate).toBe(0.15); // 15% for corporations
      expect(withholding.amount).toBe(3000.0);
      expect(withholding.netPayment).toBe(17000.0);
    });

    it("should generate withholding tax certificates", async () => {
      const expense = {
        id: "exp-123",
        vendor: "Professional Services Inc.",
        amount: 15000.0,
        withholdingTax: 2250.0,
        date: new Date("2025-01-15"),
      };

      const certificate = await vendorService.generateWTCert(expense);

      expect(certificate.formNumber).toBe("2307");
      expect(certificate.payee).toBe("Professional Services Inc.");
      expect(certificate.incomePayment).toBe(15000.0);
      expect(certificate.taxWithheld).toBe(2250.0);
    });
  });
});
```

### 4. Petty Cash Management

#### Test Suite: PettyCashManagement

```typescript
describe("PettyCashManagement", () => {
  describe("Petty Cash Fund", () => {
    it("should establish petty cash fund", async () => {
      const fund = {
        amount: 10000.0,
        custodian: "Maria Santos",
        effectiveDate: new Date("2025-01-01"),
      };

      const result = await pettyCashService.establishFund(fund);

      expect(result.balance).toBe(10000.0);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].type).toBe("FUND_ESTABLISHMENT");
    });

    it("should record petty cash disbursements", async () => {
      const disbursement = {
        date: new Date("2025-01-15"),
        amount: 250.0,
        purpose: "Office supplies",
        requestedBy: "John Doe",
        approvedBy: "Maria Santos",
        voucherNumber: "PCV-2025-001",
      };

      const result = await pettyCashService.disburse(disbursement);

      expect(result.remainingBalance).toBe(9750.0);
      expect(result.voucherNumber).toMatch(/^PCV-\d{4}-\d{3}$/);
    });

    it("should enforce petty cash limits", async () => {
      const largeDisbursement = {
        amount: 5000.0, // Exceeds typical limit
        purpose: "Equipment purchase",
      };

      await expect(
        pettyCashService.disburse(largeDisbursement)
      ).rejects.toThrow("Amount exceeds petty cash limit of PHP 2,000");
    });

    it("should trigger replenishment when balance is low", async () => {
      const fund = await pettyCashService.getFund();

      expect(fund.balance).toBe(1500.0);
      expect(fund.requiresReplenishment).toBe(true);
      expect(fund.replenishmentAmount).toBe(8500.0); // To restore to 10000
    });
  });

  describe("Petty Cash Reconciliation", () => {
    it("should perform daily petty cash reconciliation", async () => {
      const reconciliation = {
        date: new Date("2025-01-15"),
        cashCount: 7250.0,
        receiptsTotal: 2750.0,
        fundAmount: 10000.0,
      };

      const result = await pettyCashService.reconcile(reconciliation);

      expect(result.isBalanced).toBe(true);
      expect(result.variance).toBe(0);
      expect(result.status).toBe("BALANCED");
    });

    it("should detect cash shortages and overages", async () => {
      const reconciliation = {
        cashCount: 7000.0,
        receiptsTotal: 2750.0,
        fundAmount: 10000.0,
      };

      const result = await pettyCashService.reconcile(reconciliation);

      expect(result.isBalanced).toBe(false);
      expect(result.variance).toBe(-250.0);
      expect(result.status).toBe("SHORT");
      expect(result.requiresInvestigation).toBe(true);
    });

    it("should generate petty cash reports", async () => {
      const dateRange = {
        from: new Date("2025-01-01"),
        to: new Date("2025-01-31"),
      };

      const report = await pettyCashService.generateReport(dateRange);

      expect(report).toEqual({
        openingBalance: 10000.0,
        totalDisbursements: 8500.0,
        totalReplenishments: 8500.0,
        closingBalance: 10000.0,
        transactions: expect.any(Array),
        reconciliations: expect.any(Array),
        variances: expect.any(Array),
      });
    });
  });
});
```

### 5. Expense Approval Workflow

#### Test Suite: ExpenseApprovalWorkflow

```typescript
describe("ExpenseApprovalWorkflow", () => {
  describe("Approval Rules", () => {
    it("should auto-approve expenses below threshold", async () => {
      const expense = {
        amount: 500.0,
        category: "SUPPLIES",
      };

      const result = await approvalService.submit(expense);

      expect(result.status).toBe("AUTO_APPROVED");
      expect(result.approvedBy).toBe("SYSTEM");
      expect(result.approvalDate).toBeDefined();
    });

    it("should require manager approval for mid-range expenses", async () => {
      const expense = {
        amount: 5000.0,
        category: "MAINTENANCE",
      };

      const result = await approvalService.submit(expense);

      expect(result.status).toBe("PENDING_MANAGER");
      expect(result.approvalLevel).toBe(1);
      expect(result.notificationSent).toBe(true);
    });

    it("should require owner approval for high-value expenses", async () => {
      const expense = {
        amount: 50000.0,
        category: "EQUIPMENT",
      };

      const result = await approvalService.submit(expense);

      expect(result.status).toBe("PENDING_OWNER");
      expect(result.approvalLevel).toBe(2);
      expect(result.escalated).toBe(true);
    });

    it("should enforce approval limits by role", async () => {
      const manager = { role: "MANAGER", approvalLimit: 10000.0 };
      const expense = { amount: 15000.0 };

      await expect(approvalService.approve(expense, manager)).rejects.toThrow(
        "Approval amount exceeds your limit"
      );
    });
  });

  describe("Approval Tracking", () => {
    it("should maintain complete approval audit trail", async () => {
      const expenseId = "exp-123";

      const auditTrail = await approvalService.getAuditTrail(expenseId);

      expect(auditTrail).toEqual(
        expect.arrayContaining([
          {
            action: "SUBMITTED",
            user: "john.doe@resort.ph",
            timestamp: expect.any(Date),
            notes: expect.any(String),
          },
          {
            action: "APPROVED",
            user: "manager@resort.ph",
            timestamp: expect.any(Date),
            notes: expect.any(String),
          },
        ])
      );
    });

    it("should handle rejection with reasons", async () => {
      const expense = { id: "exp-123" };
      const rejection = {
        reason: "BUDGET_EXCEEDED",
        notes: "This expense exceeds monthly budget allocation",
      };

      const result = await approvalService.reject(expense, rejection);

      expect(result.status).toBe("REJECTED");
      expect(result.rejectionReason).toBe("BUDGET_EXCEEDED");
      expect(result.canResubmit).toBe(true);
    });
  });
});
```

## Test Execution Plan

### Environment Setup

```bash
# Install test dependencies
npm install --save-dev @testing-library/react vitest @vitest/ui
npm install --save-dev @faker-js/faker dayjs

# Configure test database
export TEST_DATABASE_URL="postgresql://test:test@localhost:5432/okaeri_test"

# Set test environment variables
export NODE_ENV=test
export BIR_API_KEY=test_key_123
export STORAGE_PATH=/tmp/okaeri-test-storage
```

### Test Data Fixtures

```typescript
// fixtures/expenses.ts
export const sampleExpenses = {
  utility: {
    date: new Date("2025-01-15"),
    category: "UTILITIES",
    vendor: "Meralco",
    amount: 15750.0,
    vatAmount: 1687.5,
  },
  supply: {
    date: new Date("2025-01-10"),
    category: "SUPPLIES",
    vendor: "Office Warehouse",
    amount: 3500.0,
    vatAmount: 375.0,
  },
  professional: {
    date: new Date("2025-01-20"),
    category: "PROFESSIONAL",
    vendor: "ABC Accounting",
    amount: 20000.0,
    withholdingTax: 3000.0,
  },
};

// fixtures/vendors.ts
export const sampleVendors = {
  utility: {
    name: "Manila Electric Company",
    tin: "000-123-456-000",
    category: "UTILITIES",
  },
  supplier: {
    name: "ABC Supplies Inc.",
    tin: "123-456-789-000",
    category: "SUPPLIES",
  },
};
```

### Performance Benchmarks

```typescript
describe("Performance Tests", () => {
  it("should create 1000 expenses in under 5 seconds", async () => {
    const start = Date.now();
    const expenses = generateBulkExpenses(1000);

    await expenseService.bulkCreate(expenses);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  it("should generate monthly report in under 2 seconds", async () => {
    const start = Date.now();

    await reportService.generateMonthly("2025-01");

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });
});
```

## Success Criteria

### Test Coverage Requirements

- **Unit Tests**: 90% code coverage
- **Integration Tests**: All API endpoints tested
- **E2E Tests**: Critical user workflows covered
- **Edge Cases**: All validation rules tested

### Compliance Validation

- All BIR requirements properly tested
- VAT calculations accurate to centavo
- Withholding tax scenarios covered
- Receipt generation format validated

### Performance Metrics

- Expense creation: < 100ms
- Receipt upload: < 2s
- Report generation: < 2s for 1000 records
- Search and filter: < 500ms

## Next Phase

Upon completion of all RED phase tests, proceed to Phase 4.2 for income
management testing before any implementation begins.

---

**Phase Lead**: Financial Systems Architect **Document Status**: RED Phase -
Test Specification **Tests Written**: 0 **Tests Passing**: 0 **Target**: 100%
test definition before implementation
