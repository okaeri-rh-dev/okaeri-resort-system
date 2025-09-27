# 🔐 Environment Variables Configuration Guide

## Overview

This guide provides comprehensive documentation for all environment variables used in the Okaeri Resort System. Proper configuration of these variables is critical for application security, performance, and functionality.

## 📋 Quick Reference

| Category        | Variable                    | Required | Environment |
| --------------- | --------------------------- | -------- | ----------- |
| **Supabase**    | `VITE_SUPABASE_URL`         | ✅       | All         |
| **Supabase**    | `VITE_SUPABASE_ANON_KEY`    | ✅       | All         |
| **Supabase**    | `SUPABASE_SERVICE_ROLE_KEY` | ✅       | Production  |
| **Application** | `VITE_APP_NAME`             | ✅       | All         |
| **Application** | `VITE_APP_ENV`              | ✅       | All         |
| **Application** | `NODE_ENV`                  | ✅       | All         |
| **Debug**       | `VITE_DEBUG`                | ❌       | Development |
| **Features**    | `VITE_ENABLE_*`             | ❌       | All         |

## 🗂️ Environment Files

### File Structure

```
.env                  # Shared environment variables (git-ignored)
.env.local           # Local development overrides (git-ignored)
.env.production      # Production environment (git-ignored)
.env.example         # Template file (committed to git)
```

### Loading Priority

Variables are loaded in the following order (later files override earlier ones):

1. `.env`
2. `.env.local`
3. `.env.[mode]` (e.g., `.env.production`)
4. Environment-specific system variables

## 🔑 Core Configuration

### Supabase Configuration

#### `VITE_SUPABASE_URL`

- **Required**: Yes
- **Type**: String (URL)
- **Description**: Your Supabase project URL
- **Example**: `https://xyzcompany.supabase.co`
- **Where to find**: Supabase Dashboard → Settings → API → Project URL

#### `VITE_SUPABASE_ANON_KEY`

- **Required**: Yes
- **Type**: String (JWT)
- **Description**: Public anonymous key for client-side Supabase access
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → anon/public

#### `SUPABASE_SERVICE_ROLE_KEY`

- **Required**: Yes (Production/API Routes)
- **Type**: String (JWT)
- **Description**: Service role key for server-side operations
- **Security**: ⚠️ **NEVER expose in client-side code**
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → service_role

### Application Configuration

#### `NODE_ENV`

- **Required**: Yes
- **Type**: `development` | `production` | `test`
- **Description**: Node.js environment mode
- **Default**: `development`
- **Impact**:
  - `production`: Optimizations enabled, debug disabled
  - `development`: Hot reload, debug tools enabled
  - `test`: Test utilities enabled

#### `VITE_APP_ENV`

- **Required**: Yes
- **Type**: `development` | `staging` | `production`
- **Description**: Application environment identifier
- **Usage**: Feature flags, API endpoints, logging levels

#### `VITE_APP_NAME`

- **Required**: Yes
- **Type**: String
- **Description**: Application display name
- **Default**: `Okaeri Resort System`
- **Usage**: Page titles, email templates, notifications

#### `VITE_APP_VERSION`

- **Required**: No
- **Type**: String (Semantic Version)
- **Description**: Application version for tracking
- **Example**: `0.0.1`
- **Auto-generated**: From `package.json` if not set

## 🚀 Feature Flags

### Core Features

#### `VITE_ENABLE_ANALYTICS`

- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable analytics tracking (Google Analytics, Mixpanel)
- **Production**: `true`

#### `VITE_ENABLE_PWA`

- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable Progressive Web App features
- **Features**: Offline mode, push notifications, app install

#### `VITE_ENABLE_REALTIME`

- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable Supabase realtime subscriptions
- **Impact**: Live updates for bookings, notifications

#### `VITE_ENABLE_WORKFLOWS`

- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable Phase 3-4 workflow automation features
- **Note**: Experimental features, not production-ready

### Development Features

#### `VITE_DEBUG`

- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable debug logging and development tools
- **Warning**: Never enable in production

#### `VITE_DEBUG_LEVEL`

- **Type**: `error` | `warn` | `info` | `debug` | `trace`
- **Default**: `warn`
- **Description**: Logging verbosity level

#### `VITE_SHOW_DEVTOOLS`

- **Type**: Boolean
- **Default**: `true` (in development)
- **Description**: Show React Query and Router devtools

## 🌐 API Configuration

### Internal APIs

#### `VITE_API_BASE_URL`

- **Type**: String (URL)
- **Description**: Base URL for API endpoints
- **Default**: `/api` (relative)
- **Production Example**: `https://okaeri-resort.vercel.app/api`

#### `VITE_API_TIMEOUT`

- **Type**: Number (milliseconds)
- **Default**: `10000`
- **Description**: API request timeout
- **Recommended**: `8000` for Philippine users

#### `VITE_API_RETRY_ATTEMPTS`

- **Type**: Number
- **Default**: `3`
- **Description**: Number of retry attempts for failed requests

### External Services

#### `VITE_STORAGE_URL`

- **Type**: String (URL)
- **Description**: External storage service URL (if not using Supabase Storage)
- **Optional**: Falls back to Supabase Storage

#### `VITE_CDN_URL`

- **Type**: String (URL)
- **Description**: CDN URL for static assets
- **Optional**: Improves asset loading performance

## 🔒 Security Configuration

### Authentication

#### `VITE_AUTH_REDIRECT_URL`

- **Type**: String (URL)
- **Description**: OAuth redirect URL after authentication
- **Example**: `https://okaeri-resort.vercel.app/auth/callback`

#### `VITE_AUTH_SESSION_DURATION`

