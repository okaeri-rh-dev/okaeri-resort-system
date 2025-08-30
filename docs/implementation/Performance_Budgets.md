# Performance Budgets

## Single Source of Truth for Okaeri Resort System Performance Targets

> **Last Updated**: August 2025  
> **Status**: Authoritative Source - All Other Documents Must Reference This  
> **Owner**: pwa-performance-optimizer agent

---

## Overview

This document defines the **authoritative performance budgets** for the Okaeri
Resort Management System. All other documentation, CI/CD configurations, and
monitoring systems must reference these values to ensure consistency.

---

## Bundle Size Budgets

### Production Limits (Gzipped)

Based on `bundlesize.config.json` - the enforced configuration:

#### Initial Load Bundles

| Bundle            | Max Size   | Purpose                  |
| ----------------- | ---------- | ------------------------ |
| Main Application  | **120KB**  | Core application logic   |
| Critical CSS      | **40KB**   | Above-the-fold styles    |
| React Vendor      | **42KB**   | React and React-DOM      |
| **Total Initial** | **~200KB** | First paint requirements |

#### Lazy-Loaded Bundles

| Bundle                   | Max Size | Purpose                  |
| ------------------------ | -------- | ------------------------ |
| Router Bundle            | **28KB** | TanStack Router          |
| Query Bundle             | **32KB** | TanStack Query           |
| UI Components (Critical) | **38KB** | Essential UI components  |
| UI Components (Extended) | **65KB** | Additional UI components |
| Form Handling            | **22KB** | React Hook Form + Zod    |
| State Management         | **15KB** | Zustand stores           |

#### Route-Specific Bundles

| Route         | Max Size | Components                 |
| ------------- | -------- | -------------------------- |
| Dashboard     | **35KB** | Metrics, charts, summaries |
| Bookings      | **45KB** | Calendar, forms, timeline  |
| Properties    | **30KB** | Room management UI         |
| Expenses      | **35KB** | Financial forms, receipts  |
| Other Routes  | **25KB** | Settings, profile, etc.    |
| Public Routes | **20KB** | Login, register, landing   |

#### Platform Totals

| Platform                | Total Budget | Context                          |
| ----------------------- | ------------ | -------------------------------- |
| **Mobile (3G)**         | **400KB**    | All assets for mobile experience |
| **Desktop (Broadband)** | **800KB**    | Enhanced desktop features        |
| **Absolute Maximum**    | **1.5MB**    | Hard limit for all assets        |

---

## Core Web Vitals Targets

### User Experience Metrics

| Metric                              | Good   | Acceptable | Poor   | Measurement          |
| ----------------------------------- | ------ | ---------- | ------ | -------------------- |
| **LCP** (Largest Contentful Paint)  | <2.5s  | <4.0s      | >4.0s  | Loading performance  |
| **INP** (Interaction to Next Paint) | <200ms | <500ms     | >500ms | Interactivity        |
| **CLS** (Cumulative Layout Shift)   | <0.1   | <0.25      | >0.25  | Visual stability     |
| **TTI** (Time to Interactive)       | <3.8s  | <7.3s      | >7.3s  | Full interactivity   |
| **TBT** (Total Blocking Time)       | <200ms | <600ms     | >600ms | Main thread blocking |
| **FCP** (First Contentful Paint)    | <1.5s  | <3.0s      | >3.0s  | First render         |

---

## Lighthouse Score Requirements

### Minimum Scores by Category

| Category           | Production | Staging | Development |
| ------------------ | ---------- | ------- | ----------- |
| **Performance**    | ≥90        | ≥85     | ≥80         |
| **Accessibility**  | ≥90        | ≥90     | ≥90         |
| **Best Practices** | ≥90        | ≥85     | ≥80         |
| **SEO**            | ≥90        | ≥85     | ≥80         |
| **PWA**            | ≥90        | ≥85     | ≥80         |

---

## Network Performance Budgets

### API Response Times

