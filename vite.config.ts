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

    // Enable source maps for debugging
    sourcemap: true,

    // Minification
    minify: "esbuild",

    // Strict chunk size warnings for mobile performance
    chunkSizeWarningLimit: 500,

    // Rollup options for code splitting
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        // Advanced chunk splitting strategy for mobile performance
        manualChunks: (id) => {
          // Vendor chunks - critical for initial load
          if (id.includes("react") || id.includes("react-dom")) {
            return "react-vendor";
          }

          // Router chunk - loaded early
          if (id.includes("@tanstack/react-router")) {
            return "router";
          }

          // Query chunk - essential for data fetching
          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          // UI components - split by usage frequency
          if (
            id.includes("@radix-ui/react-dialog") ||
            id.includes("@radix-ui/react-toast") ||
            id.includes("@radix-ui/react-dropdown-menu")
          ) {
            return "ui-critical";
          }

          if (id.includes("@radix-ui")) {
            return "ui-extended";
          }

          // Form handling - lazy loaded
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("zod")
          ) {
            return "forms";
          }

          // Utilities - small and frequently used
          if (
            id.includes("date-fns") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("class-variance-authority")
          ) {
            return "utils";
          }

          // Icons - lazy loaded on demand
          if (id.includes("lucide-react")) {
            return "icons";
          }

          // Store management
          if (id.includes("zustand") || id.includes("immer")) {
            return "state";
          }

          // Route-specific chunks
          if (id.includes("/routes/")) {
            const routePath = id.split("/routes/")[1];
            if (routePath) {
              const routeSegments = routePath.split("/");
              if (routeSegments[0] === "_protected") {
                // Group protected routes by feature
                const feature = routeSegments[1]?.split(".")[0];
                if (["dashboard", "bookings", "properties", "expenses"].includes(feature)) {
                  return `route-${feature}`;
                }
                return "route-misc";
              }
              return "route-public";
            }
          }

          // Pages - split by feature
          if (id.includes("/pages/")) {
            const pageName = id.split("/pages/")[1]?.split(".")[0]?.toLowerCase();
            if (pageName?.includes("dashboard")) return "page-dashboard";
            if (pageName?.includes("booking")) return "page-bookings";
            if (pageName?.includes("property") || pageName?.includes("properties"))
              return "page-properties";
            if (pageName?.includes("expense")) return "page-expenses";
            return "page-misc";
          }

          // Third-party node_modules not already handled
          if (id.includes("node_modules")) {
            return "vendor";
          }

          // Default chunk for application code
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

  // Enhanced dependency optimization for faster dev server
  optimizeDeps: {
    include: [
      // Core React libraries
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-error-boundary",

      // TanStack ecosystem
      "@tanstack/react-query",
      "@tanstack/react-router",

      // State management
      "zustand",
      "zustand/middleware",
      "immer",

      // Form handling
      "react-hook-form",
      "@hookform/resolvers",
      "zod",

      // Utilities
      "date-fns",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",

      // Critical UI components
      "@radix-ui/react-dialog",
      "@radix-ui/react-toast",
      "@radix-ui/react-dropdown-menu",
    ],
    exclude: [
      // Exclude dev dependencies from optimization
      "@testing-library/react",
      "@testing-library/jest-dom",
      "vitest",
      "@vitejs/plugin-react-swc",
      "rollup-plugin-visualizer",
      // Exclude Playwright from browser bundle
      "playwright",
      "playwright-core",
      "@playwright/test",
      "chromium-bidi",
      "fsevents",
    ],
    // Force re-optimization on dependency changes
    force: process.env.NODE_ENV === "development",
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
