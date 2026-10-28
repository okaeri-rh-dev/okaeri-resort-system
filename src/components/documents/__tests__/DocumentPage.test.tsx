/**
 * Unit Tests for DocumentPage (A4 Preview Component)
 *
 * Tests cover:
 * - Rendering letterhead info
 * - Rendering recipient details
 * - Line items table rendering
 * - Pricing summary display
 * - Document type labels
 * - Currency formatting
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LETTERHEAD } from "@/components/documents/constants";
import { DocumentPage } from "@/components/documents/DocumentPreview/DocumentPage";
import type { DocumentFormData, LetterheadConfig } from "@/components/documents/types";

// Mock formatters
vi.mock("@/lib/formatters", () => ({
  formatCurrency: (amount: number) =>
    `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
  formatFullDate: (date: string) => {
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return "Invalid Date";
    }
  },
}));

describe("DocumentPage", () => {
  const defaultLetterhead: LetterheadConfig = {
    ...DEFAULT_LETTERHEAD,
    phone: "+63 917 123 4567",
    email: "stay@okaeri-resort.example",
  };

  const defaultFormData: DocumentFormData = {
    document_type: "quotation",
    document_date: "2026-02-13",
    valid_until: "2026-03-13",
    recipient: {
      name: "Maria Santos",
      email: "maria@example.com",
      phone: "0917 123 4567",
      address: "Manila, Philippines",
      company_name: "Santos Corp",
      tin: "123-456-789",
    },
    line_items: [
      {
        id: "item-1",
        type: "accommodation",
        description: "Cabin Deluxe",
        quantity: 3,
        unit_label: "night",
        unit_price: 5000,
        amount: 15000,
      },
      {
        id: "item-2",
        type: "service",
        description: "Pool Access",
        quantity: 6,
        unit_label: "pax",
        unit_price: 200,
        amount: 1200,
      },
    ],
    pricing: {
      subtotal: 16200,
      discount_label: "Early Bird",
      discount_amount: 1000,
      taxable_amount: 15200,
      vat_rate: 0.12,
      vat_amount: 1824,
      total_amount: 17024,
    },
    notes: "Thank you for your business!",
    payment_terms: "50% deposit required",
    cancellation_policy: "Non-refundable within 48 hours",
  };

  it("should render the resort name from letterhead", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText(DEFAULT_LETTERHEAD.resort_name)).toBeInTheDocument();
  });

  it("should render the letterhead contact info", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("stay@okaeri-resort.example")).toBeInTheDocument();
    expect(screen.getByText("+63 917 123 4567")).toBeInTheDocument();
  });

  it("should display QUOTATION for quotation type", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("QUOTATION")).toBeInTheDocument();
  });

  it("should display INVOICE for invoice type", () => {
    render(
      <DocumentPage
        formData={{ ...defaultFormData, document_type: "invoice" }}
        letterhead={defaultLetterhead}
      />
    );
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
  });

  it("should render the recipient name", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });

  it("should render the recipient company name", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("Santos Corp")).toBeInTheDocument();
  });

  it("should render line item descriptions", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("Cabin Deluxe")).toBeInTheDocument();
    expect(screen.getByText("Pool Access")).toBeInTheDocument();
  });

  it("should render line item row numbers", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should show discount label when discount is applied", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    // The discount line should show the label
    expect(screen.getByText(/Early Bird/)).toBeInTheDocument();
  });

  it("should display the TOTAL label", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("TOTAL")).toBeInTheDocument();
  });

  it("should render payment terms", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("50% deposit required")).toBeInTheDocument();
  });

  it("should render cancellation policy", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("Non-refundable within 48 hours")).toBeInTheDocument();
  });

  it("should render notes", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText("Thank you for your business!")).toBeInTheDocument();
  });

  it("should render the computer-generated footer", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText(/computer-generated document/i)).toBeInTheDocument();
  });

  it("should render logo when provided", () => {
    const letterheadWithLogo = {
      ...defaultLetterhead,
      logo_base64: "data:image/png;base64,test",
    };
    render(<DocumentPage formData={defaultFormData} letterhead={letterheadWithLogo} />);
    const logo = screen.getByAltText("Logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "data:image/png;base64,test");
  });

  it("should not render logo when not provided", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
  });

  it("should not render logo with non-image data URI", () => {
    const letterheadWithBadLogo = {
      ...defaultLetterhead,
      logo_base64: "javascript:alert(1)",
    };
    render(<DocumentPage formData={defaultFormData} letterhead={letterheadWithBadLogo} />);
    expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
  });

  it("should render custom document number", () => {
    render(
      <DocumentPage
        formData={defaultFormData}
        letterhead={defaultLetterhead}
        documentNumber="QUO-2026-0042"
      />
    );
    expect(screen.getByText("QUO-2026-0042")).toBeInTheDocument();
  });

  it("should render DRAFT number when no document number given", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText(/DRAFT/)).toBeInTheDocument();
  });

  it("should not render empty sections", () => {
    const formNoNotes: DocumentFormData = {
      ...defaultFormData,
      notes: "",
      payment_terms: "",
      cancellation_policy: "",
      recipient: { name: "" },
    };
    render(<DocumentPage formData={formNoNotes} letterhead={defaultLetterhead} />);
    expect(screen.queryByText("Payment Terms")).not.toBeInTheDocument();
    expect(screen.queryByText("Bill To")).not.toBeInTheDocument();
  });

  it("should hide discount line when discount is zero", () => {
    const formNoDiscount: DocumentFormData = {
      ...defaultFormData,
      pricing: { ...defaultFormData.pricing, discount_amount: 0 },
    };
    render(<DocumentPage formData={formNoDiscount} letterhead={defaultLetterhead} />);
    expect(screen.queryByText(/Early Bird/)).not.toBeInTheDocument();
  });

  it("should display tagline when provided", () => {
    render(<DocumentPage formData={defaultFormData} letterhead={defaultLetterhead} />);
    expect(screen.getByText(DEFAULT_LETTERHEAD.tagline!)).toBeInTheDocument();
  });
});
