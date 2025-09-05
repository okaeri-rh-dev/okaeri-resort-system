/**
 * Metric Helper Utilities
 * Phase 2.1 - RED Phase: Philippine business context utilities for consistent test data
 *
 * Provides helper functions for:
 * - Philippine currency formatting and calculations
 * - BIR tax computations
 * - Date/time scenarios (peak hours, seasons, holidays)
 * - Business context generators (names, IDs, phone numbers)
 */

import { PhilippineCurrency, PaymentMethod } from "../../src/features/dashboard/types/metrics";

// Philippine holiday calendar for realistic date scenarios
export const PHILIPPINE_HOLIDAYS_2024 = [
  { date: "2024-01-01", name: "New Year's Day", type: "regular" },
  { date: "2024-02-10", name: "Chinese New Year", type: "special_non_working" },
  { date: "2024-02-25", name: "EDSA People Power Revolution", type: "special_non_working" },
  { date: "2024-03-28", name: "Maundy Thursday", type: "regular" },
  { date: "2024-03-29", name: "Good Friday", type: "regular" },
  { date: "2024-03-30", name: "Black Saturday", type: "special_non_working" },
  { date: "2024-04-09", name: "Araw ng Kagitingan", type: "regular" },
  { date: "2024-05-01", name: "Labor Day", type: "regular" },
  { date: "2024-06-12", name: "Independence Day", type: "regular" },
  { date: "2024-08-21", name: "Ninoy Aquino Day", type: "special_non_working" },
  { date: "2024-08-26", name: "National Heroes Day", type: "regular" },
  { date: "2024-11-01", name: "All Saints' Day", type: "special_non_working" },
  { date: "2024-11-30", name: "Bonifacio Day", type: "regular" },
  { date: "2024-12-25", name: "Christmas Day", type: "regular" },
  { date: "2024-12-30", name: "Rizal Day", type: "regular" },
  { date: "2024-12-31", name: "New Year's Eve", type: "special_non_working" },
];

// Typhoon season patterns (June to November)
export const TYPHOON_SEASON_MONTHS = [5, 6, 7, 8, 9, 10]; // June-November (0-indexed)

// Peak tourism seasons in the Philippines
export const TOURISM_SEASONS = {
  PEAK: [2, 3, 4], // March-May (summer)
  HIGH: [11, 0, 1], // December-February (cool dry season)
  OFF: [5, 6, 7, 8, 9, 10], // June-November (rainy season)
};

// Common Filipino first names and surnames
export const FILIPINO_NAMES = {
  MALE_FIRST: [
    "Juan",
    "Jose",
    "Antonio",
    "Pedro",
    "Miguel",
    "Carlos",
    "Eduardo",
    "Roberto",
    "Francisco",
    "Rafael",
    "Manuel",
    "Daniel",
    "Luis",
    "Ricardo",
    "Fernando",
    "Angelo",
    "Mark",
    "John",
    "Michael",
    "Christopher",
    "Joshua",
    "David",
  ],
  FEMALE_FIRST: [
    "Maria",
    "Ana",
    "Carmen",
    "Teresa",
    "Elena",
    "Rosa",
    "Luz",
    "Cristina",
    "Gloria",
    "Patricia",
    "Michelle",
    "Jennifer",
    "Sarah",
    "Princess",
    "Angel",
    "Marilyn",
    "Grace",
    "Josephine",
    "Elizabeth",
    "Catherine",
    "Donna",
  ],
  SURNAMES: [
    "Dela Cruz",
    "Santos",
    "Reyes",
    "Garcia",
    "Mendoza",
    "Rodriguez",
    "Torres",
    "Villanueva",
    "Bautista",
    "Aquino",
    "Fernandez",
    "Morales",
    "Valdez",
    "Castro",
    "Jimenez",
    "Guerrero",
    "Herrera",
    "Aguilar",
    "Ramos",
    "Flores",
    "Gutierrez",
    "Gonzales",
    "Lopez",
    "Perez",
    "Cruz",
    "Diaz",
    "Martinez",
  ],
};

