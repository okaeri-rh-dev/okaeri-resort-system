// src/components/audit/__tests__/SafeAuditText.test.tsx

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SafeAuditText, SafeAuditTextMemo } from "../SafeAuditText";

describe("SafeAuditText", () => {
  describe("Plain text rendering", () => {
    it("renders plain text correctly", () => {
      render(<SafeAuditText text="Normal description" />);
      expect(screen.getByText("Normal description")).toBeInTheDocument();
    });

    it("renders multiline text", () => {
      const multilineText = "Line 1\nLine 2\nLine 3";
      const { container } = render(<SafeAuditText text={multilineText} />);
      // sanitizeText preserves newlines for plain text without HTML
      // Check that all three lines are present in the output
      const textContent = container.textContent || "";
      expect(textContent).toContain("Line 1");
      expect(textContent).toContain("Line 2");
      expect(textContent).toContain("Line 3");
    });

    it("preserves special characters", () => {
      const specialText = "Email: test@example.com & Phone: +63-123-4567";
      render(<SafeAuditText text={specialText} />);
      expect(screen.getByText(specialText)).toBeInTheDocument();
    });
  });

  describe("XSS protection", () => {
    it("strips script tags", () => {
      render(<SafeAuditText text='Text <script>alert("xss")</script> here' />);
      expect(screen.queryByText(/script/i)).not.toBeInTheDocument();
      // sanitizeText from security/sanitize.ts removes "script" word entirely
      expect(screen.getByText(/Text.*here/i)).toBeInTheDocument();
    });

    it("strips img tags with onerror", () => {
      render(<SafeAuditText text='<img src=x onerror=alert("xss")>Test' />);
      expect(screen.queryByText(/onerror/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Test/i)).toBeInTheDocument();
    });

    it("strips iframe tags", () => {
      render(<SafeAuditText text='<iframe src="malicious.com"></iframe>Normal text' />);
      expect(screen.queryByText(/iframe/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Normal text/i)).toBeInTheDocument();
    });

    it("strips onclick handlers", () => {
      render(<SafeAuditText text='<div onclick="alert(1)">Click me</div>' />);
      expect(screen.queryByText(/onclick/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Click me/i)).toBeInTheDocument();
    });

    it("strips javascript: protocol", () => {
      render(<SafeAuditText text='<a href="javascript:alert(1)">Link</a>' />);
      const text = screen.getByText(/Link/i);
      expect(text.textContent).not.toContain("javascript:");
    });

    it("strips multiple XSS attempts", () => {
      const xssPayload =
        '<script>alert(1)</script><img src=x onerror=alert(2)><iframe src="x"></iframe>Safe text';
      render(<SafeAuditText text={xssPayload} />);
      expect(screen.queryByText(/script/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/onerror/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/iframe/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Safe text/i)).toBeInTheDocument();
    });
  });

  describe("Empty states", () => {
    it("shows default empty message for null text", () => {
      render(<SafeAuditText text={null} />);
      expect(screen.getByText("No description")).toBeInTheDocument();
      expect(screen.getByText("No description")).toHaveClass("text-muted-foreground");
      expect(screen.getByText("No description")).toHaveClass("italic");
    });

    it("shows default empty message for undefined text", () => {
      render(<SafeAuditText text={undefined} />);
      expect(screen.getByText("No description")).toBeInTheDocument();
    });

    it("shows default empty message for empty string", () => {
      render(<SafeAuditText text="" />);
      expect(screen.getByText("No description")).toBeInTheDocument();
    });

    it("shows default empty message for whitespace-only string", () => {
      // Test with pure whitespace (spaces only) which is more reliably detected
      render(<SafeAuditText text="     " />);
      // Component checks text.trim() === "" before sanitization
      const emptyMessage = screen.getByText(/no description/i);
      expect(emptyMessage).toBeInTheDocument();
      expect(emptyMessage).toHaveClass("text-muted-foreground");
      expect(emptyMessage).toHaveClass("italic");
    });

    it("shows custom empty message", () => {
      render(<SafeAuditText text={null} emptyMessage="Custom empty" />);
      expect(screen.getByText("Custom empty")).toBeInTheDocument();
      expect(screen.queryByText("No description")).not.toBeInTheDocument();
    });

    it("shows security filter message when content is fully sanitized", () => {
      // Content that gets completely removed by sanitization
      render(<SafeAuditText text="<script></script>" />);
      const emptyState = screen.getByText(/No description/i);
      expect(emptyState.textContent).toContain("security filter");
    });
  });

  describe("Custom styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <SafeAuditText text="Text" className="custom-class text-red-500" />
      );
      const span = container.querySelector("span");
      expect(span).toHaveClass("custom-class");
      expect(span).toHaveClass("text-red-500");
    });

    it("applies className to empty state", () => {
      const { container } = render(
        <SafeAuditText text={null} className="custom-empty" emptyMessage="Empty" />
      );
      const span = container.querySelector("span");
      expect(span).toHaveClass("custom-empty");
      expect(span).toHaveClass("text-muted-foreground");
      expect(span).toHaveClass("italic");
    });
  });

  describe("Edge cases", () => {
    it("handles very long text", () => {
      const longText = "A".repeat(10000);
      render(<SafeAuditText text={longText} />);
      // sanitizeText has a 10000 char limit
      const displayedText = screen.getByText(/A+/);
      expect(displayedText.textContent?.length).toBeLessThanOrEqual(10000);
    });

    it("handles Unicode characters", () => {
      const unicodeText = "日本語 한글 العربية emoji: 🎉🔒";
      render(<SafeAuditText text={unicodeText} />);
      expect(screen.getByText(unicodeText)).toBeInTheDocument();
    });

    it("handles HTML entities", () => {
      const { container } = render(<SafeAuditText text='&lt;div&gt; &amp; "test"' />);
      // sanitizeText decodes entities: &lt;div&gt; → <div>, then strips tags
      // &amp; → &, "test" preserved
      // After tag removal: should have & and "test" but not <div>
      const textContent = container.textContent || "";
      expect(textContent).toContain("test");
      expect(textContent).toContain("&");
      // Should not contain the word "div" or any angle brackets
      expect(textContent).not.toContain("<");
      expect(textContent).not.toContain(">");
    });

    it("handles numeric strings", () => {
      render(<SafeAuditText text="123456.78" />);
      expect(screen.getByText("123456.78")).toBeInTheDocument();
    });

    it("handles boolean-like strings", () => {
      render(<SafeAuditText text="true" />);
      expect(screen.getByText("true")).toBeInTheDocument();
    });
  });

  describe("SafeAuditTextMemo", () => {
    it("renders same output as regular component", () => {
      const { rerender } = render(<SafeAuditTextMemo text="Test text" />);
      expect(screen.getByText("Test text")).toBeInTheDocument();

      // Rerender with same props - should use memoized version
      rerender(<SafeAuditTextMemo text="Test text" />);
      expect(screen.getByText("Test text")).toBeInTheDocument();
    });

    it("strips XSS in memoized version", () => {
      render(<SafeAuditTextMemo text='<script>alert("xss")</script>Clean text' />);
      expect(screen.queryByText(/script/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Clean text/i)).toBeInTheDocument();
    });
  });

  describe("Real-world audit log scenarios", () => {
    it("handles booking cancellation reason with potential XSS", () => {
      const maliciousReason = 'Personal emergency <script>alert("steal data")</script>';
      render(<SafeAuditText text={maliciousReason} />);
      expect(screen.queryByText(/script/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Personal emergency/i)).toBeInTheDocument();
    });

    it("handles payment description with HTML", () => {
      const paymentDesc = 'Payment for <strong>Unit A</strong> via <a href="gcash.com">GCash</a>';
      render(<SafeAuditText text={paymentDesc} />);
      // Should strip HTML tags but preserve text
      expect(screen.getByText(/Payment for Unit A via GCash/i)).toBeInTheDocument();
    });

    it("handles expense notes with embedded code", () => {
      const expenseNotes = "Maintenance: Fixed <div>circuit breaker</div> issue";
      render(<SafeAuditText text={expenseNotes} />);
      expect(screen.getByText(/Maintenance: Fixed circuit breaker issue/i)).toBeInTheDocument();
    });

    it("handles system event description", () => {
      const systemDesc = "Database migration completed: Added audit_logs table";
      render(<SafeAuditText text={systemDesc} />);
      expect(screen.getByText(systemDesc)).toBeInTheDocument();
    });
  });
});
