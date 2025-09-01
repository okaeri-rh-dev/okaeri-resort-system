# Accessibility Testing Guide (Gate 6)

This guide provides comprehensive procedures for reproducing accessibility tests
locally that match CI requirements. Accessibility is critical for the Okaeri
Resort Management System to ensure inclusive user experience across all user
abilities and assistive technologies.

## Table of Contents

- [Overview](#overview)
- [Accessibility Targets](#accessibility-targets)
- [Local Setup](#local-setup)
- [Lighthouse Accessibility Testing](#lighthouse-accessibility-testing)
- [Axe-core Integration Testing](#axe-core-integration-testing)
- [Manual Testing Procedures](#manual-testing-procedures)
- [Screen Reader Testing](#screen-reader-testing)
- [Keyboard Navigation Testing](#keyboard-navigation-testing)
- [Touch Target Validation](#touch-target-validation)
- [Color Contrast Testing](#color-contrast-testing)
- [Resort-Specific Accessibility](#resort-specific-accessibility)
- [CI Parity](#ci-parity)
- [Troubleshooting](#troubleshooting)

## Overview

The Okaeri Resort System must be accessible to all users, including those using
assistive technologies. Our accessibility testing ensures:

- WCAG 2.1 AA compliance across all pages
- Proper screen reader compatibility
- Full keyboard navigation support
- Adequate touch targets for mobile users
- Sufficient color contrast ratios
- Proper semantic markup and ARIA attributes

## Accessibility Targets

Based on CI configuration and WCAG 2.1 AA standards:

### Lighthouse Scores

- **Accessibility Score**: ≥95% (Note: CI currently has 90%, needs update)
- **SEO Score**: ≥90%
- **Best Practices**: ≥95%

### WCAG 2.1 AA Requirements

- **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Touch Targets**: Minimum 48x48px (44x44px with adequate spacing)
- **Focus Indicators**: Visible and clear focus states
- **Screen Reader**: All content accessible via screen reader
- **Keyboard Navigation**: All interactive elements keyboard accessible

### Specific Audits (Must Pass)

- `aria-allowed-attr`: error
- `aria-required-attr`: error
- `button-name`: error
- `color-contrast`: warn (should be error for AA compliance)
- `document-title`: error
- `html-lang-valid`: error
- `image-alt`: error
- `label`: error
- `link-name`: error
- `list`: error
- `listitem`: error
- `meta-viewport`: error

## Local Setup

### Prerequisites

```bash
# Install accessibility testing tools
npm install -g @axe-core/cli
npm install -g lighthouse
npm install -g pa11y

# Install browser extensions (Chrome)
# - axe DevTools: https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnindnejefpokejbdd
# - WAVE: https://chrome.google.com/webstore/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh
# - Colour Contrast Analyser: https://chrome.google.com/webstore/detail/colour-contrast-analyser/dagdlcijhfbmgkjokkjicnnfimlebcll

# Install project dependencies (includes @axe-core/react)
npm ci
```

### Environment Configuration

```bash
# Create accessibility testing environment
cp .env.example .env.a11y
echo "NODE_ENV=development" >> .env.a11y
echo "VITE_A11Y_TESTING=true" >> .env.a11y
```

## Lighthouse Accessibility Testing

### 1. Basic Accessibility Audit

```bash
# Build and start the application
npm run build
npm run preview &
sleep 5

# Run accessibility-only audit
lighthouse http://localhost:4173 \
  --only-categories=accessibility \
  --output=html \
  --output-path=./lighthouse-a11y.html \
  --chrome-flags="--no-sandbox"
```

### 2. Full Accessibility Suite

```bash
# Run all accessibility-related audits
lighthouse http://localhost:4173 \
  --only-categories=accessibility,seo,best-practices \
  --output=json \
  --output-path=./reports/lighthouse-full-a11y.json
```

### 3. Mobile Accessibility Testing

```bash
# Test accessibility on mobile viewport
lighthouse http://localhost:4173 \
  --preset=mobile \
  --only-categories=accessibility \
  --output=html \
  --output-path=./lighthouse-mobile-a11y.html
```

### 4. Multi-Page Accessibility Testing

```bash
# Test all critical routes for accessibility
ROUTES=("/" "/login" "/dashboard" "/bookings" "/expenses" "/properties")

for route in "${ROUTES[@]}"; do
  echo "Testing accessibility for route: $route"
  lighthouse "http://localhost:4173$route" \
    --only-categories=accessibility \
    --output=json \
    --output-path="./reports/lighthouse-a11y$route.json" \
    --quiet
done
```

### 5. Using npm Scripts

```bash
# Use predefined accessibility scripts
npm run verify:accessibility  # Full accessibility verification
```

## Axe-core Integration Testing

### 1. Runtime axe-core Testing

The project includes `@axe-core/react` for runtime accessibility testing:

```javascript
// src/components/accessibility/AxeAuditor.tsx (development only)
import React from "react";

if (process.env.NODE_ENV === "development") {
  import("@axe-core/react").then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}
```

### 2. Command Line axe Testing

```bash
# Start development server with axe integration
npm run dev &
sleep 10

# Run axe-core CLI tests
axe http://localhost:3000 --exit

# Test specific routes
axe http://localhost:3000/dashboard --exit
axe http://localhost:3000/bookings --exit
axe http://localhost:3000/expenses --exit
```

### 3. Programmatic axe Testing

```javascript
// scripts/test-accessibility.js
const { AxePuppeteer } = require("@axe-core/puppeteer");
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:3000");

  const results = await new AxePuppeteer(page).analyze();

  console.log("Violations:", results.violations.length);
  results.violations.forEach((violation) => {
    console.log(`- ${violation.id}: ${violation.description}`);
    violation.nodes.forEach((node) => {
      console.log(`  Target: ${node.target}`);
    });
  });

  await browser.close();
})();
```

### 4. Integration with Jest Testing

```javascript
// src/components/__tests__/accessibility.test.tsx
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { LoginForm } from "../auth/LoginForm";

expect.extend(toHaveNoViolations);

describe("Accessibility Tests", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Manual Testing Procedures

### 1. Tab Navigation Test

```bash
# Manual test procedure:
# 1. Open http://localhost:3000
# 2. Press Tab key repeatedly
# 3. Verify all interactive elements receive focus
# 4. Verify focus indicators are visible
# 5. Verify logical tab order
# 6. Test Shift+Tab for reverse navigation
```

**Expected Tab Order for Login Page:**

1. Email input field
2. Password input field
3. "Show password" toggle
4. "Remember me" checkbox
5. "Sign in" button
6. "Forgot password?" link
7. "Create account" link

### 2. Keyboard Interaction Test

```bash
# Test keyboard interactions:
# - Enter/Space on buttons and links
# - Arrow keys in dropdown menus
# - Escape key to close modals/dropdowns
# - Home/End keys in text inputs
# - Page Up/Down in scrollable areas
```

### 3. Focus Management Test

```javascript
// Test focus management in React components
// Check that focus is properly managed on:
// - Modal open/close
// - Page navigation
# - Form submission
// - Error states
// - Loading states
```

## Screen Reader Testing

### 1. VoiceOver Testing (macOS)

```bash
# Enable VoiceOver
sudo spctl --add --label "VoiceOver" --allow /System/Library/CoreServices/VoiceOver.app

# Test procedure:
# 1. Start VoiceOver (Cmd + F5)
# 2. Navigate to http://localhost:3000
# 3. Use VoiceOver commands:
#    - VO + Right Arrow: Next element
#    - VO + Left Arrow: Previous element
#    - VO + Space: Activate element
#    - VO + H: Next heading
#    - VO + F: Next form control
#    - VO + L: Next link
#    - VO + R: Continuous reading
```

### 2. NVDA Testing (Windows)

```bash
# Download NVDA: https://www.nvaccess.org/download/
# Test procedure:
# 1. Start NVDA
# 2. Navigate to http://localhost:3000
# 3. Use NVDA commands:
#    - Tab: Next focusable element
#    - H: Next heading
#    - B: Next button
#    - E: Next edit field
#    - L: Next link
#    - K: Next link
#    - Insert + Down: Say all
```

### 3. Screen Reader Test Checklist

For each page, verify:

- [ ] Page title is announced
- [ ] All headings are properly announced with levels
- [ ] Form labels are associated with inputs
- [ ] Button purposes are clear
- [ ] Link destinations are meaningful
- [ ] Images have appropriate alt text
- [ ] Tables have proper headers
- [ ] Error messages are announced
- [ ] Loading states are communicated
- [ ] Success messages are announced

## Keyboard Navigation Testing

### 1. Full Keyboard Navigation Test

```javascript
// Automated keyboard navigation test
// scripts/test-keyboard-navigation.js
const puppeteer = require("puppeteer");

async function testKeyboardNavigation() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:3000");

  // Get all focusable elements
  const focusableElements = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(elements).map((el) => ({
      tag: el.tagName,
      type: el.type,
      text: el.textContent?.trim() || el.value || el.placeholder,
    }));
  });

  console.log("Focusable elements found:", focusableElements.length);

  // Test tab navigation
  for (let i = 0; i < focusableElements.length; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () =>
        document.activeElement?.tagName +
        ": " +
        (document.activeElement?.textContent?.trim() ||
          document.activeElement?.value ||
          document.activeElement?.placeholder)
    );
    console.log(`Tab ${i + 1}:`, focused);
  }

  await browser.close();
}

testKeyboardNavigation();
```

### 2. Keyboard Shortcuts Testing

Test resort-specific keyboard shortcuts:

```javascript
// Test keyboard shortcuts
const keyboardShortcuts = {
  "Alt + D": "Navigate to Dashboard",
  "Alt + B": "Navigate to Bookings",
  "Alt + E": "Navigate to Expenses",
  "Alt + P": "Navigate to Properties",
  "Ctrl + /": "Show keyboard shortcuts help",
  Escape: "Close modal/dropdown",
  Enter: "Activate primary action",
  Space: "Toggle checkbox/button",
};
```

### 3. Focus Trap Testing

```javascript
// Test focus trapping in modals
// scripts/test-focus-trap.js
const puppeteer = require("puppeteer");

async function testFocusTrap() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/dashboard");

  // Open modal
  await page.click('[data-testid="add-booking-button"]');

  // Test focus trap
  const modalFocusableElements = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    const elements = modal?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return elements?.length || 0;
  });

  console.log("Modal focusable elements:", modalFocusableElements);

  // Tab through all elements + 2 more (should loop back)
  for (let i = 0; i < modalFocusableElements + 2; i++) {
    await page.keyboard.press("Tab");
  }

  // Check if focus is still within modal
  const focusWithinModal = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    return modal?.contains(document.activeElement);
  });

  console.log("Focus trapped within modal:", focusWithinModal);

  await browser.close();
}
```

## Touch Target Validation

### 1. Touch Target Size Testing

```javascript
// scripts/test-touch-targets.js
const puppeteer = require("puppeteer");

async function testTouchTargets() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 732 }); // Mobile viewport
  await page.goto("http://localhost:3000");

  const touchTargets = await page.evaluate(() => {
    const interactiveElements = document.querySelectorAll(
      'button, a, input[type="checkbox"], input[type="radio"], [role="button"]'
    );

    return Array.from(interactiveElements).map((element) => {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      const padding = {
        top: parseInt(computedStyle.paddingTop),
        right: parseInt(computedStyle.paddingRight),
        bottom: parseInt(computedStyle.paddingBottom),
        left: parseInt(computedStyle.paddingLeft),
      };

      const touchSize = {
        width: rect.width,
        height: rect.height,
        minSize: Math.min(rect.width, rect.height),
      };

      return {
        element:
          element.tagName + (element.className ? "." + element.className : ""),
        touchSize,
        meets44px: touchSize.minSize >= 44,
        meets48px: touchSize.minSize >= 48,
        text: element.textContent?.trim().substring(0, 30),
      };
    });
  });

  console.log("Touch Target Analysis:");
  touchTargets.forEach((target) => {
    const status = target.meets48px ? "✓" : target.meets44px ? "⚠" : "✗";
    console.log(
      `${status} ${target.element}: ${target.touchSize.width}x${target.touchSize.height}px - ${target.text}`
    );
  });

  const failingTargets = touchTargets.filter((t) => !t.meets44px);
  if (failingTargets.length > 0) {
    console.log("\n❌ Touch targets failing 44px minimum:");
    failingTargets.forEach((t) =>
      console.log(
        `  - ${t.element}: ${t.touchSize.width}x${t.touchSize.height}px`
      )
    );
  }

  await browser.close();
}

testTouchTargets();
```

### 2. Touch Target Spacing

```css
/* Verify adequate spacing between touch targets */
/* Minimum 8px spacing recommended */

.touch-target-group {
  gap: 8px; /* Minimum spacing */
}

.button-group button:not(:last-child) {
  margin-right: 12px; /* Adequate spacing */
}

/* Touch target size utilities */
.touch-target-48 {
  min-width: 48px;
  min-height: 48px;
}

.touch-target-44 {
  min-width: 44px;
  min-height: 44px;
}
```

## Color Contrast Testing

### 1. Automated Color Contrast Testing

```bash
# Install color contrast checker
npm install -g color-contrast-checker

# Test with pa11y for color contrast
pa11y http://localhost:3000 --include-notices --include-warnings
```

### 2. Manual Color Contrast Verification

```javascript
// scripts/test-color-contrast.js
const puppeteer = require("puppeteer");

async function testColorContrast() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:3000");

  // Get color contrast ratios
  const contrastResults = await page.evaluate(() => {
    // This would require a color contrast library
    // For now, we'll identify text elements to check manually
    const textElements = document.querySelectorAll(
      "p, span, div, button, a, h1, h2, h3, h4, h5, h6"
    );

    return Array.from(textElements)
      .filter((el) => el.textContent?.trim())
      .slice(0, 20) // Limit for testing
      .map((el) => {
        const computedStyle = window.getComputedStyle(el);
        return {
          text: el.textContent?.trim().substring(0, 50),
          color: computedStyle.color,
          backgroundColor: computedStyle.backgroundColor,
          fontSize: computedStyle.fontSize,
        };
      });
  });

  console.log("Elements requiring color contrast verification:");
  contrastResults.forEach((result, index) => {
    console.log(`${index + 1}. "${result.text}"`);
    console.log(`   Color: ${result.color}`);
    console.log(`   Background: ${result.backgroundColor}`);
    console.log(`   Font Size: ${result.fontSize}`);
    console.log("");
  });

  await browser.close();
}

