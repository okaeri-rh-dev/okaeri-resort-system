# Phase 3: Deployment & Testing

> **Production deployment, testing, monitoring, and launch**

**Estimated Time**: 2 days (16 hours)
**Prerequisites**: Phase 1 & 2 complete, staging environment tested
**Deliverables**: Production-ready public availability calendar

---

## Overview

Phase 3 finalizes the public availability calendar with:

1. **Testing**: Comprehensive cross-browser and device testing
2. **Performance**: Lighthouse audits and optimization
3. **Deployment**: Production deployment with zero downtime
4. **Monitoring**: Analytics and error tracking setup
5. **Launch**: Marketing updates and user communication

`★ Insight ─────────────────────────────────────`
**Test in production-like conditions**: CDN caching behaves differently in local vs production. Always verify cache headers and hit ratios in the actual production environment before announcing the launch.
`─────────────────────────────────────────────────`

---

## Step 1: Pre-Deployment Testing

### 1.1 Cross-Browser Testing

Test on major browsers:

**Desktop Testing**:

```
✓ Chrome (latest)
✓ Firefox (latest)
✓ Safari (latest)
✓ Edge (latest)
```

**Test Cases**:

- [ ] Calendar loads without console errors
- [ ] Month navigation works smoothly
- [ ] Colors render correctly (green/yellow/orange/red)
- [ ] Hover states work as expected
- [ ] View-only information box displays correctly
- [ ] Loading/error states display properly
- [ ] Font rendering looks good
- [ ] Timezone handling works (Philippine Time)

**Tools**:

- [BrowserStack](https://www.browserstack.com/) - Cloud browser testing
- Local browser installations
- Chrome DevTools device emulation

### 1.2 Mobile Device Testing

Test on real devices:

**iOS Devices**:

```
✓ iPhone 14 Pro (iOS 17+)
✓ iPhone 13 (iOS 16+)
✓ iPad Pro (iPadOS 17+)
```

**Android Devices**:

```
✓ Samsung Galaxy S23
✓ Google Pixel 7
✓ OnePlus 10 Pro
```

**Test Cases**:

- [ ] Calendar fits screen without horizontal scroll
- [ ] Touch targets are adequate (min 44x44px)
- [ ] Swipe gestures work for month navigation
- [ ] View-only information message is visible
- [ ] Footer links are tappable (min 44x44px)
- [ ] Text is readable without zooming
- [ ] No layout shift on page load
- [ ] Page loads under 3 seconds on 4G
- [ ] Date validation works (no past months, max 1 year future)

**Tools**:

- Physical devices (recommended)
- BrowserStack Real Device Cloud
- Chrome DevTools remote debugging

### 1.3 Accessibility Testing

**WCAG 2.1 AA Compliance**:

- [ ] **Color Contrast**: All text meets 4.5:1 ratio
- [ ] **Keyboard Navigation**: All interactive elements accessible via Tab
- [ ] **Screen Reader**: Calendar announces availability correctly
- [ ] **Focus Indicators**: Clear visual focus on all buttons
- [ ] **Alt Text**: All icons have descriptive labels
- [ ] **Heading Structure**: Proper H1 → H2 → H3 hierarchy
- [ ] **ARIA Labels**: Appropriate ARIA attributes on calendar

**Testing Tools**:

```bash
# Axe DevTools (Chrome extension)
# WAVE (Web Accessibility Evaluation Tool)
# Lighthouse Accessibility audit

# Run Lighthouse
npm run lighthouse -- --url=http://localhost:5173/calendar
```

---

## Step 2: Performance Testing

### 2.1 Lighthouse Audits

Run Lighthouse in CI mode:

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run audit
lhci autorun --collect.url=http://localhost:5173/calendar

# Expected scores:
# Performance: > 90
# Accessibility: > 95
# Best Practices: > 95
# SEO: > 90
```

**Performance Budget**:

```json
{
  "performance": {
    "firstContentfulPaint": 1500,
    "largestContentfulPaint": 2500,
    "timeToInteractive": 3000,
    "cumulativeLayoutShift": 0.1,
    "totalBlockingTime": 200
  },
  "budgets": {
    "javascript": 200,
    "css": 50,
    "fonts": 100,
    "images": 200
  }
}
```

### 2.2 Core Web Vitals Testing

**Metrics to Monitor**:

| Metric                             | Target  | Measurement                    |
| ---------------------------------- | ------- | ------------------------------ |
| **LCP** (Largest Contentful Paint) | < 2.5s  | Lighthouse, PageSpeed Insights |
| **FID** (First Input Delay)        | < 100ms | Real User Monitoring (RUM)     |
| **CLS** (Cumulative Layout Shift)  | < 0.1   | Lighthouse, PageSpeed Insights |
| **TTFB** (Time to First Byte)      | < 600ms | Cloudflare Analytics           |

**Tools**:

- [PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)
- Vercel Analytics (built-in)
- Chrome DevTools Performance panel

### 2.3 Load Testing

Test API endpoint under load:

```bash
# Install k6 (load testing tool)
brew install k6

# Create load test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50, // 50 virtual users
  duration: '2m', // 2 minutes
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests < 500ms
    http_req_failed: ['rate<0.01'], // <1% failures
  },
};

