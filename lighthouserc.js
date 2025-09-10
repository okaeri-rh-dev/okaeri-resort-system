/**
 * Lighthouse CI Configuration
 * @since Phase 1.7 - Performance Testing
 *
 * Automated performance testing configuration for CI/CD pipeline
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        "http://localhost:4173/",
        "http://localhost:4173/login",
        "http://localhost:4173/dashboard",
        "http://localhost:4173/bookings",
        "http://localhost:4173/expenses",
        "http://localhost:4173/properties",
        "http://localhost:4173/reports",
      ],

      // Number of runs per URL
      numberOfRuns: 3,

      // Server configuration
      startServerCommand: "npm run build && npm run preview",
      startServerReadyPattern: "Local:",
      startServerReadyTimeout: 30000,

      // Settings for mobile testing (Philippines network conditions)
      settings: {
        preset: "mobile",
        formFactor: "mobile",
        throttlingMethod: "devtools",
        throttling: {
          rttMs: 150, // Phase 5.3: Optimized for Singapore edge deployment
          throughputKbps: 1600, // 1.6 Mbps (improved with Singapore CDN)
          requestLatencyMs: 150, // Reduced latency via edge optimization
          downloadThroughputKbps: 1600,
          uploadThroughputKbps: 750,
          cpuSlowdownMultiplier: 4,
        },
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 732,
          deviceScaleFactor: 2.625,
          disabled: false,
        },
        emulatedUserAgent:
          "Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36",
      },
    },

    assert: {
      preset: "lighthouse:no-pwa",
      assertions: {
        // Category scores (0-1 scale, converted to 0-100 in reports)
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.9 }],

        // Core Web Vitals - Critical for user experience (Phase 5.3 optimized)
        "first-contentful-paint": ["error", { maxNumericValue: 1800 }], // Adjusted for Philippine networks
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "interaction-to-next-paint": ["error", { maxNumericValue: 200 }], // New Web Vitals metric
        "total-blocking-time": ["error", { maxNumericValue: 300 }],
        "speed-index": ["error", { maxNumericValue: 3000 }],
        interactive: ["error", { maxNumericValue: 3000 }],

        // Network payloads (Phase 5.3 optimized with multi-layer caching)
        "total-byte-weight": ["error", { maxNumericValue: 1500000 }], // 1.5MB (reduced via optimization)
        "mainthread-work-breakdown": ["warn", { maxNumericValue: 4000 }],
        "bootup-time": ["warn", { maxNumericValue: 3500 }],
        "uses-long-cache-ttl": "warn",

        // JavaScript performance
        "unused-javascript": ["warn", { maxNumericValue: 100000 }],
        "legacy-javascript": "warn",
        "duplicated-javascript": "warn",

        // CSS optimization
        "unused-css-rules": ["warn", { maxNumericValue: 50000 }],
        "unminified-css": "error",

        // Image optimization
        "uses-optimized-images": "warn",
        "uses-webp-images": "warn",
        "offscreen-images": "warn",
        "modern-image-formats": "warn",
        "unsized-images": "error",
        "preload-lcp-image": "warn",

        // Mobile optimization
        viewport: "error",
        "font-size": "error",
        "tap-targets": "error",
        "content-width": "error",

        // Security headers
        "csp-xss": "warn",
        "is-on-https": "error",
        "redirects-http": "error",

        // Accessibility
        "aria-allowed-attr": "error",
        "aria-required-attr": "error",
        "button-name": "error",
        "color-contrast": "warn",
        "document-title": "error",
        "html-lang-valid": "error",
        "image-alt": "error",
        label: "error",
        "link-name": "error",
        list: "error",
        listitem: "error",
        "meta-viewport": "error",

        // PWA checks (warnings since not all pages need PWA)
        "installable-manifest": "warn",
        "service-worker": "warn",
        "apple-touch-icon": "warn",
        "maskable-icon": "warn",
        "offline-start-url": "warn",

        // Third-party resources
        "no-vulnerable-libraries": "error",
        "js-libraries": "warn",

        // Resort-specific metrics
        "server-response-time": ["error", { maxNumericValue: 600 }],
        "render-blocking-resources": ["warn", { maxNumericValue: 2 }],
        "dom-size": ["warn", { maxNumericValue: 1500 }],
        "network-rtt": ["warn", { maxNumericValue: 300 }],
      },
    },

    upload: {
      target: "temporary-public-storage",
      uploadUrlMap: true,

      // GitHub status check
      githubAppToken: process.env.LHCI_GITHUB_APP_TOKEN,
      githubToken: process.env.GITHUB_TOKEN,
      githubStatusContextSuffix: "/lighthouse",

      // Optional: Upload to custom server
      serverBaseUrl: process.env.LHCI_SERVER_URL,
      token: process.env.LHCI_BUILD_TOKEN,
    },

    // Server configuration for LHCI Server (optional)
    server: {
      port: 9001,
      storage: {
        storageMethod: "sql",
        sqlDialect: "postgres",
        sqlConnectionUrl: process.env.LHCI_DATABASE_URL,
      },
    },
  },

  // Budget configurations for different pages
  budgets: [
    {
      path: "/*",
      resourceSizes: [
        { resourceType: "script", budget: 150000 }, // 150KB JS
        { resourceType: "stylesheet", budget: 50000 }, // 50KB CSS
        { resourceType: "image", budget: 200000 }, // 200KB images
        { resourceType: "font", budget: 100000 }, // 100KB fonts
        { resourceType: "media", budget: 0 }, // No video/audio
        { resourceType: "third-party", budget: 100000 }, // 100KB third-party
      ],
      resourceCounts: [
        { resourceType: "script", budget: 10 },
        { resourceType: "stylesheet", budget: 5 },
        { resourceType: "image", budget: 20 },
        { resourceType: "font", budget: 5 },
        { resourceType: "third-party", budget: 5 },
      ],
      timings: [
        { metric: "first-contentful-paint", budget: 1500 },
        { metric: "largest-contentful-paint", budget: 2500 },
        { metric: "cumulative-layout-shift", budget: 0.1 },
        { metric: "total-blocking-time", budget: 300 },
        { metric: "speed-index", budget: 3000 },
        { metric: "interactive", budget: 3000 },
      ],
    },

    // Specific budget for dashboard (heavier page)
    {
      path: "/dashboard",
      resourceSizes: [
        { resourceType: "script", budget: 200000 },
        { resourceType: "stylesheet", budget: 60000 },
        { resourceType: "total", budget: 2000000 },
      ],
      timings: [{ metric: "interactive", budget: 4000 }],
    },
  ],
};
