/**
 * Lighthouse CI Configuration
 * Automated performance testing for Okaeri Resort System
 */

export default {
  ci: {
    collect: {
      startServerCommand: "npm run preview",
      url: [
        "http://localhost:4173/",
        "http://localhost:4173/dashboard",
        "http://localhost:4173/bookings",
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        // Performance assertions
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "categories:pwa": ["warn", { minScore: 0.8 }],

        // Core Web Vitals
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "first-input-delay": ["error", { maxNumericValue: 100 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],

        // Additional performance metrics
        "first-contentful-paint": ["error", { maxNumericValue: 1500 }],
        "speed-index": ["error", { maxNumericValue: 3000 }],
        "total-blocking-time": ["error", { maxNumericValue: 300 }],

        // Resource optimization
        "unused-javascript": ["warn", { maxNumericValue: 50000 }],
        "unused-css-rules": ["warn", { maxNumericValue: 30000 }],
        "modern-image-formats": "warn",
        "efficient-animated-content": "warn",
        "offscreen-images": "warn",

        // PWA requirements
        "installable-manifest": "error",
        "service-worker": "error",
        "offline-start-url": "error",

        // Mobile optimization
        viewport: "error",
        "content-width": "error",
        "tap-targets": "error",

        // Network optimization
        "render-blocking-resources": ["warn", { maxNumericValue: 500 }],
        "uses-text-compression": "error",
        "uses-optimized-images": "warn",

        // Bundle size budget
        "total-byte-weight": ["error", { maxNumericValue: 1600000 }], // 1.6MB total
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },

  // Custom Lighthouse configuration
  extends: "lighthouse:default",
  settings: {
    // Simulate mobile device
    formFactor: "mobile",
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
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
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36",
  },

  // Custom audits for resort system
  audits: [
    // Add custom audit for offline functionality
    "service-worker",
    "offline-start-url",

    // Add custom audit for image optimization
    "modern-image-formats",
    "efficient-animated-content",

    // Add custom audit for mobile experience
    "viewport",
    "content-width",
    "tap-targets",
  ],

  // Categories configuration
  categories: {
    performance: {
      title: "Performance",
      description: "Metrics for resort system performance on mobile devices",
      auditRefs: [
        { id: "first-contentful-paint", weight: 10 },
        { id: "largest-contentful-paint", weight: 25 },
        { id: "first-input-delay", weight: 10 },
        { id: "cumulative-layout-shift", weight: 25 },
        { id: "speed-index", weight: 10 },
        { id: "total-blocking-time", weight: 30 },
      ],
    },

    "resort-mobile": {
      title: "Resort Mobile Experience",
      description: "Mobile optimization for resort staff workflows",
      auditRefs: [
        { id: "viewport", weight: 20 },
        { id: "content-width", weight: 15 },
        { id: "tap-targets", weight: 25 },
        { id: "font-size", weight: 10 },
        { id: "installable-manifest", weight: 30 },
      ],
    },

    "resort-offline": {
      title: "Offline Functionality",
      description: "Critical offline features for resort operations",
      auditRefs: [
        { id: "service-worker", weight: 40 },
        { id: "offline-start-url", weight: 30 },
        { id: "apple-touch-icon", weight: 15 },
        { id: "maskable-icon", weight: 15 },
      ],
    },
  },
};
