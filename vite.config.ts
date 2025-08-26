import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

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
  ],

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

    // Output directory
    outDir: "dist",
    assetsDir: "assets",

    // Enable source maps for debugging
    sourcemap: true,

    // Minification
    minify: "esbuild",

    // Chunk size warnings
    chunkSizeWarningLimit: 1000,

    // Rollup options for code splitting
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        // Optimize chunk splitting for better caching
        manualChunks: {
          // Vendor chunks for better caching
          react: ["react", "react-dom"],
          router: ["@tanstack/react-router"],
          query: ["@tanstack/react-query"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-switch",
            "@radix-ui/react-label",
            "@radix-ui/react-avatar",
            "@radix-ui/react-tabs",
            "@radix-ui/react-progress",
            "@radix-ui/react-alert-dialog",
          ],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          utils: ["date-fns", "clsx", "tailwind-merge", "class-variance-authority"],
          icons: ["lucide-react"],
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

  // Dependency optimization
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "zustand",
      "react-hook-form",
      "zod",
      "date-fns",
      "clsx",
      "tailwind-merge",
    ],
    exclude: [
      // Exclude dev dependencies from optimization
      "@testing-library/react",
      "@testing-library/jest-dom",
      "vitest",
    ],
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
