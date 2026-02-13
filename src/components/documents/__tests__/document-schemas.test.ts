/**
 * Unit Tests for Document Validation Schemas
 *
 * Tests cover:
 * - Recipient schema validation
 * - Line item schema validation
 * - Document form schema validation
 * - XSS sanitization transforms
 * - Edge cases and boundary conditions
 */

import { describe, expect, it, vi } from "vitest";

import {
  documentFormSchema,
  lineItemSchema,
  recipientSchema,
} from "@/lib/validation/document-schemas";

// Mock DOMPurify sanitizeText used inside the schemas
vi.mock("@/lib/security/sanitize", () => ({
  sanitizeText: (val: string) => {
    if (!val) return "";
    // Simple mock: strip script tags
    return val.replace(/<script[^>]*>.*?<\/script>/gis, "").trim();
  },
}));

describe("Document Validation Schemas", () => {
  // ============================================
  // RECIPIENT SCHEMA
  // ============================================

  describe("recipientSchema", () => {
    it("should validate a valid recipient", () => {
      const result = recipientSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        phone: "0917 123 4567",
        address: "Manila, Philippines",
      });

      expect(result.success).toBe(true);
    });

    it("should require a name", () => {
      const result = recipientSchema.safeParse({
        name: "",
        email: "john@example.com",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("name");
      }
    });

    it("should accept empty optional fields", () => {
      const result = recipientSchema.safeParse({
        name: "Jane",
        email: "",
        phone: "",
        address: "",
        company_name: "",
        tin: "",
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = recipientSchema.safeParse({
        name: "Test",
        email: "not-an-email",
      });

      expect(result.success).toBe(false);
    });

    it("should sanitize name with XSS payload", () => {
      const result = recipientSchema.safeParse({
        name: '<script>alert("XSS")</script>John',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).not.toContain("<script>");
        expect(result.data.name).toContain("John");
      }
    });

    it("should reject name exceeding max length", () => {
      const result = recipientSchema.safeParse({
        name: "A".repeat(201),
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // LINE ITEM SCHEMA
  // ============================================

  describe("lineItemSchema", () => {
    const validItem = {
      id: "test-id",
      type: "accommodation" as const,
      description: "Cabin A",
      quantity: 2,
      unit_label: "night",
      unit_price: 5000,
      amount: 10000,
    };

    it("should validate a valid line item", () => {
      const result = lineItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("should require description", () => {
      const result = lineItemSchema.safeParse({
        ...validItem,
        description: "",
      });

      expect(result.success).toBe(false);
    });

    it("should require quantity > 0", () => {
      const result = lineItemSchema.safeParse({
        ...validItem,
        quantity: 0,
      });

      expect(result.success).toBe(false);
    });

    it("should allow fractional quantities", () => {
      const result = lineItemSchema.safeParse({
        ...validItem,
        quantity: 0.5,
      });

      expect(result.success).toBe(true);
    });

    it("should reject negative unit price", () => {
      const result = lineItemSchema.safeParse({
        ...validItem,
        unit_price: -100,
      });

      expect(result.success).toBe(false);
    });

    it("should allow zero unit price (for complementary items)", () => {
      const result = lineItemSchema.safeParse({
        ...validItem,
        unit_price: 0,
        amount: 0,
      });

      expect(result.success).toBe(true);
    });

    it("should validate all line item types", () => {
      for (const type of ["accommodation", "service", "fee", "custom"] as const) {
        const result = lineItemSchema.safeParse({
          ...validItem,
          type,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid type", () => {
      const result = lineItemSchema.safeParse({
        ...validItem,
        type: "invalid",
      });

      expect(result.success).toBe(false);
    });

    it("should sanitize description with HTML", () => {
      const result = lineItemSchema.safeParse({
        ...validItem,
        description: '<script>alert("XSS")</script>Cabin B',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).not.toContain("<script>");
      }
    });
  });

  // ============================================
  // DOCUMENT FORM SCHEMA
  // ============================================

  describe("documentFormSchema", () => {
    const validForm = {
      document_type: "quotation" as const,
      document_date: "2026-02-13",
      valid_until: "2026-03-13",
      recipient: {
        name: "John Doe",
        email: "john@example.com",
        phone: "0917 123 4567",
      },
      line_items: [
        {
          id: "item-1",
          type: "accommodation" as const,
          description: "Cabin A",
          quantity: 2,
          unit_label: "night",
          unit_price: 5000,
          amount: 10000,
        },
      ],
      pricing: {
        subtotal: 10000,
        discount_label: "",
        discount_amount: 0,
        taxable_amount: 10000,
        vat_rate: 0.12,
        vat_amount: 1200,
        total_amount: 11200,
      },
      notes: "Test note",
      payment_terms: "50% deposit required",
      cancellation_policy: "Non-refundable",
    };

    it("should validate a complete valid form", () => {
      const result = documentFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
    });

    it("should require at least one line item", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        line_items: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const lineItemError = result.error.issues.find((i) => i.path.includes("line_items"));
        expect(lineItemError).toBeDefined();
      }
    });

    it("should require document date", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        document_date: "",
      });

      expect(result.success).toBe(false);
    });

    it("should accept invoice type", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        document_type: "invoice",
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid document type", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        document_type: "receipt",
      });

      expect(result.success).toBe(false);
    });

    it("should accept empty optional text fields", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        notes: "",
        payment_terms: "",
        cancellation_policy: "",
        valid_until: "",
      });

      expect(result.success).toBe(true);
    });

    it("should reject notes exceeding max length", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        notes: "A".repeat(2001),
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative discount", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        pricing: {
          ...validForm.pricing,
          discount_amount: -500,
        },
      });

      expect(result.success).toBe(false);
    });

    it("should reject VAT rate > 1", () => {
      const result = documentFormSchema.safeParse({
        ...validForm,
        pricing: {
          ...validForm.pricing,
          vat_rate: 12, // should be 0.12 not 12
        },
      });

      expect(result.success).toBe(false);
    });
  });
});
