/**
 * Mobile Responsive Design Validation Utilities
 * Okaeri Resort Management System
 *
 * Tests and validates mobile-first design implementations
 * for Philippine resort staff usage patterns
 */

import { logger } from "@/lib/logger";

// Standard mobile device breakpoints for testing
export const DEVICE_BREAKPOINTS = {
  MOBILE_SMALL: 360, // Samsung Galaxy S8, common Android
  MOBILE_MEDIUM: 375, // iPhone SE, iPhone 12 mini
  MOBILE_LARGE: 414, // iPhone 11 Pro Max, iPhone 12 Pro Max
  TABLET_SMALL: 640, // Small tablets, landscape phones
  TABLET_LARGE: 768, // iPad portrait
  DESKTOP: 1024, // Desktop and up
} as const;

// Touch target minimum sizes (WCAG AA)
export const TOUCH_TARGETS = {
  MINIMUM: 44, // Minimum touch target size in pixels
  PREFERRED: 48, // Preferred touch target size
  SPACING: 8, // Minimum spacing between touch targets
} as const;

/**
 * Validates if element meets touch target requirements
 */
export function validateTouchTarget(element: HTMLElement): {
  isValid: boolean;
  width: number;
  height: number;
  issues: string[];
} {
  const rect = element.getBoundingClientRect();
  const issues: string[] = [];

  if (rect.width < TOUCH_TARGETS.MINIMUM) {
    issues.push(`Width ${rect.width}px is below minimum ${TOUCH_TARGETS.MINIMUM}px`);
  }

  if (rect.height < TOUCH_TARGETS.MINIMUM) {
    issues.push(`Height ${rect.height}px is below minimum ${TOUCH_TARGETS.MINIMUM}px`);
  }

  return {
    isValid: issues.length === 0,
    width: rect.width,
    height: rect.height,
    issues,
  };
}

/**
 * Scans page for touch target violations
 */
export function scanTouchTargets(): Array<{
  element: HTMLElement;
  tagName: string;
  classes: string;
  validation: ReturnType<typeof validateTouchTarget>;
}> {
  const interactiveElements = document.querySelectorAll(
    'button, a, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
  );

  const violations: Array<{
    element: HTMLElement;
    tagName: string;
    classes: string;
    validation: ReturnType<typeof validateTouchTarget>;
  }> = [];

  interactiveElements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    const validation = validateTouchTarget(htmlElement);

    if (!validation.isValid) {
      violations.push({
        element: htmlElement,
        tagName: htmlElement.tagName.toLowerCase(),
        classes: htmlElement.className,
        validation,
      });
    }
  });

  return violations;
}

/**
 * Tests responsive behavior at different breakpoints
 */
export function testResponsiveBreakpoints(callback: (width: number) => void) {
  const originalWidth = window.innerWidth;

  Object.entries(DEVICE_BREAKPOINTS).forEach(([name, width]) => {
    // Simulate viewport resize
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });

    // Trigger resize event
    window.dispatchEvent(new Event("resize"));

    // Run callback with current width
    callback(width);

    logger.info(`✓ Tested ${name}: ${width}px`);
  });

  // Restore original width
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: originalWidth,
  });

  window.dispatchEvent(new Event("resize"));
}

/**
 * Validates contrast ratios for accessibility
 */
export function validateContrast(
  foregroundColor: string,
  backgroundColor: string
): {
  ratio: number;
  isValidAA: boolean;
  isValidAAA: boolean;
} {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  // Calculate relative luminance
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const fg = hexToRgb(foregroundColor);
  const bg = hexToRgb(backgroundColor);

  if (!fg || !bg) {
    return { ratio: 0, isValidAA: false, isValidAAA: false };
  }

  const fgLum = getLuminance(fg.r, fg.g, fg.b);
  const bgLum = getLuminance(bg.r, bg.g, bg.b);

  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);

  return {
    ratio,
    isValidAA: ratio >= 4.5, // WCAG AA normal text
    isValidAAA: ratio >= 7, // WCAG AAA normal text
  };
}

/**
 * Tests keyboard navigation flow
 */
