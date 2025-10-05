import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileUploadField } from "@/components/guest-booking/FileUploadField";

describe("FileUploadField Component", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("should render upload area", () => {
    render(<FileUploadField onChange={mockOnChange} />);

    expect(screen.getByText(/drag & drop your file here/i)).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG or PDF/i)).toBeInTheDocument();
  });

  it("should accept valid file types", async () => {
    render(<FileUploadField onChange={mockOnChange} />);

    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(mockOnChange).toHaveBeenCalledWith(file);
  });

  it("should reject files over size limit", async () => {
    render(<FileUploadField onChange={mockOnChange} maxSize={1024} />); // 1KB limit

    const largeFile = new File(["x".repeat(2048)], "large.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [largeFile] } });
    });

    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.getByText(/file is too large/i)).toBeInTheDocument();
  });

  it("should reject invalid file types", async () => {
    render(<FileUploadField onChange={mockOnChange} accept="image/jpeg,image/png" />);

    const invalidFile = new File(["test"], "test.exe", { type: "application/exe" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [invalidFile] } });
    });

    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });

  it("should display file preview for images", async () => {
    const file = new File(["image content"], "preview.jpg", { type: "image/jpeg" });

    render(<FileUploadField onChange={mockOnChange} value={file} />);

    await waitFor(() => {
      expect(screen.getByText("preview.jpg")).toBeInTheDocument();
    });
  });

  it("should display file icon for PDFs", () => {
    const file = new File(["pdf content"], "document.pdf", { type: "application/pdf" });

    render(<FileUploadField onChange={mockOnChange} value={file} />);

    expect(screen.getByText("document.pdf")).toBeInTheDocument();
  });

  it("should allow file removal", async () => {
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    render(<FileUploadField onChange={mockOnChange} value={file} />);

    const removeButton = screen.getByRole("button");
    await userEvent.click(removeButton);

    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it("should be disabled when disabled prop is true", () => {
    render(<FileUploadField onChange={mockOnChange} disabled />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it("should format file size correctly", () => {
    const file = new File(["x".repeat(1536)], "test.jpg", { type: "image/jpeg" }); // 1.5KB

    render(<FileUploadField onChange={mockOnChange} value={file} />);

    expect(screen.getByText(/1\.5 KB/)).toBeInTheDocument();
  });

  it("should handle drag and drop", async () => {
    render(<FileUploadField onChange={mockOnChange} />);

    const dropZone = screen.getByText(/drag & drop your file here/i).closest("div");
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    const dataTransfer = {
      files: [file],
      types: ["Files"],
    };

    if (dropZone) {
      fireEvent.dragOver(dropZone, { dataTransfer });
      expect(screen.getByText(/drop the file here/i)).toBeInTheDocument();

      fireEvent.drop(dropZone, { dataTransfer });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(file);
      });
    }
  });
});
