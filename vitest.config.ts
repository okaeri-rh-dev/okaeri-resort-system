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

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
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
      // Coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
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
    reporter: ["verbose", "json", "html"],
    outputFile: {
      json: "./test-results.json",
      html: "./test-report.html",
    },

    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,

    // Watch options
    watch: true,

    // Pool options for performance
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
      },
    },

    // Retry configuration
    retry: 1,

    // Define globals for TypeScript
    define: {
      __DEV__: true,
      __TEST__: true,
    },

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
    ui: true,
    open: false,

    // Performance monitoring
    logHeapUsage: true,

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
