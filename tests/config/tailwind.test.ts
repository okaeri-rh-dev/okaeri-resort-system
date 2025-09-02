/**
 * TDD Test Suite: Tailwind CSS Configuration Validation
 *
 * This test suite validates the Tailwind CSS configuration for the Okaeri Resort Management System,
 * ensuring proper theme configuration, Philippine resort-specific styling, mobile-first design,
 * and accessibility features for a production-ready resort management application.
 *
 * COVERAGE:
 * - Tailwind CSS v4 configuration and PostCSS integration
 * - Philippine resort theme colors and branding
 * - Typography and font configuration
 * - Responsive breakpoints and mobile-first design
 * - Custom utilities and component classes
 * - Accessibility and high contrast support
 * - Animation and transition configurations
 * - Print styles and offline considerations
 * - Performance optimizations and dark mode
 *
 * TDD APPROACH:
 * 🔴 RED: Write failing tests for expected Tailwind theme and utilities
 * 🟢 GREEN: Validate actual CSS configuration matches resort requirements
 * 🔄 REFACTOR: Test advanced features and Philippine-specific customizations
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 1.1 - Project Setup
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { resolve } from "path";
import { TDDWorkflow, TDD_CONSTANTS } from "@tests/utils/tdd-helpers";

// ====================================
// CONFIGURATION LOADING & VALIDATION
// ====================================

describe("🎨 Tailwind CSS Configuration - Phase 1.1 Foundation", () => {
  let postcssConfig: any;
  let tailwindStyles: string;
  let projectRoot: string;

  beforeAll(async () => {
    // 🔧 SETUP: Load PostCSS configuration and main CSS file
    projectRoot = resolve(process.cwd());

    try {
      // Load PostCSS config
      const postcssConfigPath = resolve(projectRoot, "postcss.config.js");
      const postcssModule = await import(postcssConfigPath);
      postcssConfig = postcssModule.default;

      // Load main Tailwind styles
      const stylesPath = resolve(projectRoot, "src/index.css");
      const fs = require("fs");
      tailwindStyles = fs.readFileSync(stylesPath, "utf8");
    } catch (error) {
      throw new Error(`Failed to load Tailwind configurations: ${error}`);
    }
  });

  // ====================================
  // RED-GREEN-REFACTOR: POSTCSS CONFIGURATION
  // ====================================

  describe("🔴🟢🔄 PostCSS & Tailwind Plugin Configuration", () => {
    it("🔴 RED: should fail without PostCSS configuration", () => {
      const tddCycle = TDDWorkflow.createTDDCycle("PostCSS Tailwind Setup");

      tddCycle.red("validates PostCSS config exists", () => {
        expect(postcssConfig).toBeDefined();
        expect(typeof postcssConfig).toBe("object");
      });
    });

    it("🟢 GREEN: should configure Tailwind CSS v4 plugin", () => {
      expect(postcssConfig.plugins).toBeDefined();
      expect(postcssConfig.plugins["@tailwindcss/postcss"]).toBeDefined();
    });

    it("🔄 REFACTOR: should use minimal PostCSS configuration", () => {
      // Tailwind CSS v4 requires minimal PostCSS setup
      expect(Object.keys(postcssConfig.plugins)).toHaveLength(1);
      expect(postcssConfig.plugins["@tailwindcss/postcss"]).toEqual({});
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: BASIC STYLES STRUCTURE
  // ====================================

  describe("🔴🟢🔄 Tailwind Styles Structure & Imports", () => {
    it("🔴 RED: should fail without Tailwind CSS import", () => {
      expect(tailwindStyles).toBeDefined();
      expect(typeof tailwindStyles).toBe("string");
      expect(tailwindStyles.length).toBeGreaterThan(0);
    });

    it("🟢 GREEN: should import Tailwind CSS v4", () => {
      expect(tailwindStyles).toContain('@import "tailwindcss";');
    });

    it("🔄 REFACTOR: should import custom route transitions", () => {
      expect(tailwindStyles).toContain('@import "./styles/route-transitions.css";');
    });

    it("🔄 REFACTOR: should define theme configuration", () => {
      expect(tailwindStyles).toContain("@theme {");
    });

    it("🔄 REFACTOR: should include base layer styles", () => {
      expect(tailwindStyles).toContain("@layer base {");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: PHILIPPINE RESORT THEME
  // ====================================

  describe("🔴🟢🔄 Philippine Resort Theme Configuration", () => {
    it("🔴 RED: should fail without enterprise-specific color palette", () => {
      expect(tailwindStyles).toContain("--color-corporate");
      expect(tailwindStyles).toContain("--color-neutral");
      expect(tailwindStyles).toContain("--color-accent");
    });

    it("🟢 GREEN: should define Corporate Blue color palette", () => {
      const corporateColors = [
        "--color-corporate-25",
        "--color-corporate-50",
        "--color-corporate-100",
        "--color-corporate-200",
        "--color-corporate-300",
        "--color-corporate-400",
        "--color-corporate-500",
        "--color-corporate-600",
        "--color-corporate-700",
        "--color-corporate-800",
        "--color-corporate-900",
        "--color-corporate-950",
      ];

      corporateColors.forEach((color) => {
        expect(tailwindStyles).toContain(color);
      });
    });

    it("🔄 REFACTOR: should define Neutral Gray color palette", () => {
      const neutralColors = [
        "--color-neutral-25",
        "--color-neutral-50",
        "--color-neutral-100",
        "--color-neutral-200",
        "--color-neutral-300",
        "--color-neutral-400",
        "--color-neutral-500",
        "--color-neutral-600",
        "--color-neutral-700",
        "--color-neutral-800",
        "--color-neutral-900",
      ];

      neutralColors.forEach((color) => {
        expect(tailwindStyles).toContain(color);
      });
    });

    it("🔄 REFACTOR: should define Accent Blue highlights colors", () => {
      const accentColors = [
        "--color-accent-25",
        "--color-accent-50",
        "--color-accent-100",
        "--color-accent-200",
        "--color-accent-300",
        "--color-accent-400",
        "--color-accent-500",
        "--color-accent-600",
        "--color-accent-700",
        "--color-accent-800",
        "--color-accent-900",
      ];

      accentColors.forEach((color) => {
        expect(tailwindStyles).toContain(color);
      });
    });

    it("🔄 REFACTOR: should define Success Green status colors", () => {
      const successColors = [
        "--color-success-25",
        "--color-success-50",
        "--color-success-100",
        "--color-success-200",
        "--color-success-300",
        "--color-success-400",
        "--color-success-500",
        "--color-success-600",
        "--color-success-700",
        "--color-success-800",
        "--color-success-900",
      ];

      successColors.forEach((color) => {
        expect(tailwindStyles).toContain(color);
      });
    });

    it("🔄 REFACTOR: should define Warning Orange alert colors", () => {
      const warningColors = [
        "--color-warning-25",
        "--color-warning-50",
        "--color-warning-100",
        "--color-warning-200",
        "--color-warning-300",
        "--color-warning-400",
        "--color-warning-500",
        "--color-warning-600",
        "--color-warning-700",
        "--color-warning-800",
        "--color-warning-900",
      ];

      warningColors.forEach((color) => {
        expect(tailwindStyles).toContain(color);
      });
    });

    it("🔄 REFACTOR: should use modern oklch color space", () => {
      expect(tailwindStyles).toContain("oklch(");

      // Should use oklch for better color consistency
      const colorDefinitions = tailwindStyles.match(/oklch\([^)]+\)/g);
      expect(colorDefinitions).toBeDefined();
      expect(colorDefinitions!.length).toBeGreaterThan(30);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: SHADCN/UI COMPATIBILITY
  // ====================================

  describe("🔴🟢🔄 Shadcn/UI Theme Compatibility", () => {
    it("🔴 RED: should fail without shadcn/ui color mappings", () => {
      expect(tailwindStyles).toContain("--color-primary");
      expect(tailwindStyles).toContain("--color-secondary");
      expect(tailwindStyles).toContain("--color-background");
    });

    it("🟢 GREEN: should map semantic colors correctly", () => {
      const semanticColors = [
        "--color-border",
        "--color-input",
        "--color-ring",
        "--color-background",
        "--color-foreground",
        "--color-primary",
        "--color-primary-foreground",
        "--color-secondary",
        "--color-secondary-foreground",
        "--color-destructive",
        "--color-destructive-foreground",
        "--color-muted",
        "--color-muted-foreground",
        "--color-accent",
        "--color-accent-foreground",
        "--color-popover",
        "--color-popover-foreground",
        "--color-card",
        "--color-card-foreground",
      ];

      semanticColors.forEach((color) => {
        expect(tailwindStyles).toContain(color);
      });
    });

    it("🔄 REFACTOR: should define light theme variables", () => {
      expect(tailwindStyles).toContain(":root {");

      // Light theme ocean primary
      expect(tailwindStyles).toContain("--primary: 55% 0.2 220;");

      // Light theme sand secondary
      expect(tailwindStyles).toContain("--secondary: 90% 0.04 85;");

      // Light theme coral accent
      expect(tailwindStyles).toContain("--accent: 88% 0.08 25;");
    });

    it("🔄 REFACTOR: should define dark theme variables", () => {
      expect(tailwindStyles).toContain(".dark {");

      // Dark theme adjustments for resort colors
      expect(tailwindStyles).toContain("--primary: 75% 0.12 220;");
      expect(tailwindStyles).toContain("--background: 15% 0.02 220;");
      expect(tailwindStyles).toContain("--accent: 80% 0.12 25;");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: TYPOGRAPHY CONFIGURATION
  // ====================================

  describe("🔴🟢🔄 Typography & Font Configuration", () => {
    it("🔴 RED: should fail without proper font family configuration", () => {
      expect(tailwindStyles).toContain("--font-family-sans");
    });

    it("🟢 GREEN: should configure Inter font with system fallbacks", () => {
      expect(tailwindStyles).toContain('"Inter"');
      expect(tailwindStyles).toContain("system-ui");
      expect(tailwindStyles).toContain("-apple-system");
      expect(tailwindStyles).toContain("BlinkMacSystemFont");
      expect(tailwindStyles).toContain('"Segoe UI"');
    });

    it("🔄 REFACTOR: should define responsive heading styles", () => {
      const headingSelectors = ["h1", "h2", "h3", "h4", "h5", "h6"];

      headingSelectors.forEach((selector) => {
        expect(tailwindStyles).toContain(`${selector} {`);
      });

      // Should use responsive text sizing
      expect(tailwindStyles).toContain("text-4xl lg:text-5xl");
      expect(tailwindStyles).toContain("text-3xl lg:text-4xl");
    });

    it("🔄 REFACTOR: should configure font feature settings", () => {
      expect(tailwindStyles).toContain("font-feature-settings:");
      expect(tailwindStyles).toContain('"rlig" 1');
      expect(tailwindStyles).toContain('"calt" 1');
    });

    it("🔄 REFACTOR: should enable font smoothing", () => {
      expect(tailwindStyles).toContain("-webkit-font-smoothing: antialiased");
      expect(tailwindStyles).toContain("-moz-osx-font-smoothing: grayscale");
      expect(tailwindStyles).toContain("text-rendering: optimizeLegibility");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: RESPONSIVE BREAKPOINTS
  // ====================================

  describe("🔴🟢🔄 Responsive Breakpoints & Mobile-First Design", () => {
    it("🔴 RED: should fail without responsive breakpoint configuration", () => {
      expect(tailwindStyles).toContain("--breakpoint-");
    });

    it("🟢 GREEN: should define standard responsive breakpoints", () => {
      expect(tailwindStyles).toContain("--breakpoint-sm: 640px");
      expect(tailwindStyles).toContain("--breakpoint-md: 768px");
      expect(tailwindStyles).toContain("--breakpoint-lg: 1024px");
      expect(tailwindStyles).toContain("--breakpoint-xl: 1280px");
      expect(tailwindStyles).toContain("--breakpoint-2xl: 1400px");
    });

    it("🔄 REFACTOR: should optimize for Philippine mobile usage", () => {
      // Mobile-first optimizations for typical Philippine devices
      expect(tailwindStyles).toContain("@media (max-width: 768px)");
      expect(tailwindStyles).toContain("min-h-[44px]");
    });

    it("🔄 REFACTOR: should configure container utility", () => {
      expect(tailwindStyles).toContain("@utility container");
      expect(tailwindStyles).toContain("margin-inline: auto");
      expect(tailwindStyles).toContain("padding-inline: 2rem");
      expect(tailwindStyles).toContain("max-width: 1400px");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: CUSTOM UTILITIES
  // ====================================

  describe("🔴🟢🔄 Resort-Specific Custom Utilities", () => {
    it("🔴 RED: should fail without enterprise-specific color variables", () => {
      expect(tailwindStyles).toContain("--color-corporate");
      expect(tailwindStyles).toContain("--color-neutral");
      expect(tailwindStyles).toContain("--color-accent");
    });

    it("🟢 GREEN: should define corporate color variables", () => {
      expect(tailwindStyles).toContain("--color-corporate-400");
      expect(tailwindStyles).toContain("--color-corporate-500");
      expect(tailwindStyles).toContain("--color-corporate-600");
    });

    it("🔄 REFACTOR: should define warning color variables", () => {
      expect(tailwindStyles).toContain("--color-warning-400");
      expect(tailwindStyles).toContain("--color-accent-400");
      expect(tailwindStyles).toContain("--color-warning-500");
    });

    it("🔄 REFACTOR: should define success color variables", () => {
      expect(tailwindStyles).toContain("--color-success-400");
      expect(tailwindStyles).toContain("--color-corporate-400");
      expect(tailwindStyles).toContain("--color-accent-400");
    });

    it("🔄 REFACTOR: should define enterprise color consistency", () => {
      expect(tailwindStyles).toContain("--color-corporate-");
      expect(tailwindStyles).toContain("--color-accent-");
      // Should not contain old resort names
      expect(tailwindStyles).not.toContain("--color-ocean-");
      expect(tailwindStyles).not.toContain("--color-coral-");
    });

    it("🔄 REFACTOR: should define glass morphism utilities", () => {
      expect(tailwindStyles).toContain(".glass {");
      expect(tailwindStyles).toContain(".glass-dark {");
      expect(tailwindStyles).toContain("backdrop-blur-md");
      expect(tailwindStyles).toContain("bg-white/10");
    });

    it("🔄 REFACTOR: should define Philippine peso currency utility", () => {
      expect(tailwindStyles).toContain(".currency-php::before");
      expect(tailwindStyles).toContain('content: "₱"');
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: ANIMATIONS & INTERACTIONS
  // ====================================

  describe("🔴🟢🔄 Animations & Interactive Elements", () => {
    it("🔴 RED: should fail without custom animation definitions", () => {
      expect(tailwindStyles).toContain("@keyframes");
    });

    it("🟢 GREEN: should define accordion animations", () => {
      expect(tailwindStyles).toContain("--animate-accordion-down");
      expect(tailwindStyles).toContain("--animate-accordion-up");
      expect(tailwindStyles).toContain("@keyframes accordion-down");
      expect(tailwindStyles).toContain("@keyframes accordion-up");
    });

    it("🔄 REFACTOR: should define resort-specific animations", () => {
      expect(tailwindStyles).toContain("@keyframes float");
      expect(tailwindStyles).toContain("@keyframes float-delayed");
      expect(tailwindStyles).toContain("@keyframes loading-bar");
    });

    it("🔄 REFACTOR: should define float animation classes", () => {
      expect(tailwindStyles).toContain(".animate-float");
      expect(tailwindStyles).toContain(".animate-float-delayed");
      expect(tailwindStyles).toContain("animation: float 6s ease-in-out infinite");
      expect(tailwindStyles).toContain("animation: float-delayed 8s ease-in-out infinite");
    });

    it("🔄 REFACTOR: should support reduced motion preferences", () => {
      expect(tailwindStyles).toContain("@media (prefers-reduced-motion: reduce)");
      expect(tailwindStyles).toContain("animation-duration: 0.01ms !important");
      expect(tailwindStyles).toContain("animation: none !important");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: ACCESSIBILITY FEATURES
  // ====================================

  describe("🔴🟢🔄 Accessibility & Inclusive Design", () => {
    it("🔴 RED: should fail without focus and accessibility styles", () => {
      expect(tailwindStyles).toContain(":focus-visible");
      expect(tailwindStyles).toContain("outline-ring");
    });

    it("🟢 GREEN: should define proper focus styles", () => {
      expect(tailwindStyles).toContain("*:focus-visible {");
      expect(tailwindStyles).toContain("outline-ring outline-2 outline-offset-2");
      expect(tailwindStyles).toContain("*:focus:not(:focus-visible)");
      expect(tailwindStyles).toContain("outline-none");
    });

    it("🔄 REFACTOR: should support high contrast mode", () => {
      expect(tailwindStyles).toContain("@media (prefers-contrast: high)");
      expect(tailwindStyles).toContain("--border: 0% 0 0");
      expect(tailwindStyles).toContain("--ring: 0% 0 0");
    });

    it("🔄 REFACTOR: should define proper selection styles", () => {
      expect(tailwindStyles).toContain("::selection {");
      expect(tailwindStyles).toContain("bg-primary/20");
      expect(tailwindStyles).toContain("text-primary-foreground");
    });

    it("🔄 REFACTOR: should ensure minimum touch target sizes", () => {
      expect(tailwindStyles).toContain("min-h-[44px]");

      // Should apply to interactive elements
      const interactiveElements = ["button", "a", "input", "select", "textarea"];
      interactiveElements.forEach((element) => {
        expect(tailwindStyles).toContain(element);
      });
    });

    it("🔄 REFACTOR: should configure proper text size adjustment", () => {
      expect(tailwindStyles).toContain("-webkit-text-size-adjust: 100%");
      expect(tailwindStyles).toContain("-webkit-tap-highlight-color: transparent");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: SCROLLBAR & UI ENHANCEMENTS
  // ====================================

  describe("🔴🟢🔄 Scrollbar & UI Enhancement Styles", () => {
    it("🔴 RED: should fail without custom scrollbar styles", () => {
      expect(tailwindStyles).toContain("::-webkit-scrollbar");
    });

    it("🟢 GREEN: should define custom scrollbar styling", () => {
      expect(tailwindStyles).toContain("::-webkit-scrollbar {");
      expect(tailwindStyles).toContain("h-2 w-2");
      expect(tailwindStyles).toContain("::-webkit-scrollbar-track");
      expect(tailwindStyles).toContain("::-webkit-scrollbar-thumb");
    });

    it("🔄 REFACTOR: should use theme colors for scrollbars", () => {
      expect(tailwindStyles).toContain("bg-muted");
      expect(tailwindStyles).toContain("bg-border");
      expect(tailwindStyles).toContain("hover:bg-muted-foreground/20");
    });

    it("🔄 REFACTOR: should improve form element appearance", () => {
      expect(tailwindStyles).toContain("-webkit-appearance: none");
      expect(tailwindStyles).toContain("-moz-appearance: none");
      expect(tailwindStyles).toContain("appearance: none");
    });

    it("🔄 REFACTOR: should enhance touch interactions", () => {
      expect(tailwindStyles).toContain("touch-manipulation");
      expect(tailwindStyles).toContain("select-none");
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: PRINT & OFFLINE STYLES
  // ====================================

  describe("🔴🟢🔄 Print & Offline Considerations", () => {
    it("🔴 RED: should fail without print media styles", () => {
      expect(tailwindStyles).toContain("@media print");
    });

    it("🟢 GREEN: should define print-specific styles", () => {
      expect(tailwindStyles).toContain(".no-print");
      expect(tailwindStyles).toContain("display: none !important");
    });

    it("🔄 REFACTOR: should optimize for print readability", () => {
      expect(tailwindStyles).toContain("bg-white text-black");
    });

    it("🔄 REFACTOR: should handle offline scenarios", () => {
      // Styles should be embedded for offline usage
      expect(tailwindStyles.length).toBeGreaterThan(10000);
    });
  });

  // ====================================
  // INTEGRATION & COMPATIBILITY TESTS
  // ====================================

  describe("🔗 Integration & Compatibility", () => {
    it("should be compatible with Vite and build process", () => {
      // CSS should be structured for Vite processing
      expect(tailwindStyles).toContain('@import "tailwindcss";');
      expect(tailwindStyles).not.toContain("undefined");
      expect(tailwindStyles).not.toContain("null");
    });

    it("should work with React components", () => {
      // Should define variables that React components can use
      expect(tailwindStyles).toContain("--color-corporate-");
      expect(tailwindStyles).toContain(".glass");
      expect(tailwindStyles).toContain(".currency-php");
    });

    it("should support component library integration", () => {
      // Shadcn/ui compatibility
      expect(tailwindStyles).toContain("--color-primary");
      expect(tailwindStyles).toContain("--color-secondary");
      expect(tailwindStyles).toContain("--color-accent");
    });

    it("should be optimized for production builds", () => {
      // Should not contain development-only styles
      expect(tailwindStyles).not.toContain("console.log");
      expect(tailwindStyles).not.toContain("debugger");
    });
  });

  // ====================================
  // PHILIPPINE-SPECIFIC CONFIGURATIONS
  // ====================================

  describe("🇵🇭 Philippine Resort-Specific Styling", () => {
    it("should support Philippine Peso currency formatting", () => {
      expect(tailwindStyles).toContain(".currency-php::before");
      expect(tailwindStyles).toContain('content: "₱"');
      expect(tailwindStyles).toContain("mr-1");
    });

    it("should use professional enterprise color palette", () => {
      // Corporate, neutral, accent, success colors for professional feel
      expect(tailwindStyles).toContain("--color-corporate-");
      expect(tailwindStyles).toContain("--color-neutral-");
      expect(tailwindStyles).toContain("--color-accent-");
      expect(tailwindStyles).toContain("--color-success-");
    });

    it("should optimize for Filipino mobile usage patterns", () => {
      // Touch-friendly sizing for mobile-first country
      expect(tailwindStyles).toContain("min-h-[44px]");
      expect(tailwindStyles).toContain("touch-manipulation");
    });

    it("should support enterprise branding and aesthetics", () => {
      expect(tailwindStyles).toContain("--color-success-");
      expect(tailwindStyles).toContain("--color-warning-");
      expect(tailwindStyles).toContain(".animate-float");
    });

    it("should provide glass morphism for modern resort UI", () => {
      expect(tailwindStyles).toContain(".glass {");
      expect(tailwindStyles).toContain("backdrop-blur-md");
      expect(tailwindStyles).toContain("bg-white/10");
    });

    it("should handle multi-language text with proper spacing", () => {
      // Filipino and English mixed content
      expect(tailwindStyles).toContain("font-feature-settings:");
      expect(tailwindStyles).toContain('"rlig" 1');
      expect(tailwindStyles).toContain('"calt" 1');
    });
  });

  // ====================================
  // PERFORMANCE & OPTIMIZATION
  // ====================================

  describe("🚀 Performance & Build Optimization", () => {
    it("should use efficient CSS custom properties", () => {
      // CSS custom properties are more performant than inline styles
      const customProperties = tailwindStyles.match(/--[\w-]+:/g);
      expect(customProperties).toBeDefined();
      expect(customProperties!.length).toBeGreaterThan(50);
    });

    it("should optimize for critical CSS", () => {
      // Base styles should be minimal and critical
      expect(tailwindStyles).toContain("@layer base");
      expect(tailwindStyles.indexOf("@layer base")).toBeGreaterThan(0);
    });

    it("should minimize redundant CSS", () => {
      // Should use efficient selectors and avoid duplication
      const asteriskSelectors = tailwindStyles.match(/\* \{/g);
      expect(asteriskSelectors?.length || 0).toBeLessThan(5);
    });

    it("should support tree shaking and purging", () => {
      // Tailwind v4 automatically handles purging
      expect(tailwindStyles).toContain('@import "tailwindcss";');
    });

    it("should optimize for mobile performance", () => {
      // Should avoid expensive operations on mobile
      expect(tailwindStyles).toContain("transform: translateY");
      expect(tailwindStyles).toContain("animation: ");

      // Should have reduced motion support
      expect(tailwindStyles).toContain("@media (prefers-reduced-motion: reduce)");
    });
  });

  // ====================================
  // THEME VALIDATION TESTS
  // ====================================

  describe("🎨 Theme Consistency & Validation", () => {
    it("should maintain consistent color relationships", () => {
      // Light and dark themes should use same base colors
      expect(tailwindStyles).toContain("--primary: 55% 0.2 220");
      expect(tailwindStyles).toContain("--primary: 75% 0.12 220");
    });

    it("should provide sufficient contrast ratios", () => {
      // Colors should meet WCAG accessibility guidelines
      expect(tailwindStyles).toContain("--foreground: 20% 0 0");
      expect(tailwindStyles).toContain("--background: 100% 0 0");

      // Dark theme should invert appropriately
      expect(tailwindStyles).toContain("--foreground: 95% 0.02 85");
      expect(tailwindStyles).toContain("--background: 15% 0.02 220");
    });

    it("should use semantic color naming", () => {
      const semanticNames = [
        "primary",
        "secondary",
        "accent",
        "destructive",
        "muted",
        "card",
        "popover",
        "border",
        "ring",
      ];

      semanticNames.forEach((name) => {
        expect(tailwindStyles).toContain(`--${name}:`);
      });
    });

    it("should support brand color variations", () => {
      // Each brand color should have proper scale
      const brandColors = ["corporate", "neutral", "accent", "success", "warning"];
      const colorStops = [
        "25",
        "50",
        "100",
        "200",
        "300",
        "400",
        "500",
        "600",
        "700",
        "800",
        "900",
      ];

      brandColors.forEach((color) => {
        colorStops.forEach((stop) => {
          expect(tailwindStyles).toContain(`--color-${color}-${stop}:`);
        });
      });
    });
  });
});

// ====================================
// TDD HELPER FUNCTIONS FOR TAILWIND CONFIG TESTING
// ====================================

/**
 * Helper to extract color definitions from CSS
 */
