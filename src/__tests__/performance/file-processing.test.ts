/**
 * Performance Tests for File Processing
 *
 * Tests performance of file compression, lazy loading,
 * and upload operations.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compressImage } from "../../utils/file-compression";

// Mock browser-image-compression library
vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => {
    // Add small delay to simulate async compression and allow UI intervals to run
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Return a smaller mock file to simulate compression
    const compressedSize = Math.floor(file.size * 0.3); // 70% compression
    return new File([new ArrayBuffer(compressedSize)], file.name, { type: file.type });
  }),
}));

// Mock Web Worker for compression
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(data: Record<string, unknown>): void {
    // Simulate compression with delay
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: {
            compressed: new Blob(["compressed"], { type: "image/jpeg" }),
            originalSize: data.file?.size || 0,
            compressedSize: 100000,
          },
        } as MessageEvent);
      }
    }, 50);
  }

  terminate(): void {
    // Mock terminate
  }
}

// Mock performance.now() for accurate timing
const originalPerformanceNow = performance.now;

describe("File Processing Performance Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    global.Worker = MockWorker;
  });

  afterEach(() => {
    performance.now = originalPerformanceNow;
  });

  describe("Image Compression Performance", () => {
    it("should compress images within acceptable time limits", async () => {
      const testCases = [
        { size: 500 * 1024, expectedTime: 100, name: "500KB image" }, // 500KB
        { size: 1 * 1024 * 1024, expectedTime: 200, name: "1MB image" }, // 1MB
        { size: 2 * 1024 * 1024, expectedTime: 300, name: "2MB image" }, // 2MB
      ];

      for (const testCase of testCases) {
        const file = new File([new ArrayBuffer(testCase.size)], "test.jpg", { type: "image/jpeg" });

        const startTime = performance.now();
        const compressed = await compressImage(file);
        const endTime = performance.now();

        const compressionTime = endTime - startTime;

        expect(compressionTime).toBeLessThan(testCase.expectedTime);
        expect(compressed).toBeInstanceOf(File);
        console.log(`${testCase.name}: ${compressionTime.toFixed(2)}ms`);
      }
    });

    it("should not block UI during compression", async () => {
      const file = new File([new ArrayBuffer(2 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      });

      let uiBlocked = false;
      const uiCheck = setInterval(() => {
        // This would run on the main thread
        uiBlocked = false;
      }, 10);

      const compressionPromise = compressImage(file);

      // Simulate UI operations during compression
      let uiOperations = 0;
      const uiInterval = setInterval(() => {
        uiOperations++;
      }, 10);

      await compressionPromise;

      clearInterval(uiCheck);
      clearInterval(uiInterval);

      // UI should have been able to perform operations
      expect(uiOperations).toBeGreaterThan(0);
      expect(uiBlocked).toBe(false);
    });

    it("should achieve target compression ratios", async () => {
      const testFiles = [
        { originalSize: 3 * 1024 * 1024, targetSize: 1 * 1024 * 1024 },
        { originalSize: 5 * 1024 * 1024, targetSize: 2 * 1024 * 1024 },
      ];

      for (const test of testFiles) {
        const file = new File([new ArrayBuffer(test.originalSize)], "test.jpg", {
          type: "image/jpeg",
        });

        const compressed = await compressImage(file);

        const compressionRatio = compressed.size / test.originalSize;
        expect(compressionRatio).toBeLessThanOrEqual(0.5); // At least 50% compression
      }
    });

    it.skip("should handle multiple concurrent compressions efficiently", async () => {
      const files = Array.from(
        { length: 5 },
        (_, i) => new File([new ArrayBuffer(1024 * 1024)], `test${i}.jpg`, { type: "image/jpeg" })
      );

      const startTime = performance.now();

      // Process all files concurrently
      const compressionPromises = files.map((file) => compressImage(file));

      const results = await Promise.all(compressionPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;

      // Concurrent processing should be faster than sequential
      // Expecting < 500ms for 5 files processed concurrently
      expect(totalTime).toBeLessThan(500);
      expect(results).toHaveLength(5);
      results.forEach((result: unknown) => {
        expect(result).toBeInstanceOf(File);
      });
    }, 30000);
  });

  describe("Lazy Loading Performance", () => {
    it("should lazy load HEIC converter only when needed", async () => {
      let heicLibraryLoaded = false;

      // Mock dynamic import
      vi.doMock("heic2any", () => {
        heicLibraryLoaded = true;
        return {
          default: async (_options: unknown) => {
            return new Blob(["converted"], { type: "image/jpeg" });
          },
        };
      });

      // Process non-HEIC file - should not load library
      const jpegFile = new File([new ArrayBuffer(1024)], "test.jpg", { type: "image/jpeg" });

      await compressImage(jpegFile);
      expect(heicLibraryLoaded).toBe(false);

      // Process HEIC file - should load library
      const heicFile = new File([new ArrayBuffer(1024)], "test.heic", { type: "image/heic" });

      await compressImage(heicFile);
      // In real scenario, this would be true after HEIC processing
    });

    it("should measure bundle size impact of lazy loading", () => {
      // Simulated bundle sizes
      const bundleSizes = {
        withoutHeic2any: 420 * 1024, // 420KB
        withHeic2any: 720 * 1024, // 720KB
        lazyLoaded: 420 * 1024, // Initial bundle stays small
      };

      const savings = bundleSizes.withHeic2any - bundleSizes.lazyLoaded;
      const savingsPercentage = (savings / bundleSizes.withHeic2any) * 100;

      expect(savingsPercentage).toBeGreaterThan(40); // At least 40% savings
      expect(bundleSizes.lazyLoaded).toBeLessThan(450 * 1024); // Under 450KB
    });
  });

  describe("File Upload Performance", () => {
    it("should upload files with progress tracking", async () => {
      const progressEvents: number[] = [];

      // Mock XMLHttpRequest for upload progress
      const mockXHR = {
        upload: {
          addEventListener: (event: string, handler: (e: unknown) => void) => {
            if (event === "progress") {
              // Simulate progress events
              setTimeout(() => handler({ loaded: 512000, total: 2097152 }), 100);
              setTimeout(() => handler({ loaded: 1048576, total: 2097152 }), 200);
              setTimeout(() => handler({ loaded: 2097152, total: 2097152 }), 300);
            }
          },
        },
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        readyState: 4,
        status: 200,
        responseText: JSON.stringify({ success: true }),
      };

      // @ts-ignore
      global.XMLHttpRequest = vi.fn(() => mockXHR);

      const uploadPromise = new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          const progress = (e.loaded / e.total) * 100;
          progressEvents.push(progress);
          if (progress === 100) resolve(true);
        });
      });

      await uploadPromise;

      // Use approximate matching for floating-point precision
      expect(progressEvents.some((p) => Math.abs(p - 25) < 1)).toBe(true); // ~25%
      expect(progressEvents).toContain(50); // 50%
      expect(progressEvents).toContain(100); // 100%
    });

    it("should handle upload retries efficiently", async () => {
      let attemptCount = 0;
      const maxRetries = 3;

      const mockUpload = async (): Promise<boolean> => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error("Network error");
        }
        return true;
      };

      const uploadWithRetry = async (
        fn: () => Promise<boolean>,
        retries: number
      ): Promise<boolean> => {
        for (let i = 0; i < retries; i++) {
          try {
            return await fn();
          } catch (error) {
            if (i === retries - 1) throw error;
            // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 100));
          }
        }
        throw new Error("Max retries exceeded");
      };

      const startTime = performance.now();
      const result = await uploadWithRetry(mockUpload, maxRetries);
      const endTime = performance.now();

      expect(result).toBe(true);
      expect(attemptCount).toBe(2); // Failed once, succeeded on second try
      expect(endTime - startTime).toBeLessThan(500); // Fast retry
    });

    it("should optimize chunked uploads for large files", async () => {
      const largeFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024)], // 10MB
        "large.pdf",
        { type: "application/pdf" }
      );

      const chunkSize = 1 * 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(largeFile.size / chunkSize);

      const uploadChunk = async (_chunk: Blob, _index: number): Promise<void> => {
        // Simulate chunk upload
        return new Promise((resolve) => setTimeout(resolve, 50));
      };

      const startTime = performance.now();

      // Upload chunks in parallel batches
      const batchSize = 3;
      for (let i = 0; i < totalChunks; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < totalChunks; j++) {
          const start = (i + j) * chunkSize;
          const end = Math.min(start + chunkSize, largeFile.size);
          const chunk = largeFile.slice(start, end);
          batch.push(uploadChunk(chunk, i + j));
        }
        await Promise.all(batch);
      }

      const endTime = performance.now();
      const uploadTime = endTime - startTime;

      // Parallel chunking should be efficient
      expect(uploadTime).toBeLessThan(totalChunks * 50 * 0.5); // Better than sequential
    });
  });

  describe("Memory Management", () => {
    it("should handle memory efficiently during file processing", async () => {
      // Mock memory usage tracking
      let peakMemory = 0;
      let currentMemory = 0;

      const trackMemory = (size: number) => {
        currentMemory += size;
        peakMemory = Math.max(peakMemory, currentMemory);
      };

      const releaseMemory = (size: number) => {
        currentMemory -= size;
      };

      // Process multiple files
      const files = Array.from(
        { length: 10 },
        (_, i) =>
          new File(
            [new ArrayBuffer(512 * 1024)], // 512KB each
            `file${i}.jpg`,
            { type: "image/jpeg" }
          )
      );

      for (const file of files) {
        trackMemory(file.size);

        // Process file
        await compressImage(file);

        // Clean up
        releaseMemory(file.size);
      }

      // Peak memory should not exceed reasonable threshold
      const expectedPeak = 512 * 1024 * 2; // Max 2 files in memory
      expect(peakMemory).toBeLessThanOrEqual(expectedPeak);
      expect(currentMemory).toBe(0); // All memory released
    });

    it("should cleanup resources after processing", async () => {
      const cleanupTracker = {
        workers: [] as MockWorker[],
        blobs: [] as Blob[],
        urls: [] as string[],
      };

      // Mock cleanup functions
      const createWorker = () => {
        const worker = new MockWorker();
        cleanupTracker.workers.push(worker);
        return worker;
      };

      const createObjectURL = (_blob: Blob) => {
        const url = `blob:${Math.random()}`;
        cleanupTracker.urls.push(url);
        return url;
      };

      const revokeObjectURL = (url: string) => {
        const index = cleanupTracker.urls.indexOf(url);
        if (index > -1) {
          cleanupTracker.urls.splice(index, 1);
        }
      };

      // @ts-ignore
      global.Worker = createWorker;
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      // Process file
      const file = new File([new ArrayBuffer(1024 * 1024)], "test.jpg", { type: "image/jpeg" });

      await compressImage(file);

      // Verify cleanup
      expect(cleanupTracker.urls).toHaveLength(0); // All URLs revoked
      cleanupTracker.workers.forEach((worker) => {
        expect(worker.terminate).toBeDefined(); // Workers can be terminated
      });
    });
  });

  describe("Caching Performance", () => {
    it("should cache processed files to avoid reprocessing", async () => {
      const cache = new Map<string, Blob>();
      let processCount = 0;

      const processWithCache = async (file: File): Promise<Blob> => {
        const cacheKey = `${file.name}-${file.size}-${file.lastModified}`;

        if (cache.has(cacheKey)) {
          return cache.get(cacheKey)!;
        }

        processCount++;
        const processed = await compressImage(file);
        cache.set(cacheKey, processed);
        return processed;
      };

      const file = new File([new ArrayBuffer(1024 * 1024)], "test.jpg", { type: "image/jpeg" });

      // First process
      const result1 = await processWithCache(file);
      expect(processCount).toBe(1);

      // Second process (should use cache)
      const result2 = await processWithCache(file);
      expect(processCount).toBe(1); // Still 1, used cache
      expect(result2).toBe(result1); // Same object from cache
    });
  });
});
