import { beforeEach, describe, expect, it, vi } from "vitest";

import { compressAndValidateFile, formatFileSize } from "@/utils/file-compression";

// Mock browser-image-compression
vi.mock("browser-image-compression", () => ({
  default: vi.fn((file) => Promise.resolve(file)),
}));

// Mock heic2any
vi.mock("heic2any", () => ({
  default: vi.fn((options) => Promise.resolve(new Blob(["converted"], { type: "image/jpeg" }))),
}));

describe("File Compression Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("compressAndValidateFile", () => {
    it("should accept valid image files", async () => {
      const file = new File(["image content"], "test.jpg", { type: "image/jpeg" });
      const result = await compressAndValidateFile(file);

      expect(result).toBeDefined();
      expect(result.type).toBe("image/jpeg");
    });

    it("should accept PDF files", async () => {
      const file = new File(["pdf content"], "document.pdf", { type: "application/pdf" });
      const result = await compressAndValidateFile(file);

      expect(result).toBeDefined();
      expect(result.type).toBe("application/pdf");
    });

    it("should reject files over 2MB after compression", async () => {
      // Create a file larger than 2MB
      const largeContent = new Uint8Array(3 * 1024 * 1024); // 3MB
      const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });

      // Mock compression to return same large file
      const imageCompression = await import("browser-image-compression");
      vi.mocked(imageCompression.default).mockResolvedValueOnce(file);

      await expect(compressAndValidateFile(file)).rejects.toThrow(
        "File size must be less than 2MB after compression"
      );
    });

    it("should reject invalid file types", async () => {
      const file = new File(["content"], "test.exe", { type: "application/exe" });

      await expect(compressAndValidateFile(file)).rejects.toThrow(
        "File type application/exe not allowed"
      );
    });

    it("should convert HEIC files to JPEG", async () => {
      const file = new File(["heic content"], "photo.heic", { type: "image/heic" });
      const result = await compressAndValidateFile(file);

      expect(result.type).toBe("image/jpeg");
      expect(result.name).toContain(".jpg");
    });

    it("should compress images larger than 500KB", async () => {
      const largeContent = new Uint8Array(600 * 1024); // 600KB
      const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });

      const imageCompression = await import("browser-image-compression");
      const compressedFile = new File(["compressed"], "compressed.jpg", { type: "image/jpeg" });
      vi.mocked(imageCompression.default).mockResolvedValueOnce(compressedFile);

      const result = await compressAndValidateFile(file);

      expect(imageCompression.default).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        })
      );
      expect(result).toBe(compressedFile);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
      expect(formatFileSize(500)).toBe("500 Bytes");
    });

    it("should format kilobytes correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(10240)).toBe("10 KB");
    });

    it("should format megabytes correctly", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
      expect(formatFileSize(2097152)).toBe("2 MB");
      expect(formatFileSize(1572864)).toBe("1.5 MB");
    });
  });
});