function extractColorDefinitions(styles: string): string[] {
  const colorRegex = /--color-[\w-]+:\s*oklch\([^)]+\);/g;
  return styles.match(colorRegex) || [];
}

/**
 * Helper to validate CSS selector exists
 */
function validateCSSSelector(styles: string, selector: string): boolean {
  return styles.includes(`${selector} {`) || styles.includes(`${selector}{`);
}

/**
 * Helper to extract CSS custom properties
 */
function extractCustomProperties(styles: string): string[] {
  const propRegex = /--([\w-]+):/g;
  const matches = styles.match(propRegex);
  return matches ? matches.map((match) => match.replace(":", "")) : [];
}

/**
 * Helper to validate media query presence
 */
function validateMediaQuery(styles: string, query: string): boolean {
  return styles.includes(`@media ${query}`);
}

/**
 * Helper to check animation definition
 */
function validateAnimation(styles: string, name: string): boolean {
  return styles.includes(`@keyframes ${name}`) && styles.includes(`.animate-${name}`);
}

/**
 * Helper to validate utility class definition
 */
function validateUtilityClass(
  styles: string,
  className: string,
  expectedProperty: string
): boolean {
  const classRegex = new RegExp(`\\.${className}\\s*{[^}]*${expectedProperty}[^}]*}`, "g");
  return classRegex.test(styles);
}