// International guest origin countries (common in Philippines)
export const INTERNATIONAL_ORIGINS = [
  { country: "United States", code: "US", percentage: 25 },
  { country: "South Korea", code: "KR", percentage: 20 },
  { country: "China", code: "CN", percentage: 15 },
  { country: "Japan", code: "JP", percentage: 12 },
  { country: "Australia", code: "AU", percentage: 10 },
  { country: "Singapore", code: "SG", percentage: 8 },
  { country: "United Kingdom", code: "GB", percentage: 5 },
  { country: "Germany", code: "DE", percentage: 3 },
  { country: "France", code: "FR", percentage: 2 },
];

// Philippine mobile network prefixes
export const MOBILE_PREFIXES = {
  GLOBE: [
    "915",
    "916",
    "917",
    "926",
    "927",
    "935",
    "936",
    "937",
    "945",
    "955",
    "956",
    "965",
    "975",
    "976",
    "977",
    "995",
    "996",
    "997",
  ],
  SMART: [
    "908",
    "918",
    "919",
    "920",
    "921",
    "928",
    "929",
    "930",
    "938",
    "939",
    "946",
    "947",
    "948",
    "949",
    "998",
    "999",
  ],
  SUN: ["922", "923", "924", "925", "931", "932", "933", "934", "940", "941", "942", "943", "944"],
};

// Room types common in Philippine resorts
export const ROOM_TYPES = [
  { type: "Standard", capacity: 2, baseRate: 2500 },
  { type: "Deluxe", capacity: 2, baseRate: 3500 },
  { type: "Family Room", capacity: 4, baseRate: 4500 },
  { type: "Suite", capacity: 2, baseRate: 6000 },
  { type: "Villa", capacity: 6, baseRate: 8500 },
  { type: "Penthouse", capacity: 4, baseRate: 12000 },
];

// Common expense categories for Philippine resorts
export const EXPENSE_CATEGORIES = {
  UTILITIES: { percentage: 15, subcategories: ["Electricity", "Water", "Internet", "Phone"] },
  STAFF: { percentage: 35, subcategories: ["Salaries", "Benefits", "Training", "Uniforms"] },
  MAINTENANCE: {
    percentage: 12,
    subcategories: ["Repairs", "Cleaning supplies", "Equipment", "Landscaping"],
  },
  FOOD_BEVERAGE: {
    percentage: 20,
    subcategories: ["Kitchen supplies", "Beverages", "Restaurant operations"],
  },
  MARKETING: {
    percentage: 8,
    subcategories: ["Online ads", "Print materials", "Commissions", "Promotions"],
  },
  ADMINISTRATION: {
    percentage: 10,
    subcategories: ["Office supplies", "Legal fees", "Insurance", "Permits"],
  },
};

/**
 * Philippine Currency Helper Functions
 */

/**
 * Create a Philippine currency object with proper formatting
 */