testColorContrast();
```

### 3. Color Contrast Requirements

```javascript
// Color contrast requirements based on WCAG 2.1 AA
const contrastRequirements = {
  normalText: {
    minimumRatio: 4.5,
    description: "Text smaller than 18pt or 14pt bold",
  },
  largeText: {
    minimumRatio: 3.0,
    description: "Text 18pt+ or 14pt+ bold",
  },
  uiComponents: {
    minimumRatio: 3.0,
    description: "UI components and graphical objects",
  },
};

// Test specific color combinations
const colorCombinations = [
  { bg: "#0F172A", fg: "#FFFFFF", purpose: "Dark background with white text" },
  { bg: "#FFFFFF", fg: "#1F2937", purpose: "Light background with dark text" },
  { bg: "#0EA5E9", fg: "#FFFFFF", purpose: "Primary button" },
  { bg: "#EF4444", fg: "#FFFFFF", purpose: "Error state" },
  { bg: "#10B981", fg: "#FFFFFF", purpose: "Success state" },
];
```

## Resort-Specific Accessibility

### 1. Booking Calendar Accessibility

```javascript
// Test calendar navigation with keyboard
const calendarAccessibilityTests = [
  "Arrow keys navigate between dates",
  "Enter/Space selects dates",
  "Tab moves between calendar controls",
  "ESC closes date picker",
  "Home/End keys jump to start/end of week",
  "Page Up/Down navigate months",
  "Screen reader announces selected dates",
  "Screen reader announces availability status",
];
```

### 2. Financial Dashboard Accessibility

```javascript
// Test dashboard accessibility
const dashboardAccessibilityTests = [
  "Chart data available as table",
  "Screen reader announces values",
  "Keyboard navigation through data points",
  "Color not sole indicator of meaning",
  "Loading states announced",
  "Error states clearly communicated",
];
```

### 3. Mobile Menu Accessibility

```javascript
// Test mobile menu hamburger accessibility
const mobileMenuTests = [
  "Hamburger button has accessible name",
  "Menu state (open/closed) announced",
  "Focus moves to menu when opened",
  "ESC key closes menu",
  "Focus returns to hamburger when closed",
  "Menu items keyboard navigable",
];
```

### 4. Form Accessibility

```javascript
// Test booking/expense forms
const formAccessibilityTests = [
  "All inputs have labels",
  "Required fields clearly marked",
  "Error messages associated with fields",
  "Error messages announced by screen reader",
  "Success messages announced",
  "Field format instructions provided",
  "Autocomplete attributes set appropriately",
];
```

## CI Parity

### 1. Exact CI Configuration

Match the CI accessibility requirements:

```bash
# Run with exact CI thresholds
lighthouse http://localhost:4173 \
  --only-categories=accessibility \
  --chrome-flags="--no-sandbox --disable-dev-shm-usage" \
  --output=json \
  --output-path=./reports/lighthouse-ci-a11y.json

