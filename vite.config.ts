import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // TanStack Router Vite plugin for file-based routing
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      routeFileIgnorePrefix: "-",
      quoteStyle: "single",
    }),
    react({
      // Enable React Fast Refresh in development
      tsDecorators: true,
    }),
    tsconfigPaths(),
    // Tailwind CSS v4 Vite plugin
    tailwindcss(),
    // PWA configuration with offline support (disabled in development)
    process.env.NODE_ENV === "production" &&
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          // Cache all static assets
          globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff2}"],
          // Custom runtime caching
          runtimeCaching: [
            // API responses with network-first strategy
            {
              urlPattern: /^\/api\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 5 * 60, // 5 minutes
                },
                networkTimeoutSeconds: 3,
              },
            },
            // Route data with stale-while-revalidate
            {
              urlPattern: ({ request }) => request.destination === "document",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "route-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 24 * 60 * 60, // 24 hours
                },
              },
            },
            // Static assets with cache-first
            {
              urlPattern: /\.(js|css|png|jpg|jpeg|webp|svg|woff2)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
              },
            },
          ],
          // Skip waiting and claim clients immediately
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: {
          name: "Okaeri Resort System",
          short_name: "Okaeri Resort",
          description:
            "Comprehensive resort management system for booking, expenses, and analytics",
          theme_color: "#0EA5E9",
          background_color: "#0F172A",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/dashboard",
          scope: "/",
          icons: [
            {
              src: "/icons/icon-72x72.png",
              sizes: "72x72",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icons/icon-96x96.png",
              sizes: "96x96",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icons/icon-128x128.png",
              sizes: "128x128",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icons/icon-144x144.png",
              sizes: "144x144",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icons/icon-152x152.png",
              sizes: "152x152",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icons/icon-384x384.png",
              sizes: "384x384",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable any",
            },
          ],
          categories: ["business", "productivity"],
          screenshots: [
            {
              src: "/screenshots/dashboard.png",
              sizes: "1280x720",
              type: "image/png",
              form_factor: "wide",
              label: "Dashboard Overview",
            },
            {
              src: "/screenshots/mobile-dashboard.png",
              sizes: "390x844",
              type: "image/png",
              form_factor: "narrow",
              label: "Mobile Dashboard",
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: "module",
        },
      }),
    // Bundle analyzer for production builds
    process.env.ANALYZE &&
      visualizer({
        filename: "dist/bundle-analysis.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),

  // Path aliases matching tsconfig.json
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/components": resolve(__dirname, "./src/components"),
      "@/hooks": resolve(__dirname, "./src/hooks"),
      "@/lib": resolve(__dirname, "./src/lib"),
      "@/stores": resolve(__dirname, "./src/stores"),
      "@/types": resolve(__dirname, "./src/types"),
      "@/utils": resolve(__dirname, "./src/utils"),
      "@/constants": resolve(__dirname, "./src/constants"),
      "@/assets": resolve(__dirname, "./src/assets"),
      "@/features": resolve(__dirname, "./src/features"),
      "@/pages": resolve(__dirname, "./src/pages"),
      "@/layouts": resolve(__dirname, "./src/layouts"),
      // Fix for use-sync-external-store ESM compatibility with React 19
      "use-sync-external-store/shim/with-selector": resolve(
        __dirname,
        "node_modules/use-sync-external-store/shim/with-selector.js"
      ),
      // TanStack also uses this import path with .js extension
      "use-sync-external-store/shim/with-selector.js": resolve(
        __dirname,
        "node_modules/use-sync-external-store/shim/with-selector.js"
      ),
      // Prevent zustand/traditional from being loaded
      "zustand/traditional": resolve(__dirname, "node_modules/zustand/esm/react.mjs"),
      // Ensure correct module resolution for use-sync-external-store
      "use-sync-external-store/shim": resolve(
        __dirname,
        "node_modules/use-sync-external-store/shim/index.js"
      ),
      "use-sync-external-store": resolve(
        __dirname,
        "node_modules/use-sync-external-store/index.js"
      ),
    },
  },

  // Development server configuration
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    // Enable CORS for development
    cors: true,
    // Proxy API routes to avoid CORS issues during development
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },

  // Preview server configuration
  preview: {
    port: 3000,
    strictPort: true,
    host: true,
  },

  // Build configuration optimized for Vercel - Enhanced for Week 3.2 & 3.3
  build: {
    // Target modern browsers for better optimization
    target: "es2022",

    // Performance budget configuration - Enhanced monitoring
    reportCompressedSize: true,

    // CSS optimizations
    cssCodeSplit: true,
    cssMinify: true,

    // Output directory structure
    outDir: "dist",
    assetsDir: "assets",

    // Enhanced source maps for debugging
    sourcemap: process.env.NODE_ENV === "development" ? true : "hidden",

    // Advanced minification with esbuild for speed
    minify: "esbuild",

    // Aggressive chunk size limit for 30% bundle reduction target
    chunkSizeWarningLimit: 200, // Reduced from 300 for better mobile performance

    // Enhanced esbuild options for better compression
    esbuildOptions: {
      // Tree shaking optimization
      treeShaking: true,
      // Drop console statements in production
      drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
      // Mangle properties for smaller bundles
      mangleProps: process.env.NODE_ENV === "production" ? /^_/ : undefined,
      // Preserve names for better debugging in development
      keepNames: process.env.NODE_ENV === "development",
      // Legal comments handling
      legalComments: "none",
    },

    // Rollup options for aggressive code splitting - Enhanced for 195KB target
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },

      // Treeshaking configuration
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },

      output: {
        // Ultra-optimized chunk splitting strategy - 30% reduction target
        manualChunks: (id) => {
          // Critical app shell - Keep as small as possible (<20KB)
          if (
            id.includes("/src/main.tsx") ||
            id.includes("/src/App.tsx") ||
            id.includes("react/jsx-runtime")
          ) {
            return "app-shell";
          }

          // React core - Minimal essential React (<25KB)
          if (id.includes("react-dom/client") && !id.includes("react-router")) {
            return "react-core";
          }

          // React ecosystem - Non-critical React features
          if (id.includes("react") && !id.includes("react-hook-form")) {
            return "react-ecosystem";
          }

          // State management - Critical but small (<15KB)
          if (
            id.includes("zustand") ||
            id.includes("immer") ||
            id.includes("use-sync-external-store")
          ) {
            return "state-management";
          }

          // Essential UI primitives - Critical for shell (<20KB)
          if (
            id.includes("@radix-ui/react-slot") ||
            id.includes("class-variance-authority") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            (id.includes("/src/components/ui/") && !id.includes("dialog") && !id.includes("toast"))
          ) {
            return "ui-primitives";
          }

          // Router - Load after initial render (<30KB)
          if (id.includes("@tanstack/react-router")) {
            return "router-engine";
          }

          // Query client - Load with data fetching (<25KB)
          if (id.includes("@tanstack/react-query")) {
            return "data-fetching";
          }

          // Authentication components - Lazy load (<20KB)
          if (
            id.includes("/routes/_auth") ||
            id.includes("/features/auth") ||
            id.includes("jsonwebtoken")
          ) {
            return "auth-features";
          }

          // Financial components - Domain-specific lazy load (<40KB)
          if (
            id.includes("/features/financial") ||
            id.includes("/components/optimized") ||
            id.includes("/lib/money") ||
            id.includes("decimal.js")
          ) {
            return "financial-engine";
          }

          // Dashboard components - Lazy load after auth (<35KB)
          if (
            id.includes("/routes/_protected") ||
            id.includes("/features/dashboard") ||
            id.includes("/components/dashboard")
          ) {
            return "dashboard-core";
          }

          // Booking features - Domain-specific lazy load
          if (id.includes("/features/booking")) {
            return "booking-engine";
          }

          // Virtual scrolling and performance components
          if (
            id.includes("react-window") ||
            id.includes("react-virtualized") ||
            id.includes("/components/virtual")
          ) {
            return "virtualization";
          }

          // Form handling - Load with forms (<25KB)
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("zod") ||
            id.includes("@radix-ui/react-label") ||
            id.includes("@radix-ui/react-select")
          ) {
            return "form-engine";
          }

          // Modal and overlay components - Lazy load on demand
          if (
            id.includes("@radix-ui/react-dialog") ||
            id.includes("@radix-ui/react-alert-dialog") ||
            id.includes("@radix-ui/react-toast") ||
            id.includes("@radix-ui/react-dropdown-menu")
          ) {
            return "overlay-components";
          }

          // Extended UI components - Lazy load with specific features
          if (id.includes("@radix-ui") && !id.includes("react-slot")) {
            return "ui-extended";
          }

          // Icons - Major size contributor, lazy load aggressively (<15KB per chunk)
          if (id.includes("lucide-react")) {
            // Split icons into smaller chunks based on usage
            if (id.includes("ChevronDown") || id.includes("Check") || id.includes("X")) {
              return "icons-essential";
            }
            return "icons-extended";
          }

          // Date utilities - Lazy load with features that need them
          if (id.includes("date-fns")) {
            return "date-utilities";
          }

          // BIR and compliance features - Specialized lazy load
          if (id.includes("/lib/bir") || id.includes("/lib/compliance")) {
            return "compliance-engine";
          }

          // Database and backend utilities - Server-side focused
          if (
            id.includes("drizzle") ||
            id.includes("@neondatabase") ||
            id.includes("@vercel/node") ||
            id.includes("pg")
          ) {
            return "database-layer";
          }

          // Cache and performance utilities
          if (
            id.includes("/lib/cache") ||
            id.includes("/lib/performance") ||
            id.includes("@upstash/redis")
          ) {
            return "performance-layer";
          }

          // Reporting and analytics - Feature-specific
          if (
            id.includes("/lib/services/report-engine") ||
            id.includes("/lib/strategies") ||
            id.includes("/lib/monitoring")
          ) {
            return "analytics-engine";
          }

          // Security utilities - Lazy load with auth
          if (
            id.includes("bcryptjs") ||
            id.includes("isomorphic-dompurify") ||
            id.includes("/lib/security")
          ) {
            return "security-layer";
          }

          // PWA and offline features - Progressive enhancement
          if (id.includes("vite-plugin-pwa") || id.includes("workbox")) {
            return "pwa-features";
          }

          // Route-based splitting with granular control
          if (id.includes("/routes/")) {
            const routePath = id.split("/routes/")[1];
            if (routePath) {
              if (routePath.startsWith("_auth")) return "route-auth";
              if (routePath.startsWith("_protected/dashboard")) return "route-dashboard";
              if (routePath.startsWith("_protected/financial")) return "route-financial";
              if (routePath.startsWith("_protected/booking")) return "route-booking";
              if (routePath.includes("offline") || routePath.includes("unauthorized")) {
                return "route-utility";
              }
              return "route-public";
            }
          }

          // Utility libraries - Group by size and usage
          if (id.includes("uuid") || id.includes("ws") || id.includes("crypto")) {
            return "utility-crypto";
          }

          // Third-party packages - More granular grouping
          if (id.includes("node_modules")) {
            const packageName = id.split("node_modules/")[1]?.split("/")[0];

            // Critical third-party (keep small)
            if (["scheduler", "react-reconciler"].includes(packageName)) {
              return "vendor-critical";
            }

            // Database clients
            if (["@upstash/redis", "@upstash/ratelimit", "ioredis"].includes(packageName)) {
              return "vendor-database";
            }

            // Development tools (should not be in production)
            if (["@testing-library", "vitest", "playwright"].includes(packageName)) {
              return "vendor-dev";
            }

            // Large libraries that can be lazy loaded
            if (
              ["react-window", "react-virtualized-auto-sizer", "chart.js", "recharts"].includes(
                packageName
              )
            ) {
              return "vendor-heavy";
            }

            // Default vendor chunk
            return "vendor-misc";
          }

          // Default application code - Keep minimal
          return "app-core";
        },

        // Enhanced chunk naming for optimal caching and debugging
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name;

          // Critical chunks get consistent names for better caching
          const criticalChunks = ["app-shell", "react-core", "ui-primitives", "state-management"];
          if (criticalChunks.includes(name)) {
            return `assets/critical/[name]-[hash:8].js`;
          }

          // Feature chunks grouped by domain
          if (name.includes("engine") || name.includes("layer")) {
            return `assets/features/[name]-[hash:8].js`;
          }

          // Route chunks
          if (name.includes("route-")) {
            return `assets/routes/[name]-[hash:8].js`;
          }

          // Vendor chunks
          if (name.includes("vendor-")) {
            return `assets/vendors/[name]-[hash:8].js`;
          }

          // Default chunk naming
          return `assets/chunks/[name]-[hash:8].js`;
        },

        // Enhanced asset naming with optimization
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? "";
          const ext = name.split(".").pop() ?? "";

          // Images - Optimize by type and usage
          if (/\.(png|jpe?g|gif|webp|avif)$/i.test(name)) {
            if (name.includes("icon") || name.includes("logo")) {
              return `assets/images/branding/[name]-[hash:8][extname]`;
            }
            return `assets/images/content/[name]-[hash:8][extname]`;
          }

          // SVGs - Separate handling for icons vs illustrations
          if (/\.svg$/i.test(name)) {
            return `assets/images/vectors/[name]-[hash:8][extname]`;
          }

          // Fonts - Optimize for loading performance
          if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
            return `assets/fonts/[name]-[hash:8][extname]`;
          }

          // CSS - Separate by purpose
          if (ext === "css") {
            if (name.includes("critical") || name.includes("app-shell")) {
              return `assets/styles/critical/[name]-[hash:8][extname]`;
            }
            return `assets/styles/chunks/[name]-[hash:8][extname]`;
          }

          // JSON and data files
          if (ext === "json") {
            return `assets/data/[name]-[hash:8][extname]`;
          }

          // Default asset naming
          return `assets/misc/[name]-[hash:8][extname]`;
        },

        // Improve ES module interop
        interop: "auto",

        // Advanced output options for better performance
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          arrowFunctions: true,
        },

        // Compact output for smaller bundles
        compact: true,
      },

      // Optimize external dependencies - Enhanced for bundle size
      external: (id) => {
        // Don't bundle Node.js modules in the client
        if (id.startsWith("node:")) return true;

        // Server-only dependencies
        const serverOnly = ["fs", "path", "os", "crypto", "stream", "util", "events"];
        if (serverOnly.some((module) => id === module || id.startsWith(`${module}/`))) {
          return true;
        }

        return false;
      },
    },
  },

  // Enhanced dependency optimization for faster dev server and reduced TBT
  optimizeDeps: {
    include: [
      // Core React libraries - Essential for initial load
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-error-boundary",

      // State management - Keep small and fast
      "zustand",
      "zustand/middleware",
      "zustand/middleware/immer",
      "zustand/shallow",
      "zustand/react",
      "zustand/vanilla",
      "immer",

      // Fix for use-sync-external-store ESM issue with React 19
      "use-sync-external-store",
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",

      // TanStack Store uses the shim module
      "@tanstack/react-store",

      // Critical utilities only
      "clsx",
      "tailwind-merge",
      "class-variance-authority",

      // Essential UI components for shell
      "@radix-ui/react-slot",
    ],
    exclude: [
      // Prevent traditional module from being pre-bundled
      "zustand/traditional",

      // Lazy load these heavy dependencies
      "@tanstack/react-router", // Load after initial render
      "@tanstack/react-query", // Load with data fetching

      // Form handling - Load with forms
      "react-hook-form",
      "@hookform/resolvers",
      "zod",

      // Date utilities - Load when needed
      "date-fns",

      // Heavy UI components - Load on demand
      "@radix-ui/react-dialog",
      "@radix-ui/react-toast",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-alert-dialog",

      // Icons - Major size contributor, load on demand
      "lucide-react",

      // Security/crypto - Load with auth
      "bcryptjs",
      "jsonwebtoken",
      "isomorphic-dompurify",

      // Database - Server-side only
      "drizzle-orm",
      "@neondatabase/serverless",
      "pg",

      // Development tools
      "@testing-library/react",
      "@testing-library/jest-dom",
      "vitest",
      "@vitejs/plugin-react-swc",
      "rollup-plugin-visualizer",
      "playwright",
      "playwright-core",
      "@playwright/test",
      "chromium-bidi",
      "fsevents",
    ],
    // Force re-optimization in development for performance testing
    force: process.env.NODE_ENV === "development",

    // ESBuild options for faster processing
    esbuildOptions: {
      target: "es2022",
      supported: {
        "dynamic-import": true,
        "import-meta": true,
      },
    },
  },

  // CSS configuration
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: "camelCaseOnly",
    },
  },

  // Environment variables
  define: {
    // Enable proper tree shaking for production builds
    __DEV__: JSON.stringify(process.env.NODE_ENV === "development"),
  },
});
