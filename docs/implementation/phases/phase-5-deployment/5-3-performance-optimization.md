# Sub-Phase 5.3: Performance Optimization (REFACTOR Phase)

## Overview

This sub-phase represents the REFACTOR phase of our TDD approach, focusing on
optimizing the application performance for Philippine users through advanced
caching strategies, edge function optimization, image optimization, and bundle
splitting. The goal is to achieve sub-3s load times while maintaining cost
efficiency within Vercel's free tier limits.

## Objectives

- **Load Time Optimization**: Achieve <3s load times on 3G networks for
  Philippine users
- **Edge Network Utilization**: Maximize Vercel's Edge Network for regional
  performance
- **Bundle Optimization**: Implement advanced code splitting and lazy loading
- **Image Optimization**: Deploy Vercel Image Optimization with WebP conversion
- **Caching Strategy**: Implement multi-layer caching with appropriate TTL
  values
- **Cost Efficiency**: Optimize performance while staying within free tier
  constraints

## Performance Targets for Philippine Market

### Network Conditions

- **3G Connection**: 1.6 Mbps download, 768 kbps upload, 400ms RTT
- **4G Connection**: 10 Mbps download, 5 Mbps upload, 100ms RTT
- **WiFi Connection**: 25 Mbps download, 10 Mbps upload, 50ms RTT

### Performance Goals

- **Time to First Byte (TTFB)**: < 200ms (Singapore edge)
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Interaction to Next Paint (INP)**: < 200ms
- **Cumulative Layout Shift (CLS)**: < 0.1

## 1. Advanced Edge Function Optimization

### Edge Function Configuration

```json
// vercel.json - Enhanced edge configuration
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x",
      "regions": ["cle1", "hnd1", "sin1"],
      "maxDuration": 10,
      "memory": 1024
    },
    "api/auth/**/*.ts": {
      "runtime": "nodejs20.x",
      "regions": ["cle1", "sin1"],
      "maxDuration": 5,
      "memory": 512
    },
    "api/health/**/*.ts": {
      "runtime": "nodejs20.x",
      "regions": ["cle1", "hnd1", "sin1", "sfo1", "iad1"],
      "maxDuration": 3,
      "memory": 256
    }
  },
  "regions": ["cle1", "hnd1", "sin1"]
}
```

### Edge Function Optimization

```typescript
// api/_lib/edge-optimization.ts
// Note: No Next.js imports needed for Vercel Functions

export class EdgeOptimizer {
  private static memoryCache = new Map<
    string,
    { data: any; expires: number }
  >();

  /**
   * Optimize function cold starts by keeping connections warm
   */
  public static async warmConnection(): Promise<void> {
    // Keep database connections alive between invocations
    if (process.env.VERCEL_ENV === "production") {
      const warmupQuery = "SELECT 1 as alive";
      try {
        // This would use your database connection
        console.log("🔥 Connection warmed");
      } catch (error) {
        console.warn("Connection warmup failed:", error);
      }
    }
  }

  /**
   * In-memory caching for edge functions
   */
  public static getCached<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    if (cached) {
      this.memoryCache.delete(key);
    }
    return null;
  }

  public static setCached<T>(
    key: string,
    data: T,
    ttlMs: number = 60000
  ): void {
    // Limit cache size to prevent memory issues
    if (this.memoryCache.size > 100) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      data,
      expires: Date.now() + ttlMs,
    });
  }

  /**
   * Optimize response for Philippine users
   */
  public static optimizeResponse(request: Request, response: any): Response {
    const headers = new Headers();

    // Detect Philippine users for regional optimization
    const country = request.geo?.country || request.headers.get("cf-ipcountry");
    const isPhilippines = country === "PH";

    if (isPhilippines) {
      // Optimize for 3G networks common in Philippines
      headers.set(
        "Cache-Control",
        "public, max-age=300, stale-while-revalidate=60"
      );
      headers.set("X-Edge-Region", "singapore");
      headers.set("X-Optimized-For", "PH-mobile");
    } else {
      headers.set(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=300"
      );
    }

    // Add performance hints
    headers.set("X-DNS-Prefetch-Control", "on");
    headers.set("X-Preload-Fonts", "Inter-400,Inter-500,Inter-600");

    return new Response(JSON.stringify(response), { headers });
  }
}

// Edge function wrapper for optimization
export function withEdgeOptimization<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    // Warm connection on function start
    EdgeOptimizer.warmConnection();

    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;

      // Log performance metrics
      if (duration > 1000) {
        console.warn(`🐌 Slow function execution: ${duration}ms`);
      }

      return result;
    } catch (error) {
      console.error("Edge function error:", error);
      throw error;
    }
  };
}
```