# Check if score meets 95% threshold (CI currently uses 90%)
node -e "
const report = require('./reports/lighthouse-ci-a11y.json');
const score = report.lhr.categories.accessibility.score * 100;
console.log('Accessibility Score:', score);
console.log('Meets 95% threshold:', score >= 95 ? '✓' : '✗');
"
```

### 2. CI Environment Variables

```bash
# Set CI-like environment
export CI=true
export NODE_ENV=production

# Run accessibility verification
npm run verify:accessibility
```

### 3. Automated Testing Integration

```javascript
// Add to package.json scripts
{
  "test:a11y": "lighthouse http://localhost:4173 --only-categories=accessibility --chrome-flags='--headless --no-sandbox'",
  "test:a11y:axe": "axe http://localhost:4173 --exit",
  "test:a11y:pa11y": "pa11y http://localhost:4173",
  "verify:accessibility": "npm run test:a11y && npm run test:a11y:axe"
}
```

## Troubleshooting

### Common Accessibility Issues

#### 1. Missing Alt Text

```bash
# Find images without alt text
lighthouse http://localhost:4173 \
  --only-audits="image-alt" \
  --output=html \
  --output-path=./lighthouse-alt-debug.html
```

**Common fixes:**

```jsx
// ❌ Bad
<img src="/logo.png" />

