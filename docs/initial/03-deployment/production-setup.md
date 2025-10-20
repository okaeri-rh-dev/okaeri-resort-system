# 🚀 Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Okaeri Resort System to production using Vercel, optimized for Philippine operations with focus on performance, security, and scalability.

## 📋 Pre-Deployment Checklist

### ✅ Code Quality

- [ ] **TypeScript Compilation**: `npm run type-check` passes
- [ ] **Linting**: `npm run lint` shows no errors
- [ ] **Build Test**: `npm run build` completes successfully
- [ ] **Bundle Size**: Check that chunks are < 500KB
- [ ] **Security Audit**: `npm audit` shows no high/critical vulnerabilities

### ✅ Database Preparation

- [ ] **Schema Updated**: All migrations applied
- [ ] **RLS Enabled**: Row Level Security policies active
- [ ] **Indexes Created**: Performance indexes in place
- [ ] **Backup Created**: Full database backup completed
- [ ] **Test Data Removed**: No test data in production tables

### ✅ Environment Configuration

- [ ] **Environment Variables**: All production variables set
- [ ] **API Keys**: Production keys generated and secured
- [ ] **CORS Origins**: Production domains configured
- [ ] **Feature Flags**: Production features properly toggled

## 🔧 Deployment Steps

### Step 1: Prepare Codebase

```bash
# 1. Ensure you're on the main branch
git checkout main
git pull origin main

# 2. Run comprehensive checks
npm run type-check
npm run lint
npm run build

# 3. Test production build locally
npm run preview

# 4. Create deployment tag
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0
```

### Step 2: Configure Vercel Project

#### Initial Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project (first time only)
vercel link

# Configure project settings
vercel env pull .env.production.local
```

#### Project Configuration

Create/update `vercel.json`:

```json
{
  "buildCommand": "npm run build:production",
  "outputDirectory": "dist",
  "framework": "vite",
  "regions": ["sin1", "hkg1"],
  "functions": {
    "api/health.ts": {
      "maxDuration": 10,
      "memory": 256
    },
    "api/workflows/*.ts": {
      "maxDuration": 30,
      "memory": 512
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, max-age=0"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ],
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    }
  ],
  "crons": [
    {
      "path": "/api/cron/daily-tasks",
      "schedule": "0 16 * * *"
    }
  ]
}
```

### Step 3: Set Environment Variables

#### Required Production Variables

```bash
# Set via Vercel CLI
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Or via Vercel Dashboard
# Project Settings → Environment Variables
```

#### Complete Variable List

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Application
NODE_ENV=production
VITE_APP_ENV=production
VITE_APP_NAME="Okaeri Resort System"
VITE_APP_URL=https://okaeri-resort.vercel.app

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PWA=true
VITE_ENABLE_REALTIME=false
VITE_ENABLE_WORKFLOWS=false

# API Configuration
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT=8000
API_KEY=[generated-api-key]
CRON_SECRET=[vercel-cron-secret]

# Monitoring
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_ENVIRONMENT=production-ph

# Regional Settings
VITE_DEFAULT_TIMEZONE=Asia/Manila
VITE_DEFAULT_CURRENCY=PHP
VITE_DEFAULT_LOCALE=en-PH
```

### Step 4: Database Configuration

#### Supabase Production Setup

1. **Enable RLS on all tables**:

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Verify RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

2. **Create production indexes**:

```sql
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bookings_project_status
ON bookings(project_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_dates
ON bookings(check_in, check_out);

CREATE INDEX IF NOT EXISTS idx_payments_booking
ON payments(booking_id);

CREATE INDEX IF NOT EXISTS idx_guests_email
ON guests(email);

-- Analyze tables for optimization
ANALYZE bookings;
ANALYZE payments;
ANALYZE guests;
```

3. **Set up connection pooling**:

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: "public",
  },
  global: {
    headers: {
      "x-application-name": "okaeri-resort",
    },
  },
});
```

### Step 5: Deploy to Vercel

#### Production Deployment

```bash
# Deploy to production
vercel --prod

# Or deploy with specific configuration
vercel --prod --build-env NODE_ENV=production

# Monitor deployment
vercel logs --prod
```

#### Deployment via GitHub

1. **Connect GitHub Repository**:
   - Go to Vercel Dashboard
   - Import Git Repository
   - Select your GitHub repo
   - Configure branch deployments

2. **Branch Configuration**:
   - Production Branch: `main`
   - Preview Branches: All other branches
   - Automatic Deployments: Enabled

3. **Deploy Hooks**:

```bash
# Create deploy hook
curl -X POST https://api.vercel.com/v1/integrations/deploy/xxx
```

## 🔍 Post-Deployment Verification

### Health Checks

```bash
# Check API health
curl https://okaeri-resort.vercel.app/api/health

# Expected response
{
  "status": "healthy",
  "environment": "production",
  "database": "connected"
}

# Check application
curl -I https://okaeri-resort.vercel.app

# Should return 200 OK
```

### Performance Verification

```javascript
// Run Lighthouse audit
npx lighthouse https://okaeri-resort.vercel.app \
  --output html \
  --view

// Target metrics:
// - Performance: > 90
// - Accessibility: > 95
// - Best Practices: > 95
// - SEO: > 90
```

### Security Verification

```bash
# Check security headers
curl -I https://okaeri-resort.vercel.app | grep -E "X-Frame-Options|X-Content-Type|Content-Security-Policy"