### Optimized API Route Example

```typescript
// api/bookings/index.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { EdgeOptimizer, withEdgeOptimization } from "../_lib/edge-optimization";
import { secureDb } from "../../src/lib/db/secure-connection";
import { bookings } from "../../src/lib/db/schema";

async function getBookingsHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Try cache first
  const cacheKey = `bookings:${limit}:${offset}`;
  const cached = EdgeOptimizer.getCached(cacheKey);
  if (cached) {
    return EdgeOptimizer.optimizeResponse(request, {
      bookings: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  // Fetch from database
  const bookingsList = await secureDb
    .select()
    .from(bookings)
    .limit(limit)
    .offset(offset)
    .orderBy(bookings.createdAt);

  // Cache for 5 minutes
  EdgeOptimizer.setCached(cacheKey, bookingsList, 5 * 60 * 1000);

  return EdgeOptimizer.optimizeResponse(request, {
    bookings: bookingsList,
    cached: false,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withEdgeOptimization(getBookingsHandler);
```

## 2. Advanced Bundle Optimization

### Vite Configuration for Optimal Splitting

```typescript
// vite.config.ts - Enhanced for Philippine market
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.okaeri-resort\.vercel\.app\/api\/.*$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunk optimization for Philippine networks
          if (id.includes("node_modules")) {
            // Core React bundle
            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
            }

            // UI library bundle
            if (id.includes("@radix-ui") || id.includes("lucide-react")) {
              return "ui-vendor";
            }

            // Router and state management
            if (id.includes("@tanstack") || id.includes("zustand")) {
              return "state-vendor";
            }

            // Database and API
            if (id.includes("drizzle") || id.includes("@neondatabase")) {
              return "db-vendor";
            }

            // Form handling
            if (id.includes("react-hook-form") || id.includes("@hookform")) {
              return "forms-vendor";
            }

            // Date utilities
            if (id.includes("date-fns")) {
              return "date-vendor";
            }

            // Other vendors
            return "other-vendor";
          }

          // App-specific chunking
          if (id.includes("/src/pages/")) {
            return "pages";
          }

          if (id.includes("/src/components/")) {
            return "components";
          }

          if (id.includes("/src/stores/")) {
            return "stores";
          }
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId;
          if (facadeModuleId?.includes("node_modules")) {
            return "assets/vendor-[name]-[hash].js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
    // Optimize for 3G networks
    chunkSizeWarningLimit: 300, // 300kb chunks max
    sourcemap: false, // Disable sourcemaps in production for smaller bundles
    minify: "esbuild",
    cssMinify: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
```

### Dynamic Imports and Lazy Loading

```typescript
// src/lib/route-optimization.tsx
import { lazy, Suspense } from 'react'
import { SkeletonLoader } from '../components/loading'

// Lazy load pages with loading states optimized for 3G
export const LazyDashboardPage = lazy(() =>
  import('../pages/DashboardPage').then(module => ({
    default: module.DashboardPage
  }))
)

export const LazyBookingsPage = lazy(() =>
  import('../pages/BookingsPage').then(module => ({
    default: module.BookingsPage
  }))
)

export const LazyReportsPage = lazy(() =>
  import('../pages/ReportsPage').then(module => ({
    default: module.ReportsPage
  }))
)

// Preload strategy for frequently accessed routes
export const preloadDashboard = () => import('../pages/DashboardPage')
export const preloadBookings = () => import('../pages/BookingsPage')

// Smart preloading based on user behavior
export class RoutePreloader {
  private static preloadedRoutes = new Set<string>()
  private static intersectionObserver?: IntersectionObserver

  public static init(): void {
    // Preload critical routes immediately
    if (typeof window !== 'undefined') {
      // Preload dashboard (most common route)
      setTimeout(() => preloadDashboard(), 2000)

      // Set up intersection observer for navigation preloading
      this.setupIntersectionObserver()
    }
  }

  private static setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement
          const href = link.getAttribute('href')

          if (href && !this.preloadedRoutes.has(href)) {
            this.preloadRoute(href)
            this.preloadedRoutes.add(href)
          }
        }
      })
    }, { threshold: 0.1 })

    // Observe navigation links
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      this.intersectionObserver?.observe(link)
    })
  }

  private static preloadRoute(path: string): void {
    switch (path) {
      case '/dashboard':
        preloadDashboard()
        break
      case '/bookings':
        preloadBookings()
        break
      default:
        // Generic preload for other routes
        break
    }
  }
}

// Optimized Suspense wrapper for Philippine networks
export function OptimizedSuspense({
  children,
  fallback
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <Suspense fallback={fallback || <SkeletonLoader />}>
      {children}
    </Suspense>
  )
}

// Route component wrapper
export function createOptimizedRoute(Component: React.LazyExoticComponent<any>) {
  return function OptimizedRoute(props: any) {
    return (
      <OptimizedSuspense>
        <Component {...props} />
      </OptimizedSuspense>
    )
  }
}
```

