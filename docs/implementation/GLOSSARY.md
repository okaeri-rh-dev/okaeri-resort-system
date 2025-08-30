# Technical Glossary

## Okaeri Resort Management System - Terms and Acronyms

> **Last Updated**: August 2025  
> **Purpose**: Central reference for all technical terms and acronyms used
> across documentation

---

## Table of Contents

- [Performance Metrics](#performance-metrics)
- [Security Terms](#security-terms)
- [Database Terms](#database-terms)
- [Testing Terms](#testing-terms)
- [Development Terms](#development-terms)
- [Business Terms](#business-terms)

---

## Performance Metrics

### Core Web Vitals

- **LCP (Largest Contentful Paint)**: Measures loading performance. Target: <2.5
  seconds for good user experience
- **INP (Interaction to Next Paint)**: Measures interactivity by observing all
  user interactions throughout the page lifecycle. Target: <200 milliseconds
- **CLS (Cumulative Layout Shift)**: Measures visual stability. Target: <0.1
- **TTI (Time to Interactive)**: Time until the page becomes fully interactive.
  Target: <3.8 seconds
- **TBT (Total Blocking Time)**: Sum of all time periods where main thread was
  blocked. Target: <200ms
- **FCP (First Contentful Paint)**: Time when first text or image is painted.
  Target: <1.5 seconds
- **SI (Speed Index)**: How quickly contents of a page are visibly populated
- **TTFB (Time to First Byte)**: Time between request and first byte of response

---

## Security Terms

### Content Security

- **CSP (Content Security Policy)**: HTTP header that controls resources the
  browser is allowed to load
- **CORS (Cross-Origin Resource Sharing)**: Mechanism allowing resources to be
  requested from another domain
- **CSRF (Cross-Site Request Forgery)**: Attack that exploits browser's
  automatic inclusion of cookies. Not applicable to JWT authentication in
  Authorization headers, which is CSRF-immune by design
- **XSS (Cross-Site Scripting)**: Injection attack where malicious scripts are
  injected into trusted websites
- **JWT (JSON Web Token)**: Compact, URL-safe means of representing claims
  between two parties
- **MFA (Multi-Factor Authentication)**: Authentication method requiring two or
  more verification factors

### Security Headers

- **HSTS (HTTP Strict Transport Security)**: Forces browsers to use HTTPS
  connections
- **X-Frame-Options**: Prevents clickjacking attacks by controlling iframe
  embedding
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer-Policy**: Controls how much referrer information is passed
- **Permissions-Policy**: Controls which browser features can be used

---

## Database Terms

### PostgreSQL & Neon

- **RLS (Row-Level Security)**: PostgreSQL feature that restricts which rows
  users can access
- **CTE (Common Table Expression)**: Temporary named result set within a SQL
  statement
- **UUID (Universally Unique Identifier)**: 128-bit identifier used for primary
  keys
- **ACID (Atomicity, Consistency, Isolation, Durability)**: Database transaction
  properties
- **WAL (Write-Ahead Logging)**: PostgreSQL's method of ensuring data integrity
- **MVCC (Multi-Version Concurrency Control)**: PostgreSQL's approach to
  handling concurrent transactions
- **SET LOCAL**: PostgreSQL command to set configuration parameters for current
  transaction

### Connection Management

- **PgBouncer**: Lightweight PostgreSQL connection pooler
- **Connection Pooling**: Technique of sharing database connections among
  multiple clients
- **Prepared Statements**: Pre-compiled SQL statements for improved performance
  and security

---

## Testing Terms

### Test Types

- **TDD (Test-Driven Development)**: Development process where tests are written
  before code
- **BDD (Behavior-Driven Development)**: Extension of TDD using natural language
  constructs
- **E2E (End-to-End)**: Testing complete user workflows from start to finish
- **Unit Testing**: Testing individual components in isolation
- **Integration Testing**: Testing interactions between multiple components
- **Contract Testing**: Verifying that services meet agreed-upon contracts

### Testing Tools

- **Vitest**: Fast unit test framework for Vite projects
- **Playwright**: Cross-browser automation and testing framework
- **MSW (Mock Service Worker)**: API mocking library for browser and Node.js

---

## Development Terms

### Build & Bundle

- **HMR (Hot Module Replacement)**: Updates modules in browser without full
  reload
- **Tree Shaking**: Dead code elimination in JavaScript bundles
- **Code Splitting**: Breaking code into smaller chunks loaded on demand
- **Lazy Loading**: Deferring initialization of resources until needed
- **SSR (Server-Side Rendering)**: Rendering pages on the server
- **SSG (Static Site Generation)**: Pre-rendering pages at build time
- **ISR (Incremental Static Regeneration)**: Updating static pages after
  deployment

### TypeScript

- **Type Safety**: Compile-time checking of type correctness
- **Type Inference**: Automatic detection of variable types
- **Generics**: Type variables that allow reusable components
- **Strict Mode**: Set of TypeScript compiler options for maximum type safety

### React & State

- **JSX (JavaScript XML)**: Syntax extension for React components
- **Hooks**: Functions that let you use state and other React features
- **Context API**: React's way of passing data through component tree
- **Suspense**: React feature for handling async operations
- **Concurrent Mode**: React's approach to interrupting and resuming work

---

## Business Terms

### Philippine Business

- **BIR (Bureau of Internal Revenue)**: Philippine tax authority
- **VAT (Value Added Tax)**: 12% consumption tax in Philippines
- **TIN (Tax Identification Number)**: Unique number assigned by BIR
- **OR (Official Receipt)**: Document for sales of services
- **SI (Sales Invoice)**: Document for sales of goods
- **PWD (Persons with Disability)**: Entitled to 20% discount under Philippine
  law
- **Senior Citizen**: Persons 60+ years old, entitled to 20% discount

### Resort Operations

- **ADR (Average Daily Rate)**: Average revenue earned per occupied room
- **RevPAR (Revenue Per Available Room)**: Total room revenue divided by
  available rooms
- **OTA (Online Travel Agency)**: Platforms like Booking.com, Agoda, Airbnb
- **Channel Manager**: Software managing rates across multiple OTAs
- **Walk-in**: Guest without prior reservation
- **No-show**: Guest with reservation who doesn't arrive
- **Overbooking**: Accepting more reservations than available capacity

### Financial Terms

- **Withholding Tax**: Tax deducted at source of income
- **Service Charge**: 10% fee added to resort services
- **Professional Fee**: Payment for professional services (2% withholding)
- **Rental Income**: Income from property rentals (5% withholding)
- **Corporate Rate**: Special rates for business entities (15% withholding)

---

## CI/CD Terms

- **CI (Continuous Integration)**: Practice of merging code changes frequently
- **CD (Continuous Delivery/Deployment)**: Automated deployment of code changes
- **Pipeline**: Series of automated steps in CI/CD process
- **Artifact**: Build output stored for deployment
- **Rollback**: Reverting to previous version after failed deployment
- **Blue-Green Deployment**: Running two identical production environments
- **Canary Deployment**: Gradual rollout to subset of users
- **Feature Flag**: Toggle for enabling/disabling features without deployment

---

## Cloud & Infrastructure

- **Edge Function**: Code executed at CDN edge locations
- **Serverless**: Cloud execution model charging only for actual usage
- **CDN (Content Delivery Network)**: Distributed servers delivering content
- **Cold Start**: Initial delay when serverless function first runs
- **Warm Start**: Faster execution using pre-initialized function
- **Rate Limiting**: Controlling request frequency from clients
- **DDoS (Distributed Denial of Service)**: Attack overwhelming system with
  traffic

---

## Monitoring & Analytics

- **APM (Application Performance Monitoring)**: Tools tracking app performance
- **RUM (Real User Monitoring)**: Collecting performance data from actual users
- **Synthetic Monitoring**: Automated tests simulating user interactions
- **SLA (Service Level Agreement)**: Commitment to service availability
- **SLO (Service Level Objective)**: Target reliability level
- **SLI (Service Level Indicator)**: Metric measuring service performance
- **MTTR (Mean Time To Recovery)**: Average time to restore service
- **MTBF (Mean Time Between Failures)**: Average time between system failures

---

## API & Integration

- **REST (Representational State Transfer)**: Architectural style for APIs
- **GraphQL**: Query language for APIs
- **Webhook**: HTTP callback triggered by events
- **Rate Limiting**: Restricting number of API requests
- **Idempotent**: Operation producing same result regardless of repetition
- **HATEOAS (Hypermedia as Engine of Application State)**: REST constraint
- **OpenAPI**: Specification for describing REST APIs

---

## Version Control

- **PR (Pull Request)**: Proposed changes to repository
- **SHA (Secure Hash Algorithm)**: Unique identifier for Git commits
- **Branch Protection**: Rules preventing direct pushes to branches
- **Squash Merge**: Combining multiple commits into single commit
- **Rebase**: Moving branch to new base commit
- **Cherry-pick**: Applying specific commits to branch

---

## Notes

- This glossary is the authoritative source for term definitions
- Terms should be referenced consistently across all documentation
- When in doubt, refer to this glossary for correct usage
- Updates to definitions should be reflected here first

---

_For additional terms or clarifications, consult the lead agent for the relevant
domain._