export default function () {
  const res = http.get('https://okaeri-resort.com/api/public/v1/availability?start=2025-01-01&end=2025-01-31');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has availability data': (r) => JSON.parse(r.body).availability.length > 0,
  });

  sleep(1);
}
EOF

# Run load test
k6 run load-test.js
```

**Expected Results**:

- **Request rate**: ~50 requests/second
- **Success rate**: >99%
- **P95 latency**: <500ms
- **CDN cache hit ratio**: >80% after warm-up

---

## Step 3: Production Deployment

### 3.1 Pre-Deployment Checklist

- [ ] **Database function deployed**: `get_public_aggregate_availability()` exists
- [ ] **API endpoint tested**: Returns valid data
- [ ] **Environment variables set**: Supabase credentials in Cloudflare Workers
- [ ] **CDN caching enabled**: Cloudflare Cache rules configured
- [ ] **Rate limiting active**: 100 req/min per IP
- [ ] **Frontend built**: Production build with optimizations
- [ ] **Lighthouse score verified**: All scores >90
- [ ] **Staging tested**: Full end-to-end testing complete
- [ ] **Rollback plan ready**: Documented in case of issues

### 3.2 Deployment Steps

**Backend Deployment** (if not already done):

```bash
# Deploy Cloudflare Worker
cd functions
npx wrangler deploy api/public/v1/availability.ts

# Verify deployment
curl https://okaeri-resort.com/api/public/v1/availability
```

**Frontend Deployment** (Cloudflare Pages):

```bash
# Build production bundle
npm run build

# Verify build output
ls -lh dist/

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist

# Verify deployment
curl -I https://okaeri-resort.com/calendar
```

**Post-Deployment Verification**:

```bash
# Smoke test (production)
curl -I https://okaeri-resort.com/calendar

# Expected:
# HTTP/2 200
# cache-control: public, max-age=300, stale-while-revalidate=600
# content-type: text/html

# Test API endpoint
curl https://okaeri-resort.com/api/public/v1/availability?start=2025-01-01&end=2025-01-31

# Verify CDN caching
curl -I https://okaeri-resort.com/api/public/v1/availability

