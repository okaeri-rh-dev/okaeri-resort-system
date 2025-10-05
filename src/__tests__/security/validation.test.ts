/**
 * Input Validation Security Tests
 */

import { describe, it, expect } from "vitest";
import {
  guestBookingSchema,
  guestInfoSchema,
  fileUploadSchema,
  statusCheckSchema,
  validateSearchQuery,
} from "@/lib/validation/guest-booking";
import { isDisposableEmail, validateEmailWithDisposableCheck } from "@/lib/disposable-emails";

describe("Input Validation Security", () => {
  describe("Email Validation", () => {
    it("should reject disposable email domains", () => {
      const disposableEmails = [
        "test@10minutemail.com",
        "user@guerrillamail.com",
        "temp@mailinator.com",
        "throwaway@yopmail.com",
      ];

      disposableEmails.forEach((email) => {
        expect(isDisposableEmail(email)).toBe(true);

        const result = validateEmailWithDisposableCheck(email);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("Disposable");
      });
    });

    it("should accept legitimate email domains", () => {
      const legitimateEmails = [
        "user@gmail.com",
        "admin@company.com",
        "test@outlook.com",
        "john@yahoo.com",
      ];

      legitimateEmails.forEach((email) => {
        expect(isDisposableEmail(email)).toBe(false);

        const result = validateEmailWithDisposableCheck(email);
        expect(result.valid).toBe(true);
      });
    });

    it("should reject emails with + signs", () => {
      const result = validateEmailWithDisposableCheck("user+test@gmail.com");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("+");
    });

    it("should detect additional disposable domains", () => {
      const knownDisposableEmails = [
        "test@tempmail.com",
        "user@trashmail.com",
        "temp@throwaway.email",
        "test@tmpmail.org",
      ];

      knownDisposableEmails.forEach((email) => {
        expect(isDisposableEmail(email)).toBe(true);
      });
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should sanitize SQL injection attempts in search queries", () => {
      const maliciousQueries = [
        "'; DROP TABLE bookings; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
        "1; DELETE FROM bookings WHERE 1=1",
      ];

      maliciousQueries.forEach((query) => {
        const sanitized = validateSearchQuery(query);
        expect(sanitized).not.toContain("DROP");
        expect(sanitized).not.toContain("DELETE");
        expect(sanitized).not.toContain("UNION");
        expect(sanitized).not.toContain("'");
        expect(sanitized).not.toContain(";");
        expect(sanitized).not.toContain("--");
      });
    });

    it("should handle nested SQL injection attempts", () => {
      const query = "SELECT * FROM (SELECT * FROM bookings)";
      const sanitized = validateSearchQuery(query);

      expect(sanitized).not.toContain("SELECT");
      expect(sanitized).toBe("* FROM ( * FROM bookings)");
    });
  });

  describe("XSS Prevention", () => {
    it("should sanitize HTML/JavaScript in guest name", () => {
      const maliciousInputs = [
        "<script>alert('XSS')</script>John",
        "John<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<iframe src='evil.com'></iframe>",
        "onclick='stealCookies()'",
      ];

      maliciousInputs.forEach((input) => {
        const result = guestInfoSchema.shape.first_name.safeParse(input);

        if (result.success) {
          expect(result.data).not.toContain("<script>");
          expect(result.data).not.toContain("javascript:");
          expect(result.data).not.toContain("onclick");
          expect(result.data).not.toContain("<iframe>");
          expect(result.data).not.toContain("onerror");
        }
      });
    });

    it("should preserve legitimate special characters in names", () => {
      const legitimateNames = ["O'Connor", "Jean-Pierre", "María José", "Müller"];

      legitimateNames.forEach((name) => {
        const result = guestInfoSchema.shape.first_name.safeParse(name);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Phone Number Validation", () => {
    it("should accept Philippine phone numbers", () => {
      const validPhoneNumbers = [
        "+639123456789",
        "09123456789",
        "639123456789",
        "+63 912 345 6789",
        "0912-345-6789",
      ];

      validPhoneNumbers.forEach((phone) => {
        const result = guestInfoSchema.shape.phone.safeParse(phone);
        expect(result.success).toBe(true);
      });
    });

    it("should accept international phone numbers", () => {
      const internationalNumbers = [
        "+14155552671", // US
        "+442071838750", // UK
        "+81312345678", // Japan
        "+861012345678", // China
      ];

      internationalNumbers.forEach((phone) => {
        const result = guestInfoSchema.shape.phone.safeParse(phone);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid phone numbers", () => {
      const invalidPhoneNumbers = [
        "123", // Too short
        "abcdefghijk", // Letters
        "+00000000000", // Invalid country code
        "911", // Emergency number
      ];

      invalidPhoneNumbers.forEach((phone) => {
        const result = guestInfoSchema.shape.phone.safeParse(phone);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Booking Reference Validation", () => {
    it("should validate booking reference format", () => {
      const validReferences = ["BK-2024-ABC123", "BK-2025-XYZ789", "BK-9999-000AAA"];

      validReferences.forEach((ref) => {
        const result = statusCheckSchema.shape.booking_reference.safeParse(ref);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid booking references", () => {
      const invalidReferences = [
        "BK-24-ABC123", // Wrong year format
        "BK-2024-abc123", // Lowercase
        "XX-2024-ABC123", // Wrong prefix
        "BK-2024-TOOLONG", // Too many characters
        "'; DROP TABLE bookings; --", // SQL injection
      ];

      invalidReferences.forEach((ref) => {
        const result = statusCheckSchema.shape.booking_reference.safeParse(ref);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("File Upload Validation", () => {
    it("should validate file names for path traversal", () => {
      const dangerousFileNames = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32\\config",
        "file/../../../etc/shadow",
        "/etc/passwd",
        "C:\\Windows\\System32\\config.sys",
      ];

      dangerousFileNames.forEach((fileName) => {
        const result = fileUploadSchema.shape.file_name.safeParse(fileName);
        expect(result.success).toBe(false);
      });
    });

    it("should accept valid file names", () => {
      const validFileNames = [
        "receipt.jpg",
        "payment-proof-2024.pdf",
        "GCash_Screenshot_123.png",
        "bank_transfer.jpeg",
      ];

      validFileNames.forEach((fileName) => {
        const result = fileUploadSchema.shape.file_name.safeParse(fileName);
        expect(result.success).toBe(true);
      });
    });

    it("should enforce file type restrictions", () => {
      const invalidTypes = [
        "application/x-executable",
        "text/javascript",
        "application/x-sh",
        "application/octet-stream",
      ];

      invalidTypes.forEach((type) => {
        const result = fileUploadSchema.shape.file_type.safeParse(type);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Date Validation", () => {
    it("should prevent dates too far in the future", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 3); // 3 years future

      const result = guestBookingSchema.safeParse({
        guest_name: "John Doe",
        email: "john@example.com",
        phone_number: "+639123456789",
        unit_id: "550e8400-e29b-41d4-a716-446655440000",
        check_in: futureDate.toISOString(),
        check_out: new Date(futureDate.getTime() + 86400000).toISOString(),
        num_guests: 2,
        turnstile_token: "token",
        file_name: "receipt.jpg",
        file_type: "image/jpeg",
        file_size: 100000,
      });

      expect(result.success).toBe(false);
    });

    it("should enforce maximum booking duration", () => {
      const checkIn = new Date();
      const checkOut = new Date();
      checkOut.setDate(checkOut.getDate() + 35); // 35 days (exceeds 30 day max)

      const result = guestBookingSchema.safeParse({
        guest_name: "John Doe",
        email: "john@example.com",
        phone_number: "+639123456789",
        unit_id: "550e8400-e29b-41d4-a716-446655440000",
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        num_guests: 2,
        turnstile_token: "token",
        file_name: "receipt.jpg",
        file_type: "image/jpeg",
        file_size: 100000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("30 nights");
    });
  });
});