## 3. Image Optimization Strategy

### Vercel Image Optimization Configuration

```typescript
// src/lib/image-optimization.tsx
import { ImgHTMLAttributes, useState } from 'react'

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
}

export function OptimizedImage({
  src,
  alt,
  width = 800,
  height = 600,
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  className = '',
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Generate optimized image URL for Vercel
  const optimizedSrc = `/_next/image?url=${encodeURIComponent(src)}&w=${width}&h=${height}&q=${quality}`

  // Fallback for error cases
  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  if (hasError) {
    return (
      <div
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-400 text-sm">Image unavailable</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && placeholder === 'blur' && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          style={{
            backgroundImage: blurDataURL ? `url(${blurDataURL})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        {...props}
      />
    </div>
  )
}

// Image preloading utility
export class ImagePreloader {
  private static cache = new Map<string, Promise<void>>()

  public static preload(src: string, priority: boolean = false): Promise<void> {
    if (this.cache.has(src)) {
      return this.cache.get(src)!
    }

    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = reject
      img.src = src

      if (priority) {
        img.loading = 'eager'
      }
    })

    this.cache.set(src, promise)
    return promise
  }

  public static preloadCritical(images: string[]): void {
    // Preload critical images immediately
    images.forEach(src => this.preload(src, true))
  }
}

// WebP support detection and conversion
export function getOptimizedImageFormat(): 'webp' | 'jpeg' {
  if (typeof window === 'undefined') return 'jpeg'

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1

  return canvas.toDataURL('image/webp').indexOf('webp') !== -1 ? 'webp' : 'jpeg'
}
```

### Image Optimization Middleware

```typescript
// api/images/optimize.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import sharp from "sharp";

interface ImageOptimizationRequest {
  url: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "jpeg" | "png";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const {
      url,
      width = 800,
      height = 600,
      quality = 75,
      format = "webp",
    } = (await request.json()) as ImageOptimizationRequest;

    // Fetch original image
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Optimize image with Sharp
    let sharpInstance = sharp(imageBuffer).resize(width, height, {
      fit: "cover",
      position: "center",
    });

    // Apply format-specific optimizations
    if (format === "webp") {
      sharpInstance = sharpInstance.webp({ quality, effort: 6 });
    } else if (format === "jpeg") {
      sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
    } else if (format === "png") {
      sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
    }

    const optimizedBuffer = await sharpInstance.toBuffer();

    // Cache the optimized image
    const cacheHeaders = {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": `image/${format}`,
      "Content-Length": optimizedBuffer.length.toString(),
      "X-Optimized": "true",
    };

    return new NextResponse(optimizedBuffer, { headers: cacheHeaders });
  } catch (error) {
    console.error("Image optimization error:", error);
    return NextResponse.json(
      { error: "Image optimization failed" },
      { status: 500 }
    );
  }
}
```

## 4. Advanced Caching Strategy

### Multi-Layer Caching Implementation

```typescript
// src/lib/caching-strategy.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  staleWhileRevalidate?: number; // SWR time in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Compress large payloads
}

export class AdvancedCacheManager {
  private static instance: AdvancedCacheManager;
  private memoryCache = new Map<
    string,
    { data: any; expires: number; tags: string[] }
  >();
  private readonly maxMemoryItems = 100;

  private constructor() {}

