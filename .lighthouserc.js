/**
 * Phase 5.3: Lighthouse CI Configuration
 * Automated performance regression testing for Okaeri Resort System
 * Optimized for Philippine network conditions and mobile-first usage
 */

module.exports = {
  ci: {
    // Build configuration
    collect: {
      // Test multiple pages for comprehensive coverage
      url: [
        "http://localhost:5173",
        "http://localhost:5173/dashboard",
        "http://localhost:5173/bookings",
        "http://localhost:5173/expenses",
        "http://localhost:5173/reports",
      ],
      // Performance testing configuration
      numberOfRuns: 3, // Run multiple times for statistical accuracy
      settings: {
        // Emulate Philippine mobile conditions
        throttling: {
          rttMs: 150, // Philippines average RTT
          throughputKbps: 1600, // 1.6 Mbps download
          cpuSlowdownMultiplier: 4, // Mid-range mobile device
          requestLatencyMs: 150,
          downloadThroughputKbps: 1600,
          uploadThroughputKbps: 750,
        },
        // Mobile-first testing (primary user device)
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false,
        },
        // Extended timeout for Philippine network conditions
        maxWaitForLoad: 45000, // 45 seconds
        // Skip some audits that aren't relevant for internal tools
        skipAudits: [
          "canonical", // Not needed for internal app
          "crawlable-anchors", // Not needed for SPA
          "uses-http2", // Vercel handles this
        ],
      },
    },
    // Performance budget assertions
    assert: {
      assertions: {
        // Core Web Vitals thresholds (strict for performance)
        "categories:performance": ["error", { minScore: 0.9 }], // 90+ performance score
        "categories:accessibility": ["error", { minScore: 0.95 }], // 95+ accessibility
        "categories:best-practices": ["error", { minScore: 0.9 }], // 90+ best practices
        "categories:seo": ["error", { minScore: 0.8 }], // 80+ SEO (internal app)

        // Core Web Vitals - Optimized for Philippine conditions
        "metrics:largest-contentful-paint": ["error", { maxNumericValue: 2500 }], // 2.5s LCP
        "metrics:first-contentful-paint": ["error", { maxNumericValue: 1800 }], // 1.8s FCP
        "metrics:cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }], // 0.1 CLS
        "metrics:interaction-to-next-paint": ["error", { maxNumericValue: 200 }], // 200ms INP
        "metrics:total-blocking-time": ["error", { maxNumericValue: 300 }], // 300ms TBT

        // Bundle size constraints
        "metrics:total-byte-weight": ["error", { maxNumericValue: 1500000 }], // 1.5MB total
        "audits:unused-javascript": ["error", { maxLength: 0 }], // No unused JS
        "audits:unminified-javascript": ["error", { maxLength: 0 }], // All JS minified
        "audits:unused-css-rules": ["warn", { maxLength: 5 }], // Minimal unused CSS

        // Progressive Web App requirements
        "audits:service-worker": "error", // Must have service worker
        "audits:installable-manifest": "error", // Must be installable
        "audits:splash-screen": "error", // Must have splash screen
        "audits:themed-omnibox": "error", // Must have theme color

        // Image optimization (critical for mobile users)
        "audits:modern-image-formats": "error", // Must use WebP/AVIF
        "audits:uses-optimized-images": "error", // Images must be optimized
        "audits:efficient-animated-content": "warn", // Warn on large animations

        // Accessibility (essential for inclusive design)
        "audits:color-contrast": "error", // Must meet WCAG contrast
        "audits:heading-order": "error", // Proper heading hierarchy
        "audits:label": "error", // All inputs must have labels
        "audits:link-name": "error", // All links must have names

        // Security headers (required for business app)
        "audits:is-on-https": "error", // Must use HTTPS
        "audits:csp-xss": "warn", // CSP protection recommended
      },
    },
    // Upload configuration for CI/CD
    upload: {
      target: "temporary-public-storage", // Use Lighthouse's temporary storage
      // For production, consider Lighthouse CI server or GitHub integration
    },
    // Server configuration for CI environments
    server: {
      port: 9001,
      storage: {
        storageMethod: "sql",
        sqlDialect: "sqlite",
        sqlDatabasePath: "./lhci.db",
      },
    },
  },
};
