import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/supabase";

import { calculateBookingPrice, getSeasonalMultiplier } from "../pricing-with-db";

// Mock the database client
// Note: mockPricingConfigGet is defined inside the factory to avoid Vitest hoisting issues
vi.mock("@/lib/supabase", () => ({
  db: {
    seasonalRates: {
      forDate: vi.fn(),
    },
    pricingConfig: {
      get: vi.fn().mockResolvedValue({
        data: {
          id: "default",
          base_rate: 3000,
          weekend_rate: 3500,
          extra_person_rate: 500,
          base_occupancy: 2,
          downpayment_percent: 50, // Changed from downpayment_percentage to match code
          currency: "PHP", // Added missing currency field
        },
        error: null,
      }),
    },
  },
}));

describe("calculateBookingPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup pricing config mock after clearing
    vi.mocked(db.pricingConfig.get).mockResolvedValue({
      data: {
        id: "default",
        base_rate: 3000,
        weekend_rate: 3500,
        extra_person_rate: 500,
        base_occupancy: 2,
        downpayment_percent: 50, // Changed to match code expectation (50%)
        currency: "PHP", // Added currency field
      },
      error: null,
    });
  });

  describe("Regular Season (No Seasonal Rates)", () => {
    beforeEach(() => {
      // Mock no seasonal rates
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue(null);
    });

    it("calculates basic weekday pricing correctly", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"), // Monday
        checkOut: new Date("2024-10-17"), // Thursday (3 nights)
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.nights).toBe(3);
      expect(result.subtotal).toBe(9000); // 3 weekday nights × ₱3,000
      expect(result.extraPersons).toBe(0);
      expect(result.extraPersonTotal).toBe(0);
      expect(result.total).toBe(9000);
      expect(result.downpayment).toBe(4500); // 50%
      expect(result.balance).toBe(4500);
    });

    it("calculates weekend pricing correctly", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-18"), // Friday
        checkOut: new Date("2024-10-21"), // Monday (3 nights: Fri, Sat, Sun)
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.nights).toBe(3);
      // Friday (weekday: 3000) + Saturday (weekend: 3500) + Sunday (weekend: 3500) = 10000
      // isWeekend() from date-fns treats Sat-Sun as weekend (standard definition)
      expect(result.subtotal).toBe(10000);
      expect(result.nightlyBreakdown).toHaveLength(3);
      expect(result.nightlyBreakdown[0].isWeekend).toBe(false); // Friday is weekday
      expect(result.nightlyBreakdown[1].isWeekend).toBe(true); // Saturday is weekend
      expect(result.nightlyBreakdown[2].isWeekend).toBe(true); // Sunday is weekend
    });

    it("calculates extra person fees correctly", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"),
        checkOut: new Date("2024-10-17"), // 3 nights
        guestCount: 5, // 3 extra persons beyond base occupancy of 2
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.extraPersons).toBe(3);
      expect(result.extraPersonTotal).toBe(4500); // 3 persons × ₱500 × 3 nights
      expect(result.total).toBe(13500); // 9000 base + 4500 extra
    });

    it("handles single night correctly", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"),
        checkOut: new Date("2024-10-15"), // 1 night
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.nights).toBe(1);
      expect(result.subtotal).toBe(3000);
      expect(result.total).toBe(3000);
    });
  });

  describe("Seasonal Rates Applied", () => {
    it("applies Christmas seasonal rate (2.0x multiplier)", async () => {
      // Mock Christmas seasonal rate
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue({
        id: "test-christmas-id",
        season_id: "christmas_new_year",
        name: "Christmas & New Year",
        start_date: "12-20",
        end_date: "01-02",
        multiplier: 2.0,
        priority: 20,
        is_active: true,
        description: "Holiday season premium pricing",
        color: "red",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await calculateBookingPrice({
        checkIn: new Date("2024-12-20"),
        checkOut: new Date("2024-12-23"), // 3 nights
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.nights).toBe(3);

      // All nights should have 2.0x multiplier
      result.nightlyBreakdown.forEach((night) => {
        expect(night.seasonalMultiplier).toBe(2.0);
        expect(night.seasonName).toBe("Christmas & New Year");
      });

      // Friday: 3500 × 2.0 = 7000
      // Saturday: 3500 × 2.0 = 7000
      // Sunday: 3000 × 2.0 = 6000
      expect(result.subtotal).toBe(20000);
      expect(result.total).toBe(20000);
    });

    it("applies low season discount (0.8x multiplier)", async () => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue({
        id: "test-low-season-id",
        season_id: "low_season",
        name: "Low Season (Rainy)",
        start_date: "06-01",
        end_date: "09-30",
        multiplier: 0.8,
        priority: 5,
        is_active: true,
        description: "Rainy season discount",
        color: "blue",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await calculateBookingPrice({
        checkIn: new Date("2024-07-15"),
        checkOut: new Date("2024-07-17"), // 2 nights
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      // Both nights should have 0.8x multiplier
      result.nightlyBreakdown.forEach((night) => {
        expect(night.seasonalMultiplier).toBe(0.8);
        expect(night.seasonName).toBe("Low Season (Rainy)");
      });

      // 2 weekday nights: 3000 × 0.8 × 2 = 4800
      expect(result.subtotal).toBe(4800);
    });

    it("applies peak summer rate (1.5x multiplier)", async () => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue({
        id: "test-peak-summer-id",
        season_id: "peak_summer",
        name: "Peak Summer Season",
        start_date: "03-01",
        end_date: "05-31",
        multiplier: 1.5,
        priority: 10,
        is_active: true,
        description: "Philippine summer vacation season",
        color: "orange",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await calculateBookingPrice({
        checkIn: new Date("2024-04-01"),
        checkOut: new Date("2024-04-03"), // 2 nights
        guestCount: 4, // 2 extra persons
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      // 2 weekday nights: 3000 × 1.5 × 2 = 9000
      expect(result.subtotal).toBe(9000);

      // Extra persons: 2 × 500 × 2 nights = 2000
      expect(result.extraPersonTotal).toBe(2000);

      // Total: 9000 + 2000 = 11000
      expect(result.total).toBe(11000);
    });

    it("calculates extra persons correctly with seasonal rates", async () => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue({
        id: "test-christmas-extra-persons-id",
        season_id: "christmas_new_year",
        name: "Christmas & New Year",
        start_date: "12-20",
        end_date: "01-02",
        multiplier: 2.0,
        priority: 20,
        is_active: true,
        description: null,
        color: "red",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await calculateBookingPrice({
        checkIn: new Date("2024-12-20"),
        checkOut: new Date("2024-12-23"), // 3 nights
        guestCount: 6, // 4 extra persons
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.extraPersons).toBe(4);
      // Extra person fees are NOT affected by seasonal multiplier
      expect(result.extraPersonTotal).toBe(6000); // 4 × 500 × 3 nights
      expect(result.total).toBe(26000); // 20000 (seasonal) + 6000 (extra)
    });
  });

  describe("Nightly Breakdown", () => {
    it("provides detailed nightly breakdown", async () => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue(null);

      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-18"), // Friday
        checkOut: new Date("2024-10-20"), // Sunday (2 nights)
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.nightlyBreakdown).toHaveLength(2);

      // Friday (weekday in date-fns isWeekend())
      expect(result.nightlyBreakdown[0].date).toBe("2024-10-18");
      expect(result.nightlyBreakdown[0].isWeekend).toBe(false); // Friday is weekday
      expect(result.nightlyBreakdown[0].baseRate).toBe(3000); // Weekday rate
      expect(result.nightlyBreakdown[0].seasonalMultiplier).toBe(1.0);
      expect(result.nightlyBreakdown[0].finalRate).toBe(3000); // Weekday rate
      expect(result.nightlyBreakdown[0].seasonName).toBeNull();

      // Saturday (weekend in date-fns isWeekend())
      expect(result.nightlyBreakdown[1].date).toBe("2024-10-19");
      expect(result.nightlyBreakdown[1].isWeekend).toBe(true);
      expect(result.nightlyBreakdown[1].baseRate).toBe(3500); // Weekend rate
    });

    it("includes season names in breakdown when applicable", async () => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue({
        id: "test-peak-summer-breakdown-id",
        season_id: "peak_summer",
        name: "Peak Summer Season",
        start_date: "03-01",
        end_date: "05-31",
        multiplier: 1.5,
        priority: 10,
        is_active: true,
        description: null,
        color: "orange",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await calculateBookingPrice({
        checkIn: new Date("2024-04-01"),
        checkOut: new Date("2024-04-03"),
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      result.nightlyBreakdown.forEach((night) => {
        expect(night.seasonName).toBe("Peak Summer Season");
      });
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue(null);
    });

    it("handles zero extra persons", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"),
        checkOut: new Date("2024-10-15"),
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.extraPersons).toBe(0);
      expect(result.extraPersonTotal).toBe(0);
    });

    it("handles guests below base occupancy", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"),
        checkOut: new Date("2024-10-15"),
        guestCount: 1, // Below base occupancy of 2
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.extraPersons).toBe(0);
      expect(result.extraPersonTotal).toBe(0);
      expect(result.total).toBe(3000); // No discount for fewer guests
    });

    it("calculates 50% downpayment by default", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"),
        checkOut: new Date("2024-10-17"),
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.downpayment).toBe(result.total * 0.5);
      expect(result.balance).toBe(result.total - result.downpayment);
    });

    it("returns PHP as currency", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"),
        checkOut: new Date("2024-10-15"),
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.currency).toBe("PHP");
    });

    it("handles long stay (7+ nights)", async () => {
      const result = await calculateBookingPrice({
        checkIn: new Date("2024-10-14"),
        checkOut: new Date("2024-10-21"), // 7 nights
        guestCount: 2,
        baseRate: 3000,
        weekendRate: 3500,
        extraPersonRate: 500,
        baseOccupancy: 2,
      });

      expect(result.nights).toBe(7);
      expect(result.nightlyBreakdown).toHaveLength(7);
      // 5 weekdays × 3000 + 2 weekends × 3500 = 15000 + 7000 = 22000
      expect(result.subtotal).toBe(22000);
    });
  });

  describe("getSeasonalMultiplier", () => {
    it("returns 1.0 when no seasonal rate exists", async () => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue(null);

      const multiplier = await getSeasonalMultiplier(new Date("2024-10-15"));

      expect(multiplier).toBe(1.0);
    });

    it("returns correct multiplier when seasonal rate exists", async () => {
      vi.mocked(db.seasonalRates.forDate).mockResolvedValue({
        id: "test-christmas-multiplier-id",
        season_id: "christmas_new_year",
        name: "Christmas & New Year",
        start_date: "12-20",
        end_date: "01-02",
        multiplier: 2.0,
        priority: 20,
        is_active: true,
        description: null,
        color: "red",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const multiplier = await getSeasonalMultiplier(new Date("2024-12-25"));

      expect(multiplier).toBe(2.0);
    });

    it("returns 1.0 when database query fails", async () => {
      vi.mocked(db.seasonalRates.forDate).mockRejectedValue(
        new Error("Database connection failed")
      );

      const multiplier = await getSeasonalMultiplier(new Date("2024-12-25"));

      expect(multiplier).toBe(1.0);
    });
  });
});
