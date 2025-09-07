/**
 * Expense Service
 *
 * Core service for managing expenses with Money class integration
 * and Philippine regulatory compliance for VAT and withholding tax.
 */

import { Money } from "@/lib/money";
import { db } from "@/lib/db";
import {
  expenses,
  vendors,
  expenseReceipts,
  expenseApprovalHistory,
  withholdingTaxCertificates,
  type NewExpense,
  type Expense,
  type Vendor,
  type NewExpenseReceipt,
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql, inArray, isNull } from "drizzle-orm";
import {
  ExpenseCategory,
  ExpenseStatus,
  ApprovalLevel,
  PaymentMethod,
  VendorType,
  type TaxBreakdown,
} from "@/features/financial/types/financial.types";
import { generateCode } from "@/lib/utils";
import { auditLog } from "@/lib/audit";

interface CreateExpenseInput {
  projectId: string;
  expenseDate: Date;
  category: ExpenseCategory;
  amount: number | string | Money;
  description: string;
  vendorId?: string;
  vendorName?: string;
  vendorTin?: string;
  isVatable?: boolean;
  isEwtApplicable?: boolean;
  ewtRate?: number;
  invoiceNumber?: string;
  receiptNumber?: string;
  paymentMethod?: PaymentMethod;
  dueDate?: Date;
  userId: string;
}

interface UpdateExpenseInput extends Partial<CreateExpenseInput> {
  id: string;
  status?: ExpenseStatus;
  paymentStatus?: string;
  paymentDate?: Date;
  checkNumber?: string;
  bankReference?: string;
}

interface ExpenseFilter {
  projectId: string;
  dateFrom?: Date;
  dateTo?: Date;
  category?: ExpenseCategory;
  vendorId?: string;
  status?: ExpenseStatus;
  paymentStatus?: string;
  minAmount?: number;
  maxAmount?: number;
}

export class ExpenseService {
  /**
   * Create a new expense with automatic VAT/EWT calculations
   */
  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    // Convert amount to Money instance
    const amount = input.amount instanceof Money ? input.amount : new Money(input.amount);

    // Validate amount
    if (!amount.isPositive()) {
      throw new Error("Expense amount must be positive");
    }

    // Calculate VAT if applicable
    let vatAmount = new Money(0);
    let netAmount = amount;

    if (input.isVatable) {
      // Amount is VAT-inclusive, extract VAT
      netAmount = amount.removeVAT();
      vatAmount = amount.getVATAmount();
    }

    // Calculate EWT if applicable
    let ewtAmount = new Money(0);
    if (input.isEwtApplicable && input.ewtRate) {
      // EWT is calculated on gross amount
      ewtAmount = amount.multiply(input.ewtRate);
    }

    // Validate vendor TIN for large amounts
    if (amount.greaterThan(10000) && !input.vendorTin && !input.vendorId) {
      throw new Error("Vendor TIN required for amounts above PHP 10,000");
    }

    // Validate expense date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expenseDate = new Date(input.expenseDate);
    expenseDate.setHours(0, 0, 0, 0);

    if (expenseDate > today) {
      throw new Error("Expense date cannot be in the future");
    }

    // Generate expense code
    const expenseCode = await this.generateExpenseCode(input.projectId);

    // Determine approval level based on amount
    const approvalLevel = this.determineApprovalLevel(amount);
    const approvalStatus =
      approvalLevel === ApprovalLevel.AUTO
        ? ExpenseStatus.APPROVED
        : ExpenseStatus.PENDING_APPROVAL;

