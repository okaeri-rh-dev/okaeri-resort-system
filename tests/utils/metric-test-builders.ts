/**
 * Metric Test Builders - Phase 2.1 TDD Utilities
 *
 * Builder pattern utilities for creating realistic test data scenarios for
 * dashboard metrics. Provides comprehensive data generators that reflect
 * Philippine resort business patterns, seasonal variations, and edge cases.
 *
 * These builders support TDD by creating consistent, realistic test data
 * that matches real-world business scenarios at Okaeri Resort.
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 2.1 - Dashboard TDD
 */

import { faker } from "@faker-js/faker";
import type {
  DashboardStats,
  ChartData,
  Booking,
  BookingStatus,
  BookingSource,
  PaymentStatus,
  PaymentMethod,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  DateRange,
  ActivityLog,
} from "@/types/common";

/**
 * Philippine Resort Business Constants
 * Based on real resort operations in La Union, Philippines
 */
const PHILIPPINE_RESORT_CONSTANTS = {
  // Average daily rates in PHP
  PEAK_SEASON_RATE: 3500,
  REGULAR_SEASON_RATE: 2500,
  OFF_SEASON_RATE: 1800,

  // Seasonal patterns (months 0-11)
  PEAK_MONTHS: [11, 0, 1, 2, 3, 4], // Dec-May (dry season)
  TYPHOON_MONTHS: [5, 6, 7, 8, 9, 10], // Jun-Nov (wet season)

  // Occupancy patterns
  PEAK_OCCUPANCY: { min: 85, max: 95 },
  REGULAR_OCCUPANCY: { min: 65, max: 80 },
  OFF_SEASON_OCCUPANCY: { min: 35, max: 60 },

  // Property capacity
  TOTAL_ROOMS: 24,
  MAX_GUESTS_PER_ROOM: 4,

  // Common expenses (monthly averages in PHP)
  UTILITIES_RANGE: { min: 25000, max: 45000 },
  MAINTENANCE_RANGE: { min: 15000, max: 35000 },
  SUPPLIES_RANGE: { min: 8000, max: 18000 },
  SALARIES_RANGE: { min: 85000, max: 95000 },

  // Booking sources distribution
  BOOKING_SOURCES: {
    AIRBNB: 0.35,
    BOOKING_COM: 0.25,
    DIRECT: 0.2,
    WEBSITE: 0.1,
    PHONE: 0.05,
    WALK_IN: 0.03,
    OTHER: 0.02,
  },

  // Guest behavior patterns
  AVERAGE_STAY_LENGTH: 2.5,
  REPEAT_GUEST_RATE: 0.3,
  CANCELLATION_RATE: 0.15,
} as const;

/**
 * Base Builder Class
 * Provides common functionality for all metric builders
 */
abstract class BaseMetricBuilder<T> {
  protected data: Partial<T> = {};

  /**
   * Build the final object
   */
  abstract build(): T;

  /**
   * Reset the builder to default state
   */
  reset(): this {
    this.data = {};
    return this;
  }

  /**
   * Apply custom overrides
   */
  with(overrides: Partial<T>): this {
    this.data = { ...this.data, ...overrides };
    return this;
  }
}

/**
 * Dashboard Stats Builder
 * Creates realistic dashboard statistics with seasonal patterns
 */
export class DashboardStatsBuilder extends BaseMetricBuilder<DashboardStats> {
  private season: "peak" | "regular" | "off" = "regular";
  private month: number = new Date().getMonth();
  private occupancyRate: number = 70;

  /**
   * Set the season for realistic seasonal variations
   */
  withSeason(season: "peak" | "regular" | "off"): this {
    this.season = season;
    return this;
  }

  /**
   * Set specific month for seasonal calculations
   */
  withMonth(month: number): this {
    this.month = month;
    this.season = this.calculateSeasonFromMonth(month);
    return this;
  }

  /**
   * Set occupancy rate and calculate dependent metrics
   */
  withOccupancy(rate: number): this {
    this.occupancyRate = Math.max(0, Math.min(100, rate));
    return this;
  }

  /**
   * Create stats for high-performing period
   */
  withHighPerformance(): this {
    this.season = "peak";
    this.occupancyRate = faker.number.float({
      min: PHILIPPINE_RESORT_CONSTANTS.PEAK_OCCUPANCY.min,
      max: PHILIPPINE_RESORT_CONSTANTS.PEAK_OCCUPANCY.max,
    });
    return this;
  }