export function createPHPCurrency(amount: number): PhilippineCurrency {
  const amountInCentavos = Math.round(amount * 100);
  const amountInPesos = amountInCentavos / 100;

  // Philippine number formatting
  const formatted = `₱${amountInPesos.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return {
    amount: amountInCentavos,
    currency: "PHP",
    formatted,
    displayText: `${formatted} PHP`,
  };
}

/**
 * Calculate VAT (12% in Philippines)
 */
export function calculateVAT(
  grossAmount: number,
  vatRate: number = 0.12
): {
  grossAmount: PhilippineCurrency;
  vatAmount: PhilippineCurrency;
  netAmount: PhilippineCurrency;
} {
  const netAmount = grossAmount / (1 + vatRate);
  const vatAmount = grossAmount - netAmount;

  return {
    grossAmount: createPHPCurrency(grossAmount),
    vatAmount: createPHPCurrency(vatAmount),
    netAmount: createPHPCurrency(netAmount),
  };
}

/**
 * Calculate withholding tax (common rates in Philippines)
 */
export function calculateWithholdingTax(
  amount: number,
  taxType: "professional_services" | "rental" | "goods" = "professional_services"
): PhilippineCurrency {
  const rates = {
    professional_services: 0.1, // 10%
    rental: 0.05, // 5%
    goods: 0.01, // 1%
  };

  const taxAmount = amount * rates[taxType];
  return createPHPCurrency(taxAmount);
}

/**
 * Calculate local government tax (varies by municipality)
 */
export function calculateLocalTax(
  grossRevenue: number,
  municipality: string = "San Juan"
): PhilippineCurrency {
  // La Union municipalities - approximate business tax rates
  const taxRates = {
    "San Juan": 0.0025, // 0.25%
    "San Fernando": 0.003, // 0.30%
    Bauang: 0.002, // 0.20%
    Agoo: 0.0025, // 0.25%
    Rosario: 0.002, // 0.20%
    default: 0.0025, // Default 0.25%
  };

  const rate = taxRates[municipality as keyof typeof taxRates] || taxRates.default;
  const taxAmount = grossRevenue * rate;

  return createPHPCurrency(taxAmount);
}

/**
 * Date and Time Helper Functions
 */

/**
 * Check if a date is within typhoon season
 */
export function isTyphoonSeason(date: Date = new Date()): boolean {
  const month = date.getMonth();
  return TYPHOON_SEASON_MONTHS.includes(month);
}

/**
 * Get tourism season for a given date
 */
export function getTourismSeason(date: Date = new Date()): "PEAK" | "HIGH" | "OFF" {
  const month = date.getMonth();

  if (TOURISM_SEASONS.PEAK.includes(month)) return "PEAK";
  if (TOURISM_SEASONS.HIGH.includes(month)) return "HIGH";
  return "OFF";
}

/**
 * Check if date is a Philippine holiday
 */
export function isPhilippineHoliday(date: Date): { isHoliday: boolean; holiday?: any } {
  const dateString = date.toISOString().split("T")[0];
  const holiday = PHILIPPINE_HOLIDAYS_2024.find((h) => h.date === dateString);

  return {
    isHoliday: !!holiday,
    holiday,
  };
}

/**
 * Get peak hours for different resort operations
 */
export function isPeakHour(
  hour: number,
  operation: "checkin" | "checkout" | "dining" | "pool"
): boolean {
  const peakHours = {
    checkin: [14, 15, 16, 17], // 2PM-5PM
    checkout: [10, 11, 12], // 10AM-12PM
    dining: [7, 8, 18, 19, 20], // 7-8AM, 6-8PM
    pool: [10, 11, 14, 15, 16], // 10-11AM, 2-4PM
  };

  return peakHours[operation].includes(hour);
}

/**
 * Generate seasonal pricing multiplier
 */
export function getSeasonalPricing(date: Date = new Date()): number {
  const season = getTourismSeason(date);
  const { isHoliday } = isPhilippineHoliday(date);
  const isWeekend = [0, 6].includes(date.getDay()); // Sunday, Saturday

  let multiplier = 1.0;

  // Base seasonal adjustment
  switch (season) {
    case "PEAK":
      multiplier = 1.4;
      break;
    case "HIGH":
      multiplier = 1.2;
      break;
    case "OFF":
      multiplier = 0.8;
      break;
  }

  // Holiday premium
  if (isHoliday) {
    multiplier *= 1.3;
  }

  // Weekend premium (except during OFF season)
  if (isWeekend && season !== "OFF") {
    multiplier *= 1.15;
  }

  // Typhoon season discount
  if (isTyphoonSeason(date)) {
    multiplier *= 0.85;
  }

  return Math.round(multiplier * 100) / 100; // Round to 2 decimal places
}

/**
 * Guest Name and Contact Generation
 */

/**
 * Generate realistic Filipino guest name
 */
export function generateFilipinoGuestName(gender?: "male" | "female"): string {
  if (!gender) {
    gender = Math.random() > 0.5 ? "male" : "female";
  }

  const firstNames = gender === "male" ? FILIPINO_NAMES.MALE_FIRST : FILIPINO_NAMES.FEMALE_FIRST;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName =
    FILIPINO_NAMES.SURNAMES[Math.floor(Math.random() * FILIPINO_NAMES.SURNAMES.length)];

  return `${firstName} ${lastName}`;
}

/**
 * Generate international guest name based on origin country
 */
export function generateInternationalGuestName(countryCode?: string): {
  name: string;
  country: string;
  code: string;
} {
  if (!countryCode) {
    // Select country based on visitor statistics
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const origin of INTERNATIONAL_ORIGINS) {
      cumulative += origin.percentage;
      if (random <= cumulative) {
        countryCode = origin.code;
        break;
      }
    }
  }

  // Simple name generation based on country
  const namesByCountry: Record<string, { first: string[]; last: string[] }> = {
    US: {
      first: ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda"],
      last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"],
    },
    KR: {
      first: ["Min-jun", "So-yeon", "Seo-jun", "Ji-woo", "Do-yoon", "Ye-eun"],
      last: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang"],
    },
    CN: {
      first: ["Wei", "Li", "Yuki", "Ming", "Xiao", "Lei"],
      last: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang"],
    },
    JP: {
      first: ["Hiroshi", "Yuki", "Takeshi", "Akiko", "Kenji", "Sakura"],
      last: ["Tanaka", "Suzuki", "Sato", "Watanabe", "Ito", "Yamamoto"],
    },
  };

  const defaultNames = namesByCountry["US"];
  const names = namesByCountry[countryCode || "US"] || defaultNames;

  const firstName = names.first[Math.floor(Math.random() * names.first.length)];
  const lastName = names.last[Math.floor(Math.random() * names.last.length)];

  const origin =
    INTERNATIONAL_ORIGINS.find((o) => o.code === countryCode) || INTERNATIONAL_ORIGINS[0];

  return {
    name: `${firstName} ${lastName}`,
    country: origin.country,
    code: origin.code,
  };
}

/**
 * Generate Philippine mobile number
 */
export function generatePhilippineMobile(network?: "GLOBE" | "SMART" | "SUN"): string {
  if (!network) {
    const networks = ["GLOBE", "SMART", "SUN"] as const;
    network = networks[Math.floor(Math.random() * networks.length)];
  }

  const prefixes = MOBILE_PREFIXES[network];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, "0");

  return `+63 ${prefix} ${suffix}`;
}

/**
 * Business ID and Reference Generation
 */

/**
 * Generate booking reference in Philippine format
 */
export function generateBookingReference(prefix: string = "BK"): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const sequence = Math.floor(Math.random() * 9999) + 1;

  return `${prefix}-${year}${month}-${sequence.toString().padStart(4, "0")}`;
}

/**
 * Generate BIR reference number format
 */
export function generateBIRReference(): string {
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 999999) + 100000;

  return `${year}${sequence}`;
}

/**
 * Generate transaction ID for payments
 */
export function generateTransactionId(paymentMethod: PaymentMethod): string {
  const prefix = {
    cash: "CSH",
    gcash: "GCX",
    maya: "MYA",
    bank_transfer: "BNK",
    credit_card: "CRD",
    debit_card: "DBT",
    installment: "INS",
  };

  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 999) + 100;

  return `${prefix[paymentMethod]}-${timestamp}-${random}`;
}

/**
 * Revenue and Financial Calculations
 */

/**
 * Calculate realistic daily revenue based on occupancy and season
 */
export function calculateDailyRevenue(
  occupancyRate: number,
  date: Date = new Date()
): {
  baseRevenue: PhilippineCurrency;
  seasonalRevenue: PhilippineCurrency;
  projectedRevenue: PhilippineCurrency;
  breakdown: {
    accommodation: PhilippineCurrency;
    foodBeverage: PhilippineCurrency;
    services: PhilippineCurrency;
    other: PhilippineCurrency;
  };
} {
  // Base calculation: 24 rooms, average rate ₱3,500
  const totalRooms = 24;
  const averageRoomRate = 3500;
  const occupiedRooms = Math.floor(totalRooms * (occupancyRate / 100));

  // Seasonal pricing adjustment
  const seasonalMultiplier = getSeasonalPricing(date);
  const adjustedRoomRate = averageRoomRate * seasonalMultiplier;

  // Base accommodation revenue
  const accommodationRevenue = occupiedRooms * adjustedRoomRate;

  // Additional revenue streams (percentages of accommodation)
  const foodBeverageRevenue = accommodationRevenue * 0.35; // 35% F&B
  const servicesRevenue = accommodationRevenue * 0.15; // 15% services
  const otherRevenue = accommodationRevenue * 0.05; // 5% other

  const totalRevenue = accommodationRevenue + foodBeverageRevenue + servicesRevenue + otherRevenue;
  const baseRevenue = occupiedRooms * averageRoomRate * 1.55; // Without seasonal adjustment

  return {
    baseRevenue: createPHPCurrency(baseRevenue),
    seasonalRevenue: createPHPCurrency(totalRevenue),
    projectedRevenue: createPHPCurrency(totalRevenue),
    breakdown: {
      accommodation: createPHPCurrency(accommodationRevenue),
      foodBeverage: createPHPCurrency(foodBeverageRevenue),
      services: createPHPCurrency(servicesRevenue),
      other: createPHPCurrency(otherRevenue),
    },
  };
}

/**
 * Generate realistic expense distribution
 */
export function generateExpenseDistribution(totalBudget: number): Record<
  string,
  {
    budgeted: PhilippineCurrency;
    actual: PhilippineCurrency;
    variance: number;
  }
> {
  const distribution: Record<string, any> = {};

  Object.entries(EXPENSE_CATEGORIES).forEach(([category, config]) => {
    const budgetedAmount = totalBudget * (config.percentage / 100);
    // Add some variance to actual spending (-20% to +30%)
    const variance = Math.random() * 0.5 - 0.2; // -20% to +30%
    const actualAmount = budgetedAmount * (1 + variance);

    distribution[category.toLowerCase()] = {
      budgeted: createPHPCurrency(budgetedAmount),
      actual: createPHPCurrency(actualAmount),
      variance: Math.round(variance * 100),
    };
  });

  return distribution;
}

/**
 * Performance and Operational Metrics
 */

/**
 * Generate realistic performance metrics based on scenario
 */
export function generatePerformanceMetrics(
  scenario: "excellent" | "good" | "average" | "poor" | "crisis"
): {
  guestSatisfaction: number;
  averageRating: number;
  responseTime: number;
  staffEfficiency: number;
  recommendationRate: number;
} {
  const baseMetrics = {
    excellent: { satisfaction: 95, rating: 4.8, response: 5, efficiency: 95, recommendation: 98 },
    good: { satisfaction: 85, rating: 4.5, response: 10, efficiency: 85, recommendation: 90 },
    average: { satisfaction: 75, rating: 4.0, response: 15, efficiency: 75, recommendation: 80 },
    poor: { satisfaction: 60, rating: 3.2, response: 25, efficiency: 60, recommendation: 65 },
    crisis: { satisfaction: 40, rating: 2.8, response: 45, efficiency: 40, recommendation: 35 },
  };

  const base = baseMetrics[scenario];

  // Add some realistic variance
  return {
    guestSatisfaction: Math.max(0, Math.min(100, base.satisfaction + (Math.random() * 10 - 5))),
    averageRating: Math.max(1, Math.min(5, base.rating + (Math.random() * 0.4 - 0.2))),
    responseTime: Math.max(1, base.response + (Math.random() * 10 - 5)), // minutes
    staffEfficiency: Math.max(0, Math.min(100, base.efficiency + (Math.random() * 10 - 5))),
    recommendationRate: Math.max(0, Math.min(100, base.recommendation + (Math.random() * 10 - 5))),
  };
}

/**
 * Generate time-based scenarios for testing
 */
export function generateTimeScenarios(): {
  peakSummer: Date;
  typhoonSeason: Date;
  christmas: Date;
  newYear: Date;
  offSeason: Date;
  weekendPeak: Date;
  weekdayLow: Date;
} {
  const currentYear = new Date().getFullYear();

  return {
    peakSummer: new Date(currentYear, 3, 15), // April 15 - peak summer
    typhoonSeason: new Date(currentYear, 7, 15), // August 15 - typhoon season
    christmas: new Date(currentYear, 11, 25), // December 25
    newYear: new Date(currentYear + 1, 0, 1), // January 1
    offSeason: new Date(currentYear, 8, 15), // September 15
    weekendPeak: new Date(currentYear, 3, 20), // April weekend
    weekdayLow: new Date(currentYear, 8, 10), // September weekday
  };
}
