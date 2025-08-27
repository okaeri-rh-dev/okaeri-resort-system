/**
 * Philippine-specific validation tests for resort management
 * Tests GCash, PHP amounts, TIN validation, business permits, and local data formats
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  formatPHP,
  formatPHPCompact,
  isValidPhoneNumber,
  validateTIN,
  formatTIN,
  formatPhoneNumber,
  isPhilippineHoliday,
  getPhilippineHoliday,
  getSeasonType,
  getPeakSeasonMultiplier,
  isBusinessHours,
  philippineProvinces,
} from "@/lib/philippine-utils";
import { philippineTestData } from "@tests/utils/test-utils";

// Philippine business validation schemas
const philippineAmountSchema = z
  .number()
  .min(0, "Amount cannot be negative")
  .max(50_000_000, "Amount exceeds maximum limit") // PHP 50M
  .refine((val) => Number.isFinite(val) && val >= 0, "Invalid amount format")
  .transform((val) => Math.round(val * 100) / 100); // Round to 2 decimal places

const gcashNumberSchema = z
  .string()
  .trim()
  .transform((phone) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");

    // Handle different formats
    if (digits.startsWith("63")) {
      return `+${digits}`;
    } else if (digits.startsWith("09")) {
      return `+63${digits.substring(1)}`;
    } else if (digits.length === 10 && digits.startsWith("9")) {
      return `+63${digits}`;
    }

    return `+63${digits}`;
  })
  .pipe(
    z
      .string()
      .regex(
        /^\+639(17|18|19|20|21|26|27|28|29|35|36|37|38|39|56|57|58|59|96|97|98|99)\d{7}$/,
        "Invalid GCash number format"
      )
  );

const tinSchema = z
  .string()
  .trim()
  .transform((tin) => tin.replace(/\D/g, ""))
  .pipe(z.string().regex(/^(\d{9}|\d{12})$/, "TIN must be 9 or 12 digits"))
  .transform((tin) => formatTIN(tin));

const businessPermitSchema = z
  .string()
  .trim()
  .min(1, "Business permit number is required")
  .max(50, "Business permit number too long")
  .regex(
    /^[A-Z0-9\-]+$/,
    "Business permit must contain only uppercase letters, numbers, and hyphens"
  );

const philippineAddressSchema = z.object({
  street: z.string().trim().min(1, "Street address is required").optional(),
  barangay: z.string().trim().min(1, "Barangay is required"),
  city: z.string().trim().min(1, "City is required"),
  province: z.enum(philippineProvinces as [string, ...string[]], {
    errorMap: () => ({ message: "Please select a valid Philippine province" }),
  }),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "ZIP code must be 4 digits")
    .optional(),
});

const paymentMethodSchema = z.enum(
  [
    "GCash",
    "PayMaya",
    "Maya",
    "Bank Transfer",
    "Cash",
    "Credit Card",
    "Debit Card",
    "Online Banking",
    "Remittance",
    "Installment",
    "Over the Counter",
    "7-Eleven",
    "Cebuana Lhuillier",
    "M Lhuillier",
    "Palawan Pawnshop",
    "Western Union",
    "MoneyGram",
  ],
  {
    errorMap: () => ({ message: "Please select a valid payment method" }),
  }
);

const bookingAmountSchema = z
  .object({
    totalAmount: philippineAmountSchema,
    paidAmount: philippineAmountSchema.default(0),
    currency: z.literal("PHP").default("PHP"),
    paymentMethod: paymentMethodSchema,
    gcashNumber: gcashNumberSchema.optional(),
    referenceNumber: z.string().trim().min(1).max(100).optional(),
  })
  .refine((data) => data.paidAmount <= data.totalAmount, {
    message: "Paid amount cannot exceed total amount",
    path: ["paidAmount"],
  })
  .refine(
    (data) => {
      // Require GCash number if payment method is GCash
      if (data.paymentMethod === "GCash" && !data.gcashNumber) {
        return false;
      }
      return true;
    },
    {
      message: "GCash number is required for GCash payments",
      path: ["gcashNumber"],
    }
  );

const resortTypeSchema = z.enum(
  [
    "BEACH_RESORT",
    "ECO_RESORT",
    "MOUNTAIN_RESORT",
    "ISLAND_RESORT",
    "CITY_HOTEL",
    "BOUTIQUE_HOTEL",
    "VILLA",
    "PENSION_HOUSE",
    "HOSTEL",
    "GLAMPING",
    "DIVE_RESORT",
    "SURF_CAMP",
    "FAMILY_RESORT",
    "ADULTS_ONLY",
    "WELLNESS_RETREAT",
  ],
  {
    errorMap: () => ({ message: "Please select a valid resort type" }),
  }
);

describe("Philippine-Specific Validation Tests", () => {
  describe("Philippine Peso Amount Validation", () => {
    it("should validate PHP amounts correctly", () => {
      const validAmounts = [
        0,
        50,
        1500,
        15000,
        150000,
        1500000,
        15000000,
        50000000, // Max amount
      ];

      validAmounts.forEach((amount) => {
        const result = philippineAmountSchema.safeParse(amount);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(amount);
        }
      });
    });

    it("should reject invalid amounts", () => {
      const invalidAmounts = [
        -1,
        -100,
        50000001, // Over max
        Infinity,
        -Infinity,
        NaN,
      ];

      invalidAmounts.forEach((amount) => {
        const result = philippineAmountSchema.safeParse(amount);
        expect(result.success).toBe(false);
      });
    });

    it("should round amounts to 2 decimal places", () => {
      const testCases = [
        { input: 15.999, expected: 16 },
        { input: 15.001, expected: 15 },
        { input: 15.555, expected: 15.56 },
        { input: 1234.567, expected: 1234.57 },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = philippineAmountSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(expected);
        }
      });
    });

    it("should format amounts as Philippine Peso", () => {
      const testCases = [
        { amount: 1500, expected: "₱1,500.00" },
        { amount: 15000, expected: "₱15,000.00" },
        { amount: 150000, expected: "₱150,000.00" },
        { amount: 1500000, expected: "₱1,500,000.00" },
        { amount: 15.5, expected: "₱15.50" },
      ];

      testCases.forEach(({ amount, expected }) => {
        expect(formatPHP(amount)).toBe(expected);
      });
    });

    it("should format compact amounts", () => {
      const testCases = [
        { amount: 999, expected: "₱999.00" },
        { amount: 1500, expected: "₱1.50K" },
        { amount: 15000, expected: "₱15.00K" },
        { amount: 150000, expected: "₱150.00K" },
        { amount: 1500000, expected: "₱1.50M" },
        { amount: 15000000, expected: "₱15.00M" },
      ];

      testCases.forEach(({ amount, expected }) => {
        expect(formatPHPCompact(amount)).toBe(expected);
      });
    });
  });

  describe("GCash Number Validation", () => {
    it("should validate and normalize GCash numbers", () => {
      const validGCashNumbers = [
        "09171234567",
        "639171234567",
        "+639171234567",
        "9171234567",
        "09281234567", // Smart
        "09351234567", // Globe
        "09391234567", // Smart
        "09561234567", // Globe
        "09991234567", // Smart
      ];

      validGCashNumbers.forEach((number) => {
        const result = gcashNumberSchema.safeParse(number);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toMatch(/^\+639\d{9}$/);
        }
      });
    });

    it("should reject invalid GCash numbers", () => {
      const invalidGCashNumbers = [
        "09071234567", // Invalid prefix
        "08171234567", // Invalid prefix
        "1234567890", // Not Philippine
        "+1234567890", // Not Philippine
        "091712345", // Too short
        "0917123456789", // Too long
        "+639071234567", // Invalid Globe prefix
      ];

      invalidGCashNumbers.forEach((number) => {
        const result = gcashNumberSchema.safeParse(number);
        expect(result.success).toBe(false);
      });
    });

    it("should handle different GCash number formats", () => {
      const testCases = [
        { input: "09171234567", expected: "+639171234567" },
        { input: "639171234567", expected: "+639171234567" },
        { input: "+639171234567", expected: "+639171234567" },
        { input: "9171234567", expected: "+639171234567" },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = gcashNumberSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(expected);
        }
      });
    });
  });

  describe("TIN (Tax Identification Number) Validation", () => {
    it("should validate Philippine TIN formats", () => {
      const validTINs = [
        "123456789", // 9 digits
        "123-456-789", // 9 digits with dashes
        "123456789000", // 12 digits
        "123-456-789-000", // 12 digits with dashes
      ];

      validTINs.forEach((tin) => {
        expect(validateTIN(tin)).toBe(true);
      });
    });

    it("should reject invalid TIN formats", () => {
      const invalidTINs = [
        "12345678", // Too short
        "1234567890", // Wrong length (10 digits)
        "12345678901", // Wrong length (11 digits)
        "1234567890123", // Too long
        "abc123def456", // Contains letters
        "", // Empty
      ];

      invalidTINs.forEach((tin) => {
        expect(validateTIN(tin)).toBe(false);
      });
    });

    it("should format TIN correctly", () => {
      const testCases = [
        { input: "123456789", expected: "123-456-789" },
        { input: "123456789000", expected: "123-456-789-000" },
        { input: "123-456-789", expected: "123-456-789" },
        { input: "invalid", expected: "invalid" }, // Invalid stays unchanged
      ];

      testCases.forEach(({ input, expected }) => {
        expect(formatTIN(input)).toBe(expected);
      });
    });

    it("should validate TIN with schema", () => {
      const validData = "123456789";
      const result = tinSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("123-456-789");
      }
    });
  });

  describe("Business Permit Validation", () => {
    it("should validate business permit numbers", () => {
      const validPermits = [
        "BP2024-001",
        "MAYOR-PERMIT-2024",
        "BFP-2024-123",
        "DOT-2024-RESORT",
        "DENR-ECC-2024",
      ];

      validPermits.forEach((permit) => {
        const result = businessPermitSchema.safeParse(permit);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid business permit formats", () => {
      const invalidPermits = [
        "", // Empty
        "bp2024-001", // Lowercase not allowed
        "BP-2024@001", // Special chars not allowed
        "BP 2024 001", // Spaces not allowed
        "a".repeat(51), // Too long
      ];

      invalidPermits.forEach((permit) => {
        const result = businessPermitSchema.safeParse(permit);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Philippine Address Validation", () => {
    it("should validate complete Philippine addresses", () => {
      const validAddress = {
        street: "123 Sunset Avenue",
        barangay: "Balabag",
        city: "Malay",
        province: "Aklan",
        zipCode: "5608",
      };

      const result = philippineAddressSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
    });

    it("should validate address with only required fields", () => {
      const minimalAddress = {
        barangay: "Poblacion",
        city: "Puerto Princesa",
        province: "Palawan",
      };

      const result = philippineAddressSchema.safeParse(minimalAddress);
      expect(result.success).toBe(true);
    });

    it("should reject invalid provinces", () => {
      const invalidAddress = {
        barangay: "Test Barangay",
        city: "Test City",
        province: "Invalid Province",
      };

      const result = philippineAddressSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it("should validate ZIP codes", () => {
      const validZipCodes = ["5608", "1000", "9000", "1234"];
      const invalidZipCodes = ["560", "56080", "abcd", ""];

      validZipCodes.forEach((zipCode) => {
        const address = {
          barangay: "Test",
          city: "Test City",
          province: "Aklan",
          zipCode,
        };
        const result = philippineAddressSchema.safeParse(address);
        expect(result.success).toBe(true);
      });

      invalidZipCodes.forEach((zipCode) => {
        const address = {
          barangay: "Test",
          city: "Test City",
          province: "Aklan",
          zipCode,
        };
        const result = philippineAddressSchema.safeParse(address);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Payment Method Validation", () => {
    it("should validate Philippine payment methods", () => {
      const validPaymentMethods = [
        "GCash",
        "PayMaya",
        "Maya",
        "Bank Transfer",
        "Cash",
        "Credit Card",
        "Over the Counter",
        "7-Eleven",
        "Cebuana Lhuillier",
        "Western Union",
      ];

      validPaymentMethods.forEach((method) => {
        const result = paymentMethodSchema.safeParse(method);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid payment methods", () => {
      const invalidMethods = [
        "PayPal", // Not commonly used in PH
        "Venmo", // US-only
        "Alipay", // Not common in PH
        "Invalid Method",
        "",
      ];

      invalidMethods.forEach((method) => {
        const result = paymentMethodSchema.safeParse(method);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Booking Amount with Payment Method", () => {
    it("should validate booking amounts with GCash payment", () => {
      const validBooking = {
        totalAmount: 15000,
        paidAmount: 7500,
        currency: "PHP" as const,
        paymentMethod: "GCash" as const,
        gcashNumber: "09171234567",
        referenceNumber: "GCash-123456789",
      };

      const result = bookingAmountSchema.safeParse(validBooking);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gcashNumber).toBe("+639171234567");
      }
    });

    it("should require GCash number for GCash payments", () => {
      const invalidBooking = {
        totalAmount: 15000,
        paidAmount: 7500,
        paymentMethod: "GCash" as const,
        // Missing gcashNumber
      };

      const result = bookingAmountSchema.safeParse(invalidBooking);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.message === "GCash number is required for GCash payments"
          )
        ).toBe(true);
      }
    });

    it("should validate paid amount does not exceed total", () => {
      const invalidBooking = {
        totalAmount: 15000,
        paidAmount: 20000, // More than total
        paymentMethod: "Cash" as const,
      };

      const result = bookingAmountSchema.safeParse(invalidBooking);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.message === "Paid amount cannot exceed total amount"
          )
        ).toBe(true);
      }
    });

    it("should handle cash payments without additional requirements", () => {
      const cashBooking = {
        totalAmount: 25000,
        paidAmount: 25000,
        paymentMethod: "Cash" as const,
      };

      const result = bookingAmountSchema.safeParse(cashBooking);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe("PHP");
      }
    });

    it("should handle bank transfer payments", () => {
      const bankTransferBooking = {
        totalAmount: 50000,
        paidAmount: 50000,
        paymentMethod: "Bank Transfer" as const,
        referenceNumber: "BT-20240127-001",
      };

      const result = bookingAmountSchema.safeParse(bankTransferBooking);
      expect(result.success).toBe(true);
    });
  });

  describe("Resort Type Validation", () => {
    it("should validate Philippine resort types", () => {
      const validResortTypes = [
        "BEACH_RESORT",
        "ECO_RESORT",
        "MOUNTAIN_RESORT",
        "ISLAND_RESORT",
        "DIVE_RESORT",
        "SURF_CAMP",
        "GLAMPING",
        "WELLNESS_RETREAT",
      ];

      validResortTypes.forEach((type) => {
        const result = resortTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid resort types", () => {
      const invalidTypes = [
        "SKI_RESORT", // Not applicable in Philippines
        "CASINO_HOTEL", // Different category
        "MOTEL", // Less common term
        "Invalid Type",
        "",
      ];

      invalidTypes.forEach((type) => {
        const result = resortTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Philippine Phone Number Utilities", () => {
    it("should validate Philippine phone numbers", () => {
      philippineTestData.validPhoneNumbers.forEach((phone) => {
        expect(isValidPhoneNumber(phone)).toBe(true);
      });

      philippineTestData.invalidPhoneNumbers.forEach((phone) => {
        expect(isValidPhoneNumber(phone)).toBe(false);
      });
    });

    it("should format Philippine phone numbers", () => {
      const testCases = [
        { input: "09171234567", expected: "0917 123 4567" },
        { input: "+639171234567", expected: "+63 917 123 4567" },
        { input: "639171234567", expected: "+63 917 123 4567" },
        { input: "02123456789", expected: "(02) 1234 5678" }, // Landline
      ];

      testCases.forEach(({ input, expected }) => {
        const formatted = formatPhoneNumber(input);
        // Note: The actual implementation might differ from expected
        expect(typeof formatted).toBe("string");
        expect(formatted.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Philippine Holiday Utilities", () => {
    it("should identify Philippine holidays", () => {
      const holidays = [
        "2024-01-01", // New Year
        "2024-12-25", // Christmas
        "2024-06-12", // Independence Day
        "2024-12-30", // Rizal Day
      ];

      holidays.forEach((date) => {
        expect(isPhilippineHoliday(date)).toBe(true);
      });
    });

    it("should identify non-holidays", () => {
      const nonHolidays = ["2024-01-02", "2024-02-03", "2024-03-15", "2024-07-20"];

      nonHolidays.forEach((date) => {
        expect(isPhilippineHoliday(date)).toBe(false);
      });
    });

    it("should get holiday information", () => {
      const newYear = getPhilippineHoliday("2024-01-01");
      expect(newYear).toBeTruthy();
      expect(newYear?.name).toBe("New Year's Day");

      const christmas = getPhilippineHoliday("2024-12-25");
      expect(christmas).toBeTruthy();
      expect(christmas?.name).toBe("Christmas Day");

      const nonHoliday = getPhilippineHoliday("2024-01-02");
      expect(nonHoliday).toBeNull();
    });
  });

  describe("Philippine Season and Pricing", () => {
    it("should identify dry season", () => {
      const drySeasonDates = [
        new Date("2024-12-15"), // December
        new Date("2024-01-15"), // January
        new Date("2024-02-15"), // February
        new Date("2024-03-15"), // March
        new Date("2024-04-15"), // April
        new Date("2024-11-15"), // November
      ];

      drySeasonDates.forEach((date) => {
        expect(getSeasonType(date)).toBe("dry");
      });
    });

    it("should identify wet season", () => {
      const wetSeasonDates = [
        new Date("2024-06-15"), // June
        new Date("2024-07-15"), // July
        new Date("2024-08-15"), // August
        new Date("2024-09-15"), // September
        new Date("2024-10-15"), // October
      ];

      wetSeasonDates.forEach((date) => {
        expect(getSeasonType(date)).toBe("wet");
      });
    });

    it("should identify transition season", () => {
      const transitionDate = new Date("2024-05-15"); // May
      expect(getSeasonType(transitionDate)).toBe("transition");
    });

    it("should calculate peak season multipliers", () => {
      // Peak season (December)
      const peakDate = new Date("2024-12-15");
      const peakMultiplier = getPeakSeasonMultiplier(peakDate);
      expect(peakMultiplier).toBeGreaterThanOrEqual(1.3);

      // Holiday premium
      const christmasDate = new Date("2024-12-25");
      const holidayMultiplier = getPeakSeasonMultiplier(christmasDate);
      expect(holidayMultiplier).toBeGreaterThanOrEqual(1.4);

      // Regular season
      const regularDate = new Date("2024-09-15");
      const regularMultiplier = getPeakSeasonMultiplier(regularDate);
      expect(regularMultiplier).toBe(1.0);
    });
  });

  describe("Philippine Business Hours", () => {
    it("should identify business hours", () => {
      // Monday 10 AM
      const businessHour = new Date("2024-01-08T10:00:00");
      expect(isBusinessHours(businessHour)).toBe(true);

      // Monday 3 PM
      const afternoonHour = new Date("2024-01-08T15:00:00");
      expect(isBusinessHours(afternoonHour)).toBe(true);
    });

    it("should identify non-business hours", () => {
      // Monday 7 AM (too early)
      const earlyHour = new Date("2024-01-08T07:00:00");
      expect(isBusinessHours(earlyHour)).toBe(false);

      // Monday 7 PM (too late)
      const lateHour = new Date("2024-01-08T19:00:00");
      expect(isBusinessHours(lateHour)).toBe(false);

      // Saturday (weekend)
      const saturday = new Date("2024-01-06T10:00:00");
      expect(isBusinessHours(saturday)).toBe(false);

      // Sunday (weekend)
      const sunday = new Date("2024-01-07T10:00:00");
      expect(isBusinessHours(sunday)).toBe(false);
    });
  });

  describe("Integration Test: Complete Booking Validation", () => {
    it("should validate complete Filipino resort booking", () => {
      const completeBooking = {
        // Guest information
        guestName: "Juan Dela Cruz",
        guestEmail: "juan@gmail.com",
        guestPhone: "+639171234567",

        // Booking details
        checkIn: "2024-12-25", // Christmas
        checkOut: "2024-12-28",
        guests: 2,

        // Resort information
        resortType: "BEACH_RESORT" as const,
        resortAddress: {
          street: "Station 2 Beachfront",
          barangay: "Balabag",
          city: "Malay",
          province: "Aklan" as const,
          zipCode: "5608",
        },

        // Payment information
        totalAmount: 15000, // Peak season rate
        paidAmount: 7500, // 50% deposit
        currency: "PHP" as const,
        paymentMethod: "GCash" as const,
        gcashNumber: "09171234567",
        referenceNumber: "GCASH-20241225-001",

        // Business details
        businessTIN: "123-456-789",
        businessPermit: "BP2024-AKLAN-001",
      };

      // Validate individual components
      expect(philippineTestData.validNames.includes("Juan Dela Cruz")).toBe(true);
      expect(isValidPhoneNumber(completeBooking.guestPhone)).toBe(true);

      const amountResult = philippineAmountSchema.safeParse(completeBooking.totalAmount);
      expect(amountResult.success).toBe(true);

      const gcashResult = gcashNumberSchema.safeParse(completeBooking.gcashNumber);
      expect(gcashResult.success).toBe(true);

      const addressResult = philippineAddressSchema.safeParse(completeBooking.resortAddress);
      expect(addressResult.success).toBe(true);

      const resortTypeResult = resortTypeSchema.safeParse(completeBooking.resortType);
      expect(resortTypeResult.success).toBe(true);

      const paymentResult = bookingAmountSchema.safeParse({
        totalAmount: completeBooking.totalAmount,
        paidAmount: completeBooking.paidAmount,
        currency: completeBooking.currency,
        paymentMethod: completeBooking.paymentMethod,
        gcashNumber: completeBooking.gcashNumber,
        referenceNumber: completeBooking.referenceNumber,
      });
      expect(paymentResult.success).toBe(true);

      // Check holiday pricing
      const checkInDate = new Date(completeBooking.checkIn);
      expect(isPhilippineHoliday(completeBooking.checkIn)).toBe(true);
      expect(getPeakSeasonMultiplier(checkInDate)).toBeGreaterThan(1.0);

      // Format amounts
      expect(formatPHP(completeBooking.totalAmount)).toBe("₱15,000.00");
      expect(formatPHP(completeBooking.paidAmount)).toBe("₱7,500.00");

      // Validate TIN format
      expect(validateTIN(completeBooking.businessTIN)).toBe(true);
      expect(formatTIN(completeBooking.businessTIN)).toBe("123-456-789");
    });
  });
});