  /**
   * Create stats for struggling period
   */
  withLowPerformance(): this {
    this.season = "off";
    this.occupancyRate = faker.number.float({
      min: PHILIPPINE_RESORT_CONSTANTS.OFF_SEASON_OCCUPANCY.min,
      max: PHILIPPINE_RESORT_CONSTANTS.OFF_SEASON_OCCUPANCY.max,
    });
    return this;
  }

  /**
   * Create stats with typhoon season impact
   */
  withTyphoonImpact(): this {
    const impact = faker.number.float({ min: 0.3, max: 0.7 }); // 30-70% reduction
    this.occupancyRate *= impact;

    return this.with({
      revenueGrowth: faker.number.float({ min: -45, max: -15 }),
      expenseGrowth: faker.number.float({ min: 10, max: 35 }), // Higher maintenance
    });
  }

  /**
   * Create year-over-year comparison stats
   */
  withYearOverYear(growth: number): this {
    return this.with({
      revenueGrowth: growth,
      expenseGrowth: growth > 0 ? growth * 0.6 : growth * 1.2, // Expenses lag revenue
    });
  }

  build(): DashboardStats {
    const baseRate = this.getBaseRateForSeason();
    const occupiedRooms = Math.ceil(
      (PHILIPPINE_RESORT_CONSTANTS.TOTAL_ROOMS * this.occupancyRate) / 100
    );
    const totalBookings = this.calculateTotalBookings();

    // Calculate revenue based on occupancy and rates
    const totalRevenue = this.calculateTotalRevenue(occupiedRooms, baseRate);
    const totalExpenses = this.calculateTotalExpenses();

    const defaults: DashboardStats = {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      occupancyRate: this.occupancyRate,
      averageNightlyRate: baseRate,
      totalBookings,
      upcomingCheckIns: faker.number.int({ min: 0, max: 8 }),
      upcomingCheckOuts: faker.number.int({ min: 0, max: 6 }),
      revenueGrowth: faker.number.float({ min: -15, max: 25 }),
      expenseGrowth: faker.number.float({ min: -10, max: 20 }),
    };

    return { ...defaults, ...this.data };
  }

  private calculateSeasonFromMonth(month: number): "peak" | "regular" | "off" {
    if (PHILIPPINE_RESORT_CONSTANTS.PEAK_MONTHS.includes(month)) return "peak";
    if (PHILIPPINE_RESORT_CONSTANTS.TYPHOON_MONTHS.includes(month)) return "off";
    return "regular";
  }

  private getBaseRateForSeason(): number {
    switch (this.season) {
      case "peak":
        return PHILIPPINE_RESORT_CONSTANTS.PEAK_SEASON_RATE;
      case "off":
        return PHILIPPINE_RESORT_CONSTANTS.OFF_SEASON_RATE;
      default:
        return PHILIPPINE_RESORT_CONSTANTS.REGULAR_SEASON_RATE;
    }
  }

  private calculateTotalBookings(): number {
    const baseBookings = Math.ceil(this.occupancyRate * 0.8); // Rough estimation
    const seasonMultiplier = {
      peak: 1.3,
      regular: 1.0,
      off: 0.7,
    }[this.season];

    return Math.ceil(baseBookings * seasonMultiplier);
  }

  private calculateTotalRevenue(occupiedRooms: number, rate: number): number {
    const daysInMonth = 30; // Simplified
    const revenue = occupiedRooms * rate * daysInMonth;

    // Add some realistic variation
    const variation = faker.number.float({ min: 0.9, max: 1.1 });
    return Math.ceil(revenue * variation);
  }

  private calculateTotalExpenses(): number {
    const { UTILITIES_RANGE, MAINTENANCE_RANGE, SUPPLIES_RANGE, SALARIES_RANGE } =
      PHILIPPINE_RESORT_CONSTANTS;

    const utilities = faker.number.int(UTILITIES_RANGE);
    const maintenance = faker.number.int(MAINTENANCE_RANGE);
    const supplies = faker.number.int(SUPPLIES_RANGE);
    const salaries = faker.number.int(SALARIES_RANGE);

    return utilities + maintenance + supplies + salaries;
  }
}

/**
 * Booking Scenario Builder
 * Creates realistic booking data with Filipino guest patterns
 */