# SSL/TLS verification
nslookup okaeri-resort.vercel.app
openssl s_client -connect okaeri-resort.vercel.app:443
```

## 📊 Monitoring Setup

### Vercel Analytics

```typescript
// Enable Web Analytics
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Analytics />
      <SpeedInsights />
    </>
  )
}
```

### Error Tracking (Sentry)

```typescript
// Initialize Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV,
  integrations: [new Sentry.BrowserTracing(), new Sentry.Replay()],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### Custom Monitoring

```typescript
// Performance monitoring
const reportWebVitals = (metric: Metric) => {
  // Send to analytics
  if (window.gtag) {
    window.gtag("event", metric.name, {
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
    });
  }
};

// Database query monitoring
const monitorQuery = async (queryName: string, queryFn: () => Promise<any>) => {
  const start = performance.now();

  try {
    const result = await queryFn();
    const duration = performance.now() - start;

    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query: ${queryName} took ${duration}ms`);
    }

    return result;
  } catch (error) {
    // Report to error tracking
    Sentry.captureException(error, {
      tags: { query: queryName },
    });
    throw error;
  }
};
```

## 🔒 Security Best Practices

### API Security

```typescript
// API route protection
export default async function handler(req: Request) {
  // Verify API key
  const apiKey = req.headers.get("X-API-Key");
  if (apiKey !== process.env.API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for");
  if (await isRateLimited(ip)) {
    return new Response("Too Many Requests", { status: 429 });
  }

  // CORS validation
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Process request
  return handleRequest(req);
}
```

### Data Protection

```typescript
// Sanitize user input
import DOMPurify from "isomorphic-dompurify";

// Encrypt sensitive data
import { decrypt, encrypt } from "@/lib/crypto";

const sanitizeInput = (input: string) => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

const storeSecureData = async (data: SensitiveData) => {
  const encrypted = await encrypt(JSON.stringify(data));
  await supabase.from("secure_storage").insert({
    data: encrypted,
  });
};
```

## 🚦 Performance Optimization

### Edge Functions

```typescript
// Use edge functions for better latency
export const config = {
  runtime: "edge",
  regions: ["sin1", "hkg1"], // Singapore and Hong Kong
};

export default async function handler(req: Request) {
  // Handle request at edge
  return new Response("Hello from edge!");
}
```

### Caching Strategy

```typescript
// Cache static assets
export async function GET(request: Request) {
  const response = await fetch(request);

  // Cache for 1 hour
  response.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");

  return response;
}

// Cache API responses
const cacheKey = `bookings-${projectId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const data = await fetchBookings(projectId);
await redis.set(cacheKey, JSON.stringify(data), "EX", 300); // 5 minutes
```

### Bundle Optimization

```javascript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-popover"],
          utils: ["date-fns", "zod", "clsx"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
};
```

## 🔄 Rollback Procedures

### Quick Rollback

```bash
# Revert to previous deployment
vercel rollback

# Or specify deployment URL
vercel rollback https://okaeri-abc123.vercel.app

# List recent deployments
vercel ls
```

### Database Rollback

```sql
-- Keep rollback scripts ready
-- migrations/rollback/001_rollback_latest.sql

BEGIN;

-- Rollback specific changes
DROP TABLE IF EXISTS new_table;
ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;

-- Restore previous state
-- Include backup restoration if needed

COMMIT;
```

## 🎯 Regional Optimization

### Philippine-Specific Settings

```javascript
// Optimize for Philippine users
const philippineConfig = {
  // Use Singapore/Hong Kong regions
  regions: ["sin1", "hkg1"],

  // Timezone handling
  timezone: "Asia/Manila",

  // Local payment gateways
  paymentMethods: ["gcash", "maya", "bank_transfer"],

  // Local phone format
  phoneFormat: /^(\+63|0)\d{10}$/,

  // Business hours (PHT)
  businessHours: {
    start: "08:00",
    end: "18:00",
    timezone: "Asia/Manila",
  },
};
```

### CDN Configuration

```javascript
// Use regional CDN
const cdnConfig = {
  // Cloudflare for Asia-Pacific
  provider: "cloudflare",

  // Cache rules for static assets
  cacheRules: [
    {
      match: "/assets/*",
      ttl: 86400, // 24 hours
    },
    {
      match: "/images/*",
      ttl: 604800, // 7 days
    },
  ],

  // Compression
  compression: {
    brotli: true,
    gzip: true,
  },
};
```

## 📈 Scaling Considerations

### Database Scaling

```sql
-- Monitor connection usage
SELECT
  count(*) as connections,
  state
FROM pg_stat_activity
GROUP BY state;

-- Optimize slow queries
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Application Scaling

```javascript
// Implement connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Use read replicas for queries
const readReplica = createClient(process.env.READ_REPLICA_URL, process.env.SUPABASE_ANON_KEY);
```

## 🚨 Emergency Procedures

### Incident Response

1. **Immediate Actions**:
   - Enable maintenance mode
   - Notify stakeholders
   - Begin investigation

2. **Diagnosis**:

   ```bash
   # Check logs
   vercel logs --prod --since 1h

   # Check metrics
   vercel inspect [deployment-url]
   ```

3. **Resolution**:
   - Apply fix
   - Test thoroughly
   - Deploy carefully
   - Monitor closely

### Maintenance Mode

```typescript
// Enable maintenance mode
export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Scheduled Maintenance</h1>
        <p className="mt-2 text-muted-foreground">
          We'll be back shortly. Thank you for your patience.
        </p>
      </div>
    </div>
  )
}

// Redirect all routes to maintenance
if (process.env.MAINTENANCE_MODE === 'true') {
  return <MaintenancePage />
}
```

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Security Guidelines](../SECURITY.md)
- [Performance Optimization](../PERFORMANCE.md)
- [Disaster Recovery Plan](./DISASTER_RECOVERY.md)
