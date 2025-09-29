import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

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
}));
