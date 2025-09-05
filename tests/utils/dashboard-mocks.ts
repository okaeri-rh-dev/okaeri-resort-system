/**
 * Dashboard Mock Data Generators
 * Phase 2.1 - RED Phase: Comprehensive mock data for Okaeri Resort dashboard testing
 *
 * Provides realistic Philippine resort business context with various scenarios:
 * - Normal operations (peak/off-season)
 * - Edge cases (crisis, exceptional performance)
 * - Seasonal variations
 * - Financial compliance (BIR, VAT, etc.)
 */

import {
  BookingMetrics,
  FinancialMetrics,
  PerformanceKPIs,
  PhilippineCurrency,
  PaymentMethod,
  GuestArrival,
  GuestDeparture,
  ExpenseCategory,
} from "../../src/features/dashboard/types/metrics";
import {
  DashboardActivity,
  BookingActivity,
  FinancialActivity,
  OperationalActivity,
  GuestServiceActivity,
  SystemActivity,
  ComplianceActivity,
  EmergencyActivity,
} from "../../src/features/dashboard/types/activities";
import {
  DashboardState,
  DashboardAlert,
  RealtimeEvent,
} from "../../src/features/dashboard/types/dashboard";

// Filipino guest names for realistic testing
const FILIPINO_GUEST_NAMES = [
  "Juan Dela Cruz",
  "Maria Santos",
  "Jose Rizal",
  "Ana Reyes",
  "Carlos Mendoza",
  "Lorna Garcia",
  "Roberto Aquino",
  "Teresa Villanueva",
  "Antonio Bautista",
  "Carmen Rodriguez",
  "Miguel Torres",
  "Elena Fernandez",
  "Rafael Morales",
  "Cristina Valdez",
  "Eduardo Castro",
  "Rosario Jimenez",
  "Francisco Guerrero",
  "Isabella Herrera",
  "Diego Aguilar",
  "Sophia Ramos",
];

const INTERNATIONAL_GUEST_NAMES = [
  "James Smith",
  "Emma Johnson",
  "Michael Brown",
  "Olivia Davis",
  "William Wilson",
  "Ava Miller",
  "Hiroshi Tanaka",
  "Yuki Sato",
  "Li Wei",
  "Zhang Ming",
  "Hans Mueller",
  "Anna Fischer",
  "Jean Dupont",
  "Marie Martin",
  "Giuseppe Rossi",
  "Elena Bianchi",
];

const ROOM_NUMBERS = [
  "101",
  "102",
  "103",
  "104",
  "105",
  "106",
  "107",
  "108",
  "201",
  "202",
  "203",
  "204",
  "205",
  "206",
  "207",
  "208",
  "301",
  "302",
  "303",
  "304",
  "305",
  "306",
  "307",
  "308",
  "Villa-A",
  "Villa-B",
  "Villa-C",
  "Penthouse",
];

const BOOKING_SOURCES = ["direct", "booking_com", "agoda", "airbnb", "walk_in"] as const;
const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "gcash",
  "maya",
  "bank_transfer",
  "credit_card",
  "debit_card",
];

/**
 * Utility function to create Philippine currency objects
 */