    // Create expense record
    const [expense] = await db
      .insert(expenses)
      .values({
        projectId: input.projectId,
        expenseCode,
        expenseDate: input.expenseDate.toISOString().split("T")[0],
        dueDate: input.dueDate?.toISOString().split("T")[0],
        grossAmount: amount.toNumber().toString(),
        vatAmount: vatAmount.toNumber().toString(),
        ewtAmount: ewtAmount.toNumber().toString(),
        netAmount: netAmount.toNumber().toString(),
        category: input.category,
        expenseType: "operating", // Default, can be enhanced
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        vendorTin: input.vendorTin,
        isVatable: input.isVatable || false,
        vatRate: input.isVatable ? "0.12" : "0",
        isEwtApplicable: input.isEwtApplicable || false,
        ewtRate: input.ewtRate?.toString(),
        invoiceNumber: input.invoiceNumber,
        receiptNumber: input.receiptNumber,
        paymentStatus: "unpaid",
        paymentMethod: input.paymentMethod,
        approvalStatus,
        approvalLevel,
        description: input.description,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();

    // Create approval history entry
    await this.createApprovalHistoryEntry(expense.id, {
      action: "submitted",
      actionBy: input.userId,
      newStatus: approvalStatus,
      amountApproved:
        approvalStatus === ExpenseStatus.APPROVED ? amount.toNumber().toString() : undefined,
    });

    // Audit log
    await auditLog({
      userId: input.userId,
      action: "expense.created",
      entityType: "expense",
      entityId: expense.id,
      metadata: {
        amount: amount.toNumber(),
        category: input.category,
        vendorName: input.vendorName,
      },
    });

    return expense;
  }

  /**
   * Update an existing expense
   */
  async updateExpense(input: UpdateExpenseInput): Promise<Expense> {
    // Get existing expense
    const existing = await this.getExpenseById(input.id, input.projectId);
    if (!existing) {
      throw new Error("Expense not found");
    }

    // Check if expense can be edited
    if (existing.approvalStatus === ExpenseStatus.APPROVED && !input.status) {
      throw new Error("Cannot edit approved expense without changing status");
    }

    // Prepare update data
    const updateData: any = {
      updatedBy: input.userId,
      updatedAt: new Date(),
    };

    // Handle amount update with recalculation
    if (input.amount !== undefined) {
      const amount = input.amount instanceof Money ? input.amount : new Money(input.amount);

      let vatAmount = new Money(0);
      let netAmount = amount;

      if (input.isVatable ?? existing.isVatable) {
        netAmount = amount.removeVAT();
        vatAmount = amount.getVATAmount();
      }

      let ewtAmount = new Money(0);
      const ewtRate = input.ewtRate ?? parseFloat(existing.ewtRate || "0");
      if ((input.isEwtApplicable ?? existing.isEwtApplicable) && ewtRate) {
        ewtAmount = amount.multiply(ewtRate);
      }

      updateData.grossAmount = amount.toNumber().toString();
      updateData.vatAmount = vatAmount.toNumber().toString();
      updateData.ewtAmount = ewtAmount.toNumber().toString();
      updateData.netAmount = netAmount.toNumber().toString();
    }

    // Add other fields to update
    if (input.expenseDate) updateData.expenseDate = input.expenseDate.toISOString().split("T")[0];
    if (input.category) updateData.category = input.category;
    if (input.description) updateData.description = input.description;
    if (input.vendorId !== undefined) updateData.vendorId = input.vendorId;
    if (input.vendorName) updateData.vendorName = input.vendorName;
    if (input.vendorTin) updateData.vendorTin = input.vendorTin;
    if (input.isVatable !== undefined) updateData.isVatable = input.isVatable;
    if (input.isEwtApplicable !== undefined) updateData.isEwtApplicable = input.isEwtApplicable;
    if (input.ewtRate !== undefined) updateData.ewtRate = input.ewtRate?.toString();
    if (input.invoiceNumber) updateData.invoiceNumber = input.invoiceNumber;
    if (input.receiptNumber) updateData.receiptNumber = input.receiptNumber;
    if (input.status) updateData.approvalStatus = input.status;
    if (input.paymentStatus) updateData.paymentStatus = input.paymentStatus;
    if (input.paymentDate) updateData.paymentDate = input.paymentDate.toISOString().split("T")[0];
    if (input.paymentMethod) updateData.paymentMethod = input.paymentMethod;
    if (input.checkNumber) updateData.checkNumber = input.checkNumber;
    if (input.bankReference) updateData.bankReference = input.bankReference;

    // Update expense
    const [updated] = await db
      .update(expenses)
      .set(updateData)
      .where(and(eq(expenses.id, input.id), eq(expenses.projectId, input.projectId)))
      .returning();

    // Create approval history if status changed
    if (input.status && input.status !== existing.approvalStatus) {
      await this.createApprovalHistoryEntry(updated.id, {
        action: this.getApprovalAction(input.status),
        actionBy: input.userId!,
        previousStatus: existing.approvalStatus,
        newStatus: input.status,
      });
    }

    // Audit log
    await auditLog({
      userId: input.userId!,
      action: "expense.updated",
      entityType: "expense",
      entityId: updated.id,
      metadata: {
        changes: updateData,
        previousStatus: existing.approvalStatus,
        newStatus: input.status,
      },
    });

    return updated;
  }

  /**
   * Delete an expense (soft delete)
   */
  async deleteExpense(id: string, projectId: string, userId: string): Promise<void> {
    const expense = await this.getExpenseById(id, projectId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    if (expense.approvalStatus === ExpenseStatus.APPROVED) {
      throw new Error("Cannot delete approved expense");
    }

    if (expense.paymentStatus === "paid") {
      throw new Error("Cannot delete paid expense");
    }

    // Soft delete
    await db
      .update(expenses)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(expenses.id, id), eq(expenses.projectId, projectId)));

    // Audit log
    await auditLog({
      userId,
      action: "expense.deleted",
      entityType: "expense",
      entityId: id,
      metadata: {
        expenseCode: expense.expenseCode,
        amount: expense.grossAmount,
      },
    });
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(id: string, projectId: string): Promise<Expense | null> {
    const [expense] = await db
      .select()
      .from(expenses)
      .where(
        and(eq(expenses.id, id), eq(expenses.projectId, projectId), isNull(expenses.deletedAt))
      )
      .limit(1);

    return expense || null;
  }

  /**
   * List expenses with filters
   */
  async listExpenses(filter: ExpenseFilter, limit = 50, offset = 0) {
    const conditions = [eq(expenses.projectId, filter.projectId), isNull(expenses.deletedAt)];

    if (filter.dateFrom) {
      conditions.push(gte(expenses.expenseDate, filter.dateFrom.toISOString().split("T")[0]));
    }
    if (filter.dateTo) {
      conditions.push(lte(expenses.expenseDate, filter.dateTo.toISOString().split("T")[0]));
    }
    if (filter.category) {
      conditions.push(eq(expenses.category, filter.category));
    }
    if (filter.vendorId) {
      conditions.push(eq(expenses.vendorId, filter.vendorId));
    }
    if (filter.status) {
      conditions.push(eq(expenses.approvalStatus, filter.status));
    }
    if (filter.paymentStatus) {
      conditions.push(eq(expenses.paymentStatus, filter.paymentStatus));
    }

    const [items, totalCount] = await Promise.all([
      db
        .select()
        .from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.expenseDate))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(expenses)
        .where(and(...conditions))
        .then((res) => res[0]?.count || 0),
    ]);

