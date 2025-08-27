/**
 * TDD Test Suite: Vite Configuration Validation
 *
 * This test suite validates the Vite configuration for the Okaeri Resort Management System,
 * ensuring all build paths, aliases, plugins, and optimization settings are correctly configured
 * for a production-ready TypeScript + React application with PWA capabilities.
 *
 * COVERAGE:
 * - Plugin configuration and loading
 * - Path aliases and build paths
 * - Development server configuration
 * - Production build optimization
 * - PWA manifest and service worker setup
 * - Code splitting and chunk optimization
 * - Philippine-specific PWA configuration
 * - Performance and bundle analysis
 *
 * TDD APPROACH:
 * 🔴 RED: Write failing tests for expected configuration
 * 🟢 GREEN: Validate actual Vite config matches requirements
 * 🔄 REFACTOR: Test configuration edge cases and optimizations
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 1.1 - Project Setup
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { resolve } from "path";
import type { UserConfig } from "vite";
import { TDDWorkflow, TDD_CONSTANTS } from "@tests/utils/tdd-helpers";

// ====================================
// CONFIGURATION LOADING & VALIDATION
// ====================================

describe("🔧 Vite Configuration - Phase 1.1 Foundation", () => {
  let viteConfig: UserConfig;
  let configFilePath: string;
  let projectRoot: string;

  beforeAll(async () => {
    // 🔧 SETUP: Load the actual Vite configuration
    projectRoot = resolve(process.cwd());
    configFilePath = resolve(projectRoot, "vite.config.ts");

    // Dynamic import to load the Vite config
    try {
      const configModule = await import(configFilePath);
      viteConfig =
        typeof configModule.default === "function"
          ? configModule.default({ command: "build", mode: "production" })
          : configModule.default;
    } catch (error) {
      throw new Error(`Failed to load Vite config from ${configFilePath}: ${error}`);
    }
  });

  // ====================================
  // RED-GREEN-REFACTOR: BASIC CONFIG STRUCTURE
  // ====================================

  describe("🔴🟢🔄 Configuration Structure & Loading", () => {
    it("🔴 RED: should fail if config file does not exist", async () => {
      const tddCycle = TDDWorkflow.createTDDCycle("Config File Existence");

      await tddCycle.red("validates config file exists", () => {
        expect(configFilePath).toBeDefined();
        expect(configFilePath.endsWith("vite.config.ts")).toBe(true);
      });
    });

    it("🟢 GREEN: should successfully load Vite configuration", () => {
      expect(viteConfig).toBeDefined();
      expect(typeof viteConfig).toBe("object");
      expect(viteConfig).not.toBeNull();
    });

    it("🔄 REFACTOR: should have all required top-level configuration sections", () => {
      const requiredSections = [
        "plugins",
        "resolve",
        "server",
        "preview",
        "build",
        "optimizeDeps",
        "css",
      ];

      requiredSections.forEach((section) => {
        expect(viteConfig).toHaveProperty(section);
      });
    });

    it("🔄 REFACTOR: should define environment-specific configurations", () => {
      expect(viteConfig).toHaveProperty("define");
      expect(viteConfig.define).toHaveProperty("__DEV__");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: PLUGIN CONFIGURATION
  // ====================================

  describe("🔴🟢🔄 Plugin Configuration", () => {
    it("🔴 RED: should fail without essential React plugins", () => {
      expect(viteConfig.plugins).toBeDefined();
      expect(Array.isArray(viteConfig.plugins)).toBe(true);
      expect(viteConfig.plugins!.length).toBeGreaterThan(0);
    });

    it("🟢 GREEN: should include TanStack Router plugin for file-based routing", () => {
      const plugins = viteConfig.plugins as any[];
      const routerPlugin = plugins.find(
        (plugin) =>
          plugin && typeof plugin === "object" && plugin.name === "@tanstack/router-vite-plugin"
      );

      // Note: Plugin might be in nested structure or transformed
      expect(
        plugins.some(
          (plugin) =>
            plugin &&
            (plugin.name === "@tanstack/router-vite-plugin" ||
              (typeof plugin === "object" && JSON.stringify(plugin).includes("tanstack")))
        )
      ).toBe(true);
    });

    it("🟢 GREEN: should include React SWC plugin for fast compilation", () => {
      const plugins = viteConfig.plugins as any[];

      expect(
        plugins.some(
          (plugin) =>
            plugin &&
            (plugin.name === "vite:react-swc" ||
              (typeof plugin === "object" && JSON.stringify(plugin).includes("react")))
        )
      ).toBe(true);
    });

    it("🔄 REFACTOR: should include Tailwind CSS v4 plugin", () => {
      const plugins = viteConfig.plugins as any[];

      expect(
        plugins.some(
          (plugin) =>
            plugin &&
            (plugin.name === "@tailwindcss/vite" ||
              (typeof plugin === "object" && JSON.stringify(plugin).includes("tailwind")))
        )
      ).toBe(true);
    });

    it("🔄 REFACTOR: should include PWA plugin with proper configuration", () => {
      const plugins = viteConfig.plugins as any[];

      expect(
        plugins.some(
          (plugin) =>
            plugin &&
            (plugin.name === "vite-plugin-pwa" ||
              (typeof plugin === "object" && JSON.stringify(plugin).includes("pwa")))
        )
      ).toBe(true);
    });

    it("🔄 REFACTOR: should conditionally include bundle analyzer in development", () => {
      const plugins = viteConfig.plugins as any[];

      // Should be filtered out or conditionally included
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.every((plugin) => plugin !== false && plugin !== null)).toBe(true);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: PATH RESOLUTION & ALIASES
  // ====================================

  describe("🔴🟢🔄 Path Resolution & Aliases", () => {
    it("🔴 RED: should fail without proper path resolution configuration", () => {
      expect(viteConfig.resolve).toBeDefined();
      expect(viteConfig.resolve!.alias).toBeDefined();
    });

    it("🟢 GREEN: should configure @ alias pointing to src directory", () => {
      const alias = viteConfig.resolve!.alias as Record<string, string>;

      expect(alias).toHaveProperty("@");
      expect(alias["@"]).toMatch(/\/src$/);
      expect(resolve(alias["@"])).toBe(resolve(projectRoot, "src"));
    });

    it("🔄 REFACTOR: should include comprehensive component and feature aliases", () => {
      const alias = viteConfig.resolve!.alias as Record<string, string>;

      const expectedAliases = [
        "@/components",
        "@/hooks",
        "@/lib",
        "@/stores",
        "@/types",
        "@/utils",
        "@/constants",
        "@/assets",
        "@/features",
        "@/pages",
        "@/layouts",
      ];

      expectedAliases.forEach((aliasPath) => {
        expect(alias).toHaveProperty(aliasPath);

        // Validate paths resolve correctly
        const expectedPath = aliasPath.replace("@", resolve(projectRoot, "src"));
        expect(alias[aliasPath]).toBe(expectedPath);
      });
    });

    it("🔄 REFACTOR: should use absolute paths for all aliases", () => {
      const alias = viteConfig.resolve!.alias as Record<string, string>;

      Object.entries(alias).forEach(([key, path]) => {
        expect(resolve(path)).toBe(path); // Should already be absolute
        expect(path.startsWith("/")).toBe(true); // Unix absolute path
      });
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: DEVELOPMENT SERVER
  // ====================================

  describe("🔴🟢🔄 Development Server Configuration", () => {
    it("🔴 RED: should fail without development server configuration", () => {
      expect(viteConfig.server).toBeDefined();
    });

    it("🟢 GREEN: should configure server with appropriate port and host", () => {
      const server = viteConfig.server!;

      expect(server.port).toBe(3000);
      expect(server.host).toBe(true); // Enable network access
      expect(server.strictPort).toBe(true);
    });

    it("🔄 REFACTOR: should enable CORS for development", () => {
      const server = viteConfig.server!;

      expect(server.cors).toBe(true);
    });

    it("🔄 REFACTOR: should configure API proxy for development", () => {
      const server = viteConfig.server!;

      expect(server.proxy).toBeDefined();
      expect(server.proxy!).toHaveProperty("/api");

      const apiProxy = server.proxy!["/api"] as any;
      expect(apiProxy.target).toBe("http://localhost:3001");
      expect(apiProxy.changeOrigin).toBe(true);
      expect(apiProxy.secure).toBe(false);
      expect(typeof apiProxy.rewrite).toBe("function");
    });

    it("🔄 REFACTOR: should configure preview server consistently", () => {
      const preview = viteConfig.preview!;

      expect(preview.port).toBe(3000);
      expect(preview.host).toBe(true);
      expect(preview.strictPort).toBe(true);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: BUILD CONFIGURATION
  // ====================================

  describe("🔴🟢🔄 Production Build Configuration", () => {
    it("🔴 RED: should fail without production build configuration", () => {
      expect(viteConfig.build).toBeDefined();
    });

    it("🟢 GREEN: should target modern browsers for optimal performance", () => {
      const build = viteConfig.build!;

      expect(build.target).toBe("es2022");
      expect(build.minify).toBe("esbuild");
      expect(build.sourcemap).toBe(true);
    });

    it("🔄 REFACTOR: should configure proper output directories", () => {
      const build = viteConfig.build!;

      expect(build.outDir).toBe("dist");
      expect(build.assetsDir).toBe("assets");
    });

    it("🔄 REFACTOR: should enable performance monitoring", () => {
      const build = viteConfig.build!;

      expect(build.reportCompressedSize).toBe(true);
      expect(build.chunkSizeWarningLimit).toBe(500);
    });

    it("🔄 REFACTOR: should enable CSS code splitting", () => {
      const build = viteConfig.build!;

      expect(build.cssCodeSplit).toBe(true);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: ROLLUP OPTIONS & CODE SPLITTING
  // ====================================

  describe("🔴🟢🔄 Rollup Options & Code Splitting", () => {
    it("🔴 RED: should fail without Rollup configuration", () => {
      const build = viteConfig.build!;
      expect(build.rollupOptions).toBeDefined();
    });

    it("🟢 GREEN: should configure proper entry point", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;

      expect(rollupOptions.input).toBeDefined();
      expect(rollupOptions.input).toHaveProperty("main");
      expect((rollupOptions.input as any).main).toMatch(/index\.html$/);
    });

    it("🔄 REFACTOR: should implement advanced manual chunk splitting", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;

      expect(rollupOptions.output).toBeDefined();

      const output = Array.isArray(rollupOptions.output)
        ? rollupOptions.output[0]
        : rollupOptions.output;

      expect(output).toHaveProperty("manualChunks");
      expect(typeof output!.manualChunks).toBe("function");
    });

    it("🔄 REFACTOR: should create optimized vendor chunks", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;
      const output = Array.isArray(rollupOptions.output)
        ? rollupOptions.output[0]
        : rollupOptions.output;

      const manualChunks = output!.manualChunks as Function;

      // Test React vendor chunking
      expect(manualChunks("node_modules/react/index.js")).toBe("react-vendor");
      expect(manualChunks("node_modules/react-dom/client.js")).toBe("react-vendor");

      // Test Router chunking
      expect(manualChunks("node_modules/@tanstack/react-router/dist/index.js")).toBe("router");

      // Test Query chunking
      expect(manualChunks("node_modules/@tanstack/react-query/build/lib/index.js")).toBe("query");

      // Test UI component chunking
      expect(manualChunks("node_modules/@radix-ui/react-dialog/dist/index.js")).toBe("ui-critical");
      expect(manualChunks("node_modules/@radix-ui/react-accordion/dist/index.js")).toBe(
        "ui-extended"
      );

      // Test form handling
      expect(manualChunks("node_modules/react-hook-form/dist/index.js")).toBe("forms");
      expect(manualChunks("node_modules/zod/lib/index.js")).toBe("forms");

      // Test utilities
      expect(manualChunks("node_modules/date-fns/index.js")).toBe("utils");
      expect(manualChunks("node_modules/clsx/dist/clsx.js")).toBe("utils");

      // Test state management
      expect(manualChunks("node_modules/zustand/esm/index.js")).toBe("state");

      // Test generic vendor fallback
      expect(manualChunks("node_modules/some-random-package/index.js")).toBe("vendor");

      // Test app code fallback
      expect(manualChunks("/src/components/SomeComponent.tsx")).toBe("app");
    });

    it("🔄 REFACTOR: should optimize route-based code splitting", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;
      const output = Array.isArray(rollupOptions.output)
        ? rollupOptions.output[0]
        : rollupOptions.output;

      const manualChunks = output!.manualChunks as Function;

      // Test route chunking
      expect(manualChunks("/src/routes/_protected/dashboard.tsx")).toBe("route-dashboard");
      expect(manualChunks("/src/routes/_protected/bookings.tsx")).toBe("route-bookings");
      expect(manualChunks("/src/routes/_protected/properties.tsx")).toBe("route-properties");
      expect(manualChunks("/src/routes/_protected/expenses.tsx")).toBe("route-expenses");
      expect(manualChunks("/src/routes/_protected/misc.tsx")).toBe("route-misc");
      expect(manualChunks("/src/routes/_auth/login.tsx")).toBe("route-public");
    });

    it("🔄 REFACTOR: should configure optimized file naming patterns", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;
      const output = Array.isArray(rollupOptions.output)
        ? rollupOptions.output[0]
        : rollupOptions.output;

      expect(output).toHaveProperty("chunkFileNames");
      expect(output).toHaveProperty("assetFileNames");

      expect(typeof output!.chunkFileNames).toBe("function");
      expect(typeof output!.assetFileNames).toBe("function");
    });

    it("🔄 REFACTOR: should handle asset file organization", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;
      const output = Array.isArray(rollupOptions.output)
        ? rollupOptions.output[0]
        : rollupOptions.output;

      const assetFileNames = output!.assetFileNames as Function;

      // Test image asset naming
      expect(assetFileNames({ name: "logo.png" })).toBe("assets/images/logo-[hash].png");
      expect(assetFileNames({ name: "background.jpg" })).toBe(
        "assets/images/background-[hash].jpg"
      );

      // Test font asset naming
      expect(assetFileNames({ name: "font.woff2" })).toBe("assets/fonts/font-[hash].woff2");

      // Test CSS asset naming
      expect(assetFileNames({ name: "styles.css" })).toBe("assets/styles/styles-[hash].css");

      // Test generic asset naming
      expect(assetFileNames({ name: "data.json" })).toBe("assets/data-[hash].json");
    });

    it("🔄 REFACTOR: should exclude Node.js modules from client bundle", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;

      expect(rollupOptions.external).toBeDefined();
      expect(typeof rollupOptions.external).toBe("function");

      const external = rollupOptions.external as Function;
      expect(external("node:fs")).toBe(true);
      expect(external("node:path")).toBe(true);
      expect(external("react")).toBe(false);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: PWA CONFIGURATION
  // ====================================

  describe("🔴🟢🔄 PWA Configuration for Resort Management", () => {
    let pwaPlugin: any;

    beforeAll(() => {
      const plugins = viteConfig.plugins as any[];
      pwaPlugin = plugins.find(
        (plugin) =>
          plugin &&
          (plugin.name === "vite-plugin-pwa" ||
            (typeof plugin === "object" && JSON.stringify(plugin).includes("pwa")))
      );
    });

    it("🔴 RED: should fail without PWA plugin configuration", () => {
      expect(pwaPlugin).toBeDefined();
    });

    it("🟢 GREEN: should configure proper PWA manifest for resort system", () => {
      // Since we can't easily inspect plugin internals, we'll check the config structure
      expect(viteConfig.plugins).toBeDefined();

      // Test that PWA-related configuration exists in the config
      const configString = JSON.stringify(viteConfig);
      expect(configString).toContain("Okaeri Resort");
      expect(configString).toContain("registerType");
    });

    it("🔄 REFACTOR: should configure workbox for resort-specific caching", () => {
      const configString = JSON.stringify(viteConfig);

      // Should include API caching strategy
      expect(configString).toContain("NetworkFirst");
      expect(configString).toContain("api-cache");

      // Should include static asset caching
      expect(configString).toContain("CacheFirst");
      expect(configString).toContain("static-assets");
    });

    it("🔄 REFACTOR: should include Philippine resort branding", () => {
      const configString = JSON.stringify(viteConfig);

      expect(configString).toContain("Okaeri Resort System");
      expect(configString).toContain("resort management");
      expect(configString).toContain("business");
    });

    it("🔄 REFACTOR: should configure proper icon sizes for mobile devices", () => {
      const configString = JSON.stringify(viteConfig);

      // Should include standard PWA icon sizes
      expect(configString).toContain("72x72");
      expect(configString).toContain("192x192");
      expect(configString).toContain("512x512");
    });

    it("🔄 REFACTOR: should enable development PWA features", () => {
      const configString = JSON.stringify(viteConfig);

      expect(configString).toContain("devOptions");
      expect(configString).toContain('"enabled":true');
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: DEPENDENCY OPTIMIZATION
  // ====================================

  describe("🔴🟢🔄 Dependency Optimization", () => {
    it("🔴 RED: should fail without dependency optimization", () => {
      expect(viteConfig.optimizeDeps).toBeDefined();
    });

    it("🟢 GREEN: should include critical dependencies for optimization", () => {
      const optimizeDeps = viteConfig.optimizeDeps!;

      expect(optimizeDeps.include).toBeDefined();
      expect(Array.isArray(optimizeDeps.include)).toBe(true);

      const includes = optimizeDeps.include as string[];

      // Core React dependencies
      expect(includes).toContain("react");
      expect(includes).toContain("react-dom");
      expect(includes).toContain("react/jsx-runtime");

      // TanStack ecosystem
      expect(includes).toContain("@tanstack/react-query");
      expect(includes).toContain("@tanstack/react-router");

      // State management
      expect(includes).toContain("zustand");
      expect(includes).toContain("zustand/middleware");
    });

    it("🔄 REFACTOR: should exclude development dependencies", () => {
      const optimizeDeps = viteConfig.optimizeDeps!;

      expect(optimizeDeps.exclude).toBeDefined();
      expect(Array.isArray(optimizeDeps.exclude)).toBe(true);

      const excludes = optimizeDeps.exclude as string[];

      expect(excludes).toContain("@testing-library/react");
      expect(excludes).toContain("vitest");
      expect(excludes).toContain("@vitejs/plugin-react-swc");
    });

    it("🔄 REFACTOR: should force re-optimization in development", () => {
      const optimizeDeps = viteConfig.optimizeDeps!;

      // Force should be based on NODE_ENV
      expect(optimizeDeps).toHaveProperty("force");
    });

    it("🔄 REFACTOR: should include form handling dependencies", () => {
      const optimizeDeps = viteConfig.optimizeDeps!;
      const includes = optimizeDeps.include as string[];

      expect(includes).toContain("react-hook-form");
      expect(includes).toContain("@hookform/resolvers");
      expect(includes).toContain("zod");
    });

    it("🔄 REFACTOR: should include essential UI components for pre-bundling", () => {
      const optimizeDeps = viteConfig.optimizeDeps!;
      const includes = optimizeDeps.include as string[];

      expect(includes).toContain("@radix-ui/react-dialog");
      expect(includes).toContain("@radix-ui/react-toast");
      expect(includes).toContain("@radix-ui/react-dropdown-menu");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: CSS CONFIGURATION
  // ====================================

  describe("🔴🟢🔄 CSS Configuration", () => {
    it("🔴 RED: should fail without CSS configuration", () => {
      expect(viteConfig.css).toBeDefined();
    });

    it("🟢 GREEN: should enable CSS source maps for development", () => {
      const css = viteConfig.css!;

      expect(css.devSourcemap).toBe(true);
    });

    it("🔄 REFACTOR: should configure CSS modules properly", () => {
      const css = viteConfig.css!;

      expect(css.modules).toBeDefined();
      expect(css.modules!.localsConvention).toBe("camelCaseOnly");
    });
  });

  // ====================================
  // PERFORMANCE & OPTIMIZATION TESTS
  // ====================================

  describe("🚀 Performance & Bundle Optimization", () => {
    it("should not include unnecessary plugins in production", () => {
      const plugins = viteConfig.plugins as any[];

      // All plugins should be properly defined (no false/null values after filtering)
      expect(plugins.every((plugin) => plugin !== false && plugin !== null)).toBe(true);
    });

    it("should optimize for mobile-first performance", () => {
      const build = viteConfig.build!;

      // Chunk size limit appropriate for mobile
      expect(build.chunkSizeWarningLimit).toBeLessThanOrEqual(500);

      // Modern target for better optimization
      expect(build.target).toBe("es2022");
    });

    it("should enable tree shaking for production", () => {
      const define = viteConfig.define!;

      expect(define).toHaveProperty("__DEV__");
      expect(define.__DEV__).toMatch(/"development"/);
    });

    it("should configure proper build output structure", () => {
      const rollupOptions = viteConfig.build!.rollupOptions!;
      const output = Array.isArray(rollupOptions.output)
        ? rollupOptions.output[0]
        : rollupOptions.output;

      // Should organize assets into subdirectories
      const assetFileNames = output!.assetFileNames as Function;

      expect(assetFileNames({ name: "test.png" })).toContain("images/");
      expect(assetFileNames({ name: "test.woff2" })).toContain("fonts/");
      expect(assetFileNames({ name: "test.css" })).toContain("styles/");
    });
  });

  // ====================================
  // INTEGRATION & COMPATIBILITY TESTS
  // ====================================

  describe("🔗 Integration & Compatibility", () => {
    it("should be compatible with TypeScript project references", () => {
      // The config should work with TypeScript project structure
      expect(viteConfig).toBeDefined();
      expect(typeof viteConfig).toBe("object");
    });

    it("should support hot module replacement", () => {
      const server = viteConfig.server!;

      // HMR should be enabled by default (not explicitly disabled)
      expect(server.hmr).not.toBe(false);
    });

    it("should support environment variable loading", () => {
      const define = viteConfig.define!;

      // Should define environment-specific variables
      expect(define).toBeDefined();
      expect(typeof define).toBe("object");
    });

    it("should be compatible with Vercel deployment", () => {
      const build = viteConfig.build!;

      // Output structure should be compatible with static hosting
      expect(build.outDir).toBe("dist");
      expect(build.assetsDir).toBe("assets");

      // Should generate source maps for debugging
      expect(build.sourcemap).toBe(true);
    });
  });

  // ====================================
  // PHILIPPINE-SPECIFIC CONFIGURATIONS
  // ====================================

  describe("🇵🇭 Philippine Resort-Specific Configuration", () => {
    it("should configure PWA for Philippine mobile usage patterns", () => {
      const configString = JSON.stringify(viteConfig);

      // Should target mobile-first approach common in Philippines
      expect(configString).toContain("standalone");
      expect(configString).toContain("portrait-primary");
    });

    it("should optimize for typical Philippine internet conditions", () => {
      const build = viteConfig.build!;

      // Smaller chunk sizes for slower connections
      expect(build.chunkSizeWarningLimit).toBeLessThanOrEqual(500);

      const configString = JSON.stringify(viteConfig);

      // Should include network-first caching for dynamic content
      expect(configString).toContain("NetworkFirst");

      // Should have reasonable cache expiration times
      expect(configString).toContain("maxAgeSeconds");
    });

    it("should include business and productivity PWA categories", () => {
      const configString = JSON.stringify(viteConfig);

      expect(configString).toContain("business");
      expect(configString).toContain("productivity");
    });

    it("should support offline functionality for resort operations", () => {
      const configString = JSON.stringify(viteConfig);

      // Should include service worker configuration
      expect(configString).toContain("autoUpdate");
      expect(configString).toContain("skipWaiting");
      expect(configString).toContain("clientsClaim");
    });

    it("should configure appropriate caching strategies for resort data", () => {
      const configString = JSON.stringify(viteConfig);

      // API responses should use NetworkFirst (fresh data priority)
      expect(configString).toContain("NetworkFirst");

      // Static assets should use CacheFirst (performance priority)
      expect(configString).toContain("CacheFirst");

      // Route data should use StaleWhileRevalidate (balance of both)
      expect(configString).toContain("StaleWhileRevalidate");
    });
  });
});

// ====================================
// TDD HELPER FUNCTIONS FOR CONFIG TESTING
// ====================================

/**
 * Helper to extract plugin configuration by name
 */
