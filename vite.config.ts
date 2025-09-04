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

  // Build configuration optimized for Vercel
  build: {
    // Target modern browsers for better optimization
    target: "es2022",

    // Performance budget configuration
    reportCompressedSize: true,

    // CSS code splitting
    cssCodeSplit: true,

    // Output directory
    outDir: "dist",
    assetsDir: "assets",

    // Enable source maps for debugging (hidden in production)
    sourcemap: process.env.NODE_ENV === "development" ? true : "hidden",

    // Minification
    minify: "esbuild",

    // Strict chunk size warnings for mobile performance - reduced for TBT optimization
    chunkSizeWarningLimit: 300,

    // Additional optimizations for TBT reduction
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.warn"],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },

    // Rollup options for code splitting
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        // Optimized chunk splitting strategy to reduce TBT
        manualChunks: (id) => {
          // Core React - Keep small and separate for caching
          if (id.includes("react/jsx-runtime") || id.includes("react-dom/client")) {
            return "react-core";
          }

          if (id.includes("react") && !id.includes("react-hook-form")) {
            return "react-vendor";
          }

          // Router - Critical but can be lazy loaded after initial render
          if (id.includes("@tanstack/react-router")) {
            return "router";
          }

          // Query - Essential for data fetching, keep separate
          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          // Authentication related - Can be lazy loaded
          if (id.includes("/routes/_auth") || id.includes("/features/auth")) {
            return "auth";
          }

          // Dashboard and protected routes - Lazy loaded
          if (id.includes("/routes/_protected") || id.includes("/features/dashboard")) {
            return "dashboard";
          }

          // Critical UI components needed for initial render
          if (
            id.includes("@radix-ui/react-slot") ||
            id.includes("class-variance-authority") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge")
          ) {
            return "ui-critical";
          }

          // Dialog and modal components - Lazy loaded
          if (
            id.includes("@radix-ui/react-dialog") ||
            id.includes("@radix-ui/react-alert-dialog") ||
            id.includes("@radix-ui/react-toast")
          ) {
            return "ui-modals";
          }

          // Form components - Lazy loaded with forms
          if (
            id.includes("@radix-ui/react-label") ||
            id.includes("@radix-ui/react-select") ||
            id.includes("@radix-ui/react-checkbox") ||
            id.includes("@radix-ui/react-radio-group") ||
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("zod")
          ) {
            return "forms";
          }

          // Other Radix UI components - Lazy loaded
          if (id.includes("@radix-ui")) {
            return "ui-extended";
          }

          // Icons - Lazy loaded on demand (major size contributor)
          if (id.includes("lucide-react")) {
            return "icons";
          }

          // Date utilities - Can be lazy loaded
          if (id.includes("date-fns")) {
            return "date-utils";
          }

          // Store management - Keep small and separate
          if (id.includes("zustand") || id.includes("immer")) {
            return "state";
          }

          // Security and crypto - Lazy loaded
          if (
            id.includes("bcryptjs") ||
            id.includes("jsonwebtoken") ||
            id.includes("isomorphic-dompurify")
          ) {
            return "security";
          }

          // Database and backend utilities
          if (
            id.includes("drizzle") ||
            id.includes("@neondatabase") ||
            id.includes("@vercel/node")
          ) {
            return "backend";
          }

          // Route-specific chunks with better granularity
          if (id.includes("/routes/")) {
            const routePath = id.split("/routes/")[1];
            if (routePath) {
              if (routePath.startsWith("_auth")) return "auth";
              if (routePath.startsWith("_protected")) return "dashboard";
              if (routePath.includes("offline") || routePath.includes("unauthorized")) {
                return "utility-pages";
              }
              return "public-pages";
            }
          }

          // Features - Split by domain
          if (id.includes("/features/")) {
            const featurePath = id.split("/features/")[1];
            if (featurePath) {
              const feature = featurePath.split("/")[0];
              return `feature-${feature}`;
            }
          }

          // PWA and service worker related
          if (id.includes("vite-plugin-pwa") || id.includes("workbox")) {
            return "pwa";
          }

          // Testing utilities - Should not be in production bundle
          if (id.includes("@testing-library") || id.includes("vitest")) {
            return "test-utils";
          }

          // Large utility libraries that can be lazy loaded
          if (id.includes("decimal.js") || id.includes("uuid") || id.includes("ws")) {
            return "heavy-utils";
          }

          // Third-party node_modules not already handled
          if (id.includes("node_modules")) {
            const packageName = id.split("node_modules/")[1]?.split("/")[0];
            // Group small, related packages together
            if (["pg", "@upstash/redis", "@upstash/ratelimit"].includes(packageName)) {
              return "db-clients";
            }
            return "vendor";
          }

          // Application code - Keep minimal
          return "app";
        },
        // Optimize chunk naming for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId;
          if (facadeModuleId) {
            return `assets/[name]-[hash].js`;
          }
          return `assets/chunk-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split(".") ?? [];
          const ext = info[info.length - 1];

          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name ?? "")) {
            return `assets/images/[name]-[hash][extname]`;
          }

          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name ?? "")) {
            return `assets/fonts/[name]-[hash][extname]`;
          }

          if (ext === "css") {
            return `assets/styles/[name]-[hash][extname]`;
          }

          return `assets/[name]-[hash][extname]`;
        },
      },

      // Optimize external dependencies
      external: (id) => {
        // Don't bundle Node.js modules in the client
        return id.startsWith("node:");
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
