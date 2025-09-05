// Dashboard Metrics Type Definitions
// Phase 2.1 - RED Phase: Comprehensive interfaces for Okaeri Resort metrics

/**
 * Base metric types with Philippine business context
 */
export interface BaseMetric {
  readonly id: string;
  readonly projectId: string; // Multi-tenant isolation
  readonly timestamp: Date;
  readonly source: "system" | "manual" | "integration";
}

/**
 * Booking-related metrics for occupancy and guest management
 */
export interface BookingMetrics extends BaseMetric {
  // Core occupancy data
  occupancy: {
    current: number; // 0-100 percentage
    trend: "up" | "down" | "stable";
    thirtyDayAverage: number;
    peakSeasonForecast: number; // Accounts for typhoon season
    availableRooms: number;
    totalRooms: number;
  };

  // Daily activity
  checkInsToday: number;
  checkOutsToday: number;
  arrivalsNext24Hours: GuestArrival[];
  departuresNext24Hours: GuestDeparture[];

  // Booking pipeline
  pendingBookings: number;
  confirmedBookings: number;
  cancelledThisWeek: number;
  noShowRate: number; // Percentage

  // Room status
  roomStatus: {
    clean: number;
    dirty: number;
    maintenance: number;
    outOfOrder: number;
  };

  // Booking channels (Philippine context)
  bookingSources: {
    direct: number;
    booking_com: number;
    agoda: number;
    airbnb: number;
    walk_in: number;
    referral: number;
  };
}

/**
 * Guest arrival/departure details
 */
export interface GuestArrival {
  readonly id: string; // Format: BK-2024-001
  guestName: string;
  roomNumber: string;
  expectedTime: Date;
  specialRequests?: string[];
  contactNumber: string; // Philippine mobile format
  nationalityCode: string;
  adultsCount: number;
  childrenCount: number;
  paymentStatus: "paid" | "partial" | "pending";
}

export interface GuestDeparture {
  readonly id: string;
  guestName: string;
  roomNumber: string;
  checkoutTime: Date;
  finalBill: PhilippineCurrency;
  outstandingBalance: PhilippineCurrency;
  paymentMethod: PaymentMethod;
  feedback?: GuestFeedback;
}

/**
 * Financial metrics with Philippine compliance
 */
export interface FinancialMetrics extends BaseMetric {
  // Revenue tracking (PHP)
  revenue: {
    today: PhilippineCurrency;
    week: PhilippineCurrency;
    month: PhilippineCurrency;
    quarter: PhilippineCurrency;
    yearToDate: PhilippineCurrency;
    trend: {
      direction: "up" | "down" | "stable";
      percentage: number;
    };
  };

  // Payment breakdown
  payments: {
    cash: PhilippineCurrency;
    gcash: PhilippineCurrency;
    maya: PhilippineCurrency;
    bank_transfer: PhilippineCurrency;
    credit_card: PhilippineCurrency;
    pending: PhilippineCurrency;
  };

  // Expense tracking
  expenses: {
    monthly: PhilippineCurrency;
    budget: PhilippineCurrency;
    variance: number; // Percentage
    categories: ExpenseCategory[];
  };

  // Philippine tax compliance (BIR)
  taxation: {
    vatCollected: PhilippineCurrency; // 12% VAT
    withHoldingTax: PhilippineCurrency;
    occupancyTax: PhilippineCurrency; // Local government tax
    quarterlyEstimate: PhilippineCurrency;
    nextFilingDate: Date;
  };

  // Profitability
  profitability: {
    grossProfit: PhilippineCurrency;
    netProfit: PhilippineCurrency;
    margin: number; // Percentage
    averageRoomRate: PhilippineCurrency;
    revPAR: PhilippineCurrency; // Revenue per available room
  };
}

/**
 * Philippine currency type with proper formatting
 */
export interface PhilippineCurrency {
  readonly amount: number; // Always in centavos (1/100 peso)
  readonly currency: "PHP";
  readonly formatted: string; // e.g., "₱2,847.50"
  readonly displayText: string; // e.g., "₱2,847.50 PHP"
}

/**
 * Expense categories for resort operations
 */
export interface ExpenseCategory {
  readonly id: string;
  name: string;
  budgetAllocated: PhilippineCurrency;
  spent: PhilippineCurrency;
  variance: number; // Percentage
  subcategories: {
    utilities: PhilippineCurrency;
    maintenance: PhilippineCurrency;
    supplies: PhilippineCurrency;
    staff: PhilippineCurrency;
    marketing: PhilippineCurrency;
    other: PhilippineCurrency;
  };
}

/**
 * Payment methods available in Philippines
 */
export type PaymentMethod =
  | "cash"
  | "gcash"
  | "maya" // Formerly PayMaya
  | "bank_transfer"
  | "credit_card"
  | "debit_card"
  | "installment";

/**
 * Guest feedback for service improvement
 */
export interface GuestFeedback {
  rating: 1 | 2 | 3 | 4 | 5;
  comments?: string;
  wouldRecommend: boolean;
  improvementAreas?: string[];
  submittedAt: Date;
}

/**
 * Performance KPIs specific to resort operations
 */
export interface PerformanceKPIs extends BaseMetric {
  // Operational efficiency
  averageCheckInTime: number; // Minutes
  averageCheckOutTime: number; // Minutes
  housekeepingTurnaround: number; // Minutes
  maintenanceResponseTime: number; // Hours

  // Guest satisfaction
  averageRating: number; // 1-5
  recommendationRate: number; // Percentage
  repeatGuestRate: number; // Percentage
  complaintResolutionTime: number; // Hours

  // Staff productivity
  staffEfficiencyScore: number; // 0-100
  trainingCompletionRate: number; // Percentage
  staffTurnoverRate: number; // Monthly percentage

  // Seasonal adjustments (typhoon season impact)
  seasonalFactors: {
    weatherImpactRisk: "low" | "medium" | "high";
    occupancySeasonality: number; // Adjustment factor
    priceSeasonality: number; // Adjustment factor
  };
}

/**
 * Real-time alert thresholds
 */
export interface AlertThresholds {
  occupancyRate: {
    low: number; // Below this triggers low occupancy alert
    high: number; // Above this triggers overbook risk
  };
  revenue: {
    dailyTarget: PhilippineCurrency;
    weeklyTarget: PhilippineCurrency;
    variance: number; // Percentage deviation to trigger alert
  };
  expenses: {
    budgetVariance: number; // Percentage over budget
    cashFlowMinimum: PhilippineCurrency;
  };
  operations: {
    maxCheckInTime: number; // Minutes
    maxComplaintResponse: number; // Hours
    minStaffRating: number; // 1-5
  };
}

/**
 * Metric aggregation periods for different views
 */
export type MetricPeriod =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "real-time";

/**
 * Dashboard view configuration
 */
export interface DashboardConfig {
  readonly userId: string;
  readonly projectId: string;
  preferences: {
    defaultPeriod: MetricPeriod;
    timezone: string; // Philippine Standard Time
    currency: "PHP";
    language: "en" | "fil";
    refreshInterval: number; // Seconds
    alertsEnabled: boolean;
  };
  layout: {
    pinnedMetrics: string[];
    hiddenMetrics: string[];
    customOrder: string[];
  };
}
