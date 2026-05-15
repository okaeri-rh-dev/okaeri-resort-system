import path from "path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      quoteStyle: "double",
    }),
    react(),
    tsconfigPaths(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      // Use existing public/manifest.json; do not generate one
      manifest: false,
      injectRegister: null,
      workbox: {
        // Precache hashed build assets only
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Never intercept SPA navigation
        navigateFallback: null,
        // Never cache API or Supabase traffic
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/") ||
              url.hostname.endsWith("supabase.co") ||
              url.hostname.endsWith("supabase.in"),
            handler: "NetworkOnly",
          },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // user-driven activation via UpdateToast
      },
      devOptions: {
        enabled: false, // never in dev to avoid surprise SWs during development
      },
    }),
    // Bundle analyzer - in production or analyze mode
    (mode === "production" || mode === "analyze") &&
      visualizer({
        open: mode === "analyze", // Auto-open in analyze mode
        filename: "dist/bundle-stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
        title: "Okaeri Resort System Bundle Analysis",
      }),
  ].filter(Boolean),
  build: {
    sourcemap: mode !== "production",
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress TypeScript warnings during build for Phase 2
        if (warning.code === "CIRCULAR_DEPENDENCY") return;
        if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
        warn(warning);
      },
      output: {
        manualChunks: {
          // React core must be loaded first - combine with essential React hooks
          "vendor-react": [
            "react",
            "react-dom",
            "react/jsx-runtime",
            "scheduler",
            "use-sync-external-store",
          ],
          // TanStack and state management in second chunk
          "vendor-state": [
            "@tanstack/react-query",
            "@tanstack/react-router",
            "@tanstack/react-store",
            "@tanstack/react-table",
            "zustand",
            "immer",
          ],
          // UI libraries
          "vendor-ui": ["react-day-picker", "sonner", "lucide-react", "next-themes"],
          // PDF generation - lazy loaded only when user clicks "Download PDF"
          "vendor-pdf": ["@react-pdf/renderer"],
          // Note: heic2any and browser-image-compression are dynamically imported
          // in src/utils/file-compression.ts and will be automatically code-split
        },
      },
    },
    // Optimize for Cloudflare Pages
    chunkSizeWarningLimit: 1000,
    minify: "esbuild",
    target: "es2024",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    // Allow build to continue with TypeScript errors for Phase 2
    logOverride: { "this-is-undefined-in-esm": "silent" },
  },
  server: {
    port: 5173,
    // Proxy API requests to Wrangler dev server
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
}));