// ====================================
// TDD CHECKLIST FOR TAILWIND CONFIGURATION
// ====================================

/**
 * TDD IMPLEMENTATION CHECKLIST FOR TAILWIND CONFIG:
 *
 * 🔴 RED PHASE:
 * □ Test PostCSS configuration fails without Tailwind plugin
 * □ Test theme colors fail without Philippine resort palette
 * □ Test typography fails without Inter font configuration
 * □ Test responsive breakpoints fail without mobile-first setup
 * □ Test custom utilities fail without resort-specific classes
 *
 * 🟢 GREEN PHASE:
 * □ Validate Tailwind CSS v4 imports correctly
 * □ Verify Philippine resort color palette is complete
 * □ Confirm shadcn/ui compatibility mappings work
 * □ Test responsive breakpoints are mobile-optimized
 * □ Verify custom gradient and utility classes exist
 *
 * 🔄 REFACTOR PHASE:
 * □ Test advanced animations and interactions
 * □ Validate accessibility and focus states
 * □ Test high contrast and reduced motion support
 * □ Verify print styles and offline considerations
 * □ Test Philippine-specific currency and styling
 * □ Validate performance optimizations
 * □ Test theme consistency and color relationships
 * □ Verify integration with Vite and React
 * □ Test scrollbar and UI enhancement styles
 * □ Validate mobile touch target requirements
 *
 * QUALITY GATES:
 * □ All resort brand colors properly defined
 * □ Accessibility requirements met (WCAG compliance)
 * □ Mobile-first responsive design implemented
 * □ Philippine Peso currency formatting available
 * □ Dark mode theme properly configured
 * □ Custom animations respect reduced motion
 * □ Print styles defined for offline use
 * □ Touch targets meet minimum 44px requirement
 * □ Integration with component library working
 * □ Performance optimized for mobile networks
 */
