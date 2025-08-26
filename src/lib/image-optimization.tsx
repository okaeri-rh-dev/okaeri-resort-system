/**
 * Image Optimization Utilities
 * Provides intelligent image loading, compression, and caching
 * Optimized for mobile devices and slow connections
 */

// Image format support detection
const imageFormatSupport = {
  webp: false,
  avif: false,
  heic: false,
};

// Detect supported image formats on initialization
async function detectImageFormatSupport() {
  if (typeof window === "undefined") return;

  // Check WebP support
  try {
    const webpCanvas = document.createElement("canvas");
    webpCanvas.width = 1;
    webpCanvas.height = 1;
    imageFormatSupport.webp = webpCanvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  } catch {
    imageFormatSupport.webp = false;
  }

  // Check AVIF support
  try {
    const avifImage = new Image();
    imageFormatSupport.avif = await new Promise((resolve) => {
      avifImage.onload = () => resolve(true);
      avifImage.onerror = () => resolve(false);
      avifImage.src =
        "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=";
    });
  } catch {
    imageFormatSupport.avif = false;
  }
}

// Initialize format detection
detectImageFormatSupport();

/**
 * Optimized image component with lazy loading and format selection
 */
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  className?: string;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  quality = 75,
  className = "",
  priority = false,
  placeholder = "empty",
  blurDataURL,
  sizes,
  onLoad,
  onError,
}: OptimizedImageProps) {
  // Generate optimized image URLs
  const getOptimizedSrc = (format?: string) => {
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      return src;
    }

    const params = new URLSearchParams();
    if (width) params.set("w", width.toString());
    if (height) params.set("h", height.toString());
    if (quality !== 75) params.set("q", quality.toString());
    if (format) params.set("f", format);

    const hasParams = params.toString().length > 0;
    const separator = src.includes("?") ? "&" : "?";

    return hasParams ? `${src}${separator}${params}` : src;
  };

  // Create source set for different formats
  const createSources = () => {
    const sources = [];

    // AVIF - best compression
    if (imageFormatSupport.avif) {
      sources.push({
        srcSet: getOptimizedSrc("avif"),
        type: "image/avif",
      });
    }

    // WebP - good compression, wide support
    if (imageFormatSupport.webp) {
      sources.push({
        srcSet: getOptimizedSrc("webp"),
        type: "image/webp",
      });
    }

    return sources;
  };

  return (
    <picture className={`optimized-image ${className}`}>
      {createSources().map((source, index) => (
        <source key={index} srcSet={source.srcSet} type={source.type} sizes={sizes} />
      ))}
      <img
        src={getOptimizedSrc()}
        alt={alt}
        width={width}
        height={height}
        className="h-full w-full object-cover"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={onLoad}
        onError={onError}
        style={{
          contentVisibility: priority ? "visible" : "auto",
        }}
      />
    </picture>
  );
}

/**
 * Image preloader for critical images
 */
export class ImagePreloader {
  private loadedImages = new Set<string>();
  private preloadQueue: Array<{ src: string; priority: number }> = [];
  private isProcessing = false;

  /**
   * Add image to preload queue
   */
  preload(src: string, priority = 5) {
    if (this.loadedImages.has(src)) return;

    const existingIndex = this.preloadQueue.findIndex((item) => item.src === src);
    if (existingIndex >= 0) {
      // Update priority if higher
      if (this.preloadQueue[existingIndex]!.priority < priority) {
        this.preloadQueue[existingIndex]!.priority = priority;
      }
    } else {
      this.preloadQueue.push({ src, priority });
    }

    // Sort by priority (higher first)
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    this.processQueue();
  }

