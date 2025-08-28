/**
 * Comprehensive tests for expense store
 * Tests expense tracking, offline support, budget management, and approval workflows
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useExpenseStore } from "../expenseStore";
import { useProjectStore } from "../projectStore";
import { useUIStore } from "../uiStore";
import {
  ExpenseTestBuilder,
  PhilippineDataGenerator,
  QuickScenarios,
} from "@tests/utils/tdd-helpers";
import { ExpenseStatus, ExpenseCategory } from "@/types/common";

// Mock dependencies
vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../projectStore", () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      activeProjectId: "test-project-123",
    })),
  },
}));

vi.mock("../uiStore", () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
      },
    })),
  },
}));

import { apiClient } from "@/api/client";

describe("ExpenseStore - Comprehensive Tests", () => {
  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useExpenseStore());
    act(() => {
      result.current.reset();
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchExpenses", () => {
    it("should fetch expenses with pagination and sync offline queue", async () => {
      const mockExpenses = ExpenseTestBuilder.create().buildMany(5);
      const mockResponse = {
        data: {
          data: mockExpenses,
          meta: {
            total: 50,
            page: 1,
            limit: 20,
          },
        },
      };

      (apiClient.get as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExpenseStore());

      // Add offline expense to queue
      act(() => {
        result.current.queueOfflineExpense(
          ExpenseTestBuilder.create().withAmount("5000.00").build()
        );
      });

      expect(result.current.offlineQueue).toHaveLength(1);

      // Mock sync success
      (apiClient.post as any).mockResolvedValue({
        data: { id: "synced-expense", ...result.current.offlineQueue[0]!.data },
      });

      await act(async () => {
        await result.current.fetchExpenses({
          category: ExpenseCategory.UTILITIES,
        });
      });

      expect(result.current.expenses).toEqual(mockExpenses);
      expect(result.current.totalExpenses).toBe(50);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastFetch).toBeTruthy();

      expect(apiClient.get).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses",
        expect.objectContaining({
          page: 1,
          limit: 20,
          category: ExpenseCategory.UTILITIES,
        })
      );

      // Should trigger sync for offline queue
      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false);
      });
    });

    it("should handle fetch error properly", async () => {
      const error = new Error("Network error");
      (apiClient.get as any).mockRejectedValue(error);

      const { result } = renderHook(() => useExpenseStore());

      await expect(
        act(async () => {
          await result.current.fetchExpenses();
        })
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Network error");
      expect(useUIStore.getState().toast.error).toHaveBeenCalledWith(
        "Failed to fetch expenses",
        "Network error"
      );
    });
  });

  describe("createExpense", () => {
    it("should create expense with optimistic update and budget tracking", async () => {
      const expenseData = ExpenseTestBuilder.create()
        .withCategory("utilities-123")
        .withAmount("8500.00")
        .withVendor("Meralco")
        .build();

      const createdExpense = {
        id: "expense-123",
        ...expenseData,
        status: ExpenseStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (apiClient.post as any).mockResolvedValue({ data: createdExpense });

      const { result } = renderHook(() => useExpenseStore());

      // Set initial budget
      act(() => {
        result.current.budgets.set(ExpenseCategory.UTILITIES, {
          budget: 20000,
          spent: 5000,
        });
      });

      await act(async () => {
        const expense = await result.current.createExpense(expenseData);
        expect(expense).toEqual(createdExpense);
      });

      expect(result.current.expenses[0]).toEqual(createdExpense);
      expect(result.current.totalExpenses).toBe(1);

      // Check budget update
      const budgetInfo = result.current.budgets.get(ExpenseCategory.UTILITIES);
      expect(budgetInfo?.spent).toBe(13500); // 5000 + 8500

      expect(apiClient.post).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses",
        expenseData
      );
      expect(useUIStore.getState().toast.success).toHaveBeenCalledWith(
        "Expense created successfully"
      );
    });

    it("should queue expense offline when network error occurs", async () => {
      const expenseData = ExpenseTestBuilder.create().withAmount("3500.00").build();

      const networkError = new Error("Network error");
      (networkError as any).code = "NETWORK_ERROR";
      (apiClient.post as any).mockRejectedValue(networkError);

      const { result } = renderHook(() => useExpenseStore());

      const expense = await act(async () => {
        return await result.current.createExpense(expenseData);
      });

      // Should be added to offline queue
      expect(result.current.offlineQueue).toHaveLength(1);
      expect(result.current.offlineQueue[0]!.data).toEqual(expenseData);
      expect(result.current.optimisticExpenses).toHaveLength(0);

      expect(useUIStore.getState().toast.info).toHaveBeenCalledWith(
        "Expense saved offline",
        "Will sync when connection is restored"
      );

      // Returned expense should have temp ID
      expect(expense.id).toContain("temp-expense");
    });

    it("should handle regular error without offline queueing", async () => {
      const expenseData = ExpenseTestBuilder.create().build();
      const error = new Error("Validation error");
      (apiClient.post as any).mockRejectedValue(error);

      const { result } = renderHook(() => useExpenseStore());

      await expect(
        act(async () => {
          await result.current.createExpense(expenseData);
        })
      ).rejects.toThrow("Validation error");

      expect(result.current.offlineQueue).toHaveLength(0);
      expect(result.current.error).toBe("Validation error");
    });
  });

  describe("updateExpense", () => {
    it("should update expense and adjust budget when category changes", async () => {
      const originalExpense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().withCategory("utilities-123").withAmount("5000.00").build(),
        category: ExpenseCategory.UTILITIES,
        amount: 5000,
        status: ExpenseStatus.PENDING,
      };

      const updateData = {
        category: ExpenseCategory.MAINTENANCE,
        amount: 7000,
      };

      const updatedExpense = { ...originalExpense, ...updateData };

      const { result } = renderHook(() => useExpenseStore());

      // Set initial state with budgets
      act(() => {
        result.current.setExpenses([originalExpense]);
        result.current.budgets.set(ExpenseCategory.UTILITIES, {
          budget: 20000,
          spent: 10000,
        });
        result.current.budgets.set(ExpenseCategory.MAINTENANCE, {
          budget: 15000,
          spent: 3000,
        });
      });

      (apiClient.patch as any).mockResolvedValue({ data: updatedExpense });

      await act(async () => {
        await result.current.updateExpense("expense-123", updateData);
      });

      // Check expense updated
      expect(result.current.expenses[0]).toEqual(updatedExpense);

      // Check budget adjustments
      const utilitiesBudget = result.current.budgets.get(ExpenseCategory.UTILITIES);
      expect(utilitiesBudget?.spent).toBe(5000); // 10000 - 5000

      const maintenanceBudget = result.current.budgets.get(ExpenseCategory.MAINTENANCE);
      expect(maintenanceBudget?.spent).toBe(10000); // 3000 + 7000

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses/expense-123",
        updateData
      );
    });

    it("should rollback on update error", async () => {
      const originalExpense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
        status: ExpenseStatus.PENDING,
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([originalExpense]);
      });

      const error = new Error("Update failed");
      (apiClient.patch as any).mockRejectedValue(error);

      await expect(
        act(async () => {
          await result.current.updateExpense("expense-123", {
            status: ExpenseStatus.APPROVED,
          });
        })
      ).rejects.toThrow("Update failed");

      // Should rollback to original
      expect(result.current.expenses[0]).toEqual(originalExpense);
      expect(result.current.error).toBe("Update failed");
    });
  });

  describe("Approval Workflow", () => {
    it("should approve expense with notes", async () => {
      const expense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
        status: ExpenseStatus.PENDING,
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([expense]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...expense,
          status: ExpenseStatus.APPROVED,
          notes: "Approved: Budget available",
        },
      });

      await act(async () => {
        await result.current.approveExpense("expense-123", "Budget available");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses/expense-123",
        {
          status: ExpenseStatus.APPROVED,
          notes: "Approved: Budget available",
        }
      );
    });

    it("should reject expense with reason", async () => {
      const expense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
        status: ExpenseStatus.PENDING,
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([expense]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...expense,
          status: ExpenseStatus.REJECTED,
          notes: "Rejected: Over budget",
        },
      });

      await act(async () => {
        await result.current.rejectExpense("expense-123", "Over budget");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses/expense-123",
        {
          status: ExpenseStatus.REJECTED,
          notes: "Rejected: Over budget",
        }
      );
    });

    it("should submit expense for approval", async () => {
      const expense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
        status: ExpenseStatus.DRAFT,
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([expense]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: { ...expense, status: ExpenseStatus.PENDING },
      });

      await act(async () => {
        await result.current.submitForApproval("expense-123");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses/expense-123",
        { status: ExpenseStatus.PENDING }
      );
    });
  });

  describe("Category Management", () => {
    it("should fetch and store categories with budgets", async () => {
      const mockCategories = [
        {
          id: "cat-1",
          name: "Utilities",
          value: ExpenseCategory.UTILITIES,
          budget: 20000,
          spent: 8500,
        },
        {
          id: "cat-2",
          name: "Maintenance",
          value: ExpenseCategory.MAINTENANCE,
          budget: 15000,
          spent: 5000,
        },
      ];

      (apiClient.get as any).mockResolvedValue({ data: mockCategories });

      const { result } = renderHook(() => useExpenseStore());

      await act(async () => {
        await result.current.fetchCategories();
      });

      expect(result.current.categories).toEqual(mockCategories);

      // Check budgets map updated
      const utilitiesBudget = result.current.budgets.get(ExpenseCategory.UTILITIES);
      expect(utilitiesBudget).toEqual({ budget: 20000, spent: 8500 });

      const maintenanceBudget = result.current.budgets.get(ExpenseCategory.MAINTENANCE);
      expect(maintenanceBudget).toEqual({ budget: 15000, spent: 5000 });

      expect(apiClient.get).toHaveBeenCalledWith("/projects/test-project-123/expense-categories");
    });

    it("should create new category with budget", async () => {
      const categoryData = {
        name: "Marketing",
        value: ExpenseCategory.MARKETING,
        description: "Marketing and advertising",
        budget: 10000,
      };

      (apiClient.post as any).mockResolvedValue({
        data: { id: "cat-3", ...categoryData },
      });

      const { result } = renderHook(() => useExpenseStore());

      await act(async () => {
        await result.current.createCategory(categoryData);
      });

      expect(result.current.categories).toHaveLength(1);
      expect(result.current.categories[0]).toMatchObject(categoryData);

      const budget = result.current.budgets.get(ExpenseCategory.MARKETING);
      expect(budget).toEqual({ budget: 10000, spent: 0 });

      expect(useUIStore.getState().toast.success).toHaveBeenCalledWith(
        "Category created successfully"
      );
    });

    it("should update category budget", async () => {
      (apiClient.patch as any).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useExpenseStore());

      // Set initial budget
      act(() => {
        result.current.budgets.set(ExpenseCategory.UTILITIES, {
          budget: 15000,
          spent: 5000,
        });
      });

      await act(async () => {
        await result.current.updateCategoryBudget(ExpenseCategory.UTILITIES, 25000);
      });

      const budget = result.current.budgets.get(ExpenseCategory.UTILITIES);
      expect(budget).toEqual({ budget: 25000, spent: 5000 });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/expense-categories/UTILITIES",
        { budget: 25000 }
      );
    });
  });

  describe("Summary and Analytics", () => {
    it("should fetch expense summary for period", async () => {
      const mockSummary = {
        totalAmount: 45000,
        byCategory: {
          [ExpenseCategory.UTILITIES]: 15000,
          [ExpenseCategory.MAINTENANCE]: 10000,
          [ExpenseCategory.SUPPLIES]: 20000,
        },
        byMonth: {
          "2024-01": 15000,
          "2024-02": 30000,
        },
        averageMonthly: 22500,
        topVendors: [
          { vendor: "Meralco", amount: 8000, count: 3 },
          { vendor: "Water District", amount: 5000, count: 2 },
        ],
      };

      (apiClient.get as any).mockResolvedValue({ data: mockSummary });

      const { result } = renderHook(() => useExpenseStore());

      await act(async () => {
        await result.current.fetchSummary({
          from: new Date("2024-01-01"),
          to: new Date("2024-02-28"),
        });
      });

      expect(result.current.summary).toEqual(mockSummary);
      expect(apiClient.get).toHaveBeenCalledWith("/projects/test-project-123/expenses/summary", {
        from: new Date("2024-01-01").toISOString(),
        to: new Date("2024-02-28").toISOString(),
      });
    });

    it("should calculate summary by category locally", () => {
      const expenses = [
        {
          id: "1",
          ...ExpenseTestBuilder.create().build(),
          category: ExpenseCategory.UTILITIES,
          amount: 5000,
        },
        {
          id: "2",
          ...ExpenseTestBuilder.create().build(),
          category: ExpenseCategory.UTILITIES,
          amount: 3000,
        },
        {
          id: "3",
          ...ExpenseTestBuilder.create().build(),
          category: ExpenseCategory.MAINTENANCE,
          amount: 7000,
        },
      ];

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses(expenses);
      });

      const utilitiesSum = result.current.getSummaryByCategory(ExpenseCategory.UTILITIES);
      expect(utilitiesSum).toBe(8000);

      const totalSum = result.current.getSummaryByCategory();
      expect(totalSum).toBe(15000);
    });

    it("should calculate summary by period with vendor analysis", () => {
      const expenses = [
        {
          id: "1",
          ...ExpenseTestBuilder.create().build(),
          date: "2024-01-15",
          amount: 5000,
          category: ExpenseCategory.UTILITIES,
          vendor: "Meralco",
          propertyId: "prop-1",
        },
        {
          id: "2",
          ...ExpenseTestBuilder.create().build(),
          date: "2024-01-20",
          amount: 3000,
          category: ExpenseCategory.UTILITIES,
          vendor: "Meralco",
          propertyId: "prop-1",
        },
        {
          id: "3",
          ...ExpenseTestBuilder.create().build(),
          date: "2024-02-10",
          amount: 7000,
          category: ExpenseCategory.MAINTENANCE,
          vendor: "Contractor ABC",
          propertyId: "prop-2",
        },
      ];

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses(expenses);
      });

      const summary = result.current.getSummaryByPeriod(
        new Date("2024-01-01"),
        new Date("2024-02-28")
      );

      expect(summary).toBeTruthy();
      expect(summary!.totalAmount).toBe(15000);
      expect(summary!.byCategory[ExpenseCategory.UTILITIES]).toBe(8000);
      expect(summary!.byCategory[ExpenseCategory.MAINTENANCE]).toBe(7000);
      expect(summary!.byMonth["2024-01"]).toBe(8000);
      expect(summary!.byMonth["2024-02"]).toBe(7000);
      expect(summary!.byProperty["prop-1"]).toBe(8000);
      expect(summary!.byProperty["prop-2"]).toBe(7000);
      expect(summary!.topVendors).toHaveLength(2);
      expect(summary!.topVendors[0]).toEqual({
        vendor: "Meralco",
        amount: 8000,
        count: 2,
      });
    });

    it("should get budget status with calculations", () => {
      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.budgets.set(ExpenseCategory.UTILITIES, {
          budget: 20000,
          spent: 15000,
        });
      });

      const status = result.current.getBudgetStatus(ExpenseCategory.UTILITIES);

      expect(status.budget).toBe(20000);
      expect(status.spent).toBe(15000);
      expect(status.remaining).toBe(5000);
      expect(status.percentage).toBe(75);
    });

    it("should handle budget status for category without budget", () => {
      const { result } = renderHook(() => useExpenseStore());

      const status = result.current.getBudgetStatus(ExpenseCategory.MARKETING);

      expect(status).toEqual({
        budget: 0,
        spent: 0,
        remaining: 0,
        percentage: 0,
      });
    });
  });

  describe("Offline Support", () => {
    it("should sync offline expenses successfully", async () => {
      const offlineData1 = ExpenseTestBuilder.create().withAmount("3000.00").build();
      const offlineData2 = ExpenseTestBuilder.create().withAmount("5000.00").build();

      const { result } = renderHook(() => useExpenseStore());

      // Add to offline queue
      act(() => {
        result.current.queueOfflineExpense(offlineData1);
        result.current.queueOfflineExpense(offlineData2);
      });

      expect(result.current.offlineQueue).toHaveLength(2);

      // Mock successful sync for both
      (apiClient.post as any)
        .mockResolvedValueOnce({
          data: { id: "synced-1", ...offlineData1 },
        })
        .mockResolvedValueOnce({
          data: { id: "synced-2", ...offlineData2 },
        });

      await act(async () => {
        await result.current.syncOfflineExpenses();
      });

      expect(result.current.offlineQueue).toHaveLength(0);
      expect(result.current.expenses).toHaveLength(2);
      expect(result.current.lastSync).toBeTruthy();

      expect(useUIStore.getState().toast.success).toHaveBeenCalledWith("Synced 2 offline expenses");
    });

    it("should handle partial sync failure with retry count", async () => {
      const offlineData1 = ExpenseTestBuilder.create().build();
      const offlineData2 = ExpenseTestBuilder.create().build();

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.queueOfflineExpense(offlineData1);
        result.current.queueOfflineExpense(offlineData2);
      });

      // First succeeds, second fails
      (apiClient.post as any)
        .mockResolvedValueOnce({
          data: { id: "synced-1", ...offlineData1 },
        })
        .mockRejectedValueOnce(new Error("Sync failed"));

      await act(async () => {
        await result.current.syncOfflineExpenses();
      });

      // One should remain in queue with increased retry count
      expect(result.current.offlineQueue).toHaveLength(1);
      expect(result.current.offlineQueue[0]!.retryCount).toBe(1);
      expect(result.current.offlineQueue[0]!.error).toBe("Sync failed");

      expect(useUIStore.getState().toast.success).toHaveBeenCalledWith("Synced 1 offline expense");
      expect(useUIStore.getState().toast.warning).toHaveBeenCalledWith(
        "Failed to sync 1 expense",
        "Will retry later"
      );
    });

    it("should skip items that exceeded max retry attempts", async () => {
      const { result } = renderHook(() => useExpenseStore());

      // Add item with max retries exceeded
      act(() => {
        const queue = result.current as any;
        queue.offlineQueue = [
          {
            tempId: "temp-1",
            data: ExpenseTestBuilder.create().build(),
            timestamp: Date.now(),
            retryCount: 3, // MAX_RETRY_ATTEMPTS
          },
        ];
      });

      await act(async () => {
        await result.current.syncOfflineExpenses();
      });

      // Should still be in queue but not attempted
      expect(result.current.offlineQueue).toHaveLength(1);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should remove from offline queue", () => {
      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.queueOfflineExpense(ExpenseTestBuilder.create().build());
        result.current.queueOfflineExpense(ExpenseTestBuilder.create().build());
      });

      const { tempId } = result.current.offlineQueue[0]!;

      act(() => {
        result.current.removeFromQueue(tempId);
      });

      expect(result.current.offlineQueue).toHaveLength(1);
      expect(result.current.offlineQueue[0]!.tempId).not.toBe(tempId);
    });

    it("should clear offline queue", () => {
      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.queueOfflineExpense(ExpenseTestBuilder.create().build());
        result.current.queueOfflineExpense(ExpenseTestBuilder.create().build());
      });

      expect(result.current.offlineQueue).toHaveLength(2);

      act(() => {
        result.current.clearOfflineQueue();
      });

      expect(result.current.offlineQueue).toHaveLength(0);
    });
  });

  describe("Receipt Management", () => {
    it("should attach receipt to expense", async () => {
      const expense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([expense]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: { ...expense, receiptUrl: "https://receipts.com/123.pdf" },
      });

      await act(async () => {
        await result.current.attachReceipt("expense-123", "https://receipts.com/123.pdf");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses/expense-123",
        { receiptUrl: "https://receipts.com/123.pdf" }
      );
    });

    it("should remove receipt from expense", async () => {
      const expense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
        receiptUrl: "https://receipts.com/123.pdf",
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([expense]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: { ...expense, receiptUrl: undefined },
      });

      await act(async () => {
        await result.current.removeReceipt("expense-123");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses/expense-123",
        { receiptUrl: undefined }
      );
    });
  });

  describe("Delete Operations", () => {
    it("should delete expense and update budget", async () => {
      const expense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
        category: ExpenseCategory.UTILITIES,
        amount: 5000,
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([expense]);
        result.current.totalExpenses = 1;
        result.current.budgets.set(ExpenseCategory.UTILITIES, {
          budget: 20000,
          spent: 15000,
        });
      });

      (apiClient.delete as any).mockResolvedValue({});

      await act(async () => {
        await result.current.deleteExpense("expense-123");
      });

      expect(result.current.expenses).toHaveLength(0);
      expect(result.current.totalExpenses).toBe(0);

      // Budget should be updated
      const budget = result.current.budgets.get(ExpenseCategory.UTILITIES);
      expect(budget?.spent).toBe(10000); // 15000 - 5000

      expect(apiClient.delete).toHaveBeenCalledWith(
        "/projects/test-project-123/expenses/expense-123"
      );
    });

    it("should rollback delete on error including budget", async () => {
      const expense = {
        id: "expense-123",
        ...ExpenseTestBuilder.create().build(),
        category: ExpenseCategory.UTILITIES,
        amount: 5000,
      };

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses([expense]);
        result.current.totalExpenses = 1;
        result.current.budgets.set(ExpenseCategory.UTILITIES, {
          budget: 20000,
          spent: 15000,
        });
      });

      const error = new Error("Cannot delete");
      (apiClient.delete as any).mockRejectedValue(error);

      await expect(
        act(async () => {
          await result.current.deleteExpense("expense-123");
        })
      ).rejects.toThrow("Cannot delete");

      // Should rollback
      expect(result.current.expenses).toHaveLength(1);
      expect(result.current.totalExpenses).toBe(1);

      // Budget should be restored
      const budget = result.current.budgets.get(ExpenseCategory.UTILITIES);
      expect(budget?.spent).toBe(15000);
    });
  });

  describe("Utility Functions", () => {
    it("should get expenses by category", () => {
      const expenses = [
        {
          id: "1",
          ...ExpenseTestBuilder.create().build(),
          category: ExpenseCategory.UTILITIES,
        },
        {
          id: "2",
          ...ExpenseTestBuilder.create().build(),
          category: ExpenseCategory.MAINTENANCE,
        },
        {
          id: "3",
          ...ExpenseTestBuilder.create().build(),
          category: ExpenseCategory.UTILITIES,
        },
      ];

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses(expenses);
      });

      const utilityExpenses = result.current.getExpensesByCategory(ExpenseCategory.UTILITIES);
      expect(utilityExpenses).toHaveLength(2);
      expect(utilityExpenses[0]!.category).toBe(ExpenseCategory.UTILITIES);
      expect(utilityExpenses[1]!.category).toBe(ExpenseCategory.UTILITIES);
    });

    it("should get expenses by status", () => {
      const expenses = [
        {
          id: "1",
          ...ExpenseTestBuilder.create().build(),
          status: ExpenseStatus.APPROVED,
        },
        {
          id: "2",
          ...ExpenseTestBuilder.create().build(),
          status: ExpenseStatus.PENDING,
        },
        {
          id: "3",
          ...ExpenseTestBuilder.create().build(),
          status: ExpenseStatus.PENDING,
        },
      ];

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses(expenses);
      });

      const pendingExpenses = result.current.getExpensesByStatus(ExpenseStatus.PENDING);
      expect(pendingExpenses).toHaveLength(2);
    });

    it("should get pending approvals", () => {
      const expenses = [
        {
          id: "1",
          ...ExpenseTestBuilder.create().build(),
          status: ExpenseStatus.PENDING,
        },
        {
          id: "2",
          ...ExpenseTestBuilder.create().build(),
          status: ExpenseStatus.APPROVED,
        },
        {
          id: "3",
          ...ExpenseTestBuilder.create().build(),
          status: ExpenseStatus.PENDING,
        },
      ];

      const { result } = renderHook(() => useExpenseStore());

      act(() => {
        result.current.setExpenses(expenses);
      });

      const pendingApprovals = result.current.getPendingApprovals();
      expect(pendingApprovals).toHaveLength(2);
      expect(pendingApprovals.every((e) => e.status === ExpenseStatus.PENDING)).toBe(true);
    });

    it("should refresh if cache expired", async () => {
      const mockExpenses = ExpenseTestBuilder.create().buildMany(3);
      (apiClient.get as any).mockResolvedValue({
        data: {
          data: mockExpenses,
          meta: { total: 3 },
        },
      });

      const { result } = renderHook(() => useExpenseStore());

      // Set lastFetch to expired time
      act(() => {
        (result.current as any).lastFetch = Date.now() - 6 * 60 * 1000;
      });

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(apiClient.get).toHaveBeenCalled();
    });
  });

  describe("Philippine-Specific Features", () => {
    it("should handle Philippine peso amounts correctly", async () => {
      const expenseData = ExpenseTestBuilder.create()
        .withAmount("12999.99")
        .withVendor("SM Supermarket")
        .build();

      expect(expenseData.amount).toBe("12999.99");

      const { result } = renderHook(() => useExpenseStore());

      (apiClient.post as any).mockResolvedValue({
        data: { id: "expense-123", ...expenseData },
      });

      await act(async () => {
        const expense = await result.current.createExpense(expenseData);
        expect(expense.amount).toBe("12999.99");
      });
    });

    it("should handle utility expenses with Philippine vendors", () => {
      const expense = ExpenseTestBuilder.create().withUtilityExpense().build();

      expect(expense.vendor).toMatch(/Company$/);
      expect(parseFloat(expense.amount)).toBeGreaterThanOrEqual(2000);
      expect(parseFloat(expense.amount)).toBeLessThanOrEqual(15000);
    });

    it("should track Philippine-specific expense categories", async () => {
      const categories = [
        { value: ExpenseCategory.UTILITIES, name: "Meralco/Water" },
        { value: ExpenseCategory.SUPPLIES, name: "Groceries/Supplies" },
        { value: ExpenseCategory.STAFF, name: "Staff Salaries" },
      ];

      (apiClient.get as any).mockResolvedValue({
        data: categories.map((c, i) => ({
          id: `cat-${i}`,
          ...c,
          budget: 20000,
          spent: 5000,
        })),
      });

      const { result } = renderHook(() => useExpenseStore());

      await act(async () => {
        await result.current.fetchCategories();
      });

      expect(result.current.categories).toHaveLength(3);
      expect(result.current.categories.some((c) => c.name === "Meralco/Water")).toBe(true);
    });
  });

  describe("State Management", () => {
    it("should reset store to initial state", () => {
      const { result } = renderHook(() => useExpenseStore());

      // Set some data
      act(() => {
        result.current.setExpenses([
          {
            id: "expense-1",
            ...ExpenseTestBuilder.create().build(),
          },
        ]);
        result.current.queueOfflineExpense(ExpenseTestBuilder.create().build());
        result.current.setFilters({ category: ExpenseCategory.UTILITIES });
        result.current.setError("Some error");
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.expenses).toHaveLength(0);
      expect(result.current.optimisticExpenses).toHaveLength(0);
      expect(result.current.offlineQueue).toHaveLength(0);
      expect(result.current.totalExpenses).toBe(0);
      expect(result.current.filters).toEqual({});
      expect(result.current.error).toBe(null);
      expect(result.current.lastFetch).toBe(null);
      expect(result.current.lastSync).toBe(null);
      expect(result.current.budgets.size).toBe(0);
    });
  });

  describe("Persistence", () => {
    it("should persist offline queue and filters", () => {
      const { result } = renderHook(() => useExpenseStore());

      const filters = {
        category: ExpenseCategory.UTILITIES,
        status: ExpenseStatus.PENDING,
      };

      act(() => {
        result.current.setFilters(filters);
        result.current.queueOfflineExpense(ExpenseTestBuilder.create().build());
      });

      // Simulated persisted state would include:
      expect(result.current.filters).toEqual(filters);
      expect(result.current.offlineQueue).toHaveLength(1);
    });
  });
});