  public static getInstance(): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager();
    }
    return AdvancedCacheManager.instance;
  }

  /**
   * Multi-layer get: Memory -> Redis -> Source
   */
  public async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const {
      ttl = 3600,
      staleWhileRevalidate = 300,
      tags = [],
      compress = false,
    } = options;

    // Layer 1: Memory cache (fastest)
    const memoryResult = this.getFromMemory<T>(key);
    if (memoryResult !== null) {
      return memoryResult;
    }

    // Layer 2: Redis cache
    try {
      const redisData = await redis.get(key);
      if (redisData) {
        const data = compress
          ? this.decompress(redisData as string)
          : redisData;

        // Store in memory for next time
        this.setInMemory(key, data, ttl * 1000, tags);

        return data as T;
      }
    } catch (error) {
      console.warn("Redis cache error:", error);
    }

    // Layer 3: Fetch from source if fetcher provided
    if (fetcher) {
      const data = await fetcher();

      // Store in all cache layers
      await this.set(key, data, options);

      return data;
    }

    return null;
  }

  /**
   * Set data in all cache layers
   */
  public async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const { ttl = 3600, tags = [], compress = false } = options;

    // Store in memory
    this.setInMemory(key, data, ttl * 1000, tags);

    // Store in Redis
    try {
      const payload = compress ? this.compress(data) : data;
      await redis.setex(key, ttl, JSON.stringify(payload));

      // Store tags for invalidation
      if (tags.length > 0) {
        for (const tag of tags) {
          await redis.sadd(`tag:${tag}`, key);
          await redis.expire(`tag:${tag}`, ttl);
        }
      }
    } catch (error) {
      console.warn("Redis cache set error:", error);
    }
  }

  /**
   * Invalidate cache by key or tags
   */
  public async invalidate(
    keyOrTag: string,
    isTag: boolean = false
  ): Promise<void> {
    if (isTag) {
      // Invalidate all keys with this tag
      try {
        const keys = await redis.smembers(`tag:${keyOrTag}`);
        if (keys.length > 0) {
          // Remove from Redis
          await redis.del(...keys);
          await redis.del(`tag:${keyOrTag}`);

          // Remove from memory
          for (const key of keys) {
            this.memoryCache.delete(key);
          }
        }
      } catch (error) {
        console.warn("Cache invalidation error:", error);
      }
    } else {
      // Invalidate specific key
      this.memoryCache.delete(keyOrTag);
      try {
        await redis.del(keyOrTag);
      } catch (error) {
        console.warn("Redis delete error:", error);
      }
    }
  }

  /**
   * Stale-while-revalidate pattern
   */
  public async getSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<{ data: T; isStale: boolean }> {
    const { ttl = 3600, staleWhileRevalidate = 300 } = options;

    // Try to get fresh data
    const cached = await this.get<{ data: T; timestamp: number }>(key);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      const isStale = age > (ttl - staleWhileRevalidate) * 1000;

      if (isStale) {
        // Return stale data immediately, revalidate in background
        this.revalidateInBackground(key, fetcher, options);
        return { data: cached.data, isStale: true };
      }

      return { data: cached.data, isStale: false };
    }

    // No cached data, fetch fresh
    const data = await fetcher();
    await this.set(key, { data, timestamp: Date.now() }, options);

    return { data, isStale: false };
  }

  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const data = await fetcher();
      await this.set(key, { data, timestamp: Date.now() }, options);
    } catch (error) {
      console.warn("Background revalidation failed:", error);
    }
  }

  private getFromMemory<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    if (cached) {
      this.memoryCache.delete(key);
    }
    return null;
  }

  private setInMemory<T>(
    key: string,
    data: T,
    ttlMs: number,
    tags: string[]
  ): void {
    // Evict oldest items if cache is full
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      data,
      expires: Date.now() + ttlMs,
      tags,
    });
  }

  private compress<T>(data: T): string {
    return Buffer.from(JSON.stringify(data)).toString("base64");
  }

  private decompress(data: string): any {
    return JSON.parse(Buffer.from(data, "base64").toString());
  }
}
```

### Cache-Optimized API Example

```typescript
// api/dashboard/metrics.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AdvancedCacheManager } from '../../src/lib/caching-strategy'
import { secureDb } from '../../src/lib/db/secure-connection'
import { bookings, expenses } from '../../src/lib/db/schema'
import { sql } from 'drizzle-orm'

