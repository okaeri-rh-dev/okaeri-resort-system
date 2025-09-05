/**
 * Test Utilities Index
 * Phase 2.1 - RED Phase: Central export for all mock data generators
 */

// Dashboard Mock Data Generators
export * from "./dashboard-mocks";
export * from "./websocket-mocks";
export * from "./metric-helpers";

// Export default scenarios for quick testing
export {
  createNormalOperations,
  createPeakSeason,
  createOffSeason,
  createCrisisScenario,
  createHighPerformance,
  DashboardMockGenerator,
} from "./dashboard-mocks";

export {
  MockWebSocket,
  WebSocketEventSimulator,
  MockWebSocketManager,
  createStableConnection,
  createUnstableConnection,
  createTyphoonConnection,
  createPeakLoadConnection,
} from "./websocket-mocks";

export {
  createPHPCurrency,
  calculateVAT,
  calculateWithholdingTax,
  calculateLocalTax,
  generateFilipinoGuestName,
  generateInternationalGuestName,
  generatePhilippineMobile,
  generateBookingReference,
  generateTransactionId,
  calculateDailyRevenue,
  generateExpenseDistribution,
  generatePerformanceMetrics,
  getTourismSeason,
  isTyphoonSeason,
  isPhilippineHoliday,
  getSeasonalPricing,
} from "./metric-helpers";