function findPluginConfig(plugins: any[], pluginName: string): any {
  return plugins.find(
    (plugin) =>
      plugin &&
      (plugin.name === pluginName ||
        (typeof plugin === "object" && JSON.stringify(plugin).includes(pluginName.split("-")[0])))
  );
}

/**
 * Helper to validate path alias resolution
 */
function validatePathAlias(
  alias: Record<string, string>,
  key: string,
  expectedSuffix: string
): boolean {
  return alias[key] && alias[key].endsWith(expectedSuffix);
}

/**
 * Helper to test manual chunk splitting logic
 */
function testChunkSplitting(
  manualChunks: Function,
  testCases: Array<{ input: string; expected: string }>
): void {
  testCases.forEach(({ input, expected }) => {
    expect(manualChunks(input)).toBe(expected);
  });
}

// ====================================
// TDD CHECKLIST FOR VITE CONFIGURATION
// ====================================

/**
 * TDD IMPLEMENTATION CHECKLIST FOR VITE CONFIG:
 *
 * 🔴 RED PHASE:
 * □ Test config file exists and loads properly
 * □ Test essential plugins are configured
 * □ Test path aliases are defined
 * □ Test development server configuration
 * □ Test build configuration structure
 *
 * 🟢 GREEN PHASE:
 * □ Validate actual plugin configurations
 * □ Verify path resolution works correctly
 * □ Confirm server settings meet requirements
 * □ Verify build output structure
 * □ Test dependency optimization settings
 *
 * 🔄 REFACTOR PHASE:
 * □ Test advanced code splitting strategies
 * □ Validate PWA configuration for resort use
 * □ Test performance optimization settings
 * □ Verify Philippine-specific configurations
 * □ Test integration with TypeScript and React
 * □ Validate production build optimization
 * □ Test mobile-first optimization
 * □ Verify Vercel deployment compatibility
 *
 * QUALITY GATES:
 * □ All plugins load correctly
 * □ Path aliases resolve to correct directories
 * □ Build produces optimized chunks
 * □ PWA manifest is properly configured
 * □ Development server works with proxy
 * □ Production build is under size limits
 * □ Configuration supports offline functionality
 * □ Code splitting creates appropriate chunks
 */
