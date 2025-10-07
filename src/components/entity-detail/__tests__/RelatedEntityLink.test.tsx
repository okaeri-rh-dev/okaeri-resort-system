// src/components/entity-detail/__tests__/RelatedEntityLink.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelatedEntityLink } from "../RelatedEntityLink";

// Mock TanStack Router Link
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, className }: any) => (
    <a
      href={`${to}?${new URLSearchParams(params).toString()}`}
      className={className}
      data-testid="router-link"
    >
      {children}
    </a>
  ),
}));

describe("RelatedEntityLink", () => {
  describe("Basic rendering", () => {
    it("renders link to booking entity", () => {
      render(<RelatedEntityLink entityType="booking" entityId="booking-123" label="BK-2024-001" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveTextContent("BK-2024-001");
      expect(link).toHaveAttribute("href", expect.stringContaining("/bookings/"));
    });

    it("renders link to unit entity", () => {
      render(<RelatedEntityLink entityType="unit" entityId="unit-456" label="Deluxe Villa 1" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveTextContent("Deluxe Villa 1");
      expect(link).toHaveAttribute("href", expect.stringContaining("/units/"));
    });

    it("renders link to guest entity", () => {
      render(<RelatedEntityLink entityType="guest" entityId="guest-789" label="John Doe" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveTextContent("John Doe");
      expect(link).toHaveAttribute("href", expect.stringContaining("/guests/"));
    });

    it("renders link to payment entity", () => {
      render(
        <RelatedEntityLink entityType="payment" entityId="payment-101" label="Payment #12345" />
      );

      const link = screen.getByTestId("router-link");
      expect(link).toHaveTextContent("Payment #12345");
      expect(link).toHaveAttribute("href", expect.stringContaining("/payments/"));
    });

    it("renders link to expense entity", () => {
      render(
        <RelatedEntityLink entityType="expense" entityId="expense-202" label="Pool Maintenance" />
      );

      const link = screen.getByTestId("router-link");
      expect(link).toHaveTextContent("Pool Maintenance");
      expect(link).toHaveAttribute("href", expect.stringContaining("/expenses/"));
    });
  });

  describe("Badge support", () => {
    it("renders badge when provided", () => {
      render(
        <RelatedEntityLink
          entityType="unit"
          entityId="unit-123"
          label="Deluxe Villa 1"
          badge="DV-001"
        />
      );

      expect(screen.getByText("DV-001")).toBeInTheDocument();
    });

    it("positions badge after label", () => {
      render(
        <RelatedEntityLink
          entityType="booking"
          entityId="booking-123"
          label="Booking"
          badge="Confirmed"
        />
      );

      const label = screen.getByText("Booking");
      const badge = screen.getByText("Confirmed");

      expect(label.compareDocumentPosition(badge)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("styles badge appropriately", () => {
      render(
        <RelatedEntityLink entityType="unit" entityId="unit-123" label="Villa" badge="DV-001" />
      );

      const badge = screen.getByText("DV-001");
      expect(badge).toHaveClass("text-xs", "text-muted-foreground");
    });
  });

  describe("Icon display", () => {
    it("shows appropriate icon for booking entity", () => {
      const { container } = render(
        <RelatedEntityLink entityType="booking" entityId="booking-123" label="Booking" />
      );

      // Should have an icon (SVG) for booking
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("shows appropriate icon for unit entity", () => {
      const { container } = render(
        <RelatedEntityLink entityType="unit" entityId="unit-123" label="Unit" />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("shows appropriate icon for guest entity", () => {
      const { container } = render(
        <RelatedEntityLink entityType="guest" entityId="guest-123" label="Guest" />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("shows appropriate icon for payment entity", () => {
      const { container } = render(
        <RelatedEntityLink entityType="payment" entityId="payment-123" label="Payment" />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("shows appropriate icon for expense entity", () => {
      const { container } = render(
        <RelatedEntityLink entityType="expense" entityId="expense-123" label="Expense" />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("Link styling", () => {
    it("applies proper text color for links", () => {
      const { container } = render(
        <RelatedEntityLink entityType="booking" entityId="booking-123" label="Booking" />
      );

      const link = screen.getByTestId("router-link");
      expect(link).toHaveClass("text-blue-600");
    });

    it("applies hover styles", () => {
      const { container } = render(
        <RelatedEntityLink entityType="booking" entityId="booking-123" label="Booking" />
      );

      const link = screen.getByTestId("router-link");
      expect(link).toHaveClass("hover:underline");
    });

    it("applies font weight", () => {
      const { container } = render(
        <RelatedEntityLink entityType="booking" entityId="booking-123" label="Booking" />
      );

      const link = screen.getByTestId("router-link");
      expect(link).toHaveClass("font-medium");
    });
  });

  describe("Route generation", () => {
    it("generates correct route for booking", () => {
      render(<RelatedEntityLink entityType="booking" entityId="booking-123" label="Booking" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveAttribute("href", expect.stringContaining("bookingId=booking-123"));
    });

    it("generates correct route for unit", () => {
      render(<RelatedEntityLink entityType="unit" entityId="unit-456" label="Unit" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveAttribute("href", expect.stringContaining("unitId=unit-456"));
    });

    it("generates correct route for guest", () => {
      render(<RelatedEntityLink entityType="guest" entityId="guest-789" label="Guest" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveAttribute("href", expect.stringContaining("guestId=guest-789"));
    });

    it("generates correct route for payment", () => {
      render(<RelatedEntityLink entityType="payment" entityId="payment-101" label="Payment" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveAttribute("href", expect.stringContaining("paymentId=payment-101"));
    });

    it("generates correct route for expense", () => {
      render(<RelatedEntityLink entityType="expense" entityId="expense-202" label="Expense" />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveAttribute("href", expect.stringContaining("expenseId=expense-202"));
    });
  });

  describe("Custom className", () => {
    it("applies custom className when provided", () => {
      render(
        <RelatedEntityLink
          entityType="booking"
          entityId="booking-123"
          label="Booking"
          className="custom-class"
        />
      );

      const link = screen.getByTestId("router-link");
      expect(link).toHaveClass("custom-class");
    });

    it("merges custom className with default classes", () => {
      render(
        <RelatedEntityLink
          entityType="booking"
          entityId="booking-123"
          label="Booking"
          className="custom-class"
        />
      );

      const link = screen.getByTestId("router-link");
      expect(link).toHaveClass("custom-class", "text-blue-600", "hover:underline");
    });
  });

  describe("Accessibility", () => {
    it("renders as a proper link element", () => {
      render(
        <RelatedEntityLink entityType="booking" entityId="booking-123" label="View Booking" />
      );

      const link = screen.getByTestId("router-link");
      expect(link.tagName).toBe("A");
    });

    it("has descriptive text content", () => {
      render(<RelatedEntityLink entityType="guest" entityId="guest-123" label="John Doe" />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  describe("Real-world usage", () => {
    it("renders booking reference with status badge", () => {
      render(
        <RelatedEntityLink
          entityType="booking"
          entityId="booking-123"
          label="BK-2024-001"
          badge="Confirmed"
        />
      );

      expect(screen.getByText("BK-2024-001")).toBeInTheDocument();
      expect(screen.getByText("Confirmed")).toBeInTheDocument();
    });

    it("renders unit with code badge", () => {
      render(
        <RelatedEntityLink
          entityType="unit"
          entityId="unit-123"
          label="Deluxe Villa 1"
          badge="DV-001"
        />
      );

      expect(screen.getByText("Deluxe Villa 1")).toBeInTheDocument();
      expect(screen.getByText("DV-001")).toBeInTheDocument();
    });

    it("renders guest name without badge", () => {
      render(<RelatedEntityLink entityType="guest" entityId="guest-123" label="John Doe" />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });
});