const cacheManager = AdvancedCacheManager.getInstance()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId') || 'default'
    const timeRange = url.searchParams.get('range') || '30d'

    const cacheKey = `dashboard:metrics:${projectId}:${timeRange}`
    const cacheTags = ['dashboard', `project:${projectId}`, 'metrics']

    // Use SWR caching for dashboard metrics
    const result = await cacheManager.getSWR(
      cacheKey,
      async () => {
        // Fetch metrics from database
        const [bookingStats, expenseStats] = await Promise.all([
          secureDb
            .select({
              total: sql<number>`count(*)`,
              revenue: sql<number>`sum(total_amount)`
            })
            .from(bookings),

          secureDb
            .select({
              total: sql<number>`count(*)`,
              amount: sql<number>`sum(amount)`
            })
            .from(expenses)
        ])

        return {
          bookings: bookingStats[0],
          expenses: expenseStats[0],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        ttl: 300, // 5 minutes
        staleWhileRevalidate: 60, // 1 minute
        tags: cacheTags
      }
    )

    res.setHeader('Cache-Control', result.isStale
      ? 'public, max-age=60, stale-while-revalidate=300'
      : 'public, max-age=300, stale-while-revalidate=60')
    res.setHeader('X-Cache', result.isStale ? 'STALE' : 'HIT')
    return res.status(200).json({
      ...result.data,
      cached: !result.isStale,
      isStale: result.isStale
    })
  } catch (error) {
    console.error('Dashboard metrics error:', error)
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 })
  }
}