export class BookingScenarioBuilder extends BaseMetricBuilder<Booking[]> {
  private count: number = 10;
  private dateRange: DateRange = {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  };

  /**
   * Set number of bookings to generate
   */
  withCount(count: number): this {
    this.count = count;
    return this;
  }

  /**
   * Set date range for bookings
   */
  withDateRange(range: DateRange): this {
    this.dateRange = range;
    return this;
  }

  /**
   * Create peak season booking pattern
   */
  withPeakSeasonPattern(): this {
    this.count = faker.number.int({ min: 40, max: 60 });
    return this;
  }

  /**
   * Create off-season booking pattern
   */
  withOffSeasonPattern(): this {
    this.count = faker.number.int({ min: 10, max: 25 });
    return this;
  }

  /**
   * Create bookings with high cancellation rate
   */
  withHighCancellations(): this {
    // Will be handled in build() method
    this.data.highCancellations = true as any;
    return this;
  }

  /**
   * Create bookings with specific source distribution
   */
  withSourceDistribution(sources: Record<BookingSource, number>): this {
    this.data.sourceDistribution = sources as any;
    return this;
  }

  build(): Booking[] {
    const bookings: Booking[] = [];
    const { highCancellations, sourceDistribution } = this.data as any;

    for (let i = 0; i < this.count; i++) {
      const booking = this.createSingleBooking(i, {
        highCancellations,
        sourceDistribution,
      });
      bookings.push(booking);
    }

    return bookings;
  }

  private createSingleBooking(
    index: number,
    options: { highCancellations?: boolean; sourceDistribution?: any }
  ): Booking {
    const checkIn = faker.date.between({
      from: this.dateRange.from,
      to: this.dateRange.to,
    });

    const nights = faker.number.int({ min: 1, max: 7 });
    const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);

    const guests = faker.number.int({ min: 1, max: 4 });
    const totalAmount = this.calculateBookingAmount(nights, guests);

    // Determine status with realistic distribution
    const status = this.getBookingStatus(options.highCancellations);
    const paymentStatus = this.getPaymentStatus(status);
    const source = this.getBookingSource(options.sourceDistribution);

