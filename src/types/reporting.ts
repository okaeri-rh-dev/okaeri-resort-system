// Financial Reporting and Analytics Types for Okaeri Resort System
// Philippine Business Compliance & Resort Analytics

// ============================================
// REPORT TYPE DEFINITIONS
// ============================================
export type ReportType = "occupancy" | "revenue" | "financial" | "guest" | "tax" | "performance";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "custom";

export type ExportFormat = "pdf" | "excel" | "csv";

export type TaxType = "vat" | "local" | "income" | "withholding";

// ============================================
// OCCUPANCY ANALYTICS TYPES
// ============================================
export interface OccupancyMetrics {
  period: string;
  periodType: ReportPeriod;
  totalUnits: number;
  totalNights: number;
  occupiedNights: number;
  occupancyRate: number;
  averageStayLength: number;
  weekdayOccupancy: number;
  weekendOccupancy: number;
  peakOccupancy: number;
  lowestOccupancy: number;
  unitBreakdown: UnitOccupancyDetail[];
}

export interface UnitOccupancyDetail {
  unitId: string;
  unitName: string;
  unitType: string;
  totalNights: number;
  occupiedNights: number;
  occupancyRate: number;
  revenue: number;
  averageRate: number;
  maintenanceDays: number;
}

export interface OccupancyTrend {
  date: string;
  occupancyRate: number;
  occupiedUnits: number;
  availableUnits: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

// ============================================
// REVENUE REPORTING TYPES
// ============================================
export interface RevenueReport {
  period: string;
  periodType: ReportPeriod;
  grossRevenue: number;
  netRevenue: number;
  roomRevenue: number;
  additionalServicesRevenue: number;
  averageDailyRate: number; // ADR
  revenuePerAvailableUnit: number; // RevPAR
  paymentMethodBreakdown: PaymentMethodRevenue[];
  unitTypeBreakdown: UnitTypeRevenue[];
  dailyBreakdown?: DailyRevenue[];
  taxBreakdown: TaxBreakdown;
  yearOverYearGrowth?: number;
  monthOverMonthGrowth?: number;
}

export interface PaymentMethodRevenue {
  method: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface UnitTypeRevenue {
  unitType: string;
  revenue: number;
  percentage: number;
  bookingCount: number;
  averageRate: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  bookingCount: number;
  checkIns: number;
  checkOuts: number;
  occupancyRate: number;
  isWeekend: boolean;
  isHoliday: boolean;
}

// ============================================
// PHILIPPINE TAX COMPLIANCE TYPES
// ============================================
export interface TaxReport {
  period: string;
  periodType: ReportPeriod;
  grossRevenue: number;
  taxableRevenue: number;
  vatAmount: number; // 12% VAT
  vatExemptSales: number;
  localTaxAmount: number;
  withholdingTax: number;
  netRevenue: number;
  birForm2307Details?: BIRForm2307[]; // Withholding certificates
  quarterlySummary?: QuarterlyTaxSummary;
  annualSummary?: AnnualTaxSummary;
}

export interface BIRForm2307 {
  certificateNumber: string;
  payorName: string;
  payorTIN: string;
  amount: number;
  withheldAmount: number;
  dateIssued: string;
  incomeType: string;
}

export interface QuarterlyTaxSummary {
  quarter: number;
  year: number;
  grossRevenue: number;
  taxableRevenue: number;
  vatRemittance: number;
  incomePayment: number;
  localTaxPayment: number;
  totalTaxPayment: number;
  filingDeadline: string;
  filingStatus: "pending" | "filed" | "paid" | "overdue";
}

export interface AnnualTaxSummary {
  year: number;
  grossRevenue: number;
  totalExpenses: number;
  netIncome: number;
  taxableIncome: number;
  incomeTax: number;
  vatRemitted: number;
  localTaxRemitted: number;
  totalTaxPaid: number;
  effectiveTaxRate: number;
}

export interface TaxBreakdown {
  vat: number;
  localTax: number;
  withholding: number;
  total: number;
}

// ============================================
// GUEST ANALYTICS TYPES
// ============================================
export interface GuestAnalytics {
  period: string;
  periodType: ReportPeriod;
  totalGuests: number;
  newGuests: number;
  returningGuests: number;
  repeatGuestRate: number;
  averageGuestsPerBooking: number;
  topGuests: TopGuest[];
  guestDemographics: GuestDemographics;
  bookingPatterns: BookingPattern;
  satisfactionMetrics?: SatisfactionMetrics;
}

export interface TopGuest {
  guestId: string;
  guestName: string;
  email: string;
  totalBookings: number;
  totalSpent: number;
  averageBookingValue: number;
  lastBookingDate: string;
  loyaltyStatus: "new" | "returning" | "vip";
}

export interface GuestDemographics {
  domesticGuests: number;
  internationalGuests: number;
  averageAge?: number;
  familyBookings: number;
  coupleBookings: number;
  groupBookings: number;
  businessBookings: number;
}

export interface BookingPattern {
  averageLeadTime: number; // Days between booking and check-in
  averageStayLength: number;
  weekdayPreference: number;
  weekendPreference: number;
  seasonalPreference: SeasonalPreference[];
  preferredUnits: PreferredUnit[];
}

export interface SeasonalPreference {
  season: string;
  bookingCount: number;
  percentage: number;
}

export interface PreferredUnit {
  unitType: string;
  bookingCount: number;
  percentage: number;
}

export interface SatisfactionMetrics {
  averageRating?: number;
  reviewCount?: number;
  recommendationRate?: number;
  repeatBookingRate: number;
}

// ============================================
// FINANCIAL PERFORMANCE TYPES
// ============================================
export interface FinancialPerformance {
  period: string;
  periodType: ReportPeriod;
  revenue: RevenueBreakdown;
  expenses: ExpenseBreakdown;
  profitability: ProfitabilityMetrics;
  cashFlow: CashFlowStatement;
  kpis: FinancialKPIs;
  forecast?: FinancialForecast;
}

export interface RevenueBreakdown {
  roomRevenue: number;
  serviceRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  revenueGrowth: number;
}

export interface ExpenseBreakdown {
  operationalExpenses: OperationalExpenses;
  capitalExpenses: number;
  totalExpenses: number;
  expenseRatio: number;
}

export interface OperationalExpenses {
  utilities: number;
  maintenance: number;
  supplies: number;
  salaries: number;
  marketing: number;
  insurance: number;
  taxes: number;
  other: number;
  total: number;
}

export interface ProfitabilityMetrics {
  grossProfit: number;
  grossProfitMargin: number;
  operatingProfit: number;
  operatingProfitMargin: number;
  netProfit: number;
  netProfitMargin: number;
  ebitda: number;
  ebitdaMargin: number;
}

export interface CashFlowStatement {
  openingBalance: number;
  cashFromOperations: number;
  cashFromInvesting: number;
  cashFromFinancing: number;
  netCashFlow: number;
  closingBalance: number;
  burnRate?: number;
  runwayMonths?: number;
}

export interface FinancialKPIs {
  costPerOccupiedRoom: number; // CPOR
  revenuePerAvailableRoom: number; // RevPAR
  averageDailyRate: number; // ADR
  goppar: number; // Gross Operating Profit Per Available Room
  laborCostPercentage: number;
  returnOnInvestment: number; // ROI
  breakEvenOccupancy: number;
  debtServiceCoverageRatio?: number;
}

export interface FinancialForecast {
  nextMonthRevenue: number;
  nextQuarterRevenue: number;
  nextMonthOccupancy: number;
  nextQuarterOccupancy: number;
  seasonalAdjustment: number;
  confidenceLevel: number;
  assumptions: string[];
}

// ============================================
// REPORT CONFIGURATION TYPES
// ============================================
export interface ReportConfig {
  id: string;
  name: string;
  type: ReportType;
  period: ReportPeriod;
  dateRange: {
    start: string;
    end: string;
  };
  filters?: ReportFilters;
  groupBy?: string[];
  sortBy?: string;
  includeComparison?: boolean;
  comparisonPeriod?: ReportPeriod;
  exportFormat?: ExportFormat;
  schedule?: ReportSchedule;
  recipients?: string[];
}

export interface ReportFilters {
  units?: string[];
  unitTypes?: string[];
  paymentMethods?: string[];
  bookingStatus?: string[];
  guestTypes?: string[];
  minAmount?: number;
  maxAmount?: number;
}

export interface ReportSchedule {
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// ============================================
// REPORT GENERATION TYPES
// ============================================
export interface ReportRequest {
  type: ReportType;
  config: ReportConfig;
  generateNow?: boolean;
  sendEmail?: boolean;
}

export interface ReportResponse {
  id: string;
  type: ReportType;
  status: ReportStatus;
  data?: any;
  generatedAt: string;
  config: ReportConfig;
  downloadUrl?: string;
  error?: string;
}

export type ReportStatus = "pending" | "generating" | "completed" | "failed" | "scheduled";

export interface ReportCache {
  key: string;
  data: any;
  generatedAt: string;
  expiresAt: string;
  config: ReportConfig;
}

// ============================================
// PHILIPPINE-SPECIFIC TYPES
// ============================================
export interface PhilippineHoliday {
  date: string;
  name: string;
  type: "regular" | "special" | "local";
  isNationwide: boolean;
  affectsRates: boolean;
}

export interface PhilippineTaxRates {
  vat: number; // 12%
  localBusinessTax: number; // Varies by LGU
  incomeTax: number; // Based on income bracket
  withholdingTax: number; // For services
  touristTax?: number; // Some LGUs have this
}

export interface PhilippineCompliance {
  birRegistration: string;
  localBusinessPermit: string;
  tourismAccreditation?: string;
  fireSafetyPermit: string;
  sanitaryPermit: string;
  lastBIRFiling?: string;
  nextBIRDeadline?: string;
  complianceStatus: "compliant" | "pending" | "expired";
}

// ============================================
// DASHBOARD WIDGET TYPES
// ============================================
export interface DashboardWidget {
  id: string;
  type: "metric" | "chart" | "table" | "summary";
  title: string;
  data: any;
  refreshInterval?: number; // in seconds
  size: "small" | "medium" | "large" | "full";
  position: { x: number; y: number };
}

export interface MetricWidget {
  label: string;
  value: number | string;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  format?: "currency" | "percentage" | "number";
  icon?: string;
  color?: string;
}

export interface ChartWidget {
  chartType: "line" | "bar" | "pie" | "area" | "donut";
  data: any[];
  xAxis?: string;
  yAxis?: string;
  series?: string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
}

// ============================================
// EXPORT TYPES
// ============================================
export interface ExportOptions {
  format: ExportFormat;
  includeCharts: boolean;
  includeRawData: boolean;
  dateFormat: string;
  currencyFormat: string;
  logoUrl?: string;
  companyInfo?: CompanyInfo;
  customHeader?: string;
  customFooter?: string;
}

export interface CompanyInfo {
  name: string;
  address: string;
  tin: string; // Tax Identification Number
  contact: string;
  email: string;
  website?: string;
}
