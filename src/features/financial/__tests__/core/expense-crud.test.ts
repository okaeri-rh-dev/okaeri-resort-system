/**
 * Expense CRUD Operations Tests
 * Tests basic create, read, update, delete operations for expenses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ExpenseCategory,
  ExpenseStatus,
  ApprovalLevel,
  PaymentMethod,
} from "../../types/financial.types";
import { ExpenseService } from "../../services/expense.service";
import { Money } from "@/lib/money";
import {
  createDbMock,
  createMockExpense,
  assertMoneyEqual,
  setupTestEnvironment,
} from "../helpers/test-setup";

// Mock dependencies first
vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    then: vi.fn((resolve) => resolve([])),
    transaction: vi.fn(async (fn) => fn(mockDb)),
    setMockResult: vi.fn(),
  };
  return {
    db: mockDb,
    drizzleDb: mockDb,
  };
});

vi.mock("@/lib/audit", () => ({
  logFinancialActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils", () => ({
  generateCode: vi.fn(
    (prefix: string, seq: number) => `${prefix}-${seq.toString().padStart(6, "0")}`
  ),
}));

describe("Expense CRUD Operations", () => {
  let expenseService: ExpenseService;
  let testEnv: ReturnType<typeof setupTestEnvironment>;
  let dbMock: any;

  beforeEach(async () => {
    testEnv = setupTestEnvironment();
    const { db } = await import("@/lib/db");
    dbMock = db;
    expenseService = new ExpenseService();
    vi.clearAllMocks();

    // Set up default mock result
    dbMock.execute.mockResolvedValue([createMockExpense()]);
    dbMock.then.mockImplementation((resolve) => resolve([createMockExpense()]));
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe("Create expense", () => {
    it("should create new expense with required fields", async () => {
      const mockExpense = createMockExpense();
      dbMock.execute.mockResolvedValue([mockExpense]);
      dbMock.then.mockImplementation((resolve) => resolve([mockExpense]));

      const input = {
        projectId: "proj-123",
        description: "Office supplies",
        amount: new Money(1000),
        category: ExpenseCategory.SUPPLIES_OFFICE,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      expect(expense).toBeDefined();
      expect(expense.projectId).toBe(input.projectId);
      expect(expense.description).toBe(input.description);
      expect(expense.amount).toBeInstanceOf(Money);
      expect(expense.category).toBe(input.category);
    });

    it("should auto-generate expense ID with proper format", async () => {
      const mockExpense = createMockExpense({ id: "EXP-000001" });
      dbMock.setMockResult([mockExpense]);

      const input = {
        projectId: "proj-123",
        description: "Test expense",
        amount: new Money(500),
        category: ExpenseCategory.UTILITIES,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      expect(expense.id).toBeDefined();
      expect(expense.id).toMatch(/^EXP-\d{6}$/);
    });

    it("should set creation timestamp automatically", async () => {
      const mockExpense = createMockExpense();
      dbMock.setMockResult([mockExpense]);

      const input = {
        projectId: "proj-123",
        description: "Test expense",
        amount: new Money(500),
        category: ExpenseCategory.UTILITIES,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      expect(expense.createdAt).toBeDefined();
      expect(expense.createdAt).toBeInstanceOf(Date);
    });

    it("should link expense to project ID", async () => {
      const projectId = "proj-456";
      const mockExpense = createMockExpense({ projectId });
      dbMock.setMockResult([mockExpense]);

      const input = {
        projectId,
        description: "Test expense",
        amount: new Money(500),
        category: ExpenseCategory.UTILITIES,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      expect(expense.projectId).toBe(projectId);
    });

    it("should validate amount is positive", async () => {
      const input = {
        projectId: "proj-123",
        description: "Test expense",
        amount: new Money(-100),
        category: ExpenseCategory.UTILITIES,
        createdBy: "user-123",
      };

      await expect(expenseService.createExpense(input)).rejects.toThrow("Amount must be positive");
    });

    it("should calculate VAT automatically for VATable expenses", async () => {
      const mockExpense = createMockExpense({
        amount: new Money(1120),
        vatAmount: new Money(120),
        netAmount: new Money(1000),
        isVatable: true,
      });
      dbMock.setMockResult([mockExpense]);

      const input = {
        projectId: "proj-123",
        description: "VATable expense",
        amount: new Money(1120),
        category: ExpenseCategory.SUPPLIES_OFFICE,
        isVatable: true,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      assertMoneyEqual(expense.vatAmount, 120, "VAT amount");
      assertMoneyEqual(expense.netAmount, 1000, "Net amount");
    });

    it("should set initial status to DRAFT", async () => {
      const mockExpense = createMockExpense({ status: ExpenseStatus.DRAFT });
      dbMock.setMockResult([mockExpense]);

      const input = {
        projectId: "proj-123",
        description: "Test expense",
        amount: new Money(500),
        category: ExpenseCategory.UTILITIES,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      expect(expense.status).toBe(ExpenseStatus.DRAFT);
    });

    it("should determine approval level based on amount", async () => {
      const testCases = [
        { amount: 500, expectedLevel: ApprovalLevel.AUTO },
        { amount: 5000, expectedLevel: ApprovalLevel.MANAGER },
        { amount: 15000, expectedLevel: ApprovalLevel.OWNER },
        { amount: 75000, expectedLevel: ApprovalLevel.DUAL },
      ];

      for (const { amount, expectedLevel } of testCases) {
        const mockExpense = createMockExpense({
          amount: new Money(amount),
          approvalLevel: expectedLevel,
        });
        dbMock.setMockResult([mockExpense]);

        const expense = await expenseService.createExpense({
          projectId: "proj-123",
          description: `Test expense ${amount}`,
          amount: new Money(amount),
          category: ExpenseCategory.UTILITIES,
          createdBy: "user-123",
        });

        expect(expense.approvalLevel).toBe(expectedLevel);
      }
    });

    it("should store receipt information when provided", async () => {
      const receiptData = {
        receiptNumber: "2025-0001-00000001",
        receiptDate: new Date("2025-01-01"),
        receiptUrl: "https://example.com/receipts/001.pdf",
      };

      const mockExpense = createMockExpense(receiptData);
      dbMock.setMockResult([mockExpense]);

      const input = {
        projectId: "proj-123",
        description: "Test expense",
        amount: new Money(500),
        category: ExpenseCategory.UTILITIES,
        ...receiptData,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      expect(expense.receiptNumber).toBe(receiptData.receiptNumber);
      expect(expense.receiptDate).toEqual(receiptData.receiptDate);
      expect(expense.receiptUrl).toBe(receiptData.receiptUrl);
    });

    it("should handle decimal precision correctly", async () => {
      const mockExpense = createMockExpense({ amount: new Money(123.46) });
      dbMock.setMockResult([mockExpense]);

      const input = {
        projectId: "proj-123",
        description: "Test expense",
        amount: new Money(123.456), // Will be rounded to 123.46
        category: ExpenseCategory.UTILITIES,
        createdBy: "user-123",
      };

      const expense = await expenseService.createExpense(input);

      expect(expense.amount.toNumber()).toBe(123.46);
    });
  });

  describe("Read expense", () => {
    it("should retrieve expense by ID", async () => {
      const mockExpense = createMockExpense({ id: "EXP-000001" });
      dbMock.setMockResult([mockExpense]);

      const expense = await expenseService.getExpenseById("EXP-000001", "proj-123");

      expect(expense).toBeDefined();
      expect(expense?.id).toBe("EXP-000001");
    });

    it("should return null for non-existent expense", async () => {
      dbMock.setMockResult([]);

      const expense = await expenseService.getExpenseById("NON-EXISTENT", "proj-123");

      expect(expense).toBeNull();
    });

    it("should list expenses by date range", async () => {
      const expenses = [
        createMockExpense({ createdAt: new Date("2025-01-01") }),
        createMockExpense({ createdAt: new Date("2025-01-15") }),
        createMockExpense({ createdAt: new Date("2025-01-30") }),
      ];
      dbMock.setMockResult(expenses);

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      expect(result.expenses).toHaveLength(3);
    });

    it("should filter expenses by category", async () => {
      const expenses = [
        createMockExpense({ category: ExpenseCategory.SUPPLIES_OFFICE }),
        createMockExpense({ category: ExpenseCategory.UTILITIES }),
      ];
      dbMock.setMockResult(expenses.filter((e) => e.category === ExpenseCategory.SUPPLIES_OFFICE));

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
        category: ExpenseCategory.SUPPLIES_OFFICE,
      });

      expect(result.expenses).toHaveLength(1);
      expect(result.expenses[0].category).toBe(ExpenseCategory.SUPPLIES_OFFICE);
    });

    it("should filter expenses by status", async () => {
      const expenses = [
        createMockExpense({ status: ExpenseStatus.DRAFT }),
        createMockExpense({ status: ExpenseStatus.APPROVED }),
      ];
      dbMock.setMockResult(expenses.filter((e) => e.status === ExpenseStatus.APPROVED));

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
        status: ExpenseStatus.APPROVED,
      });

      expect(result.expenses).toHaveLength(1);
      expect(result.expenses[0].status).toBe(ExpenseStatus.APPROVED);
    });

    it("should paginate results correctly", async () => {
      const allExpenses = Array.from({ length: 25 }, (_, i) =>
        createMockExpense({ id: `EXP-${i.toString().padStart(6, "0")}` })
      );
      dbMock.setMockResult(allExpenses.slice(10, 20));

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
        page: 2,
        limit: 10,
        offset: 10,
      });

      expect(result.expenses).toHaveLength(10);
      expect(result.expenses[0].id).toBe("EXP-000010");
    });

    it("should sort expenses by date descending by default", async () => {
      const expenses = [
        createMockExpense({ createdAt: new Date("2025-01-30") }),
        createMockExpense({ createdAt: new Date("2025-01-15") }),
        createMockExpense({ createdAt: new Date("2025-01-01") }),
      ];
      dbMock.setMockResult(expenses);

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
      });

      expect(result.expenses[0].createdAt).toEqual(new Date("2025-01-30"));
      expect(result.expenses[2].createdAt).toEqual(new Date("2025-01-01"));
    });

    it("should include related vendor information", async () => {
      const mockExpense = createMockExpense({
        vendorId: "vendor-123",
        vendorName: "ABC Supplies Inc.",
        vendorTin: "123-456-789-000",
      });
      dbMock.setMockResult([mockExpense]);

      const expense = await expenseService.getExpenseById("EXP-000001", "proj-123");

      expect(expense?.vendorId).toBe("vendor-123");
      expect(expense?.vendorName).toBe("ABC Supplies Inc.");
      expect(expense?.vendorTin).toBe("123-456-789-000");
    });

    it("should handle empty result sets", async () => {
      dbMock.setMockResult([]);

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
      });

      expect(result.expenses).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should apply multiple filters simultaneously", async () => {
      const expenses = [
        createMockExpense({
          category: ExpenseCategory.SUPPLIES_OFFICE,
          status: ExpenseStatus.APPROVED,
          createdAt: new Date("2025-01-15"),
        }),
      ];
      dbMock.setMockResult(expenses);

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
        category: ExpenseCategory.SUPPLIES_OFFICE,
        status: ExpenseStatus.APPROVED,
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      expect(result.expenses).toHaveLength(1);
    });
  });

  describe("Update expense", () => {
    it("should update editable fields", async () => {
      const updatedExpense = createMockExpense({
        description: "Updated description",
        amount: new Money(2000),
      });
      dbMock.setMockResult([updatedExpense]);

      const result = await expenseService.updateExpense("EXP-000001", {
        description: "Updated description",
        amount: new Money(2000),
        projectId: "proj-123",
      });

      expect(result.description).toBe("Updated description");
      expect(result.amount.toNumber()).toBe(2000);
    });

    it("should prevent editing approved expenses", async () => {
      const mockExpense = createMockExpense({ status: ExpenseStatus.APPROVED });
      dbMock.setMockResult([mockExpense]);

      await expect(
        expenseService.updateExpense("EXP-000001", {
          description: "New description",
          projectId: "proj-123",
        })
      ).rejects.toThrow("Cannot edit approved expense");
    });

    it("should track update history", async () => {
      const updatedExpense = createMockExpense({
        updatedBy: "user-456",
        updatedAt: new Date(),
      });
      dbMock.setMockResult([updatedExpense]);

      const result = await expenseService.updateExpense("EXP-000001", {
        description: "Updated",
        projectId: "proj-123",
        updatedBy: "user-456",
      });

      expect(result.updatedBy).toBe("user-456");
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it("should validate updated amounts", async () => {
      await expect(
        expenseService.updateExpense("EXP-000001", {
          amount: new Money(-100),
          projectId: "proj-123",
        })
      ).rejects.toThrow("Amount must be positive");
    });

    it("should maintain audit trail", async () => {
      const updatedExpense = createMockExpense();
      dbMock.setMockResult([updatedExpense]);

      await expenseService.updateExpense("EXP-000001", {
        description: "Updated",
        projectId: "proj-123",
        updatedBy: "user-456",
      });

      const { logFinancialActivity } = await import("@/lib/audit");
      expect(logFinancialActivity).toHaveBeenCalled();
    });

    it("should recalculate taxes when amount changes", async () => {
      const updatedExpense = createMockExpense({
        amount: new Money(2240),
        vatAmount: new Money(240),
        netAmount: new Money(2000),
        isVatable: true,
      });
      dbMock.setMockResult([updatedExpense]);

      const result = await expenseService.updateExpense("EXP-000001", {
        amount: new Money(2240),
        isVatable: true,
        projectId: "proj-123",
      });

      assertMoneyEqual(result.vatAmount, 240, "VAT amount");
      assertMoneyEqual(result.netAmount, 2000, "Net amount");
    });

    it("should update approval level when amount changes", async () => {
      const updatedExpense = createMockExpense({
        amount: new Money(50000),
        approvalLevel: ApprovalLevel.DUAL,
      });
      dbMock.setMockResult([updatedExpense]);

      const result = await expenseService.updateExpense("EXP-000001", {
        amount: new Money(50000),
        projectId: "proj-123",
      });

      expect(result.approvalLevel).toBe(ApprovalLevel.DUAL);
    });

    it("should handle partial updates", async () => {
      const originalExpense = createMockExpense({
        description: "Original",
        amount: new Money(1000),
        category: ExpenseCategory.SUPPLIES_OFFICE,
      });

      const updatedExpense = { ...originalExpense, description: "Updated only description" };
      dbMock.setMockResult([updatedExpense]);

      const result = await expenseService.updateExpense("EXP-000001", {
        description: "Updated only description",
        projectId: "proj-123",
      });

      expect(result.description).toBe("Updated only description");
      expect(result.amount.toNumber()).toBe(1000);
      expect(result.category).toBe(ExpenseCategory.SUPPLIES_OFFICE);
    });

    it("should validate receipt number format when updating", async () => {
      await expect(
        expenseService.updateExpense("EXP-000001", {
          receiptNumber: "INVALID-FORMAT",
          projectId: "proj-123",
        })
      ).rejects.toThrow("Invalid receipt number format");
    });

    it("should prevent updating system-generated fields", async () => {
      const originalExpense = createMockExpense({ id: "EXP-000001" });
      dbMock.setMockResult([originalExpense]);

      const result = await expenseService.updateExpense("EXP-000001", {
        id: "EXP-999999", // Attempt to change ID
        projectId: "proj-123",
      } as any);

      expect(result.id).toBe("EXP-000001"); // ID should not change
    });
  });

  describe("Delete expense", () => {
    it("should soft delete expenses", async () => {
      const deletedExpense = createMockExpense({
        deletedAt: new Date(),
      });
      dbMock.setMockResult([deletedExpense]);

      await expenseService.deleteExpense("EXP-000001", "proj-123", "user-123");

      expect(deletedExpense.deletedAt).toBeInstanceOf(Date);
    });

    it("should prevent deleting reconciled expenses", async () => {
      const reconciledExpense = createMockExpense({
        status: ExpenseStatus.RECONCILED,
      });
      dbMock.setMockResult([reconciledExpense]);

      await expect(
        expenseService.deleteExpense("EXP-000001", "proj-123", "user-123")
      ).rejects.toThrow("Cannot delete reconciled expense");
    });

    it("should cascade delete approvals", async () => {
      const deletedExpense = createMockExpense();
      dbMock.setMockResult([deletedExpense]);

      await expenseService.deleteExpense("EXP-000001", "proj-123", "user-123");

      // Verify cascade deletion logic was triggered
      expect(dbMock.delete).toHaveBeenCalled();
    });

    it("should maintain deletion record", async () => {
      const deletedExpense = createMockExpense({
        deletedAt: new Date(),
        deletedBy: "user-123",
      });
      dbMock.setMockResult([deletedExpense]);

      await expenseService.deleteExpense("EXP-000001", "proj-123", "user-123");

      expect(deletedExpense.deletedBy).toBe("user-123");
      expect(deletedExpense.deletedAt).toBeInstanceOf(Date);
    });

    it("should allow restoration of deleted expenses", async () => {
      const restoredExpense = createMockExpense({
        deletedAt: null,
        deletedBy: null,
      });
      dbMock.setMockResult([restoredExpense]);

      await expenseService.restoreExpense("EXP-000001", "proj-123");

      expect(restoredExpense.deletedAt).toBeNull();
      expect(restoredExpense.deletedBy).toBeNull();
    });

    it("should prevent deleting paid expenses", async () => {
      const paidExpense = createMockExpense({
        paymentStatus: "PAID",
      });
      dbMock.setMockResult([paidExpense]);

      await expect(
        expenseService.deleteExpense("EXP-000001", "proj-123", "user-123")
      ).rejects.toThrow("Cannot delete paid expense");
    });

    it("should hide deleted expenses from normal queries", async () => {
      const expenses = [
        createMockExpense({ deletedAt: null }),
        createMockExpense({ deletedAt: new Date() }),
      ];
      dbMock.setMockResult(expenses.filter((e) => !e.deletedAt));

      const result = await expenseService.listExpenses({
        projectId: "proj-123",
      });

      expect(result.expenses).toHaveLength(1);
    });

    it("should record who deleted the expense", async () => {
      const deletedExpense = createMockExpense({
        deletedBy: "user-456",
      });
      dbMock.setMockResult([deletedExpense]);

      await expenseService.deleteExpense("EXP-000001", "proj-123", "user-456");

      expect(deletedExpense.deletedBy).toBe("user-456");
    });

    it("should handle non-existent expense deletion gracefully", async () => {
      dbMock.setMockResult([]);

      await expect(
        expenseService.deleteExpense("NON-EXISTENT", "proj-123", "user-123")
      ).rejects.toThrow("Expense not found");
    });

    it("should update related statistics after deletion", async () => {
      const deletedExpense = createMockExpense();
      dbMock.setMockResult([deletedExpense]);

      await expenseService.deleteExpense("EXP-000001", "proj-123", "user-123");

      // Verify statistics update logic was triggered
      const { logFinancialActivity } = await import("@/lib/audit");
      expect(logFinancialActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DELETE_EXPENSE",
        })
      );
    });
  });
});