// ✅ Good
<img src="/logo.png" alt="Okaeri Resort Management System" />

// ✅ Decorative images
<img src="/decoration.png" alt="" role="presentation" />
```

#### 2. Missing Form Labels

```bash
# Find form inputs without labels
lighthouse http://localhost:4173 \
  --only-audits="label" \
  --output=html \
  --output-path=./lighthouse-label-debug.html
```

**Common fixes:**

```jsx
// ❌ Bad
<input type="email" placeholder="Email" />

// ✅ Good
<label htmlFor="email">Email Address</label>
<input type="email" id="email" />

// ✅ Alternative with aria-label
<input type="email" aria-label="Email Address" />
```

#### 3. Poor Color Contrast

```bash
# Check color contrast issues
lighthouse http://localhost:4173 \
  --only-audits="color-contrast" \
  --output=html \
  --output-path=./lighthouse-contrast-debug.html
```

**Common fixes:**

```css
/* ❌ Poor contrast (2.1:1) */
.text-gray-400 {
  color: #9ca3af; /* on white background */
}

/* ✅ Good contrast (4.5:1+) */
.text-gray-700 {
  color: #374151; /* on white background */
}
```

#### 4. Missing ARIA Attributes

```javascript
// Common ARIA fixes
const ariaFixes = {
  // Buttons that look like links
  '<button role="link">': 'Remove role="link" from buttons',

  // Missing aria-expanded on toggles
  '<button aria-expanded="true/false">': "Add to dropdown/menu toggles",

  // Missing aria-describedby for help text
  '<input aria-describedby="help-text">': "Associate help text with inputs",

  // Missing aria-live for dynamic content
  '<div aria-live="polite">': "Add to status messages",

  // Missing aria-label for icon buttons
  '<button aria-label="Close modal">': "Add to icon-only buttons",
};
```

### Debugging Failed Tests

#### 1. Axe Violations Analysis

```javascript
// Analyze axe violations
const analyzeAxeReport = (violations) => {
  violations.forEach((violation) => {
    console.log(`\n❌ ${violation.id}: ${violation.description}`);
    console.log(`Impact: ${violation.impact}`);
    console.log(`Help: ${violation.helpUrl}`);

    violation.nodes.forEach((node, index) => {
      console.log(`  ${index + 1}. Target: ${node.target}`);
      console.log(`     HTML: ${node.html.substring(0, 100)}...`);
    });
  });
};
```

#### 2. Focus Issues Debugging

```javascript
// Debug focus management
const debugFocus = () => {
  let focusHistory = [];

  document.addEventListener("focusin", (e) => {
    focusHistory.push({
      element: e.target.tagName,
      className: e.target.className,
      id: e.target.id,
      timestamp: Date.now(),
    });
    console.log("Focus moved to:", e.target);
  });

  // Log focus history
  setInterval(() => {
    if (focusHistory.length > 0) {
      console.log("Recent focus history:", focusHistory.slice(-5));
    }
  }, 5000);
};
```

### Expected Outputs

#### Successful Accessibility Test

```
✓ Accessibility: 96/100
✓ All ARIA attributes valid
✓ All buttons have accessible names
✓ Color contrast ratios meet AA standards
✓ All images have alt text
✓ All form inputs have labels
✓ Page has valid HTML lang attribute
✓ Touch targets meet 44px minimum

Axe-core: 0 violations found
Pa11y: 0 accessibility issues found
```

#### Failed Accessibility Test

```
✗ Accessibility: 89/100 (< 95% required)
✗ 3 images missing alt attributes
✗ 2 buttons without accessible names
✗ 1 form input without label
✗ 4 color contrast issues found

Axe-core: 6 violations found
- button-name: Buttons must have discernible text
- image-alt: Images must have alternate text
- color-contrast: Elements must have sufficient color contrast

Pa11y: 8 accessibility issues found
```

This comprehensive guide ensures you can reproduce all accessibility tests
locally and create inclusive user experiences for all users of the Okaeri Resort
Management System.