# Expected headers:
# cf-cache-status: HIT (after 2nd request)
# cache-control: public, max-age=300...
```

### 3.3 DNS & CDN Configuration

**Cloudflare Settings**:

1. **Caching Rules**:

   ```
   Rule: Cache everything for /api/public/v1/availability
   TTL: 300 seconds (5 minutes)
   Browser Cache TTL: 300 seconds
   ```

2. **Page Rules** (if needed):

   ```
   URL: okaeri-resort.com/calendar*
   Settings:
     - Cache Level: Standard
     - Browser Cache TTL: Respect Existing Headers
   ```

3. **Rate Limiting**:
   ```
   Rule: Protect /api/public/v1/availability
   Threshold: 100 requests per 60 seconds
   Action: Challenge (Cloudflare Challenge Page)
   ```

---

## Step 4: Monitoring & Analytics

### 4.1 Set Up Cloudflare Web Analytics

**Enable Web Analytics**:

1. Go to Cloudflare Dashboard → Analytics → Web Analytics
2. Click "Add a site"
3. Copy the JavaScript beacon
4. Add to your `index.html` or `App.tsx`

```html
<!-- Add to index.html <head> -->
<script
  defer
  src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "YOUR_BEACON_TOKEN"}'
></script>
```

**Or via React component**:

```typescript
// src/main.tsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Cloudflare Web Analytics automatically tracks page views
    // No additional configuration needed
  }, []);

  return <YourApp />;
}
```

### 4.2 Set Up Error Tracking (Sentry - Recommended)

> **💡 Recommendation**: While optional, Sentry provides real-time error tracking and debugging context.
> Setup takes ~15 minutes and can save hours when production issues occur.

```bash
# Install Sentry
npm install --save @sentry/react

# Initialize
npx @sentry/wizard@latest -i sourcemaps
```

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  integrations: [new Sentry.BrowserTracing(), new Sentry.Replay()],
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
});
```

### 4.3 Custom Analytics Events

Track user interactions:

```typescript
// src/components/calendar/PublicAvailabilityCalendar.tsx

// Track month navigation
const goToNextMonth = () => {
  const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  const validation = validateMonth(newMonth);

  if (validation.valid) {
    setCurrentMonth(newMonth);

    // Track event
    if (typeof window !== "undefined" && "gtag" in window) {
      (window as any).gtag("event", "calendar_month_navigation", {
        event_category: "availability_calendar",
        event_label: "next_month",
      });
    }
  }
};

// Track date cell clicks (interest tracking)
const handleDateClick = (date: Date, availableCount: number) => {
  if (typeof window !== "undefined" && "gtag" in window) {
    (window as any).gtag("event", "date_interest", {
      event_category: "availability_calendar",
      event_label: date.toISOString().split("T")[0],
      value: availableCount, // Track how many units were available
    });
  }
};

// Track "Today" button clicks
const goToToday = () => {
  setCurrentMonth(getTodayPhilippineTime());

  if (typeof window !== "undefined" && "gtag" in window) {
    (window as any).gtag("event", "calendar_today_click", {
      event_category: "availability_calendar",
    });
  }
};
```

### 4.4 Dashboard Setup

**Metrics to Monitor** (Cloudflare Web Analytics):

- **Page Views**: Total visits to `/calendar`
- **Unique Visitors**: Daily/weekly unique users
- **Avg. Session Duration**: Time spent on calendar
- **Bounce Rate**: Users leaving without interaction
- **Device Breakdown**: Mobile vs Desktop ratio
- **Top Referrers**: Where traffic comes from

**Cloudflare API Analytics**:

- **API Requests**: Total requests to availability endpoint
- **Cache Hit Ratio**: Percentage of cached responses
- **Error Rate**: 4xx and 5xx responses
- **Response Time**: P50, P95, P99 latencies
- **Geographic Distribution**: Where users are located

---

## Step 5: Launch Plan

### 5.1 Pre-Launch Communication

**Internal Team**:

```
Subject: 🚀 Public Availability Calendar Launching Tomorrow

Hi Team,

Our new public availability calendar goes live tomorrow!

What's changing:
- Guests can now check real-time availability at okaeri-resort.com/calendar
- View-only calendar (guests return to main site to contact us)
- Expected reduction in "Is it available?" WhatsApp messages

What to monitor:
- WhatsApp inquiry volume (should decrease)
- Calendar page visits (new metric)
- Date interaction patterns (which dates guests click on)
- Any technical issues or guest confusion

Support docs: [Link to internal wiki]

Questions? Reply to this email.

Thanks,
[Your Name]
```

