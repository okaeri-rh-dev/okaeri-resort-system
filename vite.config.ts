import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      quoteStyle: "double",
    }),
    // Bundle analyzer - only in build mode
    mode === "production" &&
      visualizer({
        open: false,
        filename: "bundle-stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
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
        manualChunks: (id) => {
          // Core vendor libraries
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }

          // UI component libraries
          if (id.includes("@radix-ui") || id.includes("@headlessui")) {
            return "vendor-ui";
          }

          // Data fetching and state management
          if (id.includes("@tanstack") || id.includes("zustand")) {
            return "vendor-data";
          }

          // Supabase and database
          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }

          // Utilities and helpers
          if (id.includes("date-fns") || id.includes("zod") || id.includes("clsx")) {
            return "vendor-utils";
          }

          // Forms and validation
          if (id.includes("react-hook-form") || id.includes("dompurify")) {
            return "vendor-forms";
          }

          // Icons and assets
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
    // Optimize for Vercel free tier
    chunkSizeWarningLimit: 1000,
    minify: "esbuild",
    target: "es2020",
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
}));
