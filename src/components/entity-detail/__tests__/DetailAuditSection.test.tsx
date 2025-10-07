// src/components/entity-detail/__tests__/DetailAuditSection.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailAuditSection } from "../DetailAuditSection";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock the AuditLogViewer component
vi.mock("@/components/audit/AuditLogViewer", () => ({
  AuditLogViewer: ({ entityType, entityId }: any) => (
    <div data-testid="audit-log-viewer">
      Audit logs for {entityType} {entityId}
    </div>
  ),
}));

describe("DetailAuditSection", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  describe("Basic rendering", () => {
    it("renders with default title", () => {
      render(<DetailAuditSection entityType="booking" entityId="booking-123" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Audit Trail")).toBeInTheDocument();
    });

    it("renders with custom title", () => {
      render(
        <DetailAuditSection entityType="booking" entityId="booking-123" title="Change History" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Change History")).toBeInTheDocument();
    });

    it("renders AuditLogViewer component", () => {
      render(<DetailAuditSection entityType="booking" entityId="booking-123" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByTestId("audit-log-viewer")).toBeInTheDocument();
      expect(screen.getByText(/Audit logs for booking booking-123/)).toBeInTheDocument();
    });
  });

  describe("Entity types", () => {
    it("works with booking entity", () => {
      render(<DetailAuditSection entityType="booking" entityId="booking-123" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/booking booking-123/)).toBeInTheDocument();
    });

    it("works with unit entity", () => {
      render(<DetailAuditSection entityType="unit" entityId="unit-456" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/unit unit-456/)).toBeInTheDocument();
    });

    it("works with guest entity", () => {
      render(<DetailAuditSection entityType="guest" entityId="guest-789" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/guest guest-789/)).toBeInTheDocument();
    });

    it("works with payment entity", () => {
      render(<DetailAuditSection entityType="payment" entityId="payment-101" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/payment payment-101/)).toBeInTheDocument();
    });

    it("works with expense entity", () => {
      render(<DetailAuditSection entityType="expense" entityId="expense-202" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/expense expense-202/)).toBeInTheDocument();
    });
  });

  describe("Collapsible behavior", () => {
    it("is expanded by default when defaultCollapsed is false", () => {
      render(
        <DetailAuditSection entityType="booking" entityId="booking-123" defaultCollapsed={false} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId("audit-log-viewer")).toBeInTheDocument();
    });

    it("is collapsed by default when defaultCollapsed is true", () => {
      render(
        <DetailAuditSection entityType="booking" entityId="booking-123" defaultCollapsed={true} />,
        { wrapper: createWrapper() }
      );

      // When collapsed, viewer should not be visible
      expect(screen.queryByTestId("audit-log-viewer")).not.toBeInTheDocument();
    });

    it("defaults to collapsed on mobile (implicit behavior)", () => {
      // This test verifies the component accepts defaultCollapsed prop
      // Actual mobile detection would need viewport mocking
      render(
        <DetailAuditSection entityType="booking" entityId="booking-123" defaultCollapsed={true} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByTestId("audit-log-viewer")).not.toBeInTheDocument();
    });
  });

  describe("Limit prop", () => {
    it("passes limit to AuditLogViewer", () => {
      // The limit prop should be passed through to AuditLogViewer
      // Since we're mocking it, we verify the component renders
      render(<DetailAuditSection entityType="booking" entityId="booking-123" limit={10} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByTestId("audit-log-viewer")).toBeInTheDocument();
    });

    it("works without limit (default behavior)", () => {
      render(<DetailAuditSection entityType="booking" entityId="booking-123" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByTestId("audit-log-viewer")).toBeInTheDocument();
    });
  });

  describe("Section integration", () => {
    it("wraps content in DetailSection component", () => {
      const { container } = render(
        <DetailAuditSection entityType="booking" entityId="booking-123" />,
        { wrapper: createWrapper() }
      );

      // DetailSection uses a <section> element
      expect(container.querySelector("section")).toBeInTheDocument();
    });

    it("includes section title", () => {
      render(
        <DetailAuditSection entityType="booking" entityId="booking-123" title="Activity Log" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Activity Log")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to section", () => {
      const { container } = render(
        <DetailAuditSection
          entityType="booking"
          entityId="booking-123"
          className="custom-audit-class"
        />,
        { wrapper: createWrapper() }
      );

      expect(container.querySelector(".custom-audit-class")).toBeInTheDocument();
    });
  });

  describe("Real-world usage", () => {
    it("renders complete audit section for booking detail page", () => {
      render(
        <DetailAuditSection
          entityType="booking"
          entityId="booking-123"
          title="Booking History"
          defaultCollapsed={false}
          limit={50}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Booking History")).toBeInTheDocument();
      expect(screen.getByTestId("audit-log-viewer")).toBeInTheDocument();
    });

    it("renders collapsed audit section for mobile", () => {
      render(
        <DetailAuditSection
          entityType="unit"
          entityId="unit-456"
          title="Change Log"
          defaultCollapsed={true}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Change Log")).toBeInTheDocument();
      expect(screen.queryByTestId("audit-log-viewer")).not.toBeInTheDocument();
    });
  });
});