### 5.2 Marketing Materials Update

**Website Updates** (Internal use - link shared privately):

- [ ] Prepare calendar link for sharing with interested guests
- [ ] Add internal documentation for staff on when to share link
- [ ] Update internal booking workflow to include calendar reference
- [ ] Prepare calendar preview screenshot for guest communications

**Social Media** (Optional - use only if business model changes):

```
NOTE: Based on current strategy (link shared privately),
social media announcements are NOT planned for MVP.

If strategy changes to public promotion in the future,
consider:
- WhatsApp/phone verification before sharing link
- Private message distribution to interested guests
- Avoid public URL sharing to maintain exclusivity
```

### 5.3 SEO Updates

**Sitemap Update** (`/public/sitemap.xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- ... existing URLs ... -->

  <url>
    <loc>https://okaeri-resort.com/calendar</loc>
    <lastmod>2025-01-10</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

**Google Search Console**:

1. Submit updated sitemap
2. Request indexing for `/calendar` page
3. Monitor search performance for "Okaeri Resort availability"

**Schema Markup** (Optional - Rich Snippets):

```html
<!-- Add to availability page <head> -->
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "name": "Okaeri Resort",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Taboc",
      "addressRegion": "La Union",
      "addressCountry": "PH"
    },
    "telephone": "+639123456789",
    "url": "https://okaeri-resort.com",
    "sameAs": ["https://facebook.com/okaeriresort", "https://instagram.com/okaeriresort"]
  }
</script>
```

---

## Step 6: Post-Launch Monitoring

### 6.1 First 24 Hours

**Hourly Checks**:

- [ ] **Uptime**: Page accessible (use UptimeRobot)
- [ ] **Error rate**: <1% (Cloudflare Analytics)
- [ ] **Cache hit ratio**: >80% (Cloudflare Analytics)
- [ ] **Page load time**: <2s P95 (Vercel Analytics)

**Issue Response Plan**:

```
If error rate >5%:
1. Check Sentry for stack traces
2. Verify API endpoint responding
3. Check database function accessible
4. Roll back if critical (use Git tag)

If page load >5s:
1. Check Cloudflare cache status
2. Verify CDN rules configured
3. Check bundle size (should be <200KB)
4. Enable additional caching if needed

If users report confusion:
1. Update view-only messaging
2. Improve help text clarity
3. Create FAQ section
```

### 6.2 Monitoring SLOs & Alerts

**Service Level Objectives**:

- **P95 Latency < 500ms** for 15 minutes → Slack warning
- **P95 Latency > 1 second** for 15 minutes → Page on-call engineer
- **Error Rate > 5%** over 5 minutes → Email warning
- **Cache Hit Ratio < 50%** over 15 minutes → Investigate caching config
- **API Availability < 99%** over 1 hour → Critical alert

**Monitoring Tools**:

- **Cloudflare Workers Analytics** (for API metrics, not Web Analytics)
- **Sentry** for error tracking and stack traces
- **Custom Dashboard** for SLO visualization

**Alert Channels**:

- Slack: #okaeri-alerts for warnings
- Email: tech@okaeri-resort.com for critical issues
- PagerDuty: For P0 incidents (optional)

### 6.3 First Week

**Daily Metrics** (Cloudflare Web Analytics):

- **Calendar page views**: [Baseline TBD]
- **WhatsApp inquiry volume**: [Compare to pre-launch]
- **Date interaction rate**: [Target: >15% of visitors click on dates]
- **Bounce rate**: [Target: <40%]
- **Avg session duration**: [Target: >30s]
- **Mobile vs Desktop ratio**: [Track device usage]
- **Navigation patterns**: [Track which months users view most]

**User Feedback Collection**:

```
WhatsApp Auto-Reply (after booking inquiry):

