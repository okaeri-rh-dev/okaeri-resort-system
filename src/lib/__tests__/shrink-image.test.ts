import { describe, expect, it, vi } from "vitest";

import { shrinkImage } from "@/lib/file-validation-client";

const imageCompression = vi.hoisted(() => vi.fn());
vi.mock("browser-image-compression", () => ({ default: imageCompression }));

const screenshot = new File([new Uint8Array(2_000_000)], "gcash receipt.png", {
  type: "image/png",
});

describe("shrinkImage", () => {
  it("shrinks an image to a JPEG with a 1600 px long edge and about 300 KB", async () => {
    imageCompression.mockResolvedValue(new Blob([new Uint8Array(250_000)], { type: "image/jpeg" }));

    const shrunk = await shrinkImage(screenshot);

    expect(imageCompression).toHaveBeenCalledWith(
      screenshot,
      expect.objectContaining({
        maxWidthOrHeight: 1600,
        maxSizeMB: 0.3,
        fileType: "image/jpeg",
        useWebWorker: false,
      })
    );
    expect(shrunk.size).toBe(250_000);
    expect(shrunk.type).toBe("image/jpeg");
    expect(shrunk.name).toBe("gcash receipt.jpg");
  });

  it("returns a PDF unchanged", async () => {
    const pdf = new File(["%PDF-1.4"], "receipt.pdf", { type: "application/pdf" });

    expect(await shrinkImage(pdf)).toBe(pdf);
    expect(imageCompression).not.toHaveBeenCalled();
  });

  it("returns the original image when compression throws", async () => {
    imageCompression.mockImplementation(async () => {
      throw new Error("canvas unavailable");
    });

    expect(await shrinkImage(screenshot)).toBe(screenshot);
  });

  it("returns the original image when the result is not smaller", async () => {
    const small = new File([new Uint8Array(40_000)], "tiny.jpg", { type: "image/jpeg" });
    imageCompression.mockResolvedValue(new Blob([new Uint8Array(60_000)], { type: "image/jpeg" }));

    expect(await shrinkImage(small)).toBe(small);
  });
});