export function createPHPCurrency(amount: number): PhilippineCurrency {
  const amountInCentavos = Math.round(amount * 100);
  const formatted = `₱${(amountInCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  return {
    amount: amountInCentavos,
    currency: "PHP",
    formatted,
    displayText: `${formatted} PHP`,
  };
}

/**
 * Generate random Filipino mobile number
 */
export function generatePhilippineMobile(): string {
  const prefixes = [
    "917",
    "918",
    "919",
    "920",
    "921",
    "922",
    "923",
    "924",
    "925",
    "926",
    "927",
    "928",
    "929",
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, "0");
  return `+63 ${prefix} ${suffix}`;
}

/**
 * Generate booking ID in Philippine format
 */
export function generateBookingId(): string {
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 9999) + 1;
  return `BK-${year}-${sequence.toString().padStart(4, "0")}`;
}

/**
 * Mock data generator class with fluent interface
 */
export class DashboardMockGenerator {
  private season: "peak" | "off" | "typhoon" = "peak";
  private occupancyLevel: number = 75;
  private revenueTarget: number = 50000;
  private alertLevel: "normal" | "warning" | "crisis" = "normal";
  private timeOfDay: "morning" | "afternoon" | "evening" | "night" = "afternoon";
  private projectId: string = "okaeri-resort-001";

  // Fluent interface methods
  withSeason(season: "peak" | "off" | "typhoon"): this {
    this.season = season;
    return this;
  }

  withOccupancy(level: number): this {
    this.occupancyLevel = Math.max(0, Math.min(100, level));
    return this;
  }

  withRevenueTarget(target: number): this {
    this.revenueTarget = target;
    return this;
  }

  withAlert(alert: "normal" | "warning" | "crisis"): this {
    this.alertLevel = alert;
    return this;
  }

  withTimeOfDay(time: "morning" | "afternoon" | "evening" | "night"): this {
    this.timeOfDay = time;
    return this;
  }

  withProjectId(projectId: string): this {
    this.projectId = projectId;
    return this;
  }

  /**
   * Generate booking metrics based on current configuration
   */
  generateBookingMetrics(): BookingMetrics {
    const totalRooms = 24;
    const availableRooms = Math.floor(totalRooms * (1 - this.occupancyLevel / 100));
    const occupiedRooms = totalRooms - availableRooms;

    // Seasonal adjustments
    const seasonalMultipliers = {
      peak: { occupancy: 1.2, bookings: 1.3 },
      off: { occupancy: 0.7, bookings: 0.6 },
      typhoon: { occupancy: 0.3, bookings: 0.2 },
    };

    const multiplier = seasonalMultipliers[this.season];

    // Generate arrivals and departures
    const arrivals = this.generateGuestArrivals(Math.floor(8 * multiplier.bookings));
    const departures = this.generateGuestDepartures(Math.floor(6 * multiplier.bookings));

    return {
      id: `booking-metrics-${Date.now()}`,
      projectId: this.projectId,
      timestamp: new Date(),
      source: "system",
      occupancy: {
        current: this.occupancyLevel,
        trend: this.season === "peak" ? "up" : this.season === "typhoon" ? "down" : "stable",
        thirtyDayAverage: this.occupancyLevel * 0.9,
        peakSeasonForecast: Math.min(95, this.occupancyLevel * 1.15),
        availableRooms,
        totalRooms,
      },
      checkInsToday: arrivals.length,
      checkOutsToday: departures.length,
      arrivalsNext24Hours: arrivals,
      departuresNext24Hours: departures,
      pendingBookings: Math.floor(Math.random() * 15) + 5,
      confirmedBookings: occupiedRooms + Math.floor(Math.random() * 10),
      cancelledThisWeek: Math.floor(Math.random() * 8),
      noShowRate: this.season === "typhoon" ? 15 : 5,
      roomStatus: {
        clean: availableRooms - 2,
        dirty: Math.floor(Math.random() * 4) + 1,
        maintenance: Math.floor(Math.random() * 2),
        outOfOrder: this.alertLevel === "crisis" ? 3 : Math.floor(Math.random() * 2),
      },
      bookingSources: {
        direct: Math.floor(Math.random() * 30) + 20,
        booking_com: Math.floor(Math.random() * 25) + 15,
        agoda: Math.floor(Math.random() * 20) + 10,
        airbnb: Math.floor(Math.random() * 15) + 8,
        walk_in: Math.floor(Math.random() * 12) + 3,
        referral: Math.floor(Math.random() * 8) + 2,
      },
    };
  }

  /**
   * Generate financial metrics with Philippine compliance
   */
  generateFinancialMetrics(): FinancialMetrics {
    const baseRevenue = this.revenueTarget;
    const seasonalMultiplier = this.season === "peak" ? 1.3 : this.season === "typhoon" ? 0.4 : 0.8;
    const dailyRevenue = baseRevenue * seasonalMultiplier;

    // Calculate VAT (12% in Philippines)
    const vatRate = 0.12;
    const grossRevenue = dailyRevenue / (1 + vatRate);
    const vatAmount = grossRevenue * vatRate;

    return {
      id: `financial-metrics-${Date.now()}`,
      projectId: this.projectId,
      timestamp: new Date(),
      source: "system",
      revenue: {
        today: createPHPCurrency(dailyRevenue),
        week: createPHPCurrency(dailyRevenue * 7),
        month: createPHPCurrency(dailyRevenue * 30),
        quarter: createPHPCurrency(dailyRevenue * 90),
        yearToDate: createPHPCurrency(dailyRevenue * 120),
        trend: {
          direction: this.season === "peak" ? "up" : this.season === "typhoon" ? "down" : "stable",
          percentage: this.season === "peak" ? 15 : this.season === "typhoon" ? -25 : 3,
        },
      },
      payments: {
        cash: createPHPCurrency(dailyRevenue * 0.25),
        gcash: createPHPCurrency(dailyRevenue * 0.3),
        maya: createPHPCurrency(dailyRevenue * 0.15),
        bank_transfer: createPHPCurrency(dailyRevenue * 0.2),
        credit_card: createPHPCurrency(dailyRevenue * 0.08),
        pending: createPHPCurrency(dailyRevenue * 0.02),
      },
      expenses: {
        monthly: createPHPCurrency(baseRevenue * 20),
        budget: createPHPCurrency(baseRevenue * 25),
        variance: this.alertLevel === "crisis" ? 15 : -8,
        categories: this.generateExpenseCategories(baseRevenue),
      },
      taxation: {
        vatCollected: createPHPCurrency(vatAmount * 30),
        withHoldingTax: createPHPCurrency(grossRevenue * 0.02 * 30),
        occupancyTax: createPHPCurrency(this.occupancyLevel * 10 * 30),
        quarterlyEstimate: createPHPCurrency(grossRevenue * 0.3 * 90),
        nextFilingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
      profitability: {
        grossProfit: createPHPCurrency(dailyRevenue * 0.65),
        netProfit: createPHPCurrency(dailyRevenue * 0.35),
        margin: 35,
        averageRoomRate: createPHPCurrency(3500),
        revPAR: createPHPCurrency(this.occupancyLevel * 35),
      },
    };
  }

  /**
   * Generate performance KPIs
   */
  generatePerformanceKPIs(): PerformanceKPIs {
    return {
      id: `performance-metrics-${Date.now()}`,
      projectId: this.projectId,
      timestamp: new Date(),
      source: "system",
      averageCheckInTime: this.alertLevel === "crisis" ? 25 : 12,
      averageCheckOutTime: this.alertLevel === "crisis" ? 18 : 8,
      housekeepingTurnaround: this.alertLevel === "crisis" ? 90 : 45,
      maintenanceResponseTime: this.alertLevel === "crisis" ? 8 : 2,
      averageRating: this.alertLevel === "crisis" ? 3.2 : 4.6,
      recommendationRate: this.alertLevel === "crisis" ? 65 : 92,
      repeatGuestRate: this.season === "peak" ? 35 : 28,
      complaintResolutionTime: this.alertLevel === "crisis" ? 12 : 4,
      staffEfficiencyScore: this.alertLevel === "crisis" ? 60 : 88,
      trainingCompletionRate: 94,
      staffTurnoverRate: this.alertLevel === "crisis" ? 15 : 8,
      seasonalFactors: {
        weatherImpactRisk:
          this.season === "typhoon" ? "high" : this.season === "off" ? "medium" : "low",
        occupancySeasonality: this.season === "peak" ? 1.3 : this.season === "typhoon" ? 0.4 : 0.8,
        priceSeasonality: this.season === "peak" ? 1.2 : this.season === "typhoon" ? 0.7 : 0.9,
      },
    };
  }

  /**
   * Generate complete dashboard state
   */
  build(): DashboardState {
    const booking = this.generateBookingMetrics();
    const financial = this.generateFinancialMetrics();
    const performance = this.generatePerformanceKPIs();

    return {
      metrics: {
        booking,
        financial,
        performance,
        lastUpdate: new Date(),
      },
      activities: {
        activities: this.generateRecentActivities(),
        isLoading: false,
        hasMore: true,
        error: null,
        lastFetchTime: new Date(),
        unreadCount: Math.floor(Math.random() * 12),
        filters: this.getDefaultActivityFilters(),
        selectedActivity: null,
      },
      ui: this.generateUIState(),
      realtime: this.generateRealtimeState(),
      config: this.generateDashboardConfig(),
      offline: this.generateOfflineState(),
      alerts: this.generateAlertState(),
    };
  }

  // Helper methods for generating complex nested data

  private generateGuestArrivals(count: number): GuestArrival[] {
    const arrivals: GuestArrival[] = [];

    for (let i = 0; i < count; i++) {
      const isFilipino = Math.random() > 0.3; // 70% Filipino guests
      const guestName = isFilipino
        ? FILIPINO_GUEST_NAMES[Math.floor(Math.random() * FILIPINO_GUEST_NAMES.length)]
        : INTERNATIONAL_GUEST_NAMES[Math.floor(Math.random() * INTERNATIONAL_GUEST_NAMES.length)];

      arrivals.push({
        id: generateBookingId(),
        guestName,
        roomNumber: ROOM_NUMBERS[Math.floor(Math.random() * ROOM_NUMBERS.length)],
        expectedTime: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000),
        specialRequests: Math.random() > 0.7 ? ["Late check-in", "Extra towels"] : [],
        contactNumber: generatePhilippineMobile(),
        nationalityCode: isFilipino
          ? "PH"
          : ["US", "JP", "KR", "CN", "AU", "SG"][Math.floor(Math.random() * 6)],
        adultsCount: Math.floor(Math.random() * 3) + 1,
        childrenCount: Math.floor(Math.random() * 3),
        paymentStatus: ["paid", "partial", "pending"][Math.floor(Math.random() * 3)] as any,
      });
    }

    return arrivals;
  }

  private generateGuestDepartures(count: number): GuestDeparture[] {
    const departures: GuestDeparture[] = [];

    for (let i = 0; i < count; i++) {
      const isFilipino = Math.random() > 0.3;
      const guestName = isFilipino
        ? FILIPINO_GUEST_NAMES[Math.floor(Math.random() * FILIPINO_GUEST_NAMES.length)]
        : INTERNATIONAL_GUEST_NAMES[Math.floor(Math.random() * INTERNATIONAL_GUEST_NAMES.length)];

      const billAmount = Math.random() * 15000 + 5000;

      departures.push({
        id: generateBookingId(),
        guestName,
        roomNumber: ROOM_NUMBERS[Math.floor(Math.random() * ROOM_NUMBERS.length)],
        checkoutTime: new Date(Date.now() + Math.random() * 12 * 60 * 60 * 1000),
        finalBill: createPHPCurrency(billAmount),
        outstandingBalance: createPHPCurrency(Math.random() > 0.8 ? Math.random() * 1000 : 0),
        paymentMethod: PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
        feedback:
          Math.random() > 0.3
            ? {
                rating: (Math.floor(Math.random() * 2) + 4) as any, // 4-5 rating
                comments: "Great stay! Will come back.",
                wouldRecommend: true,
                submittedAt: new Date(),
              }
            : undefined,
      });
    }

    return departures;
  }

  private generateExpenseCategories(baseAmount: number): ExpenseCategory[] {
    return [
      {
        id: "utilities",
        name: "Utilities",
        budgetAllocated: createPHPCurrency(baseAmount * 0.15),
        spent: createPHPCurrency(baseAmount * 0.12),
        variance: -20,
        subcategories: {
          utilities: createPHPCurrency(baseAmount * 0.08),
          maintenance: createPHPCurrency(baseAmount * 0.04),
          supplies: createPHPCurrency(baseAmount * 0.02),
          staff: createPHPCurrency(0),
          marketing: createPHPCurrency(0),
          other: createPHPCurrency(baseAmount * 0.01),
        },
      },
      {
        id: "staff",
        name: "Staff Expenses",
        budgetAllocated: createPHPCurrency(baseAmount * 0.35),
        spent: createPHPCurrency(baseAmount * 0.38),
        variance: 8.6,
        subcategories: {
          utilities: createPHPCurrency(0),
          maintenance: createPHPCurrency(0),
          supplies: createPHPCurrency(baseAmount * 0.02),
          staff: createPHPCurrency(baseAmount * 0.35),
          marketing: createPHPCurrency(0),
          other: createPHPCurrency(baseAmount * 0.01),
        },
      },
    ];
  }

  private generateRecentActivities(): DashboardActivity[] {
    const activities: DashboardActivity[] = [];
    const activityCount = Math.floor(Math.random() * 20) + 10;

    for (let i = 0; i < activityCount; i++) {
      const type = Math.floor(Math.random() * 7);
      const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);

      switch (type) {
        case 0:
          activities.push(this.createBookingActivity(timestamp));
          break;
        case 1:
          activities.push(this.createFinancialActivity(timestamp));
          break;
        case 2:
          activities.push(this.createOperationalActivity(timestamp));
          break;
        case 3:
          activities.push(this.createGuestServiceActivity(timestamp));
          break;
        case 4:
          activities.push(this.createSystemActivity(timestamp));
          break;
        case 5:
          activities.push(this.createComplianceActivity(timestamp));
          break;
        case 6:
          if (this.alertLevel === "crisis") {
            activities.push(this.createEmergencyActivity(timestamp));
          }
          break;
      }
    }

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private createBookingActivity(timestamp: Date): BookingActivity {
    const guestName =
      Math.random() > 0.3
        ? FILIPINO_GUEST_NAMES[Math.floor(Math.random() * FILIPINO_GUEST_NAMES.length)]
        : INTERNATIONAL_GUEST_NAMES[Math.floor(Math.random() * INTERNATIONAL_GUEST_NAMES.length)];

    const types = ["booking_created", "check_in", "check_out", "booking_cancelled"] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: `activity-${timestamp.getTime()}`,
      projectId: this.projectId,
      timestamp,
      actorId: "system",
      actorName: "Resort System",
      actorType: "system",
      category: "booking",
      priority: "medium",
      status: "completed",
      type,
      details: {
        bookingId: generateBookingId(),
        guestName,
        roomNumber: ROOM_NUMBERS[Math.floor(Math.random() * ROOM_NUMBERS.length)],
        dateRange: {
          checkIn: new Date(timestamp.getTime() + 24 * 60 * 60 * 1000),
          checkOut: new Date(timestamp.getTime() + 4 * 24 * 60 * 60 * 1000),
        },
        totalAmount: createPHPCurrency(Math.random() * 15000 + 5000),
        source: BOOKING_SOURCES[Math.floor(Math.random() * BOOKING_SOURCES.length)],
      },
      displayText: `${guestName} ${type.replace("_", " ")}`,
      icon: type === "check_in" ? "login" : type === "check_out" ? "logout" : "calendar",
      color: type === "booking_cancelled" ? "red" : "blue",
    };
  }

  private createFinancialActivity(timestamp: Date): FinancialActivity {
    const types = ["payment_received", "expense_logged", "invoice_generated"] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: `activity-${timestamp.getTime()}`,
      projectId: this.projectId,
      timestamp,
      actorId: "staff-001",
      actorName: "Maria Santos",
      actorType: "user",
      category: "financial",
      priority: "high",
      status: "completed",
      type,
      details: {
        transactionId: `TXN-${timestamp.getTime()}`,
        amount: createPHPCurrency(Math.random() * 10000 + 1000),
        paymentMethod: PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
        description: type === "expense_logged" ? "Maintenance supplies" : "Room payment",
        receiptNumber: `RCP-${timestamp.getTime()}`,
        vatAmount: createPHPCurrency(Math.random() * 1200 + 120),
      },
      displayText: `${type.replace("_", " ")} - ₱${Math.floor(Math.random() * 10000 + 1000).toLocaleString()}`,
      icon: "peso",
      color: type === "expense_logged" ? "red" : "green",
    };
  }

  private createOperationalActivity(timestamp: Date): OperationalActivity {
    const types = ["room_cleaned", "maintenance_completed", "supply_restocked"] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: `activity-${timestamp.getTime()}`,
      projectId: this.projectId,
      timestamp,
      actorId: "staff-002",
      actorName: "Juan Reyes",
      actorType: "user",
      category: "operational",
      priority: "medium",
      status: "completed",
      type,
      details: {
        roomNumber: ROOM_NUMBERS[Math.floor(Math.random() * ROOM_NUMBERS.length)],
        taskDescription: `${type.replace("_", " ")} completed successfully`,
        assignedStaff: ["Juan Reyes", "Maria Torres"],
        actualDuration: Math.floor(Math.random() * 120) + 30,
        qualityCheck: {
          passed: true,
          inspector: "Ana Garcia",
          score: Math.floor(Math.random() * 2) + 4,
          issues: [],
        },
      },
      displayText: `${type.replace("_", " ")} in Room ${ROOM_NUMBERS[Math.floor(Math.random() * ROOM_NUMBERS.length)]}`,
      icon: type === "room_cleaned" ? "clean" : type === "maintenance_completed" ? "tools" : "box",
      color: "green",
    };
  }

  private createGuestServiceActivity(timestamp: Date): GuestServiceActivity {
    const types = ["service_request", "feedback_received", "complaint_resolved"] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    const guestName =
      Math.random() > 0.3
        ? FILIPINO_GUEST_NAMES[Math.floor(Math.random() * FILIPINO_GUEST_NAMES.length)]
        : INTERNATIONAL_GUEST_NAMES[Math.floor(Math.random() * INTERNATIONAL_GUEST_NAMES.length)];

    return {
      id: `activity-${timestamp.getTime()}`,
      projectId: this.projectId,
      timestamp,
      actorId: "guest-001",
      actorName: guestName,
      actorType: "guest",
      category: "guest_service",
      priority: type === "complaint_resolved" ? "high" : "medium",
      status: "completed",
      type,
      details: {
        guestId: `G-${timestamp.getTime()}`,
        guestName,
        roomNumber: ROOM_NUMBERS[Math.floor(Math.random() * ROOM_NUMBERS.length)],
        requestType: type === "service_request" ? "Room Service" : "General Feedback",
        description: type === "complaint_resolved" ? "AC issue resolved" : "Excellent service",
        urgency: "medium",
        resolution: type === "complaint_resolved" ? "Maintenance fixed AC unit" : undefined,
        satisfactionRating:
          type === "feedback_received" ? ((Math.floor(Math.random() * 2) + 4) as any) : undefined,
        followUpRequired: false,
      },
      displayText: `${guestName}: ${type.replace("_", " ")}`,
      icon: type === "complaint_resolved" ? "alert" : "user",
      color: type === "complaint_resolved" ? "yellow" : "blue",
    };
  }

  private createSystemActivity(timestamp: Date): SystemActivity {
    const types = ["backup_completed", "integration_sync", "alert_triggered"] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: `activity-${timestamp.getTime()}`,
      projectId: this.projectId,
      timestamp,
      actorId: "system",
      actorName: "Resort System",
      actorType: "system",
      category: "system",
      priority: type === "alert_triggered" ? "high" : "low",
      status: "completed",
      type,
      details: {
        systemComponent: type === "backup_completed" ? "Database" : "PMS Integration",
        alertType: type === "alert_triggered" ? "warning" : "info",
        affectedRecords: Math.floor(Math.random() * 1000) + 100,
        automaticResolution: type !== "alert_triggered",
        userActionRequired: type === "alert_triggered",
      },
      displayText: `System: ${type.replace("_", " ")}`,
      icon: "cog",
      color: type === "alert_triggered" ? "yellow" : "gray",
    };
  }

  private createComplianceActivity(timestamp: Date): ComplianceActivity {
    const types = ["bir_filing_due", "doh_inspection", "occupancy_tax_payment"] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: `activity-${timestamp.getTime()}`,
      projectId: this.projectId,
      timestamp,
      actorId: "system",
      actorName: "Compliance System",
      actorType: "system",
      category: "compliance",
      priority: "high",
      status: "pending",
      type,
      details: {
        regulatoryBody:
          type === "bir_filing_due" ? "BIR" : type === "doh_inspection" ? "DOH" : "LGU",
        filingType: type === "bir_filing_due" ? "Quarterly VAT Return" : undefined,
        dueDate: new Date(timestamp.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: "upcoming",
        penaltyRisk: createPHPCurrency(Math.random() * 50000 + 10000),
        documentsRequired: ["Financial statements", "Tax receipts"],
        contactPerson: "Elena Rodriguez",
      },
      displayText: `${type.replace("_", " ")} - Due in 7 days`,
      icon: "document",
      color: "yellow",
    };
  }

  private createEmergencyActivity(timestamp: Date): EmergencyActivity {
    const types = ["power_outage", "medical_emergency", "guest_incident"] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: `activity-${timestamp.getTime()}`,
      projectId: this.projectId,
      timestamp,
      actorId: "emergency-system",
      actorName: "Emergency Response",
      actorType: "system",
      category: "emergency",
      priority: "critical",
      status: "completed",
      type,
      details: {
        location: type === "power_outage" ? "Main Building" : "Pool Area",
        description: `${type.replace("_", " ")} handled successfully`,
        firstResponders: ["Security Team", "Management"],
        guestsEvacuated: type === "power_outage" ? 0 : undefined,
        authoritiesNotified: type === "medical_emergency",
        incidentReport: `IR-${timestamp.getTime()}`,
        followUpActions: ["Document incident", "Review procedures"],
        resolution: "Situation resolved, normal operations resumed",
        legalImplications: undefined,
      },
      displayText: `Emergency: ${type.replace("_", " ")}`,
      icon: "alert-triangle",
      color: "red",
    };
  }

  private getDefaultActivityFilters(): any {
    return {
      categories: ["booking", "financial", "operational", "guest_service"],
      priorities: ["medium", "high", "critical"],
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      maxItems: 50,
      autoRefresh: true,
      refreshInterval: 30,
      showTimestamps: true,
      groupByDate: true,
      showAvatars: true,
      compactMode: false,
      enableNotifications: true,
      soundEnabled: false,
      pushNotifications: true,
    };
  }

  private generateUIState(): any {
    return {
      isLoading: false,
      loadingComponents: new Set(),
      error:
        this.alertLevel === "crisis"
          ? {
              id: "ui-error-001",
              type: "network_error",
              message: "Connection unstable during typhoon",
              timestamp: new Date(),
              recoverable: true,
              retryable: true,
              context: {
                networkStatus: "slow",
                memoryUsage: 45,
              },
              recovery: {
                autoRetry: true,
                retryCount: 2,
                maxRetries: 5,
              },
            }
          : null,
      componentErrors: new Map(),
      layout: {
        sidebarCollapsed: false,
        fullscreenMode: false,
        activeTab: "overview",
        pinnedMetrics: ["occupancy", "revenue"],
        hiddenComponents: [],
      },
      modals: {
        quickBooking: false,
        expenseEntry: false,
        guestDetails: false,
        alertDetails: false,
        settingsPanel: false,
      },
      mobile: {
        orientation: "portrait",
        keyboardVisible: false,
        pullToRefreshActive: false,
        swipeGestureActive: false,
      },
      performance: {
        renderTime: Math.random() * 50 + 10,
        memoryUsage: Math.random() * 30 + 20,
        frameDrops: Math.floor(Math.random() * 5),
        lastOptimization: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
      },
      accessibility: {
        highContrastMode: false,
        reduceAnimations: false,
        screenReaderActive: false,
        keyboardNavigation: false,
      },
    };
  }

  private generateRealtimeState(): any {
    return {
      connection: {
        status: this.alertLevel === "crisis" ? "disconnected" : "connected",
        lastConnected:
          this.alertLevel === "crisis" ? new Date(Date.now() - 5 * 60 * 1000) : new Date(),
        reconnectAttempts: this.alertLevel === "crisis" ? 3 : 0,
        latency: this.alertLevel === "crisis" ? 2500 : 120,
      },
      events: {
        queue: [],
        processing: false,
        lastProcessed: new Date(),
        failedEvents: [],
      },
      subscriptions: {
        metrics: true,
        activities: true,
        alerts: true,
        bookings: true,
      },
      polling: {
        active: this.alertLevel === "crisis",
        interval: 60,
        lastPoll: new Date(),
      },
    };
  }

  private generateDashboardConfig(): any {
    return {
      userId: "user-001",
      projectId: this.projectId,
      preferences: {
        defaultPeriod: "daily",
        timezone: "Asia/Manila",
        currency: "PHP",
        language: "en",
        refreshInterval: 30,
        alertsEnabled: true,
      },
      layout: {
        pinnedMetrics: ["occupancy", "revenue", "guest_satisfaction"],
        hiddenMetrics: [],
        customOrder: [],
      },
    };
  }

  private generateOfflineState(): any {
    return {
      isOnline: this.alertLevel !== "crisis",
      lastOnline: this.alertLevel === "crisis" ? new Date(Date.now() - 10 * 60 * 1000) : new Date(),
      offlineDuration: this.alertLevel === "crisis" ? 10 : 0,
      queue: {
        actions: [],
        maxSize: 100,
        currentSize: 0,
        lastSync: new Date(),
      },
      cache: {
        metrics: new Map(),
        activities: [],
        lastCacheUpdate: new Date(),
        cacheSize: 2.5,
      },
      sync: {
        inProgress: false,
        lastAttempt: new Date(),
        successfulActions: 0,
        failedActions: 0,
      },
    };
  }

  private generateAlertState(): any {
    const alerts: DashboardAlert[] = [];

    if (this.alertLevel === "crisis") {
      alerts.push({
        id: "alert-001",
        type: "weather_warning",
        severity: "critical",
        title: "Typhoon Warning",
        message: "Strong typhoon approaching. Secure all facilities.",
        timestamp: new Date(),
        projectId: this.projectId,
        data: {
          metric: "weather",
          currentValue: "Signal #3",
          trend: "up",
        },
        actions: [],
        resolved: false,
        color: "red",
        icon: "cloud-rain",
        persistent: true,
      });
    }

    if (this.occupancyLevel < 30) {
      alerts.push({
        id: "alert-002",
        type: "low_occupancy",
        severity: "warning",
        title: "Low Occupancy",
        message: `Current occupancy at ${this.occupancyLevel}% - consider promotional campaigns`,
        timestamp: new Date(),
        projectId: this.projectId,
        data: {
          metric: "occupancy",
          currentValue: this.occupancyLevel,
          threshold: 40,
        },
        actions: [],
        resolved: false,
        color: "yellow",
        icon: "trending-down",
        persistent: false,
      });
    }

    return {
      active: alerts,
      history: [],
      thresholds: {},
      notifications: {},
      unread: {
        critical: alerts.filter((a) => a.severity === "critical").length,
        high: alerts.filter((a) => a.severity === "error").length,
        medium: alerts.filter((a) => a.severity === "warning").length,
        total: alerts.length,
      },
      snoozed: [],
    };
  }
}

// Export convenience factory functions
export function createNormalOperations(): DashboardState {
  return new DashboardMockGenerator()
    .withSeason("peak")
    .withOccupancy(75)
    .withRevenueTarget(50000)
    .withAlert("normal")
    .build();
}

export function createPeakSeason(): DashboardState {
  return new DashboardMockGenerator()
    .withSeason("peak")
    .withOccupancy(95)
    .withRevenueTarget(85000)
    .withAlert("normal")
    .build();
}

export function createOffSeason(): DashboardState {
  return new DashboardMockGenerator()
    .withSeason("off")
    .withOccupancy(40)
    .withRevenueTarget(25000)
    .withAlert("normal")
    .build();
}

export function createCrisisScenario(): DashboardState {
  return new DashboardMockGenerator()
    .withSeason("typhoon")
    .withOccupancy(15)
    .withRevenueTarget(8000)
    .withAlert("crisis")
    .build();
}

export function createHighPerformance(): DashboardState {
  return new DashboardMockGenerator()
    .withSeason("peak")
    .withOccupancy(100)
    .withRevenueTarget(100000)
    .withAlert("normal")
    .build();
}
