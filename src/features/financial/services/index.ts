/**
 * Financial Services Export
 *
 * Central export point for all financial services
 */

export { ExpenseService } from "./expense.service";
export { IncomeService } from "./income.service";
export { PaymentService } from "./payment.service";
export { TaxCalculatorService } from "./tax-calculator.service";

// Service factory for dependency injection
export function createFinancialServices() {
  return {
    expense: new ExpenseService(),
    income: new IncomeService(),
    payment: new PaymentService(),
    tax: new TaxCalculatorService(),
  };
}

// Type for the financial services
export type FinancialServices = ReturnType<typeof createFinancialServices>;