export function testKeyboardNavigation(): {
  focusableElements: number;
  tabOrder: string[];
  issues: string[];
} {
  const focusableSelectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  const focusableElements = document.querySelectorAll(focusableSelectors);
  const tabOrder: string[] = [];
  const issues: string[] = [];

  focusableElements.forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    const tagName = htmlElement.tagName.toLowerCase();
    const id = htmlElement.id || `${tagName}-${index}`;

    tabOrder.push(id);

    // Check for missing ARIA labels on important elements
    if (["button", "input"].includes(tagName)) {
      const hasLabel =
        htmlElement.getAttribute("aria-label") ||
        htmlElement.getAttribute("aria-labelledby") ||
        document.querySelector(`label[for="${htmlElement.id}"]`);

      if (!hasLabel && !htmlElement.textContent?.trim()) {
        issues.push(`${tagName}#${id} missing accessible label`);
      }
    }

    // Check for proper focus indicators
    const computedStyle = getComputedStyle(htmlElement);
    if (computedStyle.outline === "none" && !computedStyle.boxShadow.includes("focus")) {
      issues.push(`${tagName}#${id} missing focus indicator`);
    }
  });

  return {
    focusableElements: focusableElements.length,
    tabOrder,
    issues,
  };
}

/**
 * Validates mobile form usability
 */
export function validateMobileForms(): {
  forms: Array<{
    element: HTMLFormElement;
    issues: string[];
    score: number;
  }>;
  overallScore: number;
} {
  const forms = document.querySelectorAll("form");
  const results: Array<{
    element: HTMLFormElement;
    issues: string[];
    score: number;
  }> = [];

  forms.forEach((form) => {
    const issues: string[] = [];
    let score = 100;

    // Check input types for mobile optimization
    const inputs = form.querySelectorAll("input");
    inputs.forEach((input) => {
      const type = input.getAttribute("type") || "text";
      const name = input.getAttribute("name") || "";

      // Email inputs should use type="email"
      if (name.includes("email") && type !== "email") {
        issues.push(`Input ${name} should use type="email" for mobile keyboards`);
        score -= 10;
      }

      // Phone inputs should use type="tel"
      if (name.includes("phone") || (name.includes("mobile") && type !== "tel")) {
        issues.push(`Input ${name} should use type="tel" for mobile keyboards`);
        score -= 10;
      }

      // Check for proper autocomplete attributes
      if (["email", "tel", "name"].some((attr) => name.includes(attr))) {
        if (!input.getAttribute("autocomplete")) {
          issues.push(`Input ${name} missing autocomplete for better mobile UX`);
          score -= 5;
        }
      }

      // Check input height for touch targets
      const rect = input.getBoundingClientRect();
      if (rect.height < TOUCH_TARGETS.MINIMUM) {
        issues.push(
          `Input ${name} height ${rect.height}px below minimum ${TOUCH_TARGETS.MINIMUM}px`
        );
        score -= 15;
      }
    });

    // Check labels
    const labels = form.querySelectorAll("label");
    if (labels.length < inputs.length) {
      issues.push("Missing labels for some inputs");
      score -= 20;
    }

    results.push({
      element: form,
      issues,
      score: Math.max(0, score),
    });
  });

  const overallScore =
    results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 100;

  return { forms: results, overallScore };
}

/**
 * Tests mobile table responsiveness
 */
export function validateMobileTables(): {
  tables: Array<{
    element: HTMLTableElement;
    issues: string[];
    hasMobileView: boolean;
  }>;
} {
  const tables = document.querySelectorAll("table");
  const results: Array<{
    element: HTMLTableElement;
    issues: string[];
    hasMobileView: boolean;
  }> = [];

  tables.forEach((table) => {
    const issues: string[] = [];
    let hasMobileView = false;

    // Check if table has mobile alternative
    const parent = table.closest(".responsive-table, .mobile-table-container");
    if (parent) {
      const mobileCards = parent.querySelectorAll(".mobile-table-card, .mobile-card");
      hasMobileView = mobileCards.length > 0;
    }

    // Check table width for horizontal scroll
    const rect = table.getBoundingClientRect();
    if (rect.width > window.innerWidth) {
      if (!table.closest(".mobile-scroll-container, .overflow-x-auto")) {
        issues.push("Table wider than viewport without horizontal scroll container");
      }
    }

    // Check for sticky headers on mobile
    const thead = table.querySelector("thead");
    if (thead && window.innerWidth < DEVICE_BREAKPOINTS.TABLET_SMALL) {
      const computedStyle = getComputedStyle(thead);
      if (computedStyle.position !== "sticky") {
        issues.push("Table missing sticky header for mobile");
      }
    }

    if (!hasMobileView && window.innerWidth < DEVICE_BREAKPOINTS.TABLET_SMALL) {
      issues.push("Table lacks mobile-optimized card view");
    }

    results.push({
      element: table,
      issues,
      hasMobileView,
    });
  });

  return { tables: results };
}

