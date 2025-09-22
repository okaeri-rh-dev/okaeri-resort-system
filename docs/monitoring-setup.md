# Health Monitoring Setup Guide

## Overview

This guide explains how to set up comprehensive health monitoring for the Okaeri Resort System using the `/api/health` endpoint.

## Health Endpoint Features

### 🔍 **Endpoint Details**

- **URL**: `/api/health`
- **Method**: `GET`
- **Response Time Target**: <500ms
- **Status Codes**:
  - `200` - Healthy
  - `503` - Unhealthy
  - `405` - Method not allowed

### 📊 **Response Format**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.0.1",
  "environment": "production",
  "services": {
    "database": {
      "status": "connected",
      "responseTime": 45
    },
    "storage": {
      "status": "connected",
      "responseTime": 23
    }
  },
  "uptime": 3600000,
  "system": {
    "memory": {
      "used": 50,
      "total": 128
    },
    "nodejs": "v20.x.x",
    "platform": "linux"
  }
}
```

### 🔧 **Service Checks**

1. **Database Connectivity**
   - Tests Supabase PostgreSQL connection
   - Uses lightweight query to `information_schema.tables`
   - Reports connection time and status

2. **Storage Connectivity** (Optional)
   - Tests Supabase Storage access
   - Lists buckets as connectivity test
   - Reports storage response time

3. **System Information**
   - Memory usage (heap used/total)
   - Node.js version
   - Platform information
   - Function uptime

## UptimeRobot Configuration

### 📋 **Monitor Setup**

1. **Create HTTP Monitor**

   ```
   Monitor Type: HTTP(s)
   Friendly Name: Okaeri Resort System - Health
   URL: https://your-domain.vercel.app/api/health
   Monitoring Interval: 1 minute
   ```

2. **Advanced Settings**

   ```
   HTTP Method: GET
   Timeout: 5 seconds
   Follow Redirects: Yes
   Custom HTTP Headers:
     User-Agent: UptimeRobot-Monitor
   ```

3. **Keyword Monitoring** (Optional)
   ```
   Keyword Type: Exists
   Keyword: "healthy"
   ```

### 🚨 **Alert Configuration**

```
Alert Contacts:
- Email: admin@your-resort.com
- SMS: +63-xxx-xxx-xxxx (Philippine number)
- Slack: #alerts channel

Alert When:
- Monitor goes down (status becomes "unhealthy")
- Monitor goes up (status becomes "healthy")

Alert Threshold:
- Send alert after 2 consecutive failures
- Send recovery alert after 1 successful check
```

### 🌏 **Regional Monitoring**

Set up monitors from multiple regions:

```
Primary: Singapore (closest to Philippines)
Secondary: Hong Kong
Tertiary: Tokyo
```

## Vercel Analytics Integration

### 📈 **Setup Steps**

1. **Enable Analytics in Vercel Dashboard**

   ```bash
   # In your vercel.json, analytics are auto-enabled
   # No additional configuration needed
   ```

2. **Custom Events** (Optional)

   ```typescript
   // Add to health endpoint for custom tracking
   import { track } from "@vercel/analytics";

   track("health_check", {
     status: response.status,
     responseTime: totalResponseTime,
     environment: nodeEnv,
   });
   ```

3. **Monitoring Dashboard**
   - View function invocations
   - Monitor response times
   - Track error rates
   - Analyze geographic usage

## Performance Monitoring

### ⚡ **Response Time Headers**

The health endpoint includes performance headers:

```
X-Response-Time: 120ms
X-Database-Time: 45ms
X-Storage-Time: 23ms
```

### 📊 **Performance Targets**

| Metric              | Target | Warning | Critical |
| ------------------- | ------ | ------- | -------- |
| Total Response Time | <500ms | <1000ms | >1000ms  |
| Database Check      | <100ms | <300ms  | >500ms   |
| Storage Check       | <200ms | <500ms  | >1000ms  |
| Memory Usage        | <80MB  | <120MB  | >150MB   |

## Environment Configuration

### 🔑 **Required Environment Variables**

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Application Configuration
NODE_ENV=production
npm_package_version=0.0.1
```

### 🌍 **Environment-Specific Settings**

**Production:**

- Monitor every 1 minute
- Alert after 3 consecutive failures
- 5-second timeout

**Staging:**

- Monitor every 5 minutes
- Alert after 2 consecutive failures
- 5-second timeout

**Development:**

- Monitor every 10 minutes
- Alert after 1 failure
- 10-second timeout

## Troubleshooting

### 🔍 **Common Issues**

1. **Database Connection Failures**

   ```
   Status: 503
   Error: "Missing Supabase configuration"

   Solution: Check environment variables
   ```

2. **Slow Response Times**

   ```
   X-Response-Time: >1000ms

   Causes:
   - Cold start (first request after idle)
   - Database connectivity issues
   - Supabase regional latency
   ```

3. **Memory Issues**

   ```
   system.memory.used > 100MB

   Solution:
   - Review function memory allocation
   - Check for memory leaks
   - Optimize database queries
   ```

### 📝 **Debug Logs**

Check Vercel function logs:

```bash
vercel logs your-deployment-url
```

Look for:

- Database connection errors
- Timeout issues
- Memory warnings
- Performance metrics

## Alerting Best Practices

### 🔔 **Alert Hierarchy**

1. **Critical Alerts** (Immediate Response)
   - Health endpoint returns 503
   - Response time >2 seconds
   - Database completely unavailable

2. **Warning Alerts** (Monitor Closely)
   - Response time >500ms but <1000ms
   - Memory usage >80MB
   - Storage connectivity issues

3. **Info Alerts** (Awareness Only)
   - Function cold starts
   - Version deployments
   - Scheduled maintenance

### 📱 **Philippine Business Hours**

Configure alerts considering Philippine timezone (UTC+8):

```
Business Hours: 8 AM - 10 PM Manila Time
Peak Season: March-May, December-January
High Traffic: Weekends and holidays
```

### 🔄 **Escalation Process**

1. **Tier 1**: Automated alerts to development team
2. **Tier 2**: After 5 minutes, alert operations team
3. **Tier 3**: After 15 minutes, alert management
4. **Tier 4**: After 30 minutes, activate backup systems

## Cost Considerations

### 💰 **Monitoring Costs**

**UptimeRobot:**

- Free plan: 50 monitors, 5-minute intervals
- Pro plan: $7/month for 1-minute intervals

**Vercel Analytics:**

- Included with Pro plan ($20/month)
- Custom events: First 100k free

**Estimated Monthly Cost:**

- UptimeRobot Pro: $7
- Vercel Pro (if not already): $20
- **Total: ~$27/month for comprehensive monitoring**

### 📊 **ROI Calculation**

For a resort business:

- Average booking value: ₱5,000-15,000
- Downtime cost per hour: ~₱10,000-30,000
- Monitoring cost: ₱1,350/month
- **Break-even: Preventing 1 hour of downtime every 2-3 months**

## Next Steps

1. ✅ Deploy health endpoint to production
2. ⚙️ Configure UptimeRobot monitors
3. 📊 Set up Vercel Analytics
4. 🚨 Test alert configurations
5. 📈 Create monitoring dashboard
6. 🔄 Schedule regular health reviews

---

**Need Help?**

- Check [Vercel Documentation](https://vercel.com/docs)
- Review [UptimeRobot Guides](https://uptimerobot.com/help/)
- Contact support: admin@your-resort.com
