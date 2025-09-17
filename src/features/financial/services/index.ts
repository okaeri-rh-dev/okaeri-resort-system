/**
 * Financial Services Export
 *
 * Central export point for all financial services
 * Note: PaymentService is excluded from client bundle as it uses Node.js modules
 * and is only needed server-side for internal admin operations
 */

export { ExpenseService } from "./expense.service";
export { IncomeService } from "./income.service";
// PaymentService excluded - uses node:crypto, only for server-side use
export { TaxCalculatorService } from "./tax-calculator.service";

// Service factory for dependency injection
export function createFinancialServices() {
  return {
    expense: new ExpenseService(),
    income: new IncomeService(),
    // payment service removed - not needed for client-side operations
    tax: new TaxCalculatorService(),
  };
}

// Type for the financial services
export type FinancialServices = ReturnType<typeof createFinancialServices>;
