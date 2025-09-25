/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    // Test environment configuration
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "src/test/",
        "*.config.ts",
        "**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/types/database.types.ts", // Generated file
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 80,
        statements: 80,
      },
    },

    // Test execution configuration
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    testTimeout: 10000,
    hookTimeout: 10000,

    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // Aliases for testing
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/test": path.resolve(__dirname, "./src/test"),
    },

    // Reporter configuration
    reporters: ["default", "html"],
    outputFile: {
      html: "./test-results/index.html",
    },

    // Watch configuration for development
    watchExclude: ["**/node_modules/**", "**/dist/**"],

    // Thread configuration for performance
    threads: true,
    maxThreads: 4,
    minThreads: 1,
  },

  // Resolve configuration for tests
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
