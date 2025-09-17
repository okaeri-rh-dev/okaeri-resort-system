# Environment Variables Guide

## Overview

This guide documents the environment variable management system implemented in
the Okaeri Resort System. The system uses a unified approach to handle
environment variables safely in both browser and server contexts, preventing
common errors like "process is not defined" in client-side code.

## Architecture

### Core Module: `src/lib/env-client.ts`

The `env-client.ts` module provides a unified interface for accessing
environment variables across different execution contexts:

- **Browser Context**: Uses Vite's `import.meta.env`
- **Server Context**: Uses Node.js `process.env`
- **Test Context**: Uses Node.js `process.env` with test-specific defaults

### Key Features

1. **Context-Aware Access**: Automatically detects execution environment
2. **Type Safety**: Full TypeScript definitions for all environment variables
3. **Security**: Prevents server-only variables from being accessed in browser
4. **Lazy Initialization**: Database connections only initialize when needed
5. **Validation**: Runtime validation with helpful error messages

## Environment Variable Categories

### Client-Safe Variables (VITE\_ Prefix)

These variables are exposed to the browser and must be prefixed with `VITE_`:

```typescript
// Application Configuration
VITE_API_URL; // API endpoint URL
VITE_APP_URL; // Application base URL
VITE_PUBLIC_URL; // Public assets URL
VITE_APP_VERSION; // Application version

// Feature Flags
VITE_ENABLE_MONITORING; // Enable performance monitoring
VITE_ENABLE_PWA; // Enable PWA features
VITE_MOCK_AUTH; // Use mock authentication
VITE_USE_MOCKS; // Use mock API responses

// Third-Party Services
VITE_SENTRY_DSN; // Sentry error tracking
VITE_UPSTASH_REDIS_REST_URL; // Redis cache URL
VITE_UPSTASH_REDIS_REST_TOKEN; // Redis authentication
```

### Server-Only Variables

These variables are NEVER exposed to the browser for security:

```typescript
// Database
DATABASE_URL; // PostgreSQL connection string
DATABASE_POOL_URL; // Connection pool URL

// Authentication & Security
JWT_SECRET; // JWT signing secret
JWT_REFRESH_SECRET; // Refresh token secret
NEXTAUTH_SECRET; // NextAuth.js secret
NEXTAUTH_URL; // NextAuth.js URL

// Email Configuration
SMTP_HOST; // Email server host
SMTP_PORT; // Email server port
SMTP_USER; // Email username
SMTP_PASSWORD; // Email password

// Reserved for future internal integrations
// (No external payment providers in internal-only system)

// Monitoring & Alerts
SLACK_WEBHOOK_URL; // Slack notifications
ALERT_WEBHOOK_URL; // Custom alert webhook
WEBHOOK_AUTH_TOKEN; // Webhook authentication
VAPID_PUBLIC_KEY; // Push notification key
VAPID_PRIVATE_KEY; // Push notification secret

// Storage
R2_ACCOUNT_ID; // Cloudflare R2 account
R2_ACCESS_KEY_ID; // R2 access key
R2_SECRET_ACCESS_KEY; // R2 secret key
R2_BUCKET_NAME; // R2 bucket name
```

## Usage Patterns

### Basic Usage

```typescript
import { isDevelopment, isProduction, getEnvVar } from "@/lib/env-client";

// Check environment mode
if (isDevelopment()) {
  console.log("Running in development mode");
}

// Get an environment variable with fallback
const apiUrl = getEnvVar("VITE_API_URL", "/api");

// Get a required variable (throws if missing)
const dbUrl = requireEnvVar("DATABASE_URL");
```

### Using the clientEnv Object

```typescript
import { clientEnv } from "@/lib/env-client";

// Access pre-configured values
const apiEndpoint = clientEnv.apiUrl;
const isMonitoringEnabled = clientEnv.enableMonitoring;

// Check execution context
if (clientEnv.isBrowser) {
  // Browser-specific code
} else if (clientEnv.isServer) {
  // Server-specific code
}
```

### Database Connection Pattern

The database connection uses lazy initialization with Proxy to prevent browser
errors:

```typescript
// src/lib/db/connection.ts
import { isServer } from "../env-client";

// Database exports are Proxies that throw errors in browser
export const db = createLazyProxy(
  () => DatabaseConnection.getInstance().getDrizzle(),
  "Database is not available in browser environment"
);

// Usage in server-side code
import { db } from "@/lib/db";

// This will work on server, throw on client
const users = await db.select().from(usersTable);
```

### Conditional Imports for Server Modules

```typescript
// Only import server modules when on server
if (isServer) {
  const { db } = await import("@/lib/db");
  // Use database
}
```

## Migration Guide

### Before (Old Pattern)

```typescript
// ❌ Will cause "process is not defined" error in browser
if (process.env.NODE_ENV === "development") {
  console.log("Dev mode");
}

const apiUrl = process.env.REACT_APP_API_URL || "/api";
```

### After (New Pattern)

```typescript
// ✅ Works in both browser and server
import { isDevelopment, getEnvVar } from "@/lib/env-client";

if (isDevelopment()) {
  console.log("Dev mode");
}

const apiUrl = getEnvVar("VITE_API_URL", "/api");
```

## Configuration Files

### `.env.example`

```bash
# Database (Server-only)
DATABASE_URL=postgresql://user:pass@localhost:5432/okaeri

# Authentication (Server-only)
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# Application (Client-safe with VITE_ prefix)
VITE_API_URL=/api
VITE_APP_URL=http://localhost:3000
VITE_ENABLE_MONITORING=true
VITE_ENABLE_PWA=true

# Third-party services
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### `vite.config.ts`

The Vite configuration includes polyfills for edge cases:

```typescript
define: {
  __DEV__: JSON.stringify(process.env.NODE_ENV === "development"),
  'typeof process': JSON.stringify('undefined'),
  'typeof process.env': JSON.stringify('undefined'),
}
```

## Testing

### Unit Tests

```typescript
// Mock environment variables in tests
vi.mock("@/lib/env-client", () => ({
  isDevelopment: () => true,
  isProduction: () => false,
  getEnvVar: (key: string, fallback?: string) => {
    const mocks = {
      VITE_API_URL: "http://localhost:3001",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    };
    return mocks[key] || fallback;
  },
}));
```

### Integration Tests

Test files run in Node.js and can access `process.env` directly:

```typescript
// src/test/setup.ts
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
```

## Troubleshooting

### Common Issues

1. **"process is not defined" error**
   - Ensure you're using `env-client` helpers instead of direct `process.env`
   - Check that database code isn't being imported in browser context

2. **Environment variable is undefined**
   - Verify the variable name matches exactly (case-sensitive)
   - For client variables, ensure they have `VITE_` prefix
   - Check that `.env` file is loaded correctly

3. **Database connection fails in browser**
   - This is expected behavior - database should only be accessed server-side
   - Use API routes for database operations from the client

### Debug Helpers

```typescript
import { clientEnv } from "@/lib/env-client";

// Log current environment
console.log("Environment:", {
  mode: clientEnv.mode,
  isBrowser: clientEnv.isBrowser,
  isServer: clientEnv.isServer,
  isDevelopment: clientEnv.isDevelopment,
});

// Check if a variable is available
const hasDatabase = !!getEnvVar("DATABASE_URL");
console.log("Database available:", hasDatabase);
```

## Best Practices

1. **Always use the env-client module** for environment variable access
2. **Prefix client variables with VITE\_** to make them available in browser
3. **Never expose secrets** to the client (JWT_SECRET, API keys, etc.)
4. **Use TypeScript types** for better IDE support and type safety
5. **Validate required variables** early in application startup
6. **Document all environment variables** in `.env.example`
7. **Use descriptive variable names** that indicate their purpose
8. **Group related variables** with common prefixes (e.g., `SMTP_*` for email)

## Security Considerations

- Server-only variables are never bundled into client code
- Database connections throw errors if accessed from browser
- Sensitive operations should always happen in API routes
- Use environment-specific values for different deployments
- Rotate secrets regularly and update environment variables

## Related Documentation

- [Database Connection Guide](./NEON_CONNECTION_POOLING.md)
- [Security Implementation Guide](../security/SECURITY_IMPLEMENTATION_GUIDE.md)
- [API Route Patterns](./SIMPLE_API_EXAMPLES.md)
- [Testing Configuration](./DETERMINISTIC_TEST_CONFIGURATION.md)