// Cache invalidation endpoint
  } else if (req.method === 'DELETE') {
  try {
    const { tags } = req.body

    for (const tag of tags) {
      await cacheManager.invalidate(tag, true)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Cache invalidation failed' }, { status: 500 })
  }
}
```

## 5. Performance Monitoring and Optimization

### Real-time Performance Monitoring

```typescript
// src/lib/performance-monitor.ts
export interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  jsHeapSize: number;
  connectionType: string;
  region: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  private constructor() {
    if (typeof window !== "undefined") {
      this.initializeMonitoring();
    }
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeMonitoring(): void {
    // Core Web Vitals monitoring
    this.observeWebVitals();

    // Navigation timing
    this.observeNavigationTiming();

    // Resource timing
    this.observeResourceTiming();

    // Memory monitoring
    this.observeMemoryUsage();

    // Connection monitoring
    this.observeConnectionType();

    // Send metrics periodically
    setInterval(() => this.reportMetrics(), 30000); // Every 30 seconds
  }

  private observeWebVitals(): void {
    // LCP Observer
    if ("PerformanceObserver" in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "largest-contentful-paint") {
            this.metrics.largestContentfulPaint = entry.startTime;
          }
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      this.observers.push(lcpObserver);

      // FCP Observer
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            this.metrics.firstContentfulPaint = entry.startTime;
          }
        }
      });
      fcpObserver.observe({ type: "paint", buffered: true });
      this.observers.push(fcpObserver);

      // CLS Observer
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.metrics.cumulativeLayoutShift = clsValue;
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
      this.observers.push(clsObserver);

      // INP Observer
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // INP measures all interactions, not just first input
          const interactionTime = entry.processingStart - entry.startTime;
          this.metrics.interactionToNextPaint = Math.max(
            this.metrics.interactionToNextPaint || 0,
            interactionTime
          );
        }
      });
      inpObserver.observe({ type: "event", buffered: true });
      this.observers.push(inpObserver);
    }
  }

  private observeNavigationTiming(): void {
    if ("performance" in window && "getEntriesByType" in performance) {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.metrics.pageLoadTime =
          navigation.loadEventEnd - navigation.fetchStart;
        this.metrics.timeToInteractive =
          navigation.domInteractive - navigation.fetchStart;
      }
    }
  }

  private observeResourceTiming(): void {
    if ("PerformanceObserver" in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming;

          // Monitor slow resources
          if (resource.duration > 1000) {
            console.warn("Slow resource:", {
              name: resource.name,
              duration: resource.duration,
              size: resource.transferSize,
            });
          }
        }
      });
      resourceObserver.observe({ type: "resource", buffered: true });
      this.observers.push(resourceObserver);
    }
  }

  private observeMemoryUsage(): void {
    if ("memory" in (performance as any)) {
      const memory = (performance as any).memory;
      this.metrics.jsHeapSize = memory.usedJSHeapSize;

      // Monitor memory growth
      setInterval(() => {
        const currentMemory = memory.usedJSHeapSize;
        if (currentMemory > this.metrics.jsHeapSize! * 2) {
          console.warn("Memory usage doubled:", {
            previous: this.metrics.jsHeapSize,
            current: currentMemory,
          });
        }
        this.metrics.jsHeapSize = currentMemory;
      }, 10000);
    }
  }

  private observeConnectionType(): void {
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;
      this.metrics.connectionType = connection.effectiveType || "unknown";

      // Monitor connection changes
      connection.addEventListener("change", () => {
        this.metrics.connectionType = connection.effectiveType;
        console.log("Connection changed:", connection.effectiveType);
      });
    }
  }

  private async reportMetrics(): Promise<void> {
    if (Object.keys(this.metrics).length === 0) return;

    try {
      // Add user context
      const metricsReport = {
        ...this.metrics,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        region: this.detectRegion(),
      };

      // Send to analytics endpoint
      await fetch("/api/analytics/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metricsReport),
      });

      // Console log for development
      if (process.env.NODE_ENV === "development") {
        console.log("📊 Performance Metrics:", metricsReport);
      }
    } catch (error) {
      console.warn("Failed to report metrics:", error);
    }
  }

  private detectRegion(): string {
    // Simple timezone-based region detection for Philippines
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone.includes("Asia/Manila")) {
      return "PH";
    }
    return "unknown";
  }

  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  public cleanup(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Initialize performance monitoring
if (typeof window !== "undefined") {
  PerformanceMonitor.getInstance();
}
```

## 6. Performance Testing and Validation

### Automated Performance Tests

```typescript
// tests/performance/performance-optimization.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page } from "playwright";

describe("Performance Optimization Validation", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe("Core Web Vitals", () => {
    it("should achieve target LCP for Philippine 3G networks", async () => {
      // Simulate 3G network
      await page.route("**/*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Add 100ms delay
        route.continue();
      });

      await page.goto(process.env.TEST_URL || "http://localhost:3000");

      const lcp = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === "largest-contentful-paint") {
                resolve(entry.startTime);
                observer.disconnect();
              }
            }
          });
          observer.observe({
            type: "largest-contentful-paint",
            buffered: true,
          });

          // Timeout after 10 seconds
          setTimeout(() => resolve(0), 10000);
        });
      });

      expect(lcp).toBeLessThan(2500); // Target: < 2.5s
      expect(lcp).toBeGreaterThan(0); // Should have measurement
    });

    it("should achieve target FCP", async () => {
      await page.goto(process.env.TEST_URL || "http://localhost:3000");

      const fcp = await page.evaluate(() => {
        const paintEntries = performance.getEntriesByType("paint");
        const fcpEntry = paintEntries.find(
          (entry) => entry.name === "first-contentful-paint"
        );
        return fcpEntry?.startTime || 0;
      });

      expect(fcp).toBeLessThan(1500); // Target: < 1.5s
      expect(fcp).toBeGreaterThan(0);
    });

    it("should maintain low CLS", async () => {
      await page.goto(process.env.TEST_URL || "http://localhost:3000");

      // Wait for page to settle
      await page.waitForTimeout(3000);

      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          });

          observer.observe({ type: "layout-shift", buffered: true });

          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 2000);
        });
      });

      expect(cls).toBeLessThan(0.1); // Target: < 0.1
    });
  });

  describe("Bundle Size Optimization", () => {
    it("should not exceed bundle size limits", async () => {
      const response = await page.goto(
        process.env.TEST_URL || "http://localhost:3000"
      );
      expect(response?.ok()).toBe(true);

      // Check main bundle size
      const bundles = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll("script[src]"));
        return Promise.all(
          scripts.map(async (script) => {
            const src = (script as HTMLScriptElement).src;
            if (src.includes("/assets/") && src.includes("index")) {
              const response = await fetch(src);
              const size = parseInt(
                response.headers.get("content-length") || "0"
              );
              return { src, size };
            }
            return null;
          })
        ).then((results) => results.filter(Boolean));
      });

      const mainBundle = bundles.find((bundle) =>
        bundle?.src.includes("index")
      );
      if (mainBundle) {
        expect(mainBundle.size).toBeLessThan(500 * 1024); // 500KB limit
      }
    });

    it("should implement effective code splitting", async () => {
      await page.goto(process.env.TEST_URL || "http://localhost:3000");

      const scriptTags = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("script[src]"))
          .map((script) => (script as HTMLScriptElement).src)
          .filter((src) => src.includes("/assets/"));
      });

      // Should have multiple chunks indicating code splitting
      expect(scriptTags.length).toBeGreaterThan(3);

      // Should have vendor chunks
      const vendorChunks = scriptTags.filter((src) => src.includes("vendor"));
      expect(vendorChunks.length).toBeGreaterThan(0);
    });
  });

  describe("Caching Effectiveness", () => {
    it("should implement proper cache headers", async () => {
      const response = await page.goto(
        process.env.TEST_URL || "http://localhost:3000"
      );
      const headers = response?.headers();

      // Static assets should have long cache
      if (
        headers?.["content-type"]?.includes("javascript") ||
        headers?.["content-type"]?.includes("css")
      ) {
        expect(headers["cache-control"]).toContain("max-age");
        expect(headers["cache-control"]).toContain("immutable");
      }
    });

    it("should implement service worker caching", async () => {
      await page.goto(process.env.TEST_URL || "http://localhost:3000");

      const swRegistered = await page.evaluate(() => {
        return "serviceWorker" in navigator;
      });

      expect(swRegistered).toBe(true);

      // Wait for service worker to be active
      await page.waitForTimeout(2000);

      const swActive = await page.evaluate(() => {
        return navigator.serviceWorker.controller !== null;
      });

      expect(swActive).toBe(true);
    });
  });

  describe("Philippine Network Optimization", () => {
    it("should perform well on simulated 3G", async () => {
      // Simulate slow 3G: 1.5Mbps down, 750kbps up, 400ms RTT
      await page.route("**/*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 400)); // RTT delay
        route.continue();
      });

      const startTime = Date.now();
      await page.goto(process.env.TEST_URL || "http://localhost:3000");
      await page.waitForSelector("main", { timeout: 10000 });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000); // Should load in < 5s on 3G
    });

    it("should prioritize critical resources", async () => {
      await page.goto(process.env.TEST_URL || "http://localhost:3000");

      const criticalResources = await page.evaluate(() => {
        const resources = performance.getEntriesByType(
          "resource"
        ) as PerformanceResourceTiming[];
        return resources
          .filter(
            (resource) =>
              resource.name.includes("index") ||
              resource.name.includes("critical") ||
              resource.name.includes("main")
          )
          .map((resource) => ({
            name: resource.name,
            startTime: resource.startTime,
            duration: resource.duration,
          }))
          .sort((a, b) => a.startTime - b.startTime);
      });

      // Critical resources should load first
      expect(criticalResources.length).toBeGreaterThan(0);
      if (criticalResources.length > 1) {
        expect(criticalResources[0].startTime).toBeLessThan(
          criticalResources[1].startTime
        );
      }
    });
  });
});
```

## Implementation Timeline

### Day 1: Edge Functions and Bundle Optimization

- [ ] Deploy optimized edge function configuration
- [ ] Implement advanced bundle splitting
- [ ] Set up lazy loading for non-critical routes
- [ ] Test cold start performance

### Day 2: Image Optimization

- [ ] Configure Vercel Image Optimization
- [ ] Implement OptimizedImage component
- [ ] Set up WebP conversion pipeline
- [ ] Test image loading performance

### Day 3: Advanced Caching

- [ ] Deploy multi-layer cache system
- [ ] Implement SWR caching patterns
- [ ] Configure cache invalidation strategies
- [ ] Test cache hit ratios

### Day 4: Performance Monitoring

- [ ] Deploy real-time performance monitoring
- [ ] Set up Core Web Vitals tracking
- [ ] Configure performance alerting
- [ ] Validate performance targets

## Success Metrics

### Performance Targets

- ✅ Lighthouse Performance Score: > 90
- ✅ Time to First Byte: < 200ms
- ✅ First Contentful Paint: < 1.5s
- ✅ Largest Contentful Paint: < 2.5s
- ✅ Cumulative Layout Shift: < 0.1
- ✅ Bundle Size: Main bundle < 500KB

### Regional Performance (Philippines)

- ✅ 3G Load Time: < 5s
- ✅ 4G Load Time: < 3s
- ✅ Cache Hit Ratio: > 80%
- ✅ Edge Function Cold Start: < 500ms

### Cost Efficiency

- ✅ Stay within Vercel free tier limits
- ✅ Optimize bandwidth usage
- ✅ Minimize function execution time
- ✅ Efficient resource utilization

This comprehensive performance optimization ensures the Okaeri Resort Management
System delivers exceptional user experience for Philippine users while
maintaining cost efficiency and operational excellence.