    return {
      id: `booking-${index + 1}`,
      projectId: "test-project",
      propertyId: `property-${faker.number.int({ min: 1, max: 5 })}`,
      guestName: this.generateFilipinoName(),
      guestEmail: faker.internet.email(),
      guestPhone: this.generatePhilippinePhoneNumber(),
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      nights,
      guests,
      status,
      source,
      totalAmount,
      paidAmount: this.calculatePaidAmount(totalAmount, paymentStatus),
      paymentStatus,
      paymentMethod: this.getPaymentMethod(),
      notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
      specialRequests: faker.helpers.maybe(
        () =>
          faker.helpers.arrayElement([
            "Late check-in requested",
            "Extra towels needed",
            "Vegetarian meals",
            "Baby crib required",
            "Ground floor room preferred",
          ]),
        { probability: 0.2 }
      ),
      createdAt: faker.date.recent({ days: 30 }).toISOString(),
      updatedAt: faker.date.recent({ days: 5 }).toISOString(),
    };
  }

  private calculateBookingAmount(nights: number, guests: number): number {
    const baseRate = PHILIPPINE_RESORT_CONSTANTS.REGULAR_SEASON_RATE;
    const guestMultiplier = guests > 2 ? 1 + (guests - 2) * 0.2 : 1;
    return Math.ceil(nights * baseRate * guestMultiplier);
  }

  private getBookingStatus(highCancellations?: boolean): BookingStatus {
    const cancellationRate = highCancellations ? 0.4 : 0.15;

    const statuses: Array<{ status: BookingStatus; weight: number }> = [
      { status: "CONFIRMED", weight: 0.6 },
      { status: "CHECKED_IN", weight: 0.15 },
      { status: "CHECKED_OUT", weight: 0.15 },
      { status: "CANCELLED", weight: cancellationRate },
      { status: "PENDING", weight: 0.05 },
      { status: "NO_SHOW", weight: 0.02 },
    ];

    return faker.helpers.weightedArrayElement(statuses).status;
  }

  private getPaymentStatus(bookingStatus: BookingStatus): PaymentStatus {
    if (bookingStatus === "CANCELLED") return "REFUNDED";
    if (bookingStatus === "NO_SHOW") return "PENDING";
    if (bookingStatus === "CHECKED_OUT") return "PAID";

    return faker.helpers.weightedArrayElement([
      { weight: 0.7, value: "PAID" },
      { weight: 0.2, value: "PARTIAL" },
      { weight: 0.1, value: "PENDING" },
    ]).value;
  }

  private getBookingSource(distribution?: Record<BookingSource, number>): BookingSource {
    const sources = distribution || PHILIPPINE_RESORT_CONSTANTS.BOOKING_SOURCES;

    const weightedSources = Object.entries(sources).map(([source, weight]) => ({
      value: source as BookingSource,
      weight,
    }));

    return faker.helpers.weightedArrayElement(weightedSources).value;
  }

  private getPaymentMethod(): PaymentMethod {
    return faker.helpers.weightedArrayElement([
      { value: "CASH", weight: 0.4 }, // Cash still popular in Philippines
      { value: "CREDIT_CARD", weight: 0.3 },
      { value: "BANK_TRANSFER", weight: 0.15 },
      { value: "PAYPAL", weight: 0.1 },
      { value: "OTHER", weight: 0.05 }, // GCash, Maya, etc.
    ]).value;
  }

  private calculatePaidAmount(totalAmount: number, paymentStatus: PaymentStatus): number {
    switch (paymentStatus) {
      case "PAID":
        return totalAmount;
      case "PARTIAL":
        return Math.ceil(totalAmount * faker.number.float({ min: 0.3, max: 0.8 }));
      case "REFUNDED":
        return 0;
      default:
        return 0;
    }
  }

  private generateFilipinoName(): string {
    const firstNames = [
      "Juan",
      "Maria",
      "Jose",
      "Ana",
      "Antonio",
      "Carmen",
      "Francisco",
      "Luz",
      "Pedro",
      "Rosario",
      "Manuel",
      "Elena",
      "Ricardo",
      "Sofia",
      "Miguel",
      "Isabel",
      "Carlos",
      "Teresa",
      "Luis",
      "Rosa",
      "Angel",
      "Patricia",
    ];

    const lastNames = [
      "Santos",
      "Reyes",
      "Cruz",
      "Bautista",
      "Ocampo",
      "Garcia",
      "Mendoza",
      "Torres",
      "Tomas",
      "Andres",
      "Marquez",
      "Castillo",
      "Villanueva",
      "Morales",
      "Aquino",
      "Ramos",
      "Valdez",
      "Soriano",
      "Pascual",
      "Herrera",
    ];

    const firstName = faker.helpers.arrayElement(firstNames);
    const lastName = faker.helpers.arrayElement(lastNames);

    // Sometimes add middle name or compound last names
    if (faker.datatype.boolean(0.3)) {
      const middleName = faker.helpers.arrayElement(["dela", "de", "delos", "san", "santa"]);
      const secondLastName = faker.helpers.arrayElement(lastNames);
      return `${firstName} ${middleName} ${secondLastName}`;
    }

    return `${firstName} ${lastName}`;
  }

  private generatePhilippinePhoneNumber(): string {
    const networks = [
      "917",
      "918",
      "919",
      "920",
      "928",
      "929",
      "939",
      "946",
      "947",
      "948",
      "949",
      "950",
    ];
    const network = faker.helpers.arrayElement(networks);
    const number = faker.string.numeric(7);
    return `+63${network}${number}`;
  }
}

/**
 * Expense Scenario Builder
 * Creates realistic expense data with Philippine business patterns
 */
export class ExpenseScenarioBuilder extends BaseMetricBuilder<Expense[]> {
  private count: number = 15;
  private totalBudget: number = 200000; // PHP

  /**
   * Set number of expenses to generate
   */
  withCount(count: number): this {
    this.count = count;
    return this;
  }

  /**
   * Set total budget for expense distribution
   */
  withBudget(budget: number): this {
    this.totalBudget = budget;
    return this;
  }

  /**
   * Create high-expense month (e.g., maintenance season)
   */
  withHighExpenseMonth(): this {
    this.totalBudget *= 1.5;
    return this;
  }

  /**
   * Create cost-cutting scenario
   */
  withCostCutting(): this {
    this.totalBudget *= 0.7;
    return this;
  }

  build(): Expense[] {
    const expenses: Expense[] = [];
    const categoryDistribution = this.getCategoryDistribution();

    for (let i = 0; i < this.count; i++) {
      const expense = this.createSingleExpense(i, categoryDistribution);
      expenses.push(expense);
    }

    return expenses;
  }

