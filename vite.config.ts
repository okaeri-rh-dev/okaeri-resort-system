import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";

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
  ],
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
          // Split vendor code for better caching
          vendor: ["react", "react-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs"],
          supabase: ["@supabase/supabase-js"],
          utils: ["date-fns", "zod", "clsx"],
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
