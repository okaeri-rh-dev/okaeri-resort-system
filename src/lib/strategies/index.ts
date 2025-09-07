/**
 * Report Strategies Export
 *
 * Central export point for all report generation strategies
 */

export { ProfitLossStrategy } from "./profit-loss.strategy";
export { CashFlowStrategy } from "./cash-flow.strategy";

export type { ProfitLossDetails } from "./profit-loss.strategy";
export type { CashFlowDetails } from "./cash-flow.strategy";

// Strategy factory function
export function createReportStrategies() {
  return {
    profitLoss: new ProfitLossStrategy(),
    cashFlow: new CashFlowStrategy(),
  };
}

// Type for all strategies
export type ReportStrategies = ReturnType<typeof createReportStrategies>;