  private getCategoryDistribution(): Record<ExpenseCategory, number> {
    return {
      UTILITIES: this.totalBudget * 0.25,
      SALARIES: this.totalBudget * 0.4,
      MAINTENANCE: this.totalBudget * 0.15,
      SUPPLIES: this.totalBudget * 0.08,
      MARKETING: this.totalBudget * 0.05,
      INSURANCE: this.totalBudget * 0.03,
      TAXES: this.totalBudget * 0.02,
      COMMISSIONS: this.totalBudget * 0.01,
      CLEANING: this.totalBudget * 0.01,
      OTHER: this.totalBudget * 0.01,
    };
  }

  private createSingleExpense(
    index: number,
    categoryBudgets: Record<ExpenseCategory, number>
  ): Expense {
    const category = this.getRandomCategory();
    const maxAmount = categoryBudgets[category] / (this.count * 0.2); // Allow some variation
    const amount = faker.number.int({ min: 500, max: Math.ceil(maxAmount) });

    return {
      id: `expense-${index + 1}`,
      projectId: "test-project",
      propertyId: faker.helpers.maybe(() => `property-${faker.number.int({ min: 1, max: 5 })}`, {
        probability: 0.7,
      }),
      category,
      amount,
      description: this.getExpenseDescription(category, amount),
      vendor: this.getVendorName(category),
      date: faker.date.recent({ days: 30 }).toISOString(),
      paymentMethod: this.getExpensePaymentMethod(),
      receiptUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.6 }),
      status: this.getExpenseStatus(),
      approvedBy: faker.helpers.maybe(() => "manager-123", { probability: 0.8 }),
      approvedAt: faker.helpers.maybe(() => faker.date.recent({ days: 15 }).toISOString(), {
        probability: 0.8,
      }),
      notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
      tags: faker.helpers.maybe(
        () => [
          faker.helpers.arrayElement(["monthly", "quarterly", "emergency", "planned", "recurring"]),
        ],
        { probability: 0.4 }
      ),
      createdAt: faker.date.recent({ days: 35 }).toISOString(),
      updatedAt: faker.date.recent({ days: 5 }).toISOString(),
    };
  }

  private getRandomCategory(): ExpenseCategory {
    return faker.helpers.weightedArrayElement([
      { value: "UTILITIES", weight: 0.25 },
      { value: "SALARIES", weight: 0.2 },
      { value: "MAINTENANCE", weight: 0.15 },
      { value: "SUPPLIES", weight: 0.12 },
      { value: "CLEANING", weight: 0.08 },
      { value: "MARKETING", weight: 0.07 },
      { value: "INSURANCE", weight: 0.05 },
      { value: "TAXES", weight: 0.04 },
      { value: "COMMISSIONS", weight: 0.02 },
      { value: "OTHER", weight: 0.02 },
    ]).value;
  }

  private getExpenseDescription(category: ExpenseCategory, amount: number): string {
    const descriptions: Record<ExpenseCategory, string[]> = {
      UTILITIES: ["Electricity bill", "Water bill", "Internet service", "Gas refill"],
      SALARIES: ["Staff salary", "Manager salary", "Housekeeping salary", "Security salary"],
      MAINTENANCE: ["AC repair", "Plumbing work", "Electrical work", "Pool maintenance"],
      SUPPLIES: ["Cleaning supplies", "Toiletries", "Linens", "Kitchen supplies"],
      CLEANING: ["Laundry service", "Deep cleaning", "Carpet cleaning", "Window cleaning"],
      MARKETING: ["Facebook ads", "Google ads", "Photography", "Website maintenance"],
      INSURANCE: ["Property insurance", "Business insurance", "Health insurance"],
      TAXES: ["BIR payment", "Local tax", "Property tax"],
      COMMISSIONS: ["Booking platform commission", "Travel agent commission"],
      OTHER: ["Office supplies", "Software subscription", "Bank fees", "Miscellaneous"],
    };

    const baseDescription = faker.helpers.arrayElement(descriptions[category]);

    // Add month for recurring expenses
    if (["UTILITIES", "SALARIES", "INSURANCE"].includes(category)) {
      const month = faker.date
        .recent({ days: 30 })
        .toLocaleDateString("en-PH", { month: "long", year: "numeric" });
      return `${baseDescription} - ${month}`;
    }

    return baseDescription;
  }

  private getVendorName(category: ExpenseCategory): string {
    const vendors: Record<ExpenseCategory, string[]> = {
      UTILITIES: ["Meralco", "Manila Water", "PLDT", "Petron"],
      SALARIES: ["Payroll", "HR Department"],
      MAINTENANCE: ["Fix-It Solutions", "La Union Contractors", "ABC Repair Services"],
      SUPPLIES: ["SM Hypermarket", "Robinsons", "Local Supplier"],
      CLEANING: ["Clean Pro Services", "Sparkle Laundry", "Fresh Clean Co."],
      MARKETING: ["Meta", "Google", "Local Photographer"],
      INSURANCE: ["AIG Philippines", "Malayan Insurance", "BPI-MS Insurance"],
      TAXES: ["Bureau of Internal Revenue", "Local Government Unit"],
      COMMISSIONS: ["Airbnb", "Booking.com", "Agoda"],
      OTHER: ["National Book Store", "Microsoft", "BPI Bank"],
    };

    return faker.helpers.arrayElement(vendors[category]);
  }

  private getExpensePaymentMethod(): PaymentMethod {
    return faker.helpers.weightedArrayElement([
      { value: "BANK_TRANSFER", weight: 0.4 },
      { value: "CASH", weight: 0.3 },
      { value: "CREDIT_CARD", weight: 0.2 },
      { value: "DEBIT_CARD", weight: 0.1 },
    ]).value;
  }

  private getExpenseStatus(): ExpenseStatus {
    return faker.helpers.weightedArrayElement([
      { value: "APPROVED", weight: 0.6 },
      { value: "PAID", weight: 0.25 },
      { value: "PENDING", weight: 0.12 },
      { value: "REJECTED", weight: 0.02 },
      { value: "REIMBURSED", weight: 0.01 },
    ]).value;
  }
}

