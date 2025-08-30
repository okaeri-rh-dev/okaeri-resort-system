# PWA Testing Guide

This guide provides comprehensive procedures for testing Progressive Web App
(PWA) functionality locally. PWA capabilities are essential for the Okaeri
Resort Management System to provide native app-like experiences and reliable
offline functionality in resort locations with poor connectivity.

## Table of Contents

- [Overview](#overview)
- [PWA Requirements](#pwa-requirements)
- [Local Setup](#local-setup)
- [Service Worker Testing](#service-worker-testing)
- [Offline Functionality Testing](#offline-functionality-testing)
- [App Installation Testing](#app-installation-testing)
- [Background Sync Testing](#background-sync-testing)
- [Push Notifications Testing](#push-notifications-testing)
- [Cache Strategy Testing](#cache-strategy-testing)
- [Update Flow Testing](#update-flow-testing)
- [Resort-Specific PWA Features](#resort-specific-pwa-features)
- [Performance in PWA Context](#performance-in-pwa-context)
- [Troubleshooting](#troubleshooting)

## Overview

The Okaeri Resort System PWA must provide reliable functionality in challenging
network conditions. Our PWA testing ensures:

- Reliable service worker functionality
- Effective offline-first caching strategies
- Smooth installation experience
- Background synchronization for critical operations
- Push notification support for business alerts
- Automatic updates without user disruption
- Native app-like performance and feel

## PWA Requirements

### Core PWA Criteria

- **Web App Manifest**: Valid manifest.json with all required fields
- **Service Worker**: Functional service worker with caching strategies
- **HTTPS**: Secure connection (localhost OK for testing)
- **Responsive Design**: Works on all screen sizes
- **Offline Functionality**: Critical features work offline

### Lighthouse PWA Audits

- `installable-manifest`: Must have valid web app manifest
- `service-worker`: Must register a service worker
- `works-offline`: Must work offline
- `apple-touch-icon`: iOS installation support
- `maskable-icon`: Android adaptive icons
- `offline-start-url`: Start URL accessible offline

### Resort-Specific Requirements

- **Expense Logging**: Works offline with background sync
- **Booking Views**: Cached for offline viewing
- **Dashboard Metrics**: Background refresh with offline fallback
- **File Uploads**: Queue uploads when offline, sync when online
- **Multi-Property**: Offline access to current property data

## Local Setup

### Prerequisites

```bash
# Install PWA testing tools
npm install -g pwa-asset-generator
npm install -g workbox-cli

# Install browser tools (Chrome recommended for PWA testing)
# Chrome DevTools Application tab provides PWA debugging tools

# Project setup
npm ci
npm run build  # PWA only works with production build
```

### Development vs Production Testing

```bash
# Development (limited PWA features)
npm run dev
# Note: Service Worker disabled in development

# Production-like testing (full PWA features)
npm run build
npm run preview
# Service Worker active, full PWA functionality
```

### Environment Configuration

```bash
# Create PWA testing environment
cp .env.example .env.pwa
echo "NODE_ENV=production" >> .env.pwa
echo "VITE_PWA_TESTING=true" >> .env.pwa
```

## Service Worker Testing

### 1. Service Worker Registration

```javascript
// Test service worker registration
// scripts/test-sw-registration.js
const puppeteer = require("puppeteer");

async function testServiceWorkerRegistration() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173");

  // Wait for service worker registration
  const swRegistered = await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        return {
          registered: true,
          scope: registration.scope,
          active: !!registration.active,
          installing: !!registration.installing,
          waiting: !!registration.waiting,
        };
      } catch (error) {
        return { registered: false, error: error.message };
      }
    }
    return { registered: false, error: "Service Worker not supported" };
  });

  console.log("Service Worker Status:", swRegistered);
  await browser.close();
}

testServiceWorkerRegistration();
```

### 2. Cache Strategy Verification

```javascript
// Test cache strategies
// scripts/test-cache-strategies.js
const puppeteer = require("puppeteer");

async function testCacheStrategies() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Enable offline mode
  await page.setOfflineMode(true);

  try {
    await page.goto("http://localhost:4173", { waitUntil: "networkidle2" });
    console.log("✓ App loads offline - cache strategy working");
  } catch (error) {
    console.log("✗ App fails to load offline:", error.message);
  }

  await page.setOfflineMode(false);
  await browser.close();
}

testCacheStrategies();
```

### 3. Service Worker DevTools Testing

```bash
# Manual testing steps:
# 1. Open http://localhost:4173 in Chrome
# 2. Open DevTools (F12)
# 3. Go to Application tab
# 4. Check Service Workers section:
#    - Status should be "Activated and is running"
#    - Update on reload should work
#    - Stop/Start functionality
# 5. Check Cache Storage:
#    - api-cache (for API responses)
#    - route-cache (for page routes)
#    - static-assets (for JS/CSS/images)
```

### 4. Service Worker Update Testing

```javascript
// Test service worker updates
// scripts/test-sw-update.js
const puppeteer = require("puppeteer");

async function testServiceWorkerUpdate() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173");

  // Listen for service worker update events
  await page.evaluateOnNewDocument(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("Service Worker updated");
        window.SW_UPDATED = true;
      });
    }
  });

  // Simulate update (would normally happen when new version deployed)
  await page.evaluate(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update();
        }
      });
    }
  });

  await browser.close();
}
```

## Offline Functionality Testing

### 1. Offline Mode Simulation

```javascript
// Comprehensive offline testing
// scripts/test-offline-functionality.js
const puppeteer = require("puppeteer");

async function testOfflineFunctionality() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // First, load the app online to populate cache
  await page.goto("http://localhost:4173");
  await page.goto("http://localhost:4173/dashboard");
  await page.goto("http://localhost:4173/bookings");

  console.log("✓ Initial pages loaded and cached");

  // Now test offline functionality
  await page.setOfflineMode(true);

  const offlineTests = [
    { url: "http://localhost:4173", description: "Homepage offline" },
    {
      url: "http://localhost:4173/dashboard",
      description: "Dashboard offline",
    },
    { url: "http://localhost:4173/bookings", description: "Bookings offline" },
    { url: "http://localhost:4173/expenses", description: "Expenses offline" },
  ];

  for (const test of offlineTests) {
    try {
      await page.goto(test.url, { waitUntil: "networkidle2" });
      console.log(`✓ ${test.description}`);
    } catch (error) {
      console.log(`✗ ${test.description} failed:`, error.message);
    }
  }

  await browser.close();
}

testOfflineFunctionality();
```

### 2. Data Persistence Testing

```javascript
// Test offline data persistence
async function testOfflineDataPersistence() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173/expenses");

  // Add data while online
  await page.fill('[data-testid="expense-amount"]', "50.00");
  await page.fill('[data-testid="expense-description"]', "Test expense");
  await page.click('[data-testid="save-expense"]');

  // Go offline
  await page.setOfflineMode(true);

  // Check if data persists offline
  await page.reload();

  const expenseExists = await page.isVisible("text=Test expense");
  console.log("Expense data persists offline:", expenseExists ? "✓" : "✗");

  await browser.close();
}
```

### 3. Offline Indicator Testing

```javascript
// Test offline indicator UI
async function testOfflineIndicator() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173");

  // Check online state
  let onlineStatus = await page.evaluate(() => navigator.onLine);
  console.log("Initial online status:", onlineStatus);

  // Go offline and check indicator
  await page.setOfflineMode(true);

  // Trigger offline event
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });

  // Check if offline indicator appears
  const offlineIndicator = await page.isVisible(
    '[data-testid="offline-indicator"]'
  );
  console.log("Offline indicator visible:", offlineIndicator ? "✓" : "✗");

  await browser.close();
}
```

## App Installation Testing

### 1. Web App Manifest Validation

```bash
# Validate web app manifest
npm run pwa:validate

# Or manually check manifest
curl http://localhost:4173/manifest.json | jq .
```

Expected manifest structure:

```json
{
  "name": "Okaeri Resort System",
  "short_name": "Okaeri Resort",
  "description": "Comprehensive resort management system",
  "theme_color": "#0EA5E9",
  "background_color": "#0F172A",
  "display": "standalone",
  "orientation": "portrait-primary",
  "start_url": "/dashboard",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ]
}
```

### 2. Installation Prompt Testing

```javascript
// Test installation prompt
// scripts/test-installation.js
const puppeteer = require("puppeteer");

async function testInstallationPrompt() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Listen for beforeinstallprompt event
  await page.evaluateOnNewDocument(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("Installation prompt available");
      window.installPromptEvent = e;
    });
  });

  await page.goto("http://localhost:4173");

  // Wait for potential install prompt
  await page.waitForTimeout(3000);

  const promptAvailable = await page.evaluate(() => {
    return !!window.installPromptEvent;
  });

  console.log("Install prompt available:", promptAvailable ? "✓" : "✗");

  if (promptAvailable) {
    // Test installation
    const canInstall = await page.evaluate(async () => {
      try {
        await window.installPromptEvent.prompt();
        const choiceResult = await window.installPromptEvent.userChoice;
        return choiceResult.outcome === "accepted";
      } catch (error) {
        return false;
      }
    });

    console.log("Installation successful:", canInstall ? "✓" : "✗");
  }

  await browser.close();
}

testInstallationPrompt();
```

### 3. iOS Installation Testing

```bash
# Manual testing on iOS Safari:
# 1. Open http://localhost:4173 in Safari
# 2. Tap Share button
# 3. Look for "Add to Home Screen" option
# 4. Verify icon appears correctly on home screen
# 5. Tap icon to launch in standalone mode
# 6. Verify splash screen shows correctly
# 7. Verify app runs without Safari UI
```

### 4. Android Installation Testing

```bash
# Manual testing on Android Chrome:
# 1. Open http://localhost:4173 in Chrome
# 2. Look for "Add to Home Screen" banner/prompt
# 3. Tap "Add" or use menu → "Add to Home Screen"
# 4. Verify icon appears on home screen
# 5. Launch app from home screen
# 6. Verify standalone mode (no browser UI)
# 7. Test adaptive icon (if supported)
```

## Background Sync Testing

### 1. Background Sync Registration

```javascript
// Test background sync registration
// scripts/test-background-sync.js
const puppeteer = require("puppeteer");

async function testBackgroundSync() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173/expenses");

  // Test sync registration
  const syncRegistered = await page.evaluate(async () => {
    if (
      "serviceWorker" in navigator &&
      "sync" in window.ServiceWorkerRegistration.prototype
    ) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register("expense-sync");
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "Background sync not supported" };
  });

  console.log("Background sync registration:", syncRegistered);

  await browser.close();
}

testBackgroundSync();
```

### 2. Offline Data Queue Testing

```javascript
// Test offline data queuing and sync
async function testOfflineDataQueue() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173/expenses");

  // Create data while offline
  await page.setOfflineMode(true);

  await page.fill('[data-testid="expense-amount"]', "75.00");
  await page.fill('[data-testid="expense-description"]', "Offline expense");
  await page.click('[data-testid="save-expense"]');

  // Check if queued
  const queuedData = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem("expense-queue") || "[]");
  });

  console.log("Data queued offline:", queuedData.length > 0 ? "✓" : "✗");

  // Go back online and test sync
  await page.setOfflineMode(false);

  // Trigger sync (in real app, this happens automatically)
  await page.evaluate(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register("expense-sync");
      });
    }
  });

  await page.waitForTimeout(5000); // Wait for sync to complete

  // Check if queue cleared
  const queueAfterSync = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem("expense-queue") || "[]");
  });

  console.log(
    "Queue cleared after sync:",
    queueAfterSync.length === 0 ? "✓" : "✗"
  );

  await browser.close();
}
```

### 3. Sync Event Handling

```javascript
// Service worker sync event testing
// This would be in your service worker (sw-custom.ts)
self.addEventListener("sync", (event) => {
  if (event.tag === "expense-sync") {
    event.waitUntil(syncExpenses());
  } else if (event.tag === "booking-sync") {
    event.waitUntil(syncBookings());
  }
});

async function syncExpenses() {
  const expenses = await getQueuedExpenses();
  for (const expense of expenses) {
    try {
      await fetch("/api/expenses", {
        method: "POST",
        body: JSON.stringify(expense),
        headers: { "Content-Type": "application/json" },
      });
      await removeFromQueue(expense.id);
    } catch (error) {
      console.log("Sync failed for expense:", expense.id);
    }
  }
}
```

## Push Notifications Testing

### 1. Push Notification Setup

```javascript
// Test push notification setup
// scripts/test-push-notifications.js
const puppeteer = require("puppeteer");

async function testPushNotifications() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Grant notification permissions
  const context = browser.defaultBrowserContext();
  await context.overridePermissions("http://localhost:4173", ["notifications"]);

  await page.goto("http://localhost:4173");

  // Test notification permission and subscription
  const pushSetup = await page.evaluate(async () => {
    if ("Notification" in window && "serviceWorker" in navigator) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: "YOUR_VAPID_PUBLIC_KEY", // Would be actual key
          });

          return {
            success: true,
            permission,
            hasSubscription: !!subscription,
          };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "Push notifications not supported" };
  });

  console.log("Push notification setup:", pushSetup);

  await browser.close();
}

testPushNotifications();
```

### 2. Notification Display Testing

```javascript
// Test notification display
async function testNotificationDisplay() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const context = browser.defaultBrowserContext();
  await context.overridePermissions("http://localhost:4173", ["notifications"]);

  await page.goto("http://localhost:4173");

  // Test showing notification
  await page.evaluate(() => {
    new Notification("Test Resort Notification", {
      body: "New booking received for Ocean View Room",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge.png",
      tag: "booking-notification",
      data: { bookingId: "123", type: "new-booking" },
    });
  });

  console.log("✓ Test notification displayed");

  await browser.close();
}
```

### 3. Push Event Handling

```javascript
// Service worker push event handling
// This would be in your service worker (sw-custom.ts)
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge.png",
    data: data,
    actions: [
      { action: "view", title: "View Details" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Okaeri Resort", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "view") {
    event.waitUntil(clients.openWindow("/dashboard"));
  }
});
```

## Cache Strategy Testing

### 1. Network-First Strategy Testing

```javascript
// Test network-first strategy for API calls
async function testNetworkFirstStrategy() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173/dashboard");

  // First request (should hit network)
  const firstResponse = await page.evaluate(() => {
    return fetch("/api/dashboard/metrics").then((r) =>
      r.headers.get("x-cache")
    );
  });

  console.log("First API call cache status:", firstResponse || "MISS");

  // Second request (should hit cache if network fails)
  await page.setOfflineMode(true);

  try {
    const secondResponse = await page.evaluate(() => {
      return fetch("/api/dashboard/metrics")
        .then((r) => r.json())
        .then(() => "SUCCESS - from cache")
        .catch(() => "FAILED - cache miss");
    });

    console.log("Offline API call result:", secondResponse);
  } catch (error) {
    console.log("Offline API call failed:", error.message);
  }

  await browser.close();
}
```

### 2. Cache-First Strategy Testing

```javascript
// Test cache-first strategy for static assets
async function testCacheFirstStrategy() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Load page to cache assets
  await page.goto("http://localhost:4173");

  // Check if assets are cached
  const cachedAssets = await page.evaluate(async () => {
    const cache = await caches.open("static-assets");
    const cachedRequests = await cache.keys();
    return cachedRequests.map((req) => req.url);
  });

  console.log("Cached static assets:", cachedAssets.length);

  // Test offline access to cached assets
  await page.setOfflineMode(true);
  await page.reload();

  const assetsLoadedOffline = await page.evaluate(() => {
    const scripts = document.querySelectorAll("script[src]");
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    return scripts.length > 0 && stylesheets.length > 0;
  });

  console.log("Assets load offline:", assetsLoadedOffline ? "✓" : "✗");

  await browser.close();
}
```

### 3. Stale-While-Revalidate Testing

```javascript
// Test stale-while-revalidate strategy
async function testStaleWhileRevalidate() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // First visit to cache the page
  console.log("First visit - caching page");
  await page.goto("http://localhost:4173/bookings");

  // Second visit - should serve from cache while updating
  console.log("Second visit - should serve stale and revalidate");
  const startTime = Date.now();
  await page.goto("http://localhost:4173/bookings");
  const loadTime = Date.now() - startTime;

  console.log(`Page load time: ${loadTime}ms (should be fast from cache)`);

  // Check if revalidation happened in background
  await page.waitForTimeout(2000); // Wait for background revalidation

  await browser.close();
}
```

## Update Flow Testing

### 1. Service Worker Update Detection

```javascript
// Test service worker update detection
async function testServiceWorkerUpdate() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Listen for update events
  await page.evaluateOnNewDocument(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.SW_UPDATED = true;
      });

      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener("updatefound", () => {
          window.SW_UPDATE_FOUND = true;
        });
      });
    }
  });

  await page.goto("http://localhost:4173");

  // Simulate update by forcing registration update
  await page.evaluate(() => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.update();
      }
    });
  });

  await page.waitForTimeout(3000);

  const updateFound = await page.evaluate(() => window.SW_UPDATE_FOUND);
  console.log("Service worker update detected:", updateFound ? "✓" : "✗");

  await browser.close();
}
```

### 2. App Update Notification Testing

```javascript
// Test app update notification
async function testAppUpdateNotification() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173");

  // Simulate service worker waiting state (new version available)
  await page.evaluate(() => {
    // This would normally be triggered by actual SW update
    window.dispatchEvent(new CustomEvent("sw-update-available"));
  });

  // Check if update notification appears
  const updateBanner = await page.isVisible('[data-testid="update-banner"]');
  console.log("Update banner displayed:", updateBanner ? "✓" : "✗");

  if (updateBanner) {
    // Test update acceptance
    await page.click('[data-testid="update-accept"]');

    // Check if page reloads or shows loading state
    await page.waitForTimeout(1000);
    console.log("✓ Update flow completed");
  }

  await browser.close();
}
```

## Resort-Specific PWA Features

### 1. Expense Photo Upload Offline

```javascript
// Test offline photo upload queuing
async function testOfflinePhotoUpload() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173/expenses");

  // Simulate going offline
  await page.setOfflineMode(true);

  // Test file upload
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile("path/to/test/receipt.jpg");
    await page.click('[data-testid="upload-receipt"]');

    // Check if upload is queued
    const queuedUploads = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("upload-queue") || "[]");
    });

    console.log(
      "Photo upload queued offline:",
      queuedUploads.length > 0 ? "✓" : "✗"
    );
  }

  await browser.close();
}
```

### 2. Multi-Property Offline Support

```javascript
// Test multi-property offline functionality
async function testMultiPropertyOffline() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173/dashboard");

  // Switch between properties while online (to cache data)
  await page.click('[data-testid="property-switcher"]');
  await page.click('[data-testid="property-ocean-view"]');
  await page.waitForTimeout(2000);

  await page.click('[data-testid="property-switcher"]');
  await page.click('[data-testid="property-mountain-view"]');
  await page.waitForTimeout(2000);

  // Go offline and test property switching
  await page.setOfflineMode(true);

  await page.click('[data-testid="property-switcher"]');
  const propertiesVisible = await page.isVisible(
    '[data-testid="property-ocean-view"]'
  );

  console.log(
    "Property switching works offline:",
    propertiesVisible ? "✓" : "✗"
  );

  if (propertiesVisible) {
    await page.click('[data-testid="property-ocean-view"]');

    // Check if property data loads from cache
    const dashboardLoaded = await page.isVisible(
      '[data-testid="dashboard-metrics"]'
    );
    console.log("Cached property data loads:", dashboardLoaded ? "✓" : "✗");
  }

  await browser.close();
}
```

### 3. Booking Calendar Offline

```javascript
// Test booking calendar offline functionality
async function testBookingCalendarOffline() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:4173/bookings");

  // Cache current month data
  await page.waitForSelector('[data-testid="booking-calendar"]');

  // Go offline
  await page.setOfflineMode(true);

  // Test calendar navigation
  await page.click('[data-testid="next-month"]');
  const nextMonthLoaded = await page.isVisible(
    '[data-testid="booking-calendar"]'
  );

  console.log(
    "Calendar navigation works offline:",
    nextMonthLoaded ? "✓" : "✗"
  );

  // Test booking details view
  const bookingExists = await page.isVisible('[data-testid="booking-item"]');
  if (bookingExists) {
    await page.click('[data-testid="booking-item"]');
    const detailsLoaded = await page.isVisible(
      '[data-testid="booking-details"]'
    );
    console.log("Booking details load offline:", detailsLoaded ? "✓" : "✗");
  }

  await browser.close();
}
```

## Performance in PWA Context

### 1. Installation Performance

```bash
# Test PWA installation performance
lighthouse http://localhost:4173 \
  --only-categories=pwa \
  --chrome-flags="--enable-features=VirtualTime" \
  --output=json \
  --output-path=./lighthouse-pwa-performance.json
```

### 2. Service Worker Performance Impact

```javascript
// Measure service worker performance impact
async function measureServiceWorkerImpact() {
  const browser = await puppeteer.launch();

  // Test without service worker (first visit to uncached site)
  const pageNoSW = await browser.newPage();
  await pageNoSW.goto("http://localhost:4173", { waitUntil: "networkidle2" });

  const performanceNoSW = await pageNoSW.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded:
        navigation.domContentLoadedEventEnd -
        navigation.domContentLoadedEventStart,
    };
  });

  // Test with service worker (cached resources)
  const pageWithSW = await browser.newPage();
  await pageWithSW.goto("http://localhost:4173", { waitUntil: "networkidle2" });

  const performanceWithSW = await pageWithSW.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded:
        navigation.domContentLoadedEventEnd -
        navigation.domContentLoadedEventStart,
    };
  });

  console.log("Performance without SW:", performanceNoSW);
  console.log("Performance with SW:", performanceWithSW);
  console.log("Improvement:", {
    loadTime: performanceNoSW.loadTime - performanceWithSW.loadTime,
    domContentLoaded:
      performanceNoSW.domContentLoaded - performanceWithSW.domContentLoaded,
  });

  await browser.close();
}
```

## Troubleshooting

### Common PWA Issues

#### 1. Service Worker Not Registering

```javascript
// Debug service worker registration issues
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      console.log("SW registered:", registration.scope);
    })
    .catch((error) => {
      console.error("SW registration failed:", error);

      // Common issues:
      // - HTTPS required (except localhost)
      // - SW file not found
      // - SW file has syntax errors
      // - Browser cache issues
    });
}
```

#### 2. Cache Not Working

```bash
# Check cache in DevTools:
# 1. Open Chrome DevTools
# 2. Go to Application tab
# 3. Check Cache Storage section
# 4. Verify caches exist: api-cache, route-cache, static-assets

# Manual cache debugging
node scripts/debug-cache-strategies.js
```

#### 3. Offline Mode Issues

```javascript
// Debug offline detection
window.addEventListener("online", () => {
  console.log("App is online");
});

window.addEventListener("offline", () => {
  console.log("App is offline");
});

console.log("Current online status:", navigator.onLine);
```

#### 4. Installation Issues

```bash
# Check manifest validation
lighthouse http://localhost:4173 \
  --only-audits="installable-manifest,apple-touch-icon,maskable-icon" \
  --output=html \
  --output-path=./lighthouse-install-debug.html

# Common manifest issues:
# - Missing required fields
# - Invalid icon sizes/formats
# - Incorrect MIME types
# - Missing start_url or scope
```

### Expected Test Outputs

#### Successful PWA Tests

```
✓ Service Worker registered successfully
✓ All cache strategies working
✓ App loads offline
✓ Installation prompt available
✓ Background sync functional
✓ Push notifications setup
✓ Update flow working

PWA Lighthouse Score: 95/100
- Installable manifest: ✓
- Service worker: ✓
- Works offline: ✓
- Apple touch icon: ✓
- Maskable icon: ✓
```

#### Failed PWA Tests

```
✗ Service Worker registration failed
✗ App fails to load offline
✗ Installation prompt not available
✗ Cache strategies not working
✗ Background sync not supported

PWA Lighthouse Score: 45/100
- Installable manifest: ✗ (missing required fields)
- Service worker: ✗ (registration failed)
- Works offline: ✗ (no offline fallback)
```

This comprehensive PWA testing guide ensures the Okaeri Resort Management System
delivers a reliable, native app-like experience for resort staff working in
challenging network conditions.