- **Type**: Number (seconds)
- **Default**: `3600` (1 hour)
- **Description**: Session timeout duration

#### `VITE_AUTH_REFRESH_THRESHOLD`

- **Type**: Number (seconds)
- **Default**: `300` (5 minutes)
- **Description**: Time before session expiry to refresh token

### Security Headers

#### `VITE_CSP_POLICY`

- **Type**: String
- **Description**: Content Security Policy header
- **Example**: `default-src 'self'; script-src 'self' 'unsafe-inline';`

#### `VITE_ALLOWED_ORIGINS`

- **Type**: String (comma-separated)
- **Description**: CORS allowed origins
- **Example**: `https://okaeri-resort.vercel.app,https://app.okaeri.ph`

## 🌍 Localization

#### `VITE_DEFAULT_LOCALE`

- **Type**: String (ISO 639-1)
- **Default**: `en`
- **Description**: Default application language

#### `VITE_DEFAULT_TIMEZONE`

- **Type**: String (IANA timezone)
- **Default**: `Asia/Manila`
- **Description**: Default timezone for date/time operations

#### `VITE_DEFAULT_CURRENCY`

- **Type**: String (ISO 4217)
- **Default**: `PHP`
- **Description**: Default currency for financial operations

## 📊 Performance & Optimization

#### `VITE_CHUNK_SIZE_WARNING_LIMIT`

- **Type**: Number (KB)
- **Default**: `500`
- **Description**: Warning threshold for bundle chunk size

#### `VITE_IMAGE_OPTIMIZATION`

- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable automatic image optimization

#### `VITE_LAZY_LOAD_THRESHOLD`

- **Type**: Number (pixels)
- **Default**: `100`
- **Description**: Viewport threshold for lazy loading

## 🚦 Monitoring & Logging

#### `VITE_SENTRY_DSN`

- **Type**: String
- **Description**: Sentry error tracking DSN
- **Required for**: Production error monitoring

#### `VITE_SENTRY_ENVIRONMENT`

- **Type**: String
- **Description**: Sentry environment identifier
- **Example**: `production-ph`

#### `VITE_LOG_LEVEL`

- **Type**: `error` | `warn` | `info` | `debug`
- **Default**: `info`
- **Description**: Application logging level

## 📝 Example Configuration Files

### Development (.env.local)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Application
NODE_ENV=development
VITE_APP_ENV=development
VITE_APP_NAME="Okaeri Resort System (Dev)"
VITE_DEBUG=true
VITE_DEBUG_LEVEL=debug

# Features
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_PWA=false
VITE_ENABLE_REALTIME=true
VITE_ENABLE_WORKFLOWS=true

# API
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_TIMEOUT=30000

# Development Tools
VITE_SHOW_DEVTOOLS=true
```

### Production (.env.production)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Application
NODE_ENV=production
VITE_APP_ENV=production
VITE_APP_NAME="Okaeri Resort System"
VITE_DEBUG=false

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PWA=true
VITE_ENABLE_REALTIME=false
VITE_ENABLE_WORKFLOWS=false

# API
VITE_API_BASE_URL=https://okaeri-resort.vercel.app/api
VITE_API_TIMEOUT=8000
VITE_API_RETRY_ATTEMPTS=3

# Security
VITE_AUTH_REDIRECT_URL=https://okaeri-resort.vercel.app/auth/callback
VITE_ALLOWED_ORIGINS=https://okaeri-resort.vercel.app

# Monitoring
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production-ph
VITE_LOG_LEVEL=warn

# Localization
VITE_DEFAULT_LOCALE=en
VITE_DEFAULT_TIMEZONE=Asia/Manila
VITE_DEFAULT_CURRENCY=PHP

# Performance
VITE_CHUNK_SIZE_WARNING_LIMIT=500
VITE_IMAGE_OPTIMIZATION=true
VITE_LAZY_LOAD_THRESHOLD=100
```

## 🔍 Validation Script

```typescript
// scripts/validate-env.ts
const requiredEnvVars = {
  all: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_APP_NAME", "VITE_APP_ENV", "NODE_ENV"],
  production: ["SUPABASE_SERVICE_ROLE_KEY", "VITE_SENTRY_DSN", "VITE_AUTH_REDIRECT_URL"],
};

function validateEnv() {
  const missing = [];

  // Check required for all environments
  requiredEnvVars.all.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  // Check production-specific
  if (process.env.NODE_ENV === "production") {
    requiredEnvVars.production.forEach((key) => {
      if (!process.env[key]) {
        missing.push(key);
      }
    });
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables:\n${missing.join("\n")}`);
  }

  console.log("✅ Environment variables validated successfully");
}

validateEnv();
```

## ⚠️ Security Best Practices

1. **Never commit `.env` files** containing real credentials
2. **Use different credentials** for development and production
3. **Rotate keys regularly** especially service role keys
4. **Limit API key scope** to minimum required permissions
5. **Use secret management services** for production (Vercel Secrets, AWS Secrets Manager)
6. **Audit environment access** regularly
7. **Encrypt sensitive values** when possible
8. **Never log sensitive variables** in production

## 🚨 Common Issues

### Issue: Supabase connection fails

**Solution**: Verify URL format (should include `https://`) and key validity

### Issue: Features not working in production

**Solution**: Check feature flags are properly set in production environment

### Issue: API timeouts in production

**Solution**: Reduce `VITE_API_TIMEOUT` for better user experience

### Issue: Environment variables not loading

**Solution**: Ensure variable names start with `VITE_` for client-side access

## 📚 Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Environment Variables](https://supabase.com/docs/guides/functions/env-variables)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Security Best Practices](./SECURITY.md)
