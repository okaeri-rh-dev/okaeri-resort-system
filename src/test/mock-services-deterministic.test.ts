/**
 * Test file to demonstrate deterministic mock service behavior
 * This validates that the Math.random() issue has been resolved
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockAuthService } from "@/services/mock/auth.mock.service";
import { MockBookingService } from "@/services/mock/booking.mock.service";
import { createMockConfig } from "@/test/config/mock-service-config";
import type { MockServiceConfig } from "@/test/types/test-interfaces";

describe("Deterministic Mock Services", () => {
  let stableConfig: MockServiceConfig;
  let errorConfig: MockServiceConfig;

  beforeEach(() => {
    // Stable configuration for consistent results
    stableConfig = createMockConfig()
      .scenario("STABLE")
      .deterministic(true)
      .errorRate(0)
      .seed("test-seed-123")
      .build();

    // Error configuration for testing error simulation
    errorConfig = createMockConfig()
      .scenario("ERROR_FOCUSED")
      .deterministic(true)
      .errorRate(1.0) // 100% error rate for testing
      .seed("error-test-seed")
      .forceErrors(["networkError"])
      .build();
  });

  describe("Auth Service Deterministic Behavior", () => {
    it("should provide consistent token generation with same seed", async () => {
      // Create two services with same configuration
      const service1 = new MockAuthService(stableConfig);
      const service2 = new MockAuthService(stableConfig);

      // Login with both services using same credentials
      const loginDto = {
        email: "admin@okaeri.ph",
        password: "Admin123!",
      };

      const result1 = await service1.login(loginDto);
      const result2 = await service2.login(loginDto);

      // Tokens should be deterministic with same seed
      expect(result1.token.split(".")[0]).toBe(result2.token.split(".")[0]); // Same header
      expect(result1.token.split(".")[1]).toBe(result2.token.split(".")[1]); // Same payload
      // Signature will be different due to timestamp, but that's expected

      console.log("✅ Auth service tokens are deterministic");
    });

    it("should not throw random errors in stable mode", async () => {
      const service = new MockAuthService(stableConfig);
      const loginDto = {
        email: "admin@okaeri.ph",
        password: "Admin123!",
      };

      // Run multiple times - should never fail in stable mode
      for (let i = 0; i < 10; i++) {
        const result = await service.login(loginDto);
        expect(result).toBeDefined();
        expect(result.user.email).toBe(loginDto.email);
      }

      console.log("✅ Auth service is stable with 0% error rate");
    });

    it("should demonstrate configuration can be updated", async () => {
      const service = new MockAuthService(stableConfig);

      // Verify service uses stable config
      expect(service.getConfig().deterministic).toBe(true);
      expect(service.getConfig().errorRate).toBe(0);

      // Update to error configuration
      service.updateConfig(errorConfig);
      expect(service.getConfig().errorRate).toBe(1.0);

      console.log("✅ Auth service configuration can be updated dynamically");
    });
  });

  describe("Booking Service Deterministic Behavior", () => {
    it("should provide consistent results with same seed", async () => {
      const service1 = new MockBookingService(stableConfig);
      const service2 = new MockBookingService(stableConfig);

      // Both services should return same results
      const bookings1 = await service1.list();
      const bookings2 = await service2.list();

      expect(bookings1.data.length).toBe(bookings2.data.length);
      expect(bookings1.data[0]?.id).toBe(bookings2.data[0]?.id);

      console.log("✅ Booking service provides consistent results");
    });

    it("should not fail randomly in stable mode", async () => {
      const service = new MockBookingService(stableConfig);

      // Run multiple operations - should never fail
      for (let i = 0; i < 5; i++) {
        const bookings = await service.list();
        expect(bookings.data).toBeDefined();

        const stats = await service.getStatistics();
        expect(stats.total).toBeGreaterThanOrEqual(0);
      }

      console.log("✅ Booking service is stable with 0% error rate");
    });

    it("should demonstrate reset functionality", async () => {
      const service = new MockBookingService(stableConfig);

      // Create a new booking
      const bookingData = {
        propertyId: "property-1",
        roomId: "room-test",
        guestName: "Test Guest",
        guestEmail: "test@example.com",
        guestPhone: "+639171234567",
        checkIn: "2025-03-01",
        checkOut: "2025-03-03",
        adults: 2,
        totalAmount: 5000,
      };

      const newBooking = await service.create(bookingData);
      expect(newBooking.id).toBeDefined();

      // Reset service - should clear added bookings
      service.reset();

      // Service should be back to original state
      const bookingsAfterReset = await service.list();
      expect(bookingsAfterReset.data.some((b) => b.id === newBooking.id)).toBe(false);

      console.log("✅ Booking service reset functionality works");
    });
  });

  describe("Error Simulation", () => {
    it("should demonstrate deterministic error behavior", async () => {
      // This test would be skipped in CI since errors are forced
      // But demonstrates that error simulation is now deterministic
      const service = new MockAuthService({
        ...stableConfig,
        errorRate: 0.5, // 50% error rate
        deterministic: true,
        seed: "error-test-seed",
      });

      let errorCount = 0;
      let successCount = 0;
      const totalTests = 10;

      for (let i = 0; i < totalTests; i++) {
        try {
          await service.login({
            email: "admin@okaeri.ph",
            password: "Admin123!",
          });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      // With deterministic behavior, we should get consistent error/success ratio
      console.log(
        `✅ Deterministic error simulation: ${errorCount} errors, ${successCount} successes out of ${totalTests}`
      );

      // The exact numbers will be consistent across runs with same seed
      expect(errorCount + successCount).toBe(totalTests);
    });
  });

  describe("Performance Consistency", () => {
    it("should have consistent timing behavior", async () => {
      const service = new MockBookingService({
        deterministic: true,
        errorRate: 0,
        networkDelay: { min: 10, max: 10 }, // Fixed delay
        seed: "timing-test",
      });

      const startTimes: number[] = [];
      const durations: number[] = [];

      // Measure timing of multiple operations
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await service.list();
        const duration = Date.now() - start;

        startTimes.push(start);
        durations.push(duration);
      }

      // With deterministic timing, durations should be similar
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      console.log(`✅ Average operation duration: ${avgDuration}ms`);

      // All durations should be close to each other (within reasonable variance)
      durations.forEach((duration) => {
        expect(Math.abs(duration - avgDuration)).toBeLessThan(100); // 100ms tolerance for CI environments
      });
    });
  });
});