"Thanks for your interest in Okaeri Resort! 🏖️

Quick question: Did you use our new availability
calendar? (okaeri-resort.com/calendar)

Your feedback helps us improve! 💙"
```

### 6.4 First Month

**Weekly Review Meeting**:

- Review analytics dashboard
- Discuss user feedback
- Identify improvement opportunities
- Plan Phase 2 enhancements

**Success Criteria Review**:

- [ ] **30% reduction** in availability inquiries
- [ ] **20% increase** in qualified bookings
- [ ] **>90 Lighthouse** Performance score
- [ ] **>80% CDN cache** hit ratio
- [ ] **Zero critical bugs** or downtime

---

## Step 7: Rollback Procedure

### 7.1 Rollback Triggers

Execute rollback if:

- **Critical bug**: Calendar not loading or showing wrong data
- **Performance issue**: Page load time >10s consistently
- **High error rate**: API errors >10%
- **User complaints**: Multiple reports of confusion or broken functionality

### 7.2 Rollback Steps

**Frontend Rollback** (Cloudflare Pages):

```bash
# List recent deployments
npx wrangler pages deployments list

# Rollback to previous deployment
npx wrangler pages deployment rollback

# Verify rollback
curl -I https://okaeri-resort.com/calendar
```

**API Rollback** (Cloudflare Workers):

```bash
# List deployments
npx wrangler deployments list

# Rollback to specific version
npx wrangler rollback --version <version-id>
```

**Database Rollback** (if function modified):

```sql
-- Drop problematic function
DROP FUNCTION IF EXISTS get_public_aggregate_availability(DATE, DATE);

-- Restore from backup (if available)
-- Or recreate previous version
```

**Communication** (for private link recipients only):

```
WhatsApp/Email Message:

"We're temporarily updating our availability calendar.
Please contact us directly for current availability:

📱 +639123456789

We'll notify you when the calendar is back online.

Thanks for your patience! 💙"
```

---

## Testing Checklist Summary

### Pre-Deployment

- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device testing (iOS, Android)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Lighthouse Performance score >90
- [ ] Load testing (50 concurrent users, <500ms P95)
- [ ] API endpoint tested in production environment
- [ ] CDN caching verified
- [ ] Rate limiting tested
- [ ] Error handling tested

### Deployment

- [ ] Database function deployed
- [ ] API endpoint deployed
- [ ] Frontend deployed
- [ ] DNS configured
- [ ] CDN rules configured
- [ ] Monitoring enabled
- [ ] Analytics tracking active

### Post-Deployment

- [ ] Smoke test in production
- [ ] Cache hit ratio >80%
- [ ] Error rate <1%
- [ ] Page loads in <2s
- [ ] Timezone handling works correctly (Philippine Time)
- [ ] Date validation works (no past months, max 1 year future)
- [ ] View-only information message displays correctly
- [ ] Privacy footer added: "This calendar shows aggregate availability only. No personal data. [Privacy Policy]"
- [ ] SEO sitemap updated (if calendar is publicly indexed)
- [ ] Internal documentation updated (how to share link with guests)
- [ ] Team notified of new workflow

---

## Next Steps

✅ **Phase 3 Complete!** Public availability calendar is live.

**Post-Launch Tasks**:

1. Monitor metrics for 1 week
2. Collect user feedback
3. Plan Phase 2 enhancements (peak season indicators, etc.)
4. Document lessons learned

---

**Estimated Completion Time**: 2 days
**Actual Time Spent**: _[Track here]_
**Blockers**: _[Document any issues]_
**Sign-off**: _[Tech lead approval]_
**Launch Date**: _[Record actual launch date]_

---

**Congratulations! 🎉**

The public availability calendar is now live and helping guests discover available dates at Okaeri Resort!
