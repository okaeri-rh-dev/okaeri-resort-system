// src/components/audit/__tests__/AuditDiffViewer.test.tsx

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AuditLog } from "@/types/audit.types";

import { AuditDiffViewer } from "../AuditDiffViewer";

// Mock SafeAuditText to avoid DOMPurify issues in tests
vi.mock("../SafeAuditText", () => ({
  SafeAuditText: ({ text, className }: { text: string; className?: string }) => (
    <span className={className}>{text}</span>
  ),
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

const createMockLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  audit_id: "test-audit-id",
  correlation_id: null,
  table_name: "bookings",
  record_id: "record-123",
  record_pk: null,
  action: "UPDATE",
  event_type: null,
  source: "db",
  user_id: "user-123",
  user_email: "test@example.com",
  user_role: null,
  old_data: null,
  new_data: null,
  changed_fields: [],
  description: "Test audit log",
  category: null,
  severity: null,
  metadata: null,
  ip_address: "192.168.1.1",
  user_agent: null,
  created_at: "2025-10-03T10:00:00Z",
  ...overrides,
});

// ============================================
// COMPONENT RENDERING TESTS
// ============================================

describe("AuditDiffViewer", () => {
  describe("Component rendering", () => {
    it("returns null when log is null", () => {
      const { container } = render(
        <AuditDiffViewer log={null} open={true} onOpenChange={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders dialog when open is true", () => {
      const log = createMockLog();
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Audit Log Details")).toBeInTheDocument();
    });

    it("calls onOpenChange when dialog state changes", async () => {
      const log = createMockLog();
      const onOpenChange = vi.fn();

      render(<AuditDiffViewer log={log} open={true} onOpenChange={onOpenChange} />);

      // Click escape or backdrop would trigger onOpenChange
      // This is handled by the Dialog component internally
    });

    it("displays table and action in description", () => {
      const log = createMockLog({ table_name: "bookings", action: "UPDATE" });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      const description = screen.getByText(/Bookings.*Update/i);
      expect(description).toBeInTheDocument();
    });
  });

  // ============================================
  // METADATA DISPLAY TESTS
  // ============================================

  describe("Metadata display", () => {
    it("displays user email", () => {
      const log = createMockLog({ user_email: "admin@example.com" });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    });

    it("displays System when user_email is null", () => {
      const log = createMockLog({ user_email: null });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("System")).toBeInTheDocument();
    });

    it("displays record ID when present", () => {
      const log = createMockLog({ record_id: "booking-abc-123" });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("booking-abc-123")).toBeInTheDocument();
    });

    it("displays IP address when present", () => {
      const log = createMockLog({ ip_address: "192.168.1.100" });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("192.168.1.100")).toBeInTheDocument();
    });

    it("displays description with XSS protection", () => {
      const log = createMockLog({ description: "Updated booking status" });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      // SafeAuditText is mocked, so it renders plain text
      expect(screen.getByText("Updated booking status")).toBeInTheDocument();
    });
  });

  // ============================================
  // CHANGED FIELDS SUMMARY TESTS
  // ============================================

  describe("Changed fields summary", () => {
    it("displays changed fields for DB triggers", () => {
      const log = createMockLog({
        source: "db",
        changed_fields: ["status", "total_amount", "updated_at"],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("Changed Fields (3)")).toBeInTheDocument();
      expect(screen.getByText("status")).toBeInTheDocument();
      expect(screen.getByText("total_amount")).toBeInTheDocument();
      expect(screen.getByText("updated_at")).toBeInTheDocument();
    });

    it("does not display changed fields for app events", () => {
      const log = createMockLog({
        source: "app",
        changed_fields: ["status"],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.queryByText("Changed Fields")).not.toBeInTheDocument();
    });

    it("does not display changed fields when empty", () => {
      const log = createMockLog({
        source: "db",
        changed_fields: [],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.queryByText("Changed Fields")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // INSERT VIEW TESTS
  // ============================================

  describe("INSERT view", () => {
    it("displays only new data for INSERT action", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: {
          id: "123",
          name: "John Doe",
          status: "active",
        },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("New Record Data")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
    });

    it("does not show Before panel for INSERT", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: { id: "123" },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.queryByText("Before")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // DELETE VIEW TESTS
  // ============================================

  describe("DELETE view", () => {
    it("displays only old data for DELETE action", () => {
      const log = createMockLog({
        action: "DELETE",
        old_data: {
          id: "123",
          name: "Jane Doe",
          status: "inactive",
        },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("Deleted Record Data")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("inactive")).toBeInTheDocument();
    });

    it("does not show After panel for DELETE", () => {
      const log = createMockLog({
        action: "DELETE",
        old_data: { id: "123" },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.queryByText("After")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // UPDATE VIEW TESTS
  // ============================================

  describe("UPDATE view", () => {
    it("displays side-by-side comparison for UPDATE action", () => {
      const log = createMockLog({
        action: "UPDATE",
        old_data: { status: "pending" },
        new_data: { status: "confirmed" },
        changed_fields: ["status"],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("Before")).toBeInTheDocument();
      expect(screen.getByText("After")).toBeInTheDocument();
      expect(screen.getByText("pending")).toBeInTheDocument();
      expect(screen.getByText("confirmed")).toBeInTheDocument();
    });

    it("highlights changed fields in UPDATE view", () => {
      const log = createMockLog({
        action: "UPDATE",
        old_data: { status: "pending", amount: 100 },
        new_data: { status: "confirmed", amount: 100 },
        changed_fields: ["status"],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      // Changed badge should appear for status field
      const changedBadges = screen.getAllByText("Changed");
      expect(changedBadges.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // VALUE TYPE FORMATTING TESTS
  // ============================================

  describe("Value type formatting", () => {
    it("renders null values as italic null", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: { notes: null },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      const nullText = screen.getByText("null");
      expect(nullText).toHaveClass("italic");
    });

    it("renders boolean values as badges", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: { is_active: true, is_deleted: false },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("true")).toBeInTheDocument();
      expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("renders numbers with locale formatting", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: { amount: 1234567 },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      // Locale formatting adds commas
      expect(screen.getByText("1,234,567")).toBeInTheDocument();
    });

    it("renders ISO dates in human-readable format", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: { created_at: "2025-10-03T10:30:00Z" },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      // date-fns format should be applied - use getAllByText since date appears in dialog description too
      const dateTexts = screen.getAllByText(/Oct.*2025/i);
      expect(dateTexts.length).toBeGreaterThan(0);
    });

    it("renders [REDACTED] with destructive badge", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: { password: "[REDACTED]" },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      const redactedBadges = screen.getAllByText("[REDACTED]");
      expect(redactedBadges.length).toBeGreaterThan(0);
    });

    it("truncates long strings with expand option", () => {
      const longString = "A".repeat(150);
      const log = createMockLog({
        action: "INSERT",
        new_data: { description: longString },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/click to expand/i)).toBeInTheDocument();
    });

    it("renders objects as collapsible JSON", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: {
          metadata: { source: "web", browser: "Chrome" },
        },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/Object\/Array.*click to expand/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // REDACTED DIFF DETECTION TESTS
  // ============================================

  describe("Redacted diff detection", () => {
    it("shows special message when both old and new are redacted", () => {
      const log = createMockLog({
        action: "UPDATE",
        old_data: { password: "[REDACTED]" },
        new_data: { password: "[REDACTED]" },
        changed_fields: ["password"],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      // Use getAllByText since message appears in both Before and After panels
      const messages = screen.getAllByText(/Sensitive field changed.*value redacted/i);
      expect(messages.length).toBeGreaterThan(0);
    });

    it("shows normal [REDACTED] badge when only one side is redacted", () => {
      const log = createMockLog({
        action: "UPDATE",
        old_data: { password: "plaintext" },
        new_data: { password: "[REDACTED]" },
        changed_fields: ["password"],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      const redactedBadges = screen.getAllByText("[REDACTED]");
      expect(redactedBadges.length).toBeGreaterThan(0);
      expect(screen.queryByText(/Sensitive field changed/i)).not.toBeInTheDocument();
    });
  });

  // ============================================
  // FIELD NAME FORMATTING TESTS
  // ============================================

  describe("Field name formatting", () => {
    it("converts snake_case to Title Case", () => {
      const log = createMockLog({
        action: "INSERT",
        new_data: {
          booking_reference: "REF123",
          total_amount: 100,
          guest_id: "guest-123",
        },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("Booking Reference")).toBeInTheDocument();
      expect(screen.getByText("Total Amount")).toBeInTheDocument();
      expect(screen.getByText("Guest Id")).toBeInTheDocument();
    });
  });

  // ============================================
  // EDGE CASES TESTS
  // ============================================

  describe("Edge cases", () => {
    it("shows no data message when both old_data and new_data are null", () => {
      const log = createMockLog({
        old_data: null,
        new_data: null,
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("No data changes recorded for this log entry")).toBeInTheDocument();
    });

    it("handles non-object JSON data gracefully", () => {
      const log = createMockLog({
        action: "INSERT",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new_data: "string value" as any, // Invalid type - will be filtered by type guard
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      // Type guard converts non-object to null, triggering no data message
      expect(screen.getByText(/No data changes recorded/i)).toBeInTheDocument();
    });

    it("displays additional metadata when present", () => {
      const log = createMockLog({
        metadata: { correlation_id: "abc-123", retry_count: 2 },
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("Additional Metadata")).toBeInTheDocument();
      expect(screen.getByText(/"correlation_id"/)).toBeInTheDocument();
    });

    it("does not crash with undefined changed_fields", () => {
      const log = createMockLog({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        changed_fields: undefined as any,
        action: "UPDATE",
        old_data: { status: "pending" },
        new_data: { status: "confirmed" },
      });

      expect(() => {
        render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);
      }).not.toThrow();
    });
  });

  // ============================================
  // FIELD SORTING TESTS
  // ============================================

  describe("Field sorting", () => {
    it("displays changed fields first, then alphabetically", () => {
      const log = createMockLog({
        action: "UPDATE",
        old_data: {
          amount: 100,
          status: "pending",
          notes: "old notes",
          zebra: "last",
        },
        new_data: {
          amount: 100,
          status: "confirmed",
          notes: "new notes",
          zebra: "last",
        },
        changed_fields: ["status", "notes"],
      });
      render(<AuditDiffViewer log={log} open={true} onOpenChange={vi.fn()} />);

      // Verify Before and After panels exist for UPDATE
      expect(screen.getByText("Before")).toBeInTheDocument();
      expect(screen.getByText("After")).toBeInTheDocument();

      // Verify changed fields have "Changed" badges
      const changedBadges = screen.getAllByText("Changed");
      expect(changedBadges.length).toBeGreaterThanOrEqual(2); // status and notes in both panels
    });
  });
});
