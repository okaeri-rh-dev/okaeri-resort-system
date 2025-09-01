import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],

  // Path aliases matching tsconfig.json and vite.config.ts
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
      "@/test": resolve(__dirname, "./src/test"),
      "@tests": resolve(__dirname, "./tests"),
    },
  },

  test: {
    // Test environment
    environment: "jsdom",

    // Global test setup
    globals: true,

    // Setup files
    setupFiles: ["./src/test/setup.ts"],

    // Include and exclude patterns
    include: ["**/__tests__/**/*.{js,ts,jsx,tsx}", "**/?(*.)+(spec|test).{js,ts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress}.config.*",
    ],

    // Coverage configuration - optimized for Phase 1
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"], // Reduced reporters
      reportsDirectory: "./coverage",
      exclude: [
        "coverage/**",
        "dist/**",
        "packages/*/test{,s}/**",
        "**/*.d.ts",
        "cypress/**",
        "test{,s}/**",
        "test{,-*}.{js,cjs,mjs,ts,tsx,jsx}",
        "**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}",
        "**/*{.,-}spec.{js,cjs,mjs,ts,tsx,jsx}",
        "**/__tests__/**",
        "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress}.config.*",
        "**/.{eslint,mocha,prettier}rc.{js,cjs,yml}",
        // Custom exclusions for this project
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/test/**",
        "**/*.stories.{js,ts,jsx,tsx}",
        "**/*.config.{js,ts}",
        "**/mock*/**",
      ],
      // Coverage thresholds - Global requirements only (path-based checking via custom script)
      thresholds: {
        // Global default threshold (90% for all code)
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
      // Include source files for accurate coverage reporting
      include: ["src/**/*.{ts,tsx,js,jsx}"],
      // Skip coverage for specific files
      skipFull: false,
      // Enable all coverage reports
      all: true,
    },

    // Reporter configuration
    reporters: ["verbose", "json", "html"],
    outputFile: {
      json: "./test-results.json",
      html: "./test-report.html",
    },

    // Test timeout - increased for coverage runs
    testTimeout: 30000,
    hookTimeout: 30000,

    // Watch options - disabled by default for CI
    watch: false,

    // Pool options for performance - optimized for coverage
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Single fork for more stable coverage
        isolate: false, // Faster execution
      },
    },

    // Retry configuration
    retry: 1,

    // Define globals for TypeScript - disabled for Phase 1 build compatibility
    // define: {
    //   __DEV__: true,
    //   __TEST__: true,
    // },

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Environment variables for testing
    env: {
      NODE_ENV: "test",
      VITE_APP_VERSION: "test",
      VITE_BUILD_TIME: "test",
    },

    // UI configuration for vitest UI
    ui: false, // Disable UI for faster execution
    open: false,

    // Performance monitoring - disabled for faster execution
    logHeapUsage: false,

    // Dependency optimization for tests
    deps: {
      inline: [
        // Inline ESM dependencies that need to be transformed
        /@testing-library\/.*/,
        /lucide-react/,
        /@radix-ui\/.*/,
      ],
      external: [
        // External dependencies that shouldn't be bundled
        "react",
        "react-dom",
      ],
    },

    // CSS handling in tests
    css: {
      modules: {
        classNameStrategy: "stable",
      },
    },

    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) =>
      testPath.replace(/\.test\.([tj]sx?)/, `${snapExtension}.$1`),

    // Custom matchers and utilities
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.app.json",
    },
  },

  // Optimize dependencies for faster test runs
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@testing-library/react",
      "@testing-library/jest-dom",
      "@testing-library/user-event",
      "jsdom",
    ],
  },

  // Build configuration for test environment
  build: {
    target: "node14",
    sourcemap: true,
  },
});
