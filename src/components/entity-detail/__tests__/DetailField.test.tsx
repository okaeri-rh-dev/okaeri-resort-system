// src/components/entity-detail/__tests__/DetailField.test.tsx

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailField } from "../DetailField";

describe("DetailField", () => {
  describe("Basic rendering", () => {
    it("renders label and value", () => {
      render(<DetailField label="Field Label" value="Field Value" />);

      expect(screen.getByText("Field Label")).toBeInTheDocument();
      expect(screen.getByText("Field Value")).toBeInTheDocument();
    });

    it("renders with string value", () => {
      render(<DetailField label="Name" value="John Doe" />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("renders with number value", () => {
      render(<DetailField label="Age" value={30} />);

      expect(screen.getByText("30")).toBeInTheDocument();
    });

    it("renders with ReactNode value", () => {
      render(
        <DetailField label="Status" value={<span data-testid="custom-value">Active Badge</span>} />
      );

      expect(screen.getByTestId("custom-value")).toBeInTheDocument();
      expect(screen.getByText("Active Badge")).toBeInTheDocument();
    });
  });

  describe("Layout variants", () => {
    it("renders vertical layout by default", () => {
      const { container } = render(<DetailField label="Label" value="Value" />);

      const wrapper = container.querySelector(".space-y-1");
      expect(wrapper).toBeInTheDocument();
    });

    it("renders horizontal layout when specified", () => {
      const { container } = render(
        <DetailField label="Label" value="Value" direction="horizontal" />
      );

      const wrapper = container.querySelector(".flex.items-center.justify-between");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies proper spacing for vertical layout", () => {
      const { container } = render(<DetailField label="Label" value="Value" />);

      const wrapper = container.querySelector(".space-y-1");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies proper spacing for horizontal layout", () => {
      const { container } = render(
        <DetailField label="Label" value="Value" direction="horizontal" />
      );

      const wrapper = container.querySelector(".flex.items-center.justify-between");
      expect(wrapper).toHaveClass("justify-between", "gap-4", "py-2");
    });
  });

  describe("Icon support", () => {
    it("renders icon when provided", () => {
      render(
        <DetailField
          label="Email"
          value="test@example.com"
          icon={<span data-testid="icon">📧</span>}
        />
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
    });

    it("positions icon before label", () => {
      render(
        <DetailField
          label="Email"
          value="test@example.com"
          icon={<span data-testid="icon">📧</span>}
        />
      );

      const icon = screen.getByTestId("icon");
      const label = screen.getByText("Email");

      expect(icon.compareDocumentPosition(label)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe("Label styling", () => {
    it("applies correct text color to label", () => {
      const { container } = render(<DetailField label="Label" value="Value" />);

      const label = container.querySelector(".text-neutral-600");
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("Label");
    });

    it("label does not have a colon", () => {
      render(<DetailField label="Field Name" value="Value" />);

      expect(screen.getByText("Field Name")).toBeInTheDocument();
      expect(screen.queryByText("Field Name:")).not.toBeInTheDocument();
    });
  });

  describe("Value styling", () => {
    it("applies proper text styling to value", () => {
      render(<DetailField label="Label" value="Value" />);

      const valueElement = screen.getByText("Value");
      expect(valueElement).toHaveClass("text-sm");
    });

    it("value can have custom styling via ReactNode", () => {
      render(
        <DetailField
          label="Amount"
          value={
            <span data-testid="custom-value" className="font-mono font-bold">
              $1,234.56
            </span>
          }
        />
      );

      const customValue = screen.getByTestId("custom-value");
      expect(customValue).toHaveClass("font-mono", "font-bold");
    });
  });

  describe("Empty or undefined values", () => {
    it("renders empty string value", () => {
      render(<DetailField label="Label" value="" />);

      expect(screen.getByText("Label")).toBeInTheDocument();
      // Empty value should still render
      const { container } = render(<DetailField label="Label" value="" />);
      expect(container.querySelector(".text-sm.text-neutral-900")?.textContent).toBe("");
    });

    it("renders zero as value", () => {
      render(<DetailField label="Count" value={0} />);

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("renders false as value", () => {
      render(<DetailField label="Active" value={false as any} />);

      // false is rendered as empty by React, but the structure is there
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom valueClassName to value", () => {
      render(<DetailField label="Label" value="Value" valueClassName="custom-value-class" />);

      const value = screen.getByText("Value");
      expect(value).toHaveClass("custom-value-class", "text-sm", "text-neutral-900");
    });

    it("applies custom labelClassName to label", () => {
      render(<DetailField label="Label" value="Value" labelClassName="custom-label-class" />);

      const label = screen.getByText("Label");
      expect(label).toHaveClass("custom-label-class", "text-sm", "font-medium", "text-neutral-600");
    });
  });

  describe("Accessibility", () => {
    it("uses semantic HTML structure", () => {
      const { container } = render(<DetailField label="Label" value="Value" />);

      // Uses label element for vertical layout
      expect(container.querySelector("label")).toBeInTheDocument();
    });

    it("label is clearly associated with value", () => {
      render(<DetailField label="Email Address" value="test@example.com" />);

      const label = screen.getByText("Email Address");
      const value = screen.getByText("test@example.com");

      // Both should be in the document
      expect(label).toBeInTheDocument();
      expect(value).toBeInTheDocument();
    });
  });

  describe("Real-world examples", () => {
    it("renders currency value with monospace styling", () => {
      render(
        <DetailField
          label="Total Amount"
          value={<span className="font-mono text-lg font-bold">₱5,000.00</span>}
        />
      );

      expect(screen.getByText("₱5,000.00")).toHaveClass("font-mono", "font-bold");
    });

    it("renders date with proper formatting", () => {
      render(
        <DetailField label="Created At" value={new Date("2024-01-15").toLocaleDateString()} />
      );

      expect(screen.getByText(/1\/15\/2024|15\/1\/2024/)).toBeInTheDocument();
    });

    it("renders link as value", () => {
      render(
        <DetailField
          label="Website"
          value={
            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              example.com
            </a>
          }
        />
      );

      const link = screen.getByText("example.com");
      expect(link).toHaveAttribute("href", "https://example.com");
    });

    it("renders status badge as value", () => {
      render(
        <DetailField
          label="Status"
          value={
            <span
              data-testid="status-badge"
              className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"
            >
              Active
            </span>
          }
        />
      );

      expect(screen.getByTestId("status-badge")).toBeInTheDocument();
    });
  });

  describe("Complex layouts", () => {
    it("handles multiple fields in a grid", () => {
      render(
        <div className="grid grid-cols-2 gap-4">
          <DetailField label="First Name" value="John" />
          <DetailField label="Last Name" value="Doe" />
          <DetailField label="Email" value="john@example.com" />
          <DetailField label="Phone" value="123-456-7890" />
        </div>
      );

      expect(screen.getByText("First Name")).toBeInTheDocument();
      expect(screen.getByText("John")).toBeInTheDocument();
      expect(screen.getByText("Last Name")).toBeInTheDocument();
      expect(screen.getByText("Doe")).toBeInTheDocument();
    });
  });
});