/**
 * Comprehensive mobile validation report
 */
export function generateMobileValidationReport(): {
  touchTargets: ReturnType<typeof scanTouchTargets>;
  keyboardNavigation: ReturnType<typeof testKeyboardNavigation>;
  forms: ReturnType<typeof validateMobileForms>;
  tables: ReturnType<typeof validateMobileTables>;
  overallScore: number;
  recommendations: string[];
} {
  const touchTargets = scanTouchTargets();
  const keyboardNavigation = testKeyboardNavigation();
  const forms = validateMobileForms();
  const tables = validateMobileTables();

  const recommendations: string[] = [];
  let overallScore = 100;

  // Touch target recommendations
  if (touchTargets.length > 0) {
    recommendations.push(`Fix ${touchTargets.length} touch target violations`);
    overallScore -= Math.min(30, touchTargets.length * 5);
  }

  // Keyboard navigation recommendations
  if (keyboardNavigation.issues.length > 0) {
    recommendations.push(`Address ${keyboardNavigation.issues.length} keyboard navigation issues`);
    overallScore -= Math.min(20, keyboardNavigation.issues.length * 3);
  }

  // Form recommendations
  if (forms.overallScore < 90) {
    recommendations.push("Improve mobile form optimization");
    overallScore -= (100 - forms.overallScore) * 0.3;
  }

  // Table recommendations
  const tableIssues = tables.tables.reduce((sum, t) => sum + t.issues.length, 0);
  if (tableIssues > 0) {
    recommendations.push(`Optimize ${tableIssues} table mobile issues`);
    overallScore -= Math.min(20, tableIssues * 5);
  }

  // Add positive recommendations
  if (overallScore > 90) {
    recommendations.push("Excellent mobile optimization!");
  } else if (overallScore > 75) {
    recommendations.push("Good mobile experience with room for improvement");
  } else {
    recommendations.push("Significant mobile optimization needed");
  }

  return {
    touchTargets,
    keyboardNavigation,
    forms,
    tables,
    overallScore: Math.max(0, overallScore),
    recommendations,
  };
}

/**
 * Run mobile validation tests in browser console
 */
export function runMobileTests() {
  // eslint-disable-next-line no-console
  console.group("🔍 Mobile Responsive Validation");

  const report = generateMobileValidationReport();

  logger.info(`📱 Overall Mobile Score: ${report.overallScore.toFixed(1)}%`);
  logger.info(`🎯 Touch Targets: ${report.touchTargets.length} violations`);
  logger.info(`⌨️ Keyboard Navigation: ${report.keyboardNavigation.issues.length} issues`);
  logger.info(`📝 Forms Score: ${report.forms.overallScore.toFixed(1)}%`);
  logger.info(`📊 Tables: ${report.tables.tables.length} found`);

  if (report.recommendations.length > 0) {
    // eslint-disable-next-line no-console
    console.group("💡 Recommendations");
    report.recommendations.forEach((rec) => logger.info(`• ${rec}`));
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  // eslint-disable-next-line no-console
  console.groupEnd();

  return report;
}

// Extend Window interface for mobile validation utilities
declare global {
  interface Window {
    runMobileTests?: typeof runMobileTests;
    mobileValidation?: {
      scanTouchTargets: typeof scanTouchTargets;
      testResponsiveBreakpoints: typeof testResponsiveBreakpoints;
      validateContrast: typeof validateContrast;
      testKeyboardNavigation: typeof testKeyboardNavigation;
      validateMobileForms: typeof validateMobileForms;
      validateMobileTables: typeof validateMobileTables;
      generateMobileValidationReport: typeof generateMobileValidationReport;
    };
  }
}

// Make available globally for testing
if (typeof window !== "undefined") {
  window.runMobileTests = runMobileTests;
  window.mobileValidation = {
    scanTouchTargets,
    testResponsiveBreakpoints,
    validateContrast,
    testKeyboardNavigation,
    validateMobileForms,
    validateMobileTables,
    generateMobileValidationReport,
  };
}