  /**
   * Process preload queue
   */
  private async processQueue() {
    if (this.isProcessing || this.preloadQueue.length === 0) return;

    this.isProcessing = true;

    // Process up to 3 images concurrently
    const batch = this.preloadQueue.splice(0, 3);

    await Promise.allSettled(batch.map((item) => this.loadImage(item.src)));

    this.isProcessing = false;

    // Continue processing if more images in queue
    if (this.preloadQueue.length > 0) {
      // Small delay to prevent blocking
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Load single image
   */
  private loadImage(src: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        this.loadedImages.add(src);
        resolve();
      };

      img.onerror = () => {
        console.warn(`Failed to preload image: ${src}`);
        resolve();
      };

      // Use optimal format
      img.src = this.getOptimizedImageUrl(src);
    });
  }

  /**
   * Get optimized image URL
   */
  private getOptimizedImageUrl(src: string): string {
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      return src;
    }

    const format = imageFormatSupport.avif ? "avif" : imageFormatSupport.webp ? "webp" : null;

    if (format) {
      const separator = src.includes("?") ? "&" : "?";
      return `${src}${separator}f=${format}`;
    }

    return src;
  }

  /**
   * Check if image is loaded
   */
  isLoaded(src: string): boolean {
    return this.loadedImages.has(src);
  }

  /**
   * Clear loaded images cache
   */
  clearCache() {
    this.loadedImages.clear();
  }
}

/**
 * Image compression utilities for file uploads
 */
export class ImageCompressor {
  /**
   * Compress image file for upload
   */
  static async compressImage(
    file: File,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: "jpeg" | "webp" | "png";
    } = {}
  ): Promise<File> {
    const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, format = "jpeg" } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: `image/${format}`,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          `image/${format}`,
          quality
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get image dimensions
   */
  static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

/**
 * Responsive image utilities
 */
export function generateImageSizes(
  breakpoints: Array<{ minWidth: number; imageWidth: number }>
): string {
  return breakpoints
    .sort((a, b) => b.minWidth - a.minWidth)
    .map(({ minWidth, imageWidth }, index) => {
      if (index === breakpoints.length - 1) {
        // Last breakpoint (smallest screen)
        return `${imageWidth}px`;
      }
      return `(min-width: ${minWidth}px) ${imageWidth}px`;
    })
    .join(", ");
}

/**
 * Common responsive image configurations
 */
export const responsiveImageConfigs = {
  hero: generateImageSizes([
    { minWidth: 1280, imageWidth: 1280 },
    { minWidth: 768, imageWidth: 768 },
    { minWidth: 640, imageWidth: 640 },
    { minWidth: 0, imageWidth: 390 },
  ]),
  card: generateImageSizes([
    { minWidth: 1024, imageWidth: 400 },
    { minWidth: 768, imageWidth: 350 },
    { minWidth: 640, imageWidth: 300 },
    { minWidth: 0, imageWidth: 280 },
  ]),
  thumbnail: generateImageSizes([
    { minWidth: 768, imageWidth: 150 },
    { minWidth: 0, imageWidth: 100 },
  ]),
};

/**
 * Lazy loading with Intersection Observer
 */
export class LazyImageLoader {
  private observer: IntersectionObserver | null = null;
  private loadedImages = new Set<HTMLImageElement>();

  constructor() {
    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              this.loadImage(img);
              this.observer?.unobserve(img);
            }
          });
        },
        {
          rootMargin: "50px", // Start loading 50px before image enters viewport
          threshold: 0.1,
        }
      );
    }
  }

  /**
   * Observe image for lazy loading
   */
  observe(img: HTMLImageElement) {
    if (this.observer && !this.loadedImages.has(img)) {
      this.observer.observe(img);
    }
  }

  /**
   * Load image
   */
  private loadImage(img: HTMLImageElement) {
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.classList.remove("lazy");
      img.classList.add("loaded");
      this.loadedImages.add(img);
    }
  }

  /**
   * Cleanup observer
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Create singleton instances
export const imagePreloader = new ImagePreloader();
export const lazyImageLoader = new LazyImageLoader();

// Connection-aware image loading
if (typeof window !== "undefined") {
  const connection = (navigator as any).connection;

  if (connection) {
    // Adjust image quality based on connection speed
    const getQualityByConnection = () => {
      const effectiveType = connection.effectiveType;

      if (effectiveType === "4g" && connection.downlink > 2) {
        return 85; // High quality for fast connections
      } else if (effectiveType === "3g" || connection.downlink > 0.5) {
        return 75; // Medium quality for moderate connections
      } else {
        return 60; // Lower quality for slow connections
      }
    };

    // Export connection-aware quality
    (window as any).__imageQuality = getQualityByConnection();

    // Update quality on connection change
    connection.addEventListener("change", () => {
      (window as any).__imageQuality = getQualityByConnection();
    });
  }
}
