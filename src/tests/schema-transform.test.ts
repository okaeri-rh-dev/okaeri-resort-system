import { describe, it, expect } from "vitest";
import {
  transformToAPIFormat,
  validateAPIResponse,
  validateStatusResponse,
  type GuestBookingFormData,
} from "@/lib/schema-transform";

describe("Schema Transformation Utilities", () => {
  describe("transformToAPIFormat", () => {
    it("should transform Date objects to ISO strings", () => {
      const formData: GuestBookingFormData = {
        guest_name: "John Doe",
        email: "john@example.com",
        phone_number: "+639123456789",
        unit_id: "123e4567-e89b-12d3-a456-426614174000",
        check_in: new Date("2025-02-15T14:00:00+08:00"), // Asia/Manila
        check_out: new Date("2025-02-18T12:00:00+08:00"),
        num_guests: 2,
        special_requests: "Late check-in",
        payment_proof: new File(["content"], "receipt.jpg", { type: "image/jpeg" }),
      };

      const transformed = transformToAPIFormat(formData);

      expect(typeof transformed.check_in).toBe("string");
      expect(typeof transformed.check_out).toBe("string");
      expect(transformed.check_in as string).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(transformed.check_out as string).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it("should extract file metadata without File object", () => {
      const file = new File(["content"], "receipt.jpg", { type: "image/jpeg" });
      const formData: GuestBookingFormData = {
        guest_name: "Jane Doe",
        email: "jane@example.com",
        phone_number: "+639123456789",
        unit_id: "123e4567-e89b-12d3-a456-426614174000",
        check_in: new Date(),
        check_out: new Date(),
        num_guests: 1,
        payment_proof: file,
      };

      const transformed = transformToAPIFormat(formData);

      expect(transformed.file_name).toBe("receipt.jpg");
      expect(transformed.file_type).toBe("image/jpeg");
      expect(transformed.file_size).toBeGreaterThan(0);
      expect(transformed.payment_proof).toBeUndefined(); // File object not sent
    });

    it("should preserve guest information correctly", () => {
      const formData: GuestBookingFormData = {
        guest_name: "Test User",
        email: "test@example.com",
        phone_number: "+1234567890",
        unit_id: "123e4567-e89b-12d3-a456-426614174000",
        check_in: new Date(),
        check_out: new Date(),
        num_guests: 3,
        special_requests: "No smoking room",
        payment_proof: new File([""], "test.pdf", { type: "application/pdf" }),
      };

      const transformed = transformToAPIFormat(formData);

      expect(transformed.guest_name).toBe("Test User");
      expect(transformed.email).toBe("test@example.com");
      expect(transformed.phone_number).toBe("+1234567890");
      expect(transformed.num_guests).toBe(3);
      expect(transformed.special_requests).toBe("No smoking room");
    });

    it("should handle optional fields", () => {
      const formData: GuestBookingFormData = {
        guest_name: "Basic User",
        email: "basic@example.com",
        phone_number: "1234567890",
        unit_id: "123e4567-e89b-12d3-a456-426614174000",
        check_in: new Date(),
        check_out: new Date(),
        num_guests: 1,
        payment_proof: new File([""], "receipt.png", { type: "image/png" }),
      };

      const transformed = transformToAPIFormat(formData);

      expect(transformed.special_requests).toBeUndefined();
    });
  });

  describe("validateAPIResponse", () => {
    it("should validate correct API response", () => {
      const response = {
        success: true,
        booking: {
          booking_id: "123e4567-e89b-12d3-a456-426614174000",
          booking_reference: "BK-2025-ABCD",
          total_amount: 5000,
        },
        upload: {
          path: "payment-proofs/guest-bookings/123/file.jpg",
          token: "upload-token-123",
          bucket: "payment-proofs",
          expires_at: "2025-01-15T10:00:00.000Z",
        },
      };

      const validated = validateAPIResponse(response);

      expect(validated.success).toBe(true);
      expect(validated.booking.booking_reference).toBe("BK-2025-ABCD");
      expect(validated.upload.token).toBe("upload-token-123");
    });

    it("should throw error for invalid response", () => {
      const invalidResponse = {
        success: true,
        booking: {
          // Missing required fields
          booking_reference: "BK-2025-ABCD",
        },
        upload: {
          path: "payment-proofs/guest-bookings/123/file.jpg",
        },
      };

      expect(() => validateAPIResponse(invalidResponse)).toThrow();
    });

    it("should handle optional message field", () => {
      const response = {
        success: true,
        booking: {
          booking_id: "123e4567-e89b-12d3-a456-426614174000",
          booking_reference: "BK-2025-ABCD",
          total_amount: 5000,
        },
        upload: {
          path: "payment-proofs/guest-bookings/123/file.jpg",
          token: "upload-token-123",
          bucket: "payment-proofs",
          expires_at: "2025-01-15T10:00:00.000Z",
        },
        message: "Booking created successfully",
      };

      const validated = validateAPIResponse(response);

      expect(validated.message).toBe("Booking created successfully");
    });
  });

  describe("validateStatusResponse", () => {
    it("should validate correct status response", () => {
      const response = {
        booking_id: "123e4567-e89b-12d3-a456-426614174000",
        booking_reference: "BK-2025-ABCD",
        booking_status: "Confirmed",
        payment_status: "Completed",
        check_in: "2025-02-15T06:00:00.000Z",
        check_out: "2025-02-18T04:00:00.000Z",
        total_amount: 5000,
        unit: {
          unit_name: "Deluxe Room 101",
          unit_type: "Deluxe",
        },
      };

      const validated = validateStatusResponse(response);

      expect(validated.booking_reference).toBe("BK-2025-ABCD");
      expect(validated.booking_status).toBe("Confirmed");
      expect(validated.unit.unit_name).toBe("Deluxe Room 101");
    });

    it("should throw error for missing fields", () => {
      const invalidResponse = {
        booking_reference: "BK-2025-ABCD",
        // Missing other required fields
      };

      expect(() => validateStatusResponse(invalidResponse)).toThrow();
    });
  });
});