/**
 * Chart Data Builder
 * Creates realistic chart data with trends and patterns
 */
export class ChartDataBuilder extends BaseMetricBuilder<ChartData> {
  private type: "revenue" | "occupancy" | "expenses" | "bookings" = "revenue";
  private dataPoints: number = 12;
  private trend: "up" | "down" | "stable" | "volatile" = "stable";

  /**
   * Set chart type
   */
  withType(type: "revenue" | "occupancy" | "expenses" | "bookings"): this {
    this.type = type;
    return this;
  }

  /**
   * Set number of data points
   */
  withDataPoints(points: number): this {
    this.dataPoints = points;
    return this;
  }

  /**
   * Set trend pattern
   */
  withTrend(trend: "up" | "down" | "stable" | "volatile"): this {
    this.trend = trend;
    return this;
  }

  /**
   * Create seasonal pattern (high in dry season, low in wet season)
   */
  withSeasonalPattern(): this {
    this.trend = "volatile";
    this.data.seasonal = true as any;
    return this;
  }

  build(): ChartData {
    const labels = this.generateLabels();
    const data = this.generateData();

    const defaults: ChartData = {
      labels,
      datasets: [
        {
          label: this.getChartLabel(),
          data,
          backgroundColor: this.getBackgroundColor(),
          borderColor: this.getBorderColor(),
          borderWidth: 2,
        },
      ],
    };

    return { ...defaults, ...this.data };
  }

  private generateLabels(): string[] {
    const labels: string[] = [];
    const now = new Date();

    for (let i = this.dataPoints - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(date.toLocaleDateString("en-PH", { month: "short", year: "2-digit" }));
    }

    return labels;
  }

  private generateData(): number[] {
    const data: number[] = [];
    const baseValue = this.getBaseValue();
    let currentValue = baseValue;

    for (let i = 0; i < this.dataPoints; i++) {
      const monthValue = this.calculateMonthValue(currentValue, i);
      data.push(monthValue);
      currentValue = monthValue;
    }

    return data;
  }

  private calculateMonthValue(baseValue: number, index: number): number {
    let value = baseValue;

    // Apply trend
    const trendMultiplier = this.getTrendMultiplier(index);
    value *= trendMultiplier;

    // Apply seasonal variation if enabled
    if ((this.data as any).seasonal) {
      const seasonalMultiplier = this.getSeasonalMultiplier(index);
      value *= seasonalMultiplier;
    }

    // Add some random variation
    const variation = faker.number.float({ min: 0.9, max: 1.1 });
    value *= variation;

    return Math.ceil(value);
  }

