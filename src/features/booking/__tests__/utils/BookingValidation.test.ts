/**
 * BookingValidation.test.ts - Comprehensive tests for booking validation rules
 *
 * Tests all business rules and validation logic for bookings including
 * Philippine-specific compliance, pricing validation, and business constraints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BookingValidator } from "@/features/booking/utils/BookingValidator";
import type {
  CreateBookingData,
  Property,
  ValidationResult,
  PriceCalculation,
  BookingSource,
  PaymentMethod,
} from "@/types/common";
import {
  createBooking,
  createBookingData,
  resetBookingIdCounter,
} from "@/test/factories/booking.factory";

// Test constants
const TEST_PROJECT_ID = "test-project-001";
const VILLA_1_ID = "villa-001";
const VILLA_2_ID = "villa-002";
const ROOM_101_ID = "room-101";

// Philippine holidays for business rule testing
const PHILIPPINE_HOLIDAYS_2024 = [
  "2024-01-01", // New Year's Day
  "2024-02-10", // Chinese New Year
  "2024-02-25", // EDSA People Power Revolution Anniversary
  "2024-04-09", // Araw ng Kagitingan
  "2024-05-01", // Labor Day
  "2024-06-12", // Independence Day
  "2024-08-21", // Ninoy Aquino Day
  "2024-08-26", // National Heroes Day
  "2024-11-30", // Bonifacio Day
  "2024-12-25", // Christmas Day
  "2024-12-30", // Rizal Day
  "2024-12-31", // New Year's Eve
];

// Mock properties with different constraints
const mockProperties: Property[] = [
  {
    id: VILLA_1_ID,
    projectId: TEST_PROJECT_ID,
    name: "Villa 1 - Family Villa",
    type: "VILLA",
    status: "AVAILABLE",
    capacity: 4,
    bedrooms: 2,
    bathrooms: 2,
    amenities: ["wifi", "pool", "kitchen"],
    rates: {
      baseRate: 3000,
      minimumStay: 2, // 2-night minimum
      maximumStay: 14, // 14-night maximum
    },
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: VILLA_2_ID,
    projectId: TEST_PROJECT_ID,
    name: "Villa 2 - Luxury Suite",
    type: "VILLA",
    status: "AVAILABLE",
    capacity: 6,
    bedrooms: 3,
    bathrooms: 2,
    amenities: ["wifi", "pool", "kitchen", "bbq", "jacuzzi"],
    rates: {
      baseRate: 4500,
      minimumStay: 3, // 3-night minimum
      maximumStay: 30, // 30-night maximum
      weekendRate: 5500, // Weekend surcharge
    },
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: ROOM_101_ID,
    projectId: TEST_PROJECT_ID,
    name: "Room 101 - Standard",
    type: "ROOM",
    status: "AVAILABLE",
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    amenities: ["wifi", "ac"],
    rates: {
      baseRate: 1500,
      minimumStay: 1, // 1-night minimum
      maximumStay: 7, // 7-night maximum
    },
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

// Mock project configuration for validation rules
const mockProjectConfig = {
  currency: "PHP",
  timezone: "Asia/Manila",
  locale: "en-PH",
  businessRules: {
    maxAdvanceBookingDays: 365, // 1 year advance booking limit
    minAdvanceBookingHours: 2, // Minimum 2 hours advance notice
    maxGuestsPerProperty: 8, // Maximum 8 guests per property
    checkInTime: "14:00", // Standard check-in 2 PM
    checkOutTime: "11:00", // Standard check-out 11 AM
    allowSameDayBooking: true, // Allow same-day bookings
    requireDepositForLongStay: 7, // Require deposit for 7+ nights
    seniorDiscountRate: 0.2, // 20% senior discount
    pwdDiscountRate: 0.2, // 20% PWD discount
    vatRate: 0.12, // 12% VAT in Philippines
    serviceChargeRate: 0.1, // 10% service charge
    holidayPremiumRate: 0.25, // 25% holiday premium
  },
};

// Mock booking validator with business rules
class MockBookingValidator extends BookingValidator {
  constructor(
    private mockProperties: Property[],
    private mockConfig: typeof mockProjectConfig
  ) {
    super();
  }

  protected async getProperty(projectId: string, propertyId: string): Promise<Property | null> {
    return (
      this.mockProperties.find((p) => p.id === propertyId && p.projectId === projectId) || null
    );
  }

  protected async getProjectConfig(projectId: string) {
    return this.mockConfig;
  }

  protected isPhilippineHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split("T")[0];
    return PHILIPPINE_HOLIDAYS_2024.includes(dateStr);
  }
}

describe("BookingValidator - Basic Validation Rules", () => {
  let validator: MockBookingValidator;

  beforeEach(() => {
    resetBookingIdCounter();
    validator = new MockBookingValidator(mockProperties, mockProjectConfig);
  });

  describe("Date validation", () => {
    it("should accept valid future dates", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: tomorrow.toISOString().split("T")[0],
        checkOut: dayAfter.toISOString().split("T")[0],
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject past check-in dates", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const today = new Date();

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: yesterday.toISOString().split("T")[0],
        checkOut: today.toISOString().split("T")[0],
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Check-in date cannot be in the past");
    });

    it("should reject check-out before check-in", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-05",
        checkOut: "2024-06-03", // Before check-in
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Check-out must be after check-in");
    });

    it("should reject same-day check-in and check-out", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-05",
        checkOut: "2024-06-05",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Minimum stay is 1 night");
    });

    it("should enforce maximum advance booking limit", async () => {
      const tooFarFuture = new Date();
      tooFarFuture.setDate(tooFarFuture.getDate() + 400); // Over 365 days
      const evenFurther = new Date(tooFarFuture);
      evenFurther.setDate(evenFurther.getDate() + 2);

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: tooFarFuture.toISOString().split("T")[0],
        checkOut: evenFurther.toISOString().split("T")[0],
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Cannot book more than 365 days in advance");
    });

    it("should enforce minimum advance booking hours", async () => {
      const now = new Date();
      const soonCheckIn = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour from now
      const soonCheckOut = new Date(soonCheckIn.getTime() + 24 * 60 * 60 * 1000); // Next day

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: soonCheckIn.toISOString().split("T")[0],
        checkOut: soonCheckOut.toISOString().split("T")[0],
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Minimum 2 hours advance booking required");
    });

    it("should handle leap year dates correctly", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-02-29", // Leap day
        checkOut: "2024-03-02",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
    });
  });

  describe("Stay duration validation", () => {
    it("should enforce minimum stay requirements", async () => {
      // Villa 1 has 2-night minimum
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-01",
        checkOut: "2024-06-02", // Only 1 night
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Minimum stay requirement: 2 nights");
    });

    it("should allow bookings meeting minimum stay", async () => {
      // Villa 1 has 2-night minimum
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-01",
        checkOut: "2024-06-03", // 2 nights
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
    });

    it("should enforce maximum stay requirements", async () => {
      // Room 101 has 7-night maximum
      const longCheckOut = new Date("2024-06-01");
      longCheckOut.setDate(longCheckOut.getDate() + 10); // 10 nights

      const bookingData = createBookingData({
        propertyId: ROOM_101_ID,
        checkIn: "2024-06-01",
        checkOut: longCheckOut.toISOString().split("T")[0],
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Maximum stay exceeded: 7 nights");
    });

    it("should allow long stays for properties with higher limits", async () => {
      // Villa 2 has 30-night maximum
      const longCheckOut = new Date("2024-06-01");
      longCheckOut.setDate(longCheckOut.getDate() + 20); // 20 nights

      const bookingData = createBookingData({
        propertyId: VILLA_2_ID,
        checkIn: "2024-06-01",
        checkOut: longCheckOut.toISOString().split("T")[0],
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
    });
  });

  describe("Guest capacity validation", () => {
    it("should enforce property capacity limits", async () => {
      // Room 101 has capacity of 2
      const bookingData = createBookingData({
        propertyId: ROOM_101_ID,
        guests: 4, // Exceeds capacity
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Guest count exceeds property capacity: 2");
    });

    it("should allow bookings within capacity", async () => {
      // Villa 1 has capacity of 4
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        guests: 3,
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
    });

    it("should reject zero guests", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        guests: 0,
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("At least 1 guest required");
    });

    it("should reject negative guest count", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        guests: -1,
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Guest count must be positive");
    });

    it("should enforce global maximum guests per property", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_2_ID,
        guests: 10, // Exceeds global max of 8
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Maximum 8 guests allowed per property");
    });
  });

  describe("Property validation", () => {
    it("should reject bookings for non-existent property", async () => {
      const bookingData = createBookingData({
        propertyId: "non-existent-property",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property not found");
    });

    it("should reject bookings for maintenance properties", async () => {
      // Add maintenance property to mock
      const maintenanceProperty = { ...mockProperties[0] };
      maintenanceProperty.id = "maintenance-villa";
      maintenanceProperty.status = "MAINTENANCE";

      const validatorWithMaintenance = new MockBookingValidator(
        [...mockProperties, maintenanceProperty],
        mockProjectConfig
      );

      const bookingData = createBookingData({
        propertyId: "maintenance-villa",
      });

      const result = await validatorWithMaintenance.validateBookingRules(
        TEST_PROJECT_ID,
        bookingData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property not available for booking");
    });

    it("should reject bookings for blocked properties", async () => {
      // Add blocked property to mock
      const blockedProperty = { ...mockProperties[0] };
      blockedProperty.id = "blocked-villa";
      blockedProperty.status = "BLOCKED";

      const validatorWithBlocked = new MockBookingValidator(
        [...mockProperties, blockedProperty],
        mockProjectConfig
      );

      const bookingData = createBookingData({
        propertyId: "blocked-villa",
      });

      const result = await validatorWithBlocked.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property not available for booking");
    });
  });

  describe("Required fields validation", () => {
    it("should require guest name", async () => {
      const bookingData = createBookingData({
        guestName: "",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Guest name is required");
    });

    it("should validate email format when provided", async () => {
      const bookingData = createBookingData({
        guestEmail: "invalid-email",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid email format");
    });

    it("should validate Philippine phone number format", async () => {
      const bookingData = createBookingData({
        guestPhone: "123456789", // Invalid format
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid Philippine phone number format");
    });

    it("should accept valid Philippine phone formats", async () => {
      const validFormats = ["+639123456789", "09123456789", "+63 912 345 6789", "0912-345-6789"];

      for (const phone of validFormats) {
        const bookingData = createBookingData({
          guestPhone: phone,
        });

        const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

        expect(result.isValid).toBe(true, `Phone ${phone} should be valid`);
      }
    });

    it("should require total amount to be positive", async () => {
      const bookingData = createBookingData({
        totalAmount: 0,
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Total amount must be greater than 0");
    });
  });
});

describe("BookingValidator - Philippine Business Compliance", () => {
  let validator: MockBookingValidator;

  beforeEach(() => {
    resetBookingIdCounter();
    validator = new MockBookingValidator(mockProperties, mockProjectConfig);
  });

  describe("Holiday handling", () => {
    it("should detect Philippine holidays and apply premium rates", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-12-25", // Christmas Day
        checkOut: "2024-12-27",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Holiday premium rates apply");
    });

    it("should calculate holiday premium correctly", async () => {
      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-12-25",
        to: "2024-12-27",
      });

      // Base rate: 3000, Holiday premium: 25%, 2 nights
      const expectedBase = 3000 * 2; // 6000
      const holidayPremium = expectedBase * 0.25; // 1500
      const subtotal = expectedBase + holidayPremium; // 7500
      const vat = subtotal * 0.12; // 900
      const serviceCharge = subtotal * 0.1; // 750
      const expectedTotal = subtotal + vat + serviceCharge; // 9150

      expect(price.subtotal).toBe(subtotal);
      expect(price.vatAmount).toBe(vat);
      expect(price.serviceCharge).toBe(serviceCharge);
      expect(price.total).toBe(expectedTotal);
    });

    it("should handle multiple holidays in booking period", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-12-24",
        checkOut: "2024-01-02", // Spans Christmas and New Year
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Multiple holidays in booking period");
    });
  });

  describe("VAT and tax calculations", () => {
    it("should calculate 12% VAT correctly", async () => {
      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      const expectedVat = price.subtotal * 0.12;
      expect(price.vatAmount).toBe(expectedVat);
    });

    it("should include VAT in total price", async () => {
      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      expect(price.total).toBe(price.subtotal + price.vatAmount + price.serviceCharge);
    });

    it("should handle VAT-exempt scenarios (if applicable)", async () => {
      // Create booking with senior citizen discount
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        specialRequests: "Senior citizen discount - ID: SC123456",
      });

      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      // Senior citizens get 20% discount and VAT exemption on discounted amount
      expect(price.discounts.seniorDiscount).toBeGreaterThan(0);
    });
  });

  describe("Service charge calculations", () => {
    it("should calculate 10% service charge", async () => {
      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      const expectedServiceCharge = price.subtotal * 0.1;
      expect(price.serviceCharge).toBe(expectedServiceCharge);
    });

    it("should include service charge in total", async () => {
      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      expect(price.total).toBeGreaterThan(price.subtotal + price.vatAmount);
    });
  });

  describe("Philippine discount compliance", () => {
    it("should apply senior citizen discount", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        guestName: "Juan Santos Sr.",
        specialRequests: "Senior citizen ID: 60-1234567890",
      });

      const validation = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);
      expect(validation.isValid).toBe(true);

      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      expect(price.discounts?.seniorDiscount).toBeDefined();
      expect(price.discounts?.seniorDiscount).toBeGreaterThan(0);
    });

    it("should apply PWD (Person with Disability) discount", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        guestName: "Maria Santos",
        specialRequests: "PWD ID: PWD-1234567890",
      });

      const validation = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);
      expect(validation.isValid).toBe(true);

      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      expect(price.discounts?.pwdDiscount).toBeDefined();
      expect(price.discounts?.pwdDiscount).toBeGreaterThan(0);
    });

    it("should not allow stacking of senior and PWD discounts", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        specialRequests: "Senior ID: 60-123 and PWD ID: PWD-456",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Cannot combine senior and PWD discounts");
    });
  });

  describe("Business hours validation", () => {
    it("should validate check-in time constraints", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-01",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Standard check-in time: 2:00 PM");
    });

    it("should validate check-out time constraints", async () => {
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkOut: "2024-06-03",
      });

      const result = await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Standard check-out time: 11:00 AM");
    });
  });
});

describe("BookingValidator - Price Calculations", () => {
  let validator: MockBookingValidator;

  beforeEach(() => {
    resetBookingIdCounter();
    validator = new MockBookingValidator(mockProperties, mockProjectConfig);
  });

  describe("Basic rate calculations", () => {
    it("should calculate base rate correctly for standard property", async () => {
      const price = await validator.calculateBookingPrice(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        { from: "2024-06-01", to: "2024-06-03" } // 2 nights
      );

      const expectedBase = 3000 * 2; // 6000
      expect(price.baseAmount).toBe(expectedBase);
    });

    it("should apply weekend rates when configured", async () => {
      // Villa 2 has weekend rates
      const price = await validator.calculateBookingPrice(
        TEST_PROJECT_ID,
        VILLA_2_ID,
        { from: "2024-06-01", to: "2024-06-03" } // Includes weekend
      );

      expect(price.weekendPremium).toBeGreaterThan(0);
    });

    it("should handle long stay bookings", async () => {
      // 10-night stay
      const longCheckOut = new Date("2024-06-01");
      longCheckOut.setDate(longCheckOut.getDate() + 10);

      const price = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_2_ID, {
        from: "2024-06-01",
        to: longCheckOut.toISOString().split("T")[0],
      });

      expect(price.nights).toBe(10);
      expect(price.baseAmount).toBe(4500 * 10);
    });
  });

  describe("Complex pricing scenarios", () => {
    it("should calculate accurate pricing for holiday periods", async () => {
      const price = await validator.calculateBookingPrice(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        { from: "2024-12-24", to: "2024-12-27" } // Christmas period
      );

      expect(price.holidayPremium).toBeGreaterThan(0);
      expect(price.total).toBeGreaterThan(price.baseAmount * 1.4); // With premiums and taxes
    });

    it("should handle seasonal rate variations", async () => {
      // Peak season pricing (if implemented)
      const peakPrice = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_2_ID, {
        from: "2024-12-20",
        to: "2024-12-23",
      });

      const regularPrice = await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_2_ID, {
        from: "2024-06-01",
        to: "2024-06-04",
      });

      // Peak season should be more expensive
      expect(peakPrice.total).toBeGreaterThan(regularPrice.total);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle invalid property for pricing", async () => {
      await expect(
        validator.calculateBookingPrice(TEST_PROJECT_ID, "invalid-property-id", {
          from: "2024-06-01",
          to: "2024-06-03",
        })
      ).rejects.toThrow("Property not found");
    });

    it("should handle invalid date ranges for pricing", async () => {
      await expect(
        validator.calculateBookingPrice(
          TEST_PROJECT_ID,
          VILLA_1_ID,
          { from: "2024-06-05", to: "2024-06-03" } // Invalid range
        )
      ).rejects.toThrow("Invalid date range");
    });

    it("should handle zero-night stays", async () => {
      await expect(
        validator.calculateBookingPrice(
          TEST_PROJECT_ID,
          VILLA_1_ID,
          { from: "2024-06-01", to: "2024-06-01" } // Same day
        )
      ).rejects.toThrow("Minimum stay is 1 night");
    });

    it("should handle missing project configuration", async () => {
      const validatorWithoutConfig = new MockBookingValidator(mockProperties, null as any);

      await expect(
        validatorWithoutConfig.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
          from: "2024-06-01",
          to: "2024-06-03",
        })
      ).rejects.toThrow("Project configuration not found");
    });
  });

  describe("Performance requirements", () => {
    it("should complete validation within 100ms", async () => {
      const startTime = Date.now();

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
      });

      await validator.validateBookingRules(TEST_PROJECT_ID, bookingData);

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(100);
    });

    it("should complete price calculation within 50ms", async () => {
      const startTime = Date.now();

      await validator.calculateBookingPrice(TEST_PROJECT_ID, VILLA_1_ID, {
        from: "2024-06-01",
        to: "2024-06-03",
      });

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(50);
    });
  });
});