| Endpoint Type         | P50   | P95   | P99   | Max |
| --------------------- | ----- | ----- | ----- | --- |
| **Auth**              | 100ms | 200ms | 500ms | 1s  |
| **CRUD Operations**   | 150ms | 300ms | 750ms | 2s  |
| **Search/Filter**     | 200ms | 500ms | 1s    | 3s  |
| **File Upload**       | 500ms | 2s    | 5s    | 10s |
| **Report Generation** | 1s    | 3s    | 8s    | 15s |

### Database Query Times

| Query Type        | P50   | P95   | P99   | Max   |
| ----------------- | ----- | ----- | ----- | ----- |
| **Simple SELECT** | 5ms   | 15ms  | 30ms  | 100ms |
| **Complex JOIN**  | 20ms  | 50ms  | 100ms | 500ms |
| **Aggregation**   | 50ms  | 150ms | 300ms | 1s    |
| **Bulk Insert**   | 100ms | 500ms | 1s    | 5s    |

---

## Mobile-Specific Budgets

### Network Conditions

| Network     | Initial Load | Interaction | Background Sync |
| ----------- | ------------ | ----------- | --------------- |
| **4G**      | <3s          | <100ms      | <5s             |
| **3G**      | <5s          | <200ms      | <10s            |
| **Slow 3G** | <10s         | <500ms      | <20s            |
| **Offline** | Cached       | Cached      | Queued          |

### Device Performance

| Device Class  | TTI Target | Memory Limit | CPU Budget |
| ------------- | ---------- | ------------ | ---------- |
| **High-end**  | <2s        | 512MB        | 100%       |
| **Mid-range** | <4s        | 256MB        | 75%        |
| **Low-end**   | <8s        | 128MB        | 50%        |

---

## Monitoring Thresholds

### Alert Levels

| Metric                   | Warning | Critical | Page |
| ------------------------ | ------- | -------- | ---- |
| **Bundle Size Increase** | +10%    | +25%     | No   |
| **LCP Degradation**      | >3s     | >4s      | No   |
| **Error Rate**           | >1%     | >5%      | Yes  |
| **API Latency**          | >1s P95 | >2s P95  | Yes  |
| **Memory Usage**         | >80%    | >95%     | Yes  |

---

## Enforcement

### CI/CD Pipeline

- **Build fails** if bundles exceed limits
- **Deploy blocks** if Lighthouse scores below minimum
- **Warnings** for approaching limits (90% of budget)

### Monitoring

- **Real User Monitoring (RUM)** tracks actual performance
- **Synthetic checks** run every 15 minutes
- **Weekly reports** on budget compliance

### Review Process

- **Monthly review** of budget adherence
- **Quarterly adjustment** based on user feedback
- **Annual comprehensive review** of all targets

---

## References

### Configuration Files

- `/bundlesize.config.json` - Bundle size enforcement
- `/.github/workflows/ci.yml` - CI/CD checks
- `/vitest.config.ts` - Test thresholds
- `/lighthouse-ci.json` - Lighthouse configuration

### Documentation

- [Verification Protocol](./Verification_Protocol.md) - Quality gates
- [CI/CD Pipeline Guide](./CI_CD_PIPELINE_GUIDE.md) - Implementation details
- [GLOSSARY](./GLOSSARY.md) - Term definitions

---

## Change Process

To modify any performance budget:

1. **Propose change** with justification and impact analysis
2. **Review** by pwa-performance-optimizer agent
3. **Test** in staging environment for 1 week
4. **Approve** by technical lead and project manager
5. **Update** this document first
6. **Propagate** to all referencing documents and configs
7. **Monitor** for 2 weeks after change

---

## Notes

- All values are for **production builds** unless specified
- Bundle sizes are **gzipped** measurements
- Network times assume **Philippine infrastructure** (Manila/Cebu)
- Mobile targets prioritize **3G baseline** for rural areas
- Performance budgets are **enforced automatically** in CI/CD

---

_This document supersedes any conflicting performance targets in other
documentation._
