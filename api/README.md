# 🚀 Okaeri Resort System - API Documentation

## Overview

This directory contains serverless API functions deployed to Vercel, providing backend services for the Okaeri Resort Management System.

## 📁 Directory Structure

```
api/
├── cron/                # Scheduled tasks and background jobs
├── health.ts           # System health monitoring endpoint
└── workflows.phase3-4/ # Business workflow APIs (Phase 3-4 features)
```

## 🔌 API Endpoints

### Health Check Endpoint

#### `GET /api/health`

System health monitoring and status check endpoint.

**Purpose**: Monitors application health, database connectivity, and system resources.

**Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00Z",
  "version": "0.0.1",
  "environment": "production",
  "checks": {
    "database": {
      "status": "connected",
      "latency": 45,
      "poolSize": 10,
      "activeConnections": 3
    },
    "storage": {
      "status": "available",
      "usage": "15%"
    },
    "memory": {
      "used": 256,
      "limit": 512,
      "percentage": 50
    }
  },
  "uptime": 86400,
  "region": "sin1"
}
```

**Status Codes**:
- `200 OK`: System is healthy
- `503 Service Unavailable`: One or more critical services are down
- `500 Internal Server Error`: Health check failed

**Usage Example**:
```typescript
// Health check monitoring
const checkHealth = async () => {
  try {
    const response = await fetch('/api/health')
    const data = await response.json()

    if (data.status !== 'healthy') {
      console.error('System unhealthy:', data.checks)
    }
  } catch (error) {
    console.error('Health check failed:', error)
  }
}
```

### Cron Jobs

#### `/api/cron/daily-tasks`

**Schedule**: Daily at 00:00 UTC (8:00 AM PHT)

**Tasks**:
- Clean up expired sessions
- Generate daily reports
- Send booking reminders
- Update availability calendars
- Archive old logs

**Security**: Protected by Vercel Cron secret

#### `/api/cron/hourly-sync`

**Schedule**: Every hour

**Tasks**:
- Sync booking statuses
- Update payment reconciliation
- Check for overdue payments
- Refresh cache data

### Workflow APIs (Phase 3-4)

#### `POST /api/workflows/booking-automation`

Automated booking workflow processing.

**Request Body**:
```json
{
  "action": "process_booking",
  "bookingId": "booking_123",
  "trigger": "guest_confirmation",
  "metadata": {
    "source": "web",
    "timestamp": "2024-01-20T10:30:00Z"
  }
}
```

**Workflow Actions**:
- `process_booking`: Complete booking workflow
- `send_confirmation`: Send booking confirmation
- `update_availability`: Sync availability across platforms
- `generate_invoice`: Create booking invoice

#### `POST /api/workflows/payment-processing`

Automated payment workflow handling.

**Request Body**:
```json
{
  "paymentId": "payment_456",
  "action": "verify_payment",
  "amount": 5000,
  "currency": "PHP",
  "method": "gcash"
}
```

## 🔒 Authentication & Security

### API Key Authentication

All API endpoints require authentication via API keys:

```typescript
headers: {
  'X-API-Key': process.env.API_KEY,
  'Content-Type': 'application/json'
}
```

### Rate Limiting

- **Default**: 100 requests per minute
- **Burst**: 20 requests per second
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### CORS Configuration

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400'
}
```

## 🛠 Development

### Local Development

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Run locally**:
```bash
vercel dev
```

3. **Environment variables**:
```bash
# .env.local
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
API_KEY=your_api_key
CRON_SECRET=your_cron_secret
```

### Testing API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# With authentication
curl -H "X-API-Key: your_api_key" \
     http://localhost:3000/api/workflows/booking-automation
```

## 📊 Monitoring

### Logging

All API functions log to Vercel's logging system:

```typescript
console.log('[API]', {
  endpoint: '/api/health',
  method: 'GET',
  timestamp: new Date().toISOString(),
  userId: user?.id,
  duration: performance.now() - startTime
})
```

### Error Tracking

Errors are automatically captured and reported:

```typescript
try {
  // API logic
} catch (error) {
  console.error('[API Error]', {
    endpoint: request.url,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })

  return new Response(JSON.stringify({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

## 🚀 Deployment

### Vercel Configuration

```json
{
  "functions": {
    "api/health.ts": {
      "maxDuration": 10,
      "memory": 256
    },
    "api/cron/*.ts": {
      "maxDuration": 60,
      "memory": 512
    },
    "api/workflows/*.ts": {
      "maxDuration": 30,
      "memory": 512
    }
  },
  "crons": [
    {
      "path": "/api/cron/daily-tasks",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/hourly-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Environment Variables

Required environment variables for production:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for server-side operations
- `API_KEY`: Internal API authentication key
- `CRON_SECRET`: Vercel cron job authentication secret
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `NODE_ENV`: Environment (production/development)

## 🐛 Common Issues & Troubleshooting

### Connection Timeout

**Issue**: API requests timing out

**Solution**:
1. Check Vercel function logs
2. Verify database connection pooling
3. Increase function timeout in vercel.json

### CORS Errors

**Issue**: Cross-origin requests blocked

**Solution**:
1. Verify ALLOWED_ORIGINS environment variable
2. Check OPTIONS preflight handling
3. Ensure proper headers in response

### Database Connection Errors

**Issue**: Cannot connect to database

**Solution**:
1. Verify SUPABASE_URL is correct
2. Check service role key validity
3. Ensure IP is whitelisted in Supabase

## 📚 Additional Resources

- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Supabase Server-side Auth](https://supabase.com/docs/guides/auth/server-side-auth)
- [API Best Practices](./docs/api/best-practices.md)
- [Error Handling Guide](./docs/api/error-handling.md)