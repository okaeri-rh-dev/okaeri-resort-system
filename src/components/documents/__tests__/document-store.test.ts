/**
 * Unit Tests for Document Store
 *
 * Tests cover:
 * - Initial state
 * - Letterhead CRUD
 * - Line item management
 * - Pricing calculations (subtotal, discount, VAT, total)
 * - Document number generation
 * - Form reset
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_LETTERHEAD } from "@/components/documents/constants";
import type { DocumentLineItem } from "@/components/documents/types";
import { useDocumentStore } from "@/stores/useDocumentStore";

const NO_CONTACTS = { phone: "", email: "" };
const CHANNEL_CONTACTS = { phone: "+63 917 123 4567", email: "stay@okaeri-resort.example" };

describe("useDocumentStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useDocumentStore());
    act(() => {
      result.current.resetForm();
      result.current.resetLetterhead(NO_CONTACTS);
    });
    // Reset counter by directly accessing the store
    useDocumentStore.setState({ documentCounter: 0, contactDefaultsApplied: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // INITIAL STATE
  // ============================================

  describe("Initial State", () => {
    it("should initialize with default letterhead", () => {
      const { result } = renderHook(() => useDocumentStore());
      expect(result.current.letterhead.resort_name).toBe(DEFAULT_LETTERHEAD.resort_name);
      expect(result.current.letterhead.city).toBe(DEFAULT_LETTERHEAD.city);
    });

    it("should initialize with empty form data", () => {
      const { result } = renderHook(() => useDocumentStore());
      expect(result.current.formData.document_type).toBe("quotation");
      expect(result.current.formData.line_items).toEqual([]);
      expect(result.current.formData.recipient.name).toBe("");
      expect(result.current.formData.pricing.total_amount).toBe(0);
    });

    it("should initialize with default payment terms", () => {
      const { result } = renderHook(() => useDocumentStore());
      expect(result.current.formData.payment_terms).toBeTruthy();
      expect(result.current.formData.cancellation_policy).toBeTruthy();
    });

    it("should not be generating by default", () => {
      const { result } = renderHook(() => useDocumentStore());
      expect(result.current.isGenerating).toBe(false);
    });
  });

  // ============================================
  // LETTERHEAD
  // ============================================

  describe("Letterhead Management", () => {
    it("should update letterhead fields", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.updateLetterhead({ resort_name: "Test Resort" });
      });

      expect(result.current.letterhead.resort_name).toBe("Test Resort");
      // Other fields should remain unchanged
      expect(result.current.letterhead.city).toBe(DEFAULT_LETTERHEAD.city);
    });

    it("should update multiple letterhead fields at once", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.updateLetterhead({
          resort_name: "New Name",
          email: "new@email.com",
          tin: "123-456-789",
        });
      });

      expect(result.current.letterhead.resort_name).toBe("New Name");
      expect(result.current.letterhead.email).toBe("new@email.com");
      expect(result.current.letterhead.tin).toBe("123-456-789");
    });

    it("should reset letterhead to defaults", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.updateLetterhead({ resort_name: "Changed" });
      });
      expect(result.current.letterhead.resort_name).toBe("Changed");

      act(() => {
        result.current.resetLetterhead(NO_CONTACTS);
      });
      expect(result.current.letterhead.resort_name).toBe(DEFAULT_LETTERHEAD.resort_name);
    });

    it("resets phone and email to the given contact defaults", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.updateLetterhead({ phone: "+63 917 555 0101", email: "old@example.com" });
        result.current.resetLetterhead(CHANNEL_CONTACTS);
      });

      expect(result.current.letterhead.phone).toBe("+63 917 123 4567");
      expect(result.current.letterhead.email).toBe("stay@okaeri-resort.example");
      expect(result.current.contactDefaultsApplied).toBe(true);
    });

    it("fills empty phone and email from contact defaults once", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.updateLetterhead({ email: "frontdoor@okaeri-resort.example" });
        result.current.applyContactDefaults(CHANNEL_CONTACTS);
      });
      expect(result.current.letterhead.phone).toBe("+63 917 123 4567");
      expect(result.current.letterhead.email).toBe("frontdoor@okaeri-resort.example");

      act(() => {
        result.current.updateLetterhead({ phone: "" });
        result.current.applyContactDefaults(CHANNEL_CONTACTS);
      });
      expect(result.current.letterhead.phone).toBe("");
    });

    it("should store logo as base64", () => {
      const { result } = renderHook(() => useDocumentStore());
      const fakeBase64 = "data:image/png;base64,iVBORw0KGgo=";

      act(() => {
        result.current.updateLetterhead({ logo_base64: fakeBase64 });
      });

      expect(result.current.letterhead.logo_base64).toBe(fakeBase64);
    });
  });

  // ============================================
  // LINE ITEMS
  // ============================================

  describe("Line Item Management", () => {
    const createItem = (overrides: Partial<DocumentLineItem> = {}): DocumentLineItem => ({
      id: "test-item-1",
      type: "accommodation",
      description: "Cabin A",
      quantity: 2,
      unit_label: "night",
      unit_price: 5000,
      amount: 10000,
      ...overrides,
    });

    it("should add a line item and recalculate pricing", () => {
      const { result } = renderHook(() => useDocumentStore());
      const item = createItem();

      act(() => {
        result.current.addLineItem(item);
      });

      expect(result.current.formData.line_items).toHaveLength(1);
      expect(result.current.formData.line_items[0].description).toBe("Cabin A");
      expect(result.current.formData.pricing.subtotal).toBe(10000);
    });

    it("should remove a line item and recalculate pricing", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(createItem({ id: "item-1", unit_price: 3000 }));
        result.current.addLineItem(createItem({ id: "item-2", unit_price: 2000 }));
      });
      expect(result.current.formData.line_items).toHaveLength(2);

      act(() => {
        result.current.removeLineItem("item-1");
      });

      expect(result.current.formData.line_items).toHaveLength(1);
      expect(result.current.formData.line_items[0].id).toBe("item-2");
    });

    it("should update a line item and recalculate pricing", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(createItem({ id: "item-1" }));
      });

      act(() => {
        result.current.updateLineItem("item-1", { quantity: 3, unit_price: 4000 });
      });

      const updatedItem = result.current.formData.line_items[0];
      expect(updatedItem.quantity).toBe(3);
      expect(updatedItem.unit_price).toBe(4000);
      // amount should be recalculated: 3 * 4000 = 12000
      expect(updatedItem.amount).toBe(12000);
    });

    it("should not crash when removing a non-existent item", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(createItem({ id: "item-1" }));
      });

      act(() => {
        result.current.removeLineItem("nonexistent-id");
      });

      expect(result.current.formData.line_items).toHaveLength(1);
    });
  });

  // ============================================
  // PRICING CALCULATIONS
  // ============================================

  describe("Pricing Calculations", () => {
    const item1: DocumentLineItem = {
      id: "item-1",
      type: "accommodation",
      description: "Cabin A",
      quantity: 2,
      unit_label: "night",
      unit_price: 5000,
      amount: 10000,
    };

    const item2: DocumentLineItem = {
      id: "item-2",
      type: "service",
      description: "Pool Access",
      quantity: 4,
      unit_label: "pax",
      unit_price: 500,
      amount: 2000,
    };

    it("should calculate subtotal correctly", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(item1);
        result.current.addLineItem(item2);
      });

      // 2*5000 + 4*500 = 12000
      expect(result.current.formData.pricing.subtotal).toBe(12000);
    });

    it("should apply discount correctly", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(item1);
      });

      act(() => {
        result.current.setDiscountAmount(1000);
      });

      expect(result.current.formData.pricing.discount_amount).toBe(1000);
      // taxable = 10000 - 1000 = 9000
      expect(result.current.formData.pricing.taxable_amount).toBe(9000);
    });

    it("should calculate VAT correctly", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(item1);
      });

      // Default VAT = 12%
      // subtotal = 10000, taxable = 10000, vat = 1200, total = 11200
      expect(result.current.formData.pricing.vat_rate).toBe(0.12);
      expect(result.current.formData.pricing.vat_amount).toBe(1200);
      expect(result.current.formData.pricing.total_amount).toBe(11200);
    });

    it("should update total when VAT rate changes", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(item1);
      });

      act(() => {
        result.current.setVatRate(0.05);
      });

      // subtotal = 10000, vat = 500, total = 10500
      expect(result.current.formData.pricing.vat_amount).toBe(500);
      expect(result.current.formData.pricing.total_amount).toBe(10500);
    });

    it("should calculate total with discount and VAT together", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(item1);
        result.current.addLineItem(item2);
      });

      act(() => {
        result.current.setDiscountAmount(2000);
      });

      // subtotal = 12000, discount = 2000, taxable = 10000
      // vat = 10000 * 0.12 = 1200, total = 11200
      expect(result.current.formData.pricing.subtotal).toBe(12000);
      expect(result.current.formData.pricing.taxable_amount).toBe(10000);
      expect(result.current.formData.pricing.vat_amount).toBe(1200);
      expect(result.current.formData.pricing.total_amount).toBe(11200);
    });

    it("should handle zero VAT rate", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(item1);
      });

      act(() => {
        result.current.setVatRate(0);
      });

      expect(result.current.formData.pricing.vat_amount).toBe(0);
      expect(result.current.formData.pricing.total_amount).toBe(10000);
    });

    it("should clamp taxable amount to zero when discount exceeds subtotal", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.addLineItem(item1); // subtotal = 10000
      });

      act(() => {
        result.current.setDiscountAmount(15000); // exceeds subtotal
      });

      // taxable should be clamped to 0, not -5000
      expect(result.current.formData.pricing.taxable_amount).toBe(0);
      expect(result.current.formData.pricing.vat_amount).toBe(0);
      expect(result.current.formData.pricing.total_amount).toBe(0);
    });

    it("should set discount label", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.setDiscountLabel("Early Bird");
      });

      expect(result.current.formData.pricing.discount_label).toBe("Early Bird");
    });
  });

  // ============================================
  // DOCUMENT NUMBER GENERATION
  // ============================================

  describe("Document Number Generation", () => {
    it("should generate sequential quotation numbers", () => {
      const { result } = renderHook(() => useDocumentStore());

      let num1: string = "";
      let num2: string = "";

      act(() => {
        num1 = result.current.generateDocumentNumber("quotation");
      });

      act(() => {
        num2 = result.current.generateDocumentNumber("quotation");
      });

      expect(num1).toMatch(/^QUO-\d{4}-0001$/);
      expect(num2).toMatch(/^QUO-\d{4}-0002$/);
    });

    it("should generate invoice numbers with INV prefix", () => {
      const { result } = renderHook(() => useDocumentStore());

      let num: string = "";
      act(() => {
        num = result.current.generateDocumentNumber("invoice");
      });

      expect(num).toMatch(/^INV-\d{4}-0001$/);
    });

    it("should include current year", () => {
      const { result } = renderHook(() => useDocumentStore());
      const year = new Date().getFullYear();

      let num: string = "";
      act(() => {
        num = result.current.generateDocumentNumber("quotation");
      });

      expect(num).toContain(String(year));
    });

    it("should persist counter across document types", () => {
      const { result } = renderHook(() => useDocumentStore());

      let quo: string = "";
      let inv: string = "";

      act(() => {
        quo = result.current.generateDocumentNumber("quotation"); // counter = 1
      });
      act(() => {
        inv = result.current.generateDocumentNumber("invoice"); // counter = 2
      });

      expect(quo).toMatch(/0001$/);
      expect(inv).toMatch(/0002$/);
    });
  });

  // ============================================
  // FORM MANAGEMENT
  // ============================================

  describe("Form Management", () => {
    it("should update form data", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.setFormData({ notes: "Test note" });
      });

      expect(result.current.formData.notes).toBe("Test note");
    });

    it("should change document type", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.setDocumentType("invoice");
      });

      expect(result.current.formData.document_type).toBe("invoice");
    });

    it("should update recipient fields", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.setRecipientField("name", "John Doe");
        result.current.setRecipientField("email", "john@example.com");
      });

      expect(result.current.formData.recipient.name).toBe("John Doe");
      expect(result.current.formData.recipient.email).toBe("john@example.com");
    });

    it("should reset form to initial state", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.setFormData({ notes: "Something" });
        result.current.addLineItem({
          id: "x",
          type: "custom",
          description: "Test",
          quantity: 1,
          unit_label: "unit",
          unit_price: 100,
          amount: 100,
        });
      });

      expect(result.current.formData.line_items).toHaveLength(1);

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formData.line_items).toEqual([]);
      expect(result.current.formData.notes).toBe("");
      expect(result.current.formData.document_type).toBe("quotation");
    });

    it("should set preview mode", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.setPreviewMode("preview");
      });

      expect(result.current.previewMode).toBe("preview");
    });

    it("should set generating state", () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.setIsGenerating(true);
      });
      expect(result.current.isGenerating).toBe(true);

      act(() => {
        result.current.setIsGenerating(false);
      });
      expect(result.current.isGenerating).toBe(false);
    });
  });

  // ============================================
  // SAVED LETTERHEAD MIGRATION
  // ============================================

  describe("Saved letterhead migration", () => {
    const placeholderLetterhead = {
      resort_name: "Okaeri Resort",
      tagline: "Your Home Away From Home",
      address_line_1: "123 Resort Road",
      city: "Nasugbu",
      province: "Batangas",
      zip_code: "4231",
      phone: "0917 000 0000",
      email: "info@okaeriresort.com",
      website: "www.okaeriresort.com",
    };

    async function rehydrateFromVersion0(letterhead: Record<string, string>) {
      localStorage.setItem(
        "document-storage",
        JSON.stringify({ state: { letterhead, documentCounter: 7 }, version: 0 })
      );
      await useDocumentStore.persist.rehydrate();
      return useDocumentStore.getState();
    }

    afterEach(() => localStorage.removeItem("document-storage"));

    it("replaces the old placeholders with the real address and blank contacts", async () => {
      const state = await rehydrateFromVersion0(placeholderLetterhead);

      expect(state.letterhead).toEqual({
        resort_name: "Okaeri Resort",
        tagline: "Your Home Away From Home",
        address_line_1: "Amita St., Brgy. Taboc",
        address_line_2: "M8QQ+HF",
        city: "San Juan",
        province: "La Union",
        zip_code: "2514",
        phone: "",
        email: "",
        website: "",
      });
      expect(state.documentCounter).toBe(7);
      expect(state.contactDefaultsApplied).toBe(false);
    });

    it("keeps values that staff changed", async () => {
      const customLetterhead = {
        ...placeholderLetterhead,
        address_line_1: "Purok 3, Barangay Urbiztondo",
        city: "San Juan",
        province: "La Union",
        zip_code: "2514",
        phone: "+63 917 555 0101",
        email: "frontdoor@okaeri-resort.example",
        website: "okaeri-resort.example",
      };

      const state = await rehydrateFromVersion0(customLetterhead);

      expect(state.letterhead).toEqual({
        ...customLetterhead,
        address_line_2: undefined,
      });
    });
  });
});
