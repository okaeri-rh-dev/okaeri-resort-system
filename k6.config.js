/**
 * K6 Load Testing Configuration
 * @since Phase 1.7 - Performance Testing
 *
 * Configuration for different load testing scenarios
 */

module.exports = {
  // Default options for all tests
  defaultOptions: {
    // Basic thresholds
    thresholds: {
      http_req_duration: ["p(95)<500", "p(99)<1000"],
      http_req_failed: ["rate<0.05"],
      errors: ["rate<0.01"],
    },

    // Default user agent
    userAgent: "Okaeri-Resort-LoadTest/1.0",

    // Batch settings for efficiency
    batch: 10,
    batchPerHost: 5,

    // HTTP settings
    httpDebug: "false",
    insecureSkipTLSVerify: false,

    // DNS settings
    dns: {
      ttl: "5m",
      select: "random",
    },
  },

  // Scenario configurations
  scenarios: {
    // Smoke test - minimal load
    smoke: {
      vus: 1,
      duration: "1m",
      thresholds: {
        http_req_duration: ["p(95)<200"],
        http_req_failed: ["rate<0.01"],
      },
    },

    // Load test - normal expected load
    load: {
      stages: [
        { duration: "2m", target: 50 }, // Ramp up
        { duration: "5m", target: 50 }, // Stay at 50 users
        { duration: "2m", target: 0 }, // Ramp down
      ],
      thresholds: {
        http_req_duration: ["p(95)<500", "p(99)<1000"],
        http_req_failed: ["rate<0.05"],
      },
    },

    // Stress test - beyond normal load
    stress: {
      stages: [
        { duration: "2m", target: 100 }, // Ramp to above normal
        { duration: "5m", target: 100 }, // Stay at 100 users
        { duration: "2m", target: 200 }, // Spike to 200
        { duration: "5m", target: 200 }, // Stay at 200
        { duration: "2m", target: 100 }, // Scale down
        { duration: "5m", target: 100 }, // Recover
        { duration: "2m", target: 0 }, // Ramp down
      ],
      thresholds: {
        http_req_duration: ["p(95)<1000", "p(99)<2000"],
        http_req_failed: ["rate<0.1"],
      },
    },

    // Spike test - sudden load increase
    spike: {
      stages: [
        { duration: "10s", target: 5 }, // Baseline
        { duration: "5s", target: 500 }, // Sudden spike
        { duration: "10s", target: 500 }, // Stay at spike
        { duration: "5s", target: 5 }, // Back to baseline
        { duration: "10s", target: 5 }, // Recover
        { duration: "5s", target: 0 }, // Ramp down
      ],
      thresholds: {
        http_req_duration: ["p(95)<2000", "p(99)<5000"],
        http_req_failed: ["rate<0.2"],
      },
    },

    // Soak test - extended duration
    soak: {
      stages: [
        { duration: "5m", target: 30 }, // Ramp up
        { duration: "1h", target: 30 }, // Stay for 1 hour
        { duration: "5m", target: 0 }, // Ramp down
      ],
      thresholds: {
        http_req_duration: ["p(95)<500", "p(99)<1000"],
        http_req_failed: ["rate<0.01"],
      },
    },

    // Breakpoint test - find the limit
    breakpoint: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 1000,
      stages: [
        { duration: "10m", target: 1000 }, // Ramp up to breaking point
      ],
      thresholds: {
        http_req_duration: ["p(95)<2000"],
        http_req_failed: ["rate<0.5"],
      },
    },

    // Philippine network conditions simulation
    philippines_3g: {
      stages: [
        { duration: "2m", target: 20 },
        { duration: "5m", target: 20 },
        { duration: "2m", target: 0 },
      ],
      thresholds: {
        http_req_duration: ["p(95)<3000", "p(99)<5000"],
        http_req_failed: ["rate<0.1"],
      },
      // Network conditions
      networkProfiles: {
        "3g": {
          download: "1.6Mbps",
          upload: "768Kbps",
          latency: "300ms",
        },
      },
    },

    // Business hours simulation
    business_hours: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1h", target: 10 }, // Morning ramp up (6-7 AM)
        { duration: "2h", target: 50 }, // Morning peak (7-9 AM)
        { duration: "3h", target: 30 }, // Mid-morning (9-12 PM)
        { duration: "1h", target: 60 }, // Lunch peak (12-1 PM)
        { duration: "4h", target: 40 }, // Afternoon (1-5 PM)
        { duration: "2h", target: 70 }, // Evening peak (5-7 PM)
        { duration: "3h", target: 20 }, // Evening (7-10 PM)
        { duration: "2h", target: 5 }, // Night (10 PM-12 AM)
      ],
      thresholds: {
        http_req_duration: ["p(95)<700", "p(99)<1500"],
        http_req_failed: ["rate<0.05"],
      },
    },
  },

  // Environment configurations
  environments: {
    local: {
      API_URL: "http://localhost:3000",
      WS_URL: "ws://localhost:3000",
    },
    staging: {
      API_URL: "https://staging.okaeri-resort.vercel.app",
      WS_URL: "wss://staging.okaeri-resort.vercel.app",
    },
    production: {
      API_URL: "https://okaeri-resort.vercel.app",
      WS_URL: "wss://okaeri-resort.vercel.app",
    },
  },

  // Output configurations
  outputs: {
    // InfluxDB for metrics storage
    influxdb: {
      addr: "http://localhost:8086",
      db: "k6_metrics",
      precision: "s",
    },

    // JSON output
    json: {
      filename: "test-results.json",
    },

    // CSV output
    csv: {
      filename: "test-results.csv",
      saveInterval: "1s",
    },

    // Cloud output (K6 Cloud)
    cloud: {
      projectID: process.env.K6_CLOUD_PROJECT_ID,
      name: "Okaeri Resort Load Test",
    },
  },

  // Custom metrics
  customMetrics: {
    bookingCreationTime: {
      type: "trend",
      description: "Time to create a booking",
    },
    authenticationTime: {
      type: "trend",
      description: "Time to authenticate",
    },
    dashboardLoadTime: {
      type: "trend",
      description: "Time to load dashboard",
    },
    concurrentBookings: {
      type: "gauge",
      description: "Number of concurrent bookings",
    },
    dataIsolationViolations: {
      type: "counter",
      description: "Number of multi-tenant isolation violations",
    },
  },

  // Test data generation
  testData: {
    users: {
      count: 100,
      prefix: "loadtest",
      domain: "okaeri.ph",
    },
    bookings: {
      count: 1000,
      dateRange: 90, // Days
      sources: ["direct", "airbnb", "booking", "agoda"],
    },
    expenses: {
      count: 500,
      categories: ["supplies", "utilities", "maintenance", "staff", "other"],
      amountRange: [100, 10000],
    },
  },

  // Reporting
  reporting: {
    // Slack webhook for notifications
    slack: {
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: "#performance-testing",
      mentions: "@devops",
      thresholdAlerts: true,
    },

    // Email notifications
    email: {
      to: ["dev@okaeri.ph", "ops@okaeri.ph"],
      from: "k6-tests@okaeri.ph",
      smtp: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
      },
    },

    // HTML report generation
    htmlReport: {
      enabled: true,
      filename: "load-test-report.html",
      includeGraphs: true,
      includeRawData: false,
    },
  },

  // Scripts to run
  scripts: {
    beforeTest: "npm run db:seed:test",
    afterTest: "npm run db:cleanup:test",
    onFailure: "npm run notify:test-failure",
  },
};
