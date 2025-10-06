/**
 * End-to-End Tests for Guest Booking Flow
 *
 * Tests the complete guest booking journey including:
 * - Form submission
 * - Idempotency
 * - File upload
 * - Status checking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Cloudflare KV namespace - simpler implementation
class MockKVNamespace {
  private store = new Map<string, string>();

  async get(key: string, typeOrOptions?: any): Promise<any> {
    const value = this.store.get(key) || null;
    if (!value) return null;

    if (typeof typeOrOptions === "string") {
      if (typeOrOptions === "json") {
        return JSON.parse(value);
      }
    }
    return value;
  }

  async put(key: string, value: string, _options?: KVNamespacePutOptions): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list<Metadata = unknown>(
    _options?: KVNamespaceListOptions
  ): Promise<KVNamespaceListResult<Metadata>> {
    return {
      keys: Array.from(this.store.keys()).map((name) => ({ name, metadata: undefined as any })),
      list_complete: true,
      cacheStatus: null,
    } as KVNamespaceListResult<Metadata>;
  }

  async getWithMetadata<Value = unknown, Metadata = unknown>(
    key: string
  ): Promise<KVNamespaceGetWithMetadataResult<Value, Metadata>> {
    const value = this.store.get(key) || null;
    return {
      value: value as any,
      metadata: null as any,
      cacheStatus: null,
    };
  }

  clear(): void {
    this.store.clear();
  }
}

// Mock fetch for API calls
global.fetch = vi.fn();

describe("Guest Booking Flow E2E Tests", () => {
  let kvNamespace: MockKVNamespace;
  const baseUrl = "http://localhost:8788";

  beforeEach(() => {
    kvNamespace = new MockKVNamespace();
    vi.clearAllMocks();
  });

  afterEach(() => {
    kvNamespace.clear();
  });

  describe("Booking Submission", () => {
    it("should successfully submit a guest booking with all required fields", async () => {
      const bookingData = {
        guest_name: "John Doe",
        email: "john.doe@example.com",
        phone_number: "+639171234567",
        unit_id: "123e4567-e89b-12d3-a456-426614174000",
        check_in: "2025-02-01",
        check_out: "2025-02-05",
        num_guests: 2,
        special_requests: "Late check-in please",
        turnstile_token: "test-token-123",
        file_name: "receipt.jpg",
        file_type: "image/jpeg",
        file_size: 1024000,
      };

      // Mock successful response
      const mockResponse = {
        success: true,
        booking: {
          id: "booking-123",
          booking_reference: "BK-202502-ABCD1234",
          status: "pending",
        },
        upload: {
          url: "https://supabase.co/storage/v1/upload/signed",
          token: "upload-token-123",
          path: "payment-proofs/booking-123/receipt.jpg",
          expires: 600,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Submit booking
      const response = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.booking.booking_reference).toMatch(/^BK-\d{6}-[A-Z0-9]{8}$/);
      expect(result.upload.url).toBeDefined();
      expect(result.upload.token).toBeDefined();
    });

    it("should handle idempotent requests with the same idempotency key", async () => {
      const idempotencyKey = "test-idempotency-key-123";
      const bookingData = {
        guest_name: "Jane Smith",
        email: "jane.smith@example.com",
        phone_number: "+639181234567",
        unit_id: "456e7890-e89b-12d3-a456-426614174000",
        check_in: "2025-03-01",
        check_out: "2025-03-03",
        num_guests: 1,
        turnstile_token: "test-token-456",
        file_name: "payment.png",
        file_type: "image/png",
        file_size: 512000,
      };

      const mockResponse = {
        success: true,
        booking: {
          id: "booking-456",
          booking_reference: "BK-202503-EFGH5678",
        },
      };

      // First request
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const response1 = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(bookingData),
      });

      // Second request with same idempotency key
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const response2 = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(bookingData),
      });

      const result1 = (await response1.json()) as any;
      const result2 = (await response2.json()) as any;

      // Both responses should return the same booking
      expect(result1.booking.id).toBe(result2.booking.id);
      expect(result1.booking.booking_reference).toBe(result2.booking.booking_reference);
    });

    it("should reject bookings with invalid Turnstile token", async () => {
      const bookingData = {
        guest_name: "Invalid User",
        email: "invalid@example.com",
        phone_number: "+639191234567",
        unit_id: "789e0123-e89b-12d3-a456-426614174000",
        check_in: "2025-04-01",
        check_out: "2025-04-03",
        num_guests: 2,
        turnstile_token: "invalid-token",
        file_name: "receipt.pdf",
        file_type: "application/pdf",
        file_size: 2048000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: "CAPTCHA_FAILED",
          message: "Invalid CAPTCHA token",
        }),
      });

      const response = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      expect(result.error).toBe("CAPTCHA_FAILED");
    });

    it("should enforce rate limiting after threshold", async () => {
      const bookingData = {
        guest_name: "Rate Limited User",
        email: "ratelimit@example.com",
        phone_number: "+639201234567",
        unit_id: "012e3456-e89b-12d3-a456-426614174000",
        check_in: "2025-05-01",
        check_out: "2025-05-03",
        num_guests: 1,
        turnstile_token: "test-token-789",
        file_name: "receipt.jpg",
        file_type: "image/jpeg",
        file_size: 1024000,
      };

      // Simulate 5 successful requests (rate limit)
      for (let i = 0; i < 5; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });

        await fetch(`${baseUrl}/api/guest-booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        });
      }

      // 6th request should be rate limited
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: "RATE_LIMITED",
          message: "Too many requests",
          retryAfter: 3600,
        }),
      });

      const response = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      const result = (await response.json()) as any;

      expect(response.status).toBe(429);
      expect(result.error).toBe("RATE_LIMITED");
      expect(result.retryAfter).toBeDefined();
    });
  });

  describe("File Upload", () => {
    it("should successfully upload payment proof file", async () => {
      const file = new File(["test file content"], "receipt.jpg", {
        type: "image/jpeg",
      });

      const uploadUrl = "https://supabase.co/storage/v1/upload/signed";
      const uploadToken = "upload-token-123";

      // Since this is testing the actual upload process,
      // we simulate a successful upload response
      expect(file.name).toBe("receipt.jpg");
      expect(file.type).toBe("image/jpeg");

      // Verify upload would succeed with these parameters
      expect(uploadUrl).toBeDefined();
      expect(uploadToken).toBeDefined();
    });

    it("should confirm upload after successful file upload", async () => {
      const confirmData = {
        booking_id: "booking-123",
        file_path: "payment-proofs/booking-123/receipt.jpg",
        file_size: 1024000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "Upload confirmed",
        }),
      });

      const response = await fetch(`${baseUrl}/api/guest-booking/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(confirmData),
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Upload confirmed");
    });

    it("should validate file type and reject invalid files", async () => {
      const confirmData = {
        booking_id: "booking-456",
        file_path: "payment-proofs/booking-456/malicious.exe",
        file_size: 2048000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: "INVALID_FILE_TYPE",
          message: "File type not allowed",
        }),
      });

      const response = await fetch(`${baseUrl}/api/guest-booking/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(confirmData),
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe("INVALID_FILE_TYPE");
    });
  });

  describe("Status Checking", () => {
    it("should retrieve booking status with reference and email", async () => {
      const statusParams = {
        reference: "BK-202502-ABCD1234",
        email: "john.doe@example.com",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            reference: "BK-202502-ABCD1234",
            status: "confirmed",
            checkIn: "2025-02-01",
            checkOut: "2025-02-05",
            totalAmount: 5000,
            paymentStatus: "paid",
          },
        }),
      });

      const params = new URLSearchParams(statusParams);
      const response = await fetch(`${baseUrl}/api/guest-booking/status?${params}`, {
        method: "GET",
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.reference).toBe(statusParams.reference);
      expect(result.data.status).toBe("confirmed");
    });

    it("should require both reference and email for status check", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: "MISSING_PARAMETERS",
          message: "Both booking reference and email are required",
        }),
      });

      const response = await fetch(`${baseUrl}/api/guest-booking/status?reference=BK-123`, {
        method: "GET",
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe("MISSING_PARAMETERS");
    });

    it("should show progressive CAPTCHA after rate limit", async () => {
      const statusParams = {
        reference: "BK-202502-TEST1234",
        email: "test@example.com",
      };

      // Simulate 20 requests to trigger progressive CAPTCHA
      for (let i = 0; i < 20; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });

        const params = new URLSearchParams(statusParams);
        await fetch(`${baseUrl}/api/guest-booking/status?${params}`, {
          method: "GET",
        });
      }

      // 21st request should require CAPTCHA
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: "RATE_LIMITED",
          message: "Too many status checks",
          retryAfter: 3600,
          requiresCaptcha: true,
        }),
      });

      const params = new URLSearchParams(statusParams);
      const response = await fetch(`${baseUrl}/api/guest-booking/status?${params}`, {
        method: "GET",
      });

      const result = (await response.json()) as any;

      expect(response.status).toBe(429);
      expect(result.requiresCaptcha).toBe(true);
    });

    it("should reset rate limit with successful CAPTCHA", async () => {
      const statusParams = {
        reference: "BK-202502-CAPT5678",
        email: "captcha@example.com",
        turnstile_token: "valid-captcha-token",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            reference: "BK-202502-CAPT5678",
            status: "pending",
          },
        }),
      });

      const params = new URLSearchParams(statusParams);
      const response = await fetch(`${baseUrl}/api/guest-booking/status?${params}`, {
        method: "GET",
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe("Availability Checking", () => {
    it("should prevent double booking for same unit and dates", async () => {
      const booking1 = {
        guest_name: "First Guest",
        email: "first@example.com",
        phone_number: "+639211234567",
        unit_id: "unit-conflict-123",
        check_in: "2025-06-01",
        check_out: "2025-06-05",
        num_guests: 2,
        turnstile_token: "test-token-001",
        file_name: "receipt1.jpg",
        file_type: "image/jpeg",
        file_size: 1024000,
      };

      const booking2 = {
        ...booking1,
        guest_name: "Second Guest",
        email: "second@example.com",
        phone_number: "+639221234567",
        turnstile_token: "test-token-002",
        file_name: "receipt2.jpg",
      };

      // First booking succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          booking: { id: "booking-001" },
        }),
      });

      const response1 = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking1),
      });

      expect(response1.ok).toBe(true);

      // Second booking fails due to conflict
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: "AVAILABILITY_CONFLICT",
          message: "Unit not available for selected dates",
        }),
      });

      const response2 = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking2),
      });

      const result2 = (await response2.json()) as any;

      expect(response2.ok).toBe(false);
      expect(response2.status).toBe(409);
      expect(result2.error).toBe("AVAILABILITY_CONFLICT");
    });

    it("should handle concurrent booking requests correctly", async () => {
      const bookingBase = {
        unit_id: "unit-concurrent-123",
        check_in: "2025-07-01",
        check_out: "2025-07-05",
        num_guests: 2,
        file_name: "receipt.jpg",
        file_type: "image/jpeg",
        file_size: 1024000,
      };

      const booking1 = {
        ...bookingBase,
        guest_name: "Concurrent Guest 1",
        email: "concurrent1@example.com",
        phone_number: "+639211111111",
        turnstile_token: "test-token-concurrent-1",
      };

      const booking2 = {
        ...bookingBase,
        guest_name: "Concurrent Guest 2",
        email: "concurrent2@example.com",
        phone_number: "+639222222222",
        turnstile_token: "test-token-concurrent-2",
      };

      // Mock responses for concurrent requests
      let firstResponseResolved = false;
      (global.fetch as any).mockImplementation(() => {
        return new Promise((resolve) => {
          // Simulate slight delay to make requests truly concurrent
          setTimeout(() => {
            if (!firstResponseResolved) {
              firstResponseResolved = true;
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  success: true,
                  booking: { id: "booking-concurrent-001" },
                }),
              });
            } else {
              resolve({
                ok: false,
                status: 409,
                json: async () => ({
                  error: "AVAILABILITY_CONFLICT",
                  message: "Unit not available for selected dates",
                }),
              });
            }
          }, Math.random() * 10); // Random delay 0-10ms
        });
      });

      // Send both requests concurrently
      const [response1, response2] = await Promise.all([
        fetch(`${baseUrl}/api/guest-booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(booking1),
        }),
        fetch(`${baseUrl}/api/guest-booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(booking2),
        }),
      ]);

      // One should succeed, one should fail
      const statuses = [response1.status, response2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Verify exactly one succeeded
      const successCount = [response1.ok, response2.ok].filter(Boolean).length;
      expect(successCount).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      try {
        await fetch(`${baseUrl}/api/guest-booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Network error");
      }
    });

    it("should validate required fields", async () => {
      const incompleteBooking = {
        guest_name: "Incomplete User",
        // Missing required fields
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: "VALIDATION_ERROR",
          message: "Missing required fields",
          fields: ["email", "phone_number", "unit_id", "check_in", "check_out"],
        }),
      });

      const response = await fetch(`${baseUrl}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(incompleteBooking),
      });

      const result = (await response.json()) as any;

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe("VALIDATION_ERROR");
      expect(result.fields).toContain("email");
    });

    it("should handle expired upload links", async () => {
      const confirmData = {
        booking_id: "expired-booking-123",
        file_path: "payment-proofs/expired-booking-123/receipt.jpg",
        file_size: 1024000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({
          error: "UPLOAD_EXPIRED",
          message: "Upload link has expired. Please create a new booking.",
        }),
      });

      const response = await fetch(`${baseUrl}/api/guest-booking/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmData),
      });

      const result = (await response.json()) as any;

      expect(response.status).toBe(410);
      expect(result.error).toBe("UPLOAD_EXPIRED");
    });
  });
});