    return {
      items,
      total: totalCount,
      limit,
      offset,
    };
  }

  /**
   * Upload receipt for an expense
   */
  async uploadReceipt(
    expenseId: string,
    projectId: string,
    file: {
      url: string;
      fileName: string;
      fileType: string;
      fileSize?: number;
    },
    userId: string
  ): Promise<void> {
    // Verify expense exists
    const expense = await this.getExpenseById(expenseId, projectId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    // Create receipt record
    await db.insert(expenseReceipts).values({
      expenseId,
      documentType: "receipt",
      fileUrl: file.url,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      uploadedBy: userId,
    });

    // Update expense to indicate receipt attached
    await db
      .update(expenses)
      .set({
        attachments: sql`
          COALESCE(attachments, '[]'::jsonb) || 
          ${JSON.stringify([{ url: file.url, type: file.fileType, name: file.fileName }])}::jsonb
        `,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId));

    // Audit log
    await auditLog({
      userId,
      action: "expense.receipt_uploaded",
      entityType: "expense",
      entityId: expenseId,
      metadata: {
        fileName: file.fileName,
        fileType: file.fileType,
      },
    });
  }

  /**
   * Approve an expense
   */
  async approveExpense(
    id: string,
    projectId: string,
    userId: string,
    comments?: string
  ): Promise<Expense> {
    const expense = await this.getExpenseById(id, projectId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    if (expense.approvalStatus === ExpenseStatus.APPROVED) {
      throw new Error("Expense is already approved");
    }

    // Update expense status
    const [updated] = await db
      .update(expenses)
      .set({
        approvalStatus: ExpenseStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(expenses.id, id), eq(expenses.projectId, projectId)))
      .returning();

    // Create approval history
    await this.createApprovalHistoryEntry(id, {
      action: "approved",
      actionBy: userId,
      previousStatus: expense.approvalStatus,
      newStatus: ExpenseStatus.APPROVED,
      comments,
      amountApproved: expense.grossAmount,
    });

    // Generate withholding tax certificate if applicable
    if (expense.isEwtApplicable && parseFloat(expense.ewtAmount) > 0) {
      await this.generateWithholdingCertificate(expense, userId);
    }

    // Audit log
    await auditLog({
      userId,
      action: "expense.approved",
      entityType: "expense",
      entityId: id,
      metadata: {
        amount: expense.grossAmount,
        approver: userId,
        comments,
      },
    });

    return updated;
  }

  /**
   * Reject an expense
   */
  async rejectExpense(
    id: string,
    projectId: string,
    userId: string,
    reason: string
  ): Promise<Expense> {
    const expense = await this.getExpenseById(id, projectId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    if (expense.approvalStatus === ExpenseStatus.APPROVED) {
      throw new Error("Cannot reject an already approved expense");
    }

    // Update expense status
    const [updated] = await db
      .update(expenses)
      .set({
        approvalStatus: ExpenseStatus.REJECTED,
        rejectionReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(expenses.id, id), eq(expenses.projectId, projectId)))
      .returning();

    // Create approval history
    await this.createApprovalHistoryEntry(id, {
      action: "rejected",
      actionBy: userId,
      previousStatus: expense.approvalStatus,
      newStatus: ExpenseStatus.REJECTED,
      comments: reason,
    });

    // Audit log
    await auditLog({
      userId,
      action: "expense.rejected",
      entityType: "expense",
      entityId: id,
      metadata: {
        reason,
        amount: expense.grossAmount,
      },
    });

    return updated;
  }

  /**
   * Calculate tax breakdown for an expense
   */
  calculateTaxBreakdown(expense: Expense): TaxBreakdown {
    const grossAmount = new Money(expense.grossAmount);
    const vatAmount = new Money(expense.vatAmount);
    const ewtAmount = new Money(expense.ewtAmount);
    const netAmount = new Money(expense.netAmount);

    const totalTax = vatAmount.add(ewtAmount);
    const netPayable = grossAmount.subtract(ewtAmount); // EWT is deducted from payment

    return {
      grossAmount: grossAmount.getDecimal(),
      netAmount: netAmount.getDecimal(),
      vatAmount: vatAmount.getDecimal(),
      ewtAmount: ewtAmount.getDecimal(),
      totalTax: totalTax.getDecimal(),
      netPayable: netPayable.getDecimal(),
    };
  }

  /**
   * Get expense categories with spend totals
   */
  async getCategorySpend(projectId: string, dateFrom: Date, dateTo: Date) {
    const result = await db
      .select({
        category: expenses.category,
        total: sql<string>`SUM(${expenses.grossAmount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.projectId, projectId),
          gte(expenses.expenseDate, dateFrom.toISOString().split("T")[0]),
          lte(expenses.expenseDate, dateTo.toISOString().split("T")[0]),
          eq(expenses.approvalStatus, ExpenseStatus.APPROVED),
          isNull(expenses.deletedAt)
        )
      )
      .groupBy(expenses.category);

    return result.map((row) => ({
      category: row.category,
      total: new Money(row.total),
      count: row.count,
    }));
  }

  // Private helper methods

  private async generateExpenseCode(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}`;

    // Get the last expense code for this project and year
    const [lastExpense] = await db
      .select({ expenseCode: expenses.expenseCode })
      .from(expenses)
      .where(
        and(eq(expenses.projectId, projectId), sql`${expenses.expenseCode} LIKE ${prefix + "%"}`)
      )
      .orderBy(desc(expenses.expenseCode))
      .limit(1);

    let sequence = 1;
    if (lastExpense) {
      const lastSequence = parseInt(lastExpense.expenseCode.split("-")[2] || "0");
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(6, "0")}`;
  }

  private determineApprovalLevel(amount: Money): ApprovalLevel {
    const value = amount.toNumber();

    if (value <= 5000) return ApprovalLevel.AUTO;
    if (value <= 25000) return ApprovalLevel.MANAGER;
    if (value <= 100000) return ApprovalLevel.OWNER;
    return ApprovalLevel.DUAL;
  }

  private getApprovalAction(status: ExpenseStatus): string {
    switch (status) {
      case ExpenseStatus.APPROVED:
        return "approved";
      case ExpenseStatus.REJECTED:
        return "rejected";
      case ExpenseStatus.PENDING_APPROVAL:
        return "resubmitted";
      default:
        return "updated";
    }
  }

  private async createApprovalHistoryEntry(
    expenseId: string,
    data: {
      action: string;
      actionBy: string;
      previousStatus?: string;
      newStatus: string;
      comments?: string;
      amountApproved?: string;
    }
  ): Promise<void> {
    await db.insert(expenseApprovalHistory).values({
      expenseId,
      action: data.action,
      actionBy: data.actionBy,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      comments: data.comments,
      amountApproved: data.amountApproved,
    });
  }

  private async generateWithholdingCertificate(expense: Expense, userId: string): Promise<void> {
    const vendor = expense.vendorId
      ? await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, expense.vendorId))
          .limit(1)
          .then((r) => r[0])
      : null;

    const period = new Date(expense.expenseDate);
    const periodCovered = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, "0")}`;

    await db.insert(withholdingTaxCertificates).values({
      projectId: expense.projectId,
      expenseId: expense.id,
      certificateNumber: await this.generateCertificateNumber(expense.projectId),
      periodCovered,
      payeeName: vendor?.vendorName || expense.vendorName || "Unknown",
      payeeTin: vendor?.tin || expense.vendorTin || "",
      payeeAddress: vendor?.address || "",
      incomePayment: expense.grossAmount,
      taxRate: expense.ewtRate || "0",
      taxWithheld: expense.ewtAmount,
      atcCode: this.getATCCode(expense.category),
      status: "draft",
      createdBy: userId,
    });
  }

  private async generateCertificateNumber(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WTC-${year}`;

    const [lastCert] = await db
      .select({ certificateNumber: withholdingTaxCertificates.certificateNumber })
      .from(withholdingTaxCertificates)
      .where(
        and(
          eq(withholdingTaxCertificates.projectId, projectId),
          sql`${withholdingTaxCertificates.certificateNumber} LIKE ${prefix + "%"}`
        )
      )
      .orderBy(desc(withholdingTaxCertificates.certificateNumber))
      .limit(1);

    let sequence = 1;
    if (lastCert) {
      const lastSequence = parseInt(lastCert.certificateNumber.split("-")[2] || "0");
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(6, "0")}`;
  }

  private getATCCode(category: string): string {
    // Simplified ATC code mapping - should be expanded based on actual BIR codes
    const atcMapping: Record<string, string> = {
      [ExpenseCategory.PROFESSIONAL_ACCOUNTING]: "WI010",
      [ExpenseCategory.PROFESSIONAL_LEGAL]: "WI010",
      [ExpenseCategory.PROFESSIONAL_CONSULTING]: "WI010",
      [ExpenseCategory.MAINTENANCE_REPAIRS]: "WC160",
      [ExpenseCategory.SUPPLIES_OFFICE]: "WC140",
      // Add more mappings as needed
    };

    return atcMapping[category] || "WI999";
  }
}