  private getTrendMultiplier(index: number): number {
    const progress = index / (this.dataPoints - 1);

    switch (this.trend) {
      case "up":
        return 1 + progress * 0.3; // 30% growth over period
      case "down":
        return 1 - progress * 0.2; // 20% decline over period
      case "volatile":
        return 1 + Math.sin(progress * Math.PI * 2) * 0.2; // Sine wave pattern
      default:
        return 1; // Stable
    }
  }

  private getSeasonalMultiplier(index: number): number {
    // Philippine seasons: Peak (Dec-May), Off (Jun-Nov)
    const month = (new Date().getMonth() - (this.dataPoints - 1 - index)) % 12;
    const isPeakSeason = PHILIPPINE_RESORT_CONSTANTS.PEAK_MONTHS.includes(month);

    return isPeakSeason ? 1.3 : 0.7;
  }

  private getBaseValue(): number {
    const baseValues = {
      revenue: 150000,
      occupancy: 70,
      expenses: 80000,
      bookings: 25,
    };

    return baseValues[this.type];
  }

  private getChartLabel(): string {
    const labels = {
      revenue: "Monthly Revenue (₱)",
      occupancy: "Occupancy Rate (%)",
      expenses: "Monthly Expenses (₱)",
      bookings: "Monthly Bookings",
    };

    return labels[this.type];
  }

  private getBackgroundColor(): string {
    const colors = {
      revenue: "rgba(16, 185, 129, 0.1)",
      occupancy: "rgba(59, 130, 246, 0.1)",
      expenses: "rgba(239, 68, 68, 0.1)",
      bookings: "rgba(168, 85, 247, 0.1)",
    };

    return colors[this.type];
  }

  private getBorderColor(): string {
    const colors = {
      revenue: "rgb(16, 185, 129)",
      occupancy: "rgb(59, 130, 246)",
      expenses: "rgb(239, 68, 68)",
      bookings: "rgb(168, 85, 247)",
    };

    return colors[this.type];
  }
}

/**
 * Factory functions for quick builder creation
 */
export const MetricBuilders = {
  /**
   * Create dashboard stats builder
   */
  dashboardStats: () => new DashboardStatsBuilder(),

  /**
   * Create booking scenario builder
   */
  bookings: () => new BookingScenarioBuilder(),

  /**
   * Create expense scenario builder
   */
  expenses: () => new ExpenseScenarioBuilder(),

  /**
   * Create chart data builder
   */
  chartData: () => new ChartDataBuilder(),

  /**
   * Create complete dashboard scenario with all metrics
   */
  completeDashboard: (season: "peak" | "regular" | "off" = "regular") => {
    const stats = new DashboardStatsBuilder().withSeason(season).build();
    const bookings = new BookingScenarioBuilder().withCount(stats.totalBookings).build();
    const expenses = new ExpenseScenarioBuilder().withBudget(stats.totalExpenses).build();
    const revenueChart = new ChartDataBuilder().withType("revenue").withSeasonalPattern().build();
    const occupancyChart = new ChartDataBuilder()
      .withType("occupancy")
      .withSeasonalPattern()
      .build();

    return {
      stats,
      bookings,
      expenses,
      charts: {
        revenue: revenueChart,
        occupancy: occupancyChart,
      },
    };
  },

  /**
   * Create edge case scenarios for testing
   */
  edgeCases: () => ({
    // Zero revenue scenario
    zeroRevenue: new DashboardStatsBuilder()
      .with({
        totalRevenue: 0,
        totalBookings: 0,
        occupancyRate: 0,
      })
      .build(),

    // Very high performance
    exceptional: new DashboardStatsBuilder()
      .withHighPerformance()
      .with({
        revenueGrowth: 150,
        occupancyRate: 98,
      })
      .build(),

    // Crisis scenario
    crisis: new DashboardStatsBuilder()
      .withTyphoonImpact()
      .with({
        totalRevenue: 15000,
        occupancyRate: 12,
        revenueGrowth: -78,
      })
      .build(),

    // All cancelled bookings
    allCancelled: new BookingScenarioBuilder().withHighCancellations().build(),
  }),
};

// Export builders for individual use
export { DashboardStatsBuilder, BookingScenarioBuilder, ExpenseScenarioBuilder, ChartDataBuilder };
