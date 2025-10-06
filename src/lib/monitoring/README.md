# 📊 Monitoring Infrastructure Documentation

## Overview

The Monitoring Infrastructure provides comprehensive quota tracking, performance monitoring, and alerting capabilities to keep the Okaeri Resort System within free tier limits while ensuring operational excellence. This module consists of 7 specialized monitoring modules totaling ~76KB of code.

## 🏗️ Module Architecture

```
monitoring/
├── alert-system.ts           # Central alert management (10KB)
├── bandwidth-monitor.ts       # Bandwidth usage tracking (8.6KB)
├── cleanup-monitor.ts         # Automated cleanup monitoring (13KB)
├── cron-monitor.ts           # Cron job health monitoring (14KB)
├── email-quota-monitor.ts    # Email quota tracking (13KB)
├── kv-quota-monitor.ts       # KV namespace quota tracking (9.8KB)
└── metrics-collector.ts      # Performance metrics collection (7.6KB)
```

## 📦 Module Documentation

### Alert System (`alert-system.ts`)

Central alert management system that coordinates alerts from all monitoring sources.

#### Features

1. **Alert Management**
   - Centralized alert registry
   - Alert level classification (info, warning, critical, resolved)
   - Alert acknowledgment and resolution tracking
   - Alert history with configurable retention

2. **Notification Channels**
   - Console logging (development)
   - Audit trail integration (production)
   - Email notifications (critical alerts)
   - Webhook support (external integrations)

3. **Threshold Monitoring**
   - Configurable metric thresholds
   - Automatic alert triggering
   - Escalation policies
   - De-duplication logic

#### Usage Example

```typescript
import { getAlertSystem } from '@/lib/monitoring/alert-system'

const alertSystem = getAlertSystem()

// Register a threshold
alertSystem.registerThreshold({
  metric: 'kv_writes',
  operator: 'gte',
  value: 800, // 80% of 1000 daily limit
  level: 'warning',
  message: 'KV writes approaching daily limit',
})

// Create an alert manually
await alertSystem.createAlert({
  source: 'bandwidth-monitor',
  level: 'critical',
  title: 'Bandwidth Limit Exceeded',
  message: 'Daily bandwidth usage has exceeded 90% of free tier limit',
  metadata: {
    current: 9.5,
    limit: 10,
    unit: 'GB',
  },
})

// Subscribe to alerts
alertSystem.subscribe((alert) => {
  if (alert.level === 'critical') {
    sendEmailNotification(alert)
  }
})

// Acknowledge an alert
await alertSystem.acknowledgeAlert(alertId)

// Resolve an alert
await alertSystem.resolveAlert(alertId)
```

#### Alert Types & Levels

```typescript
type AlertLevel = 'info' | 'warning' | 'critical' | 'resolved'

interface Alert {
  id: string
  source: string // Module that generated the alert
  level: AlertLevel
  title: string
  message: string
  metadata?: Record<string, any>
  timestamp: Date
  acknowledged: boolean
  resolvedAt?: Date
}
```

#### Alert Channels

```typescript
const channels: AlertChannel[] = [
  {
    name: 'console',
    type: 'console',
    enabled: process.env.NODE_ENV === 'development',
  },
  {
    name: 'audit',
    type: 'audit',
    enabled: true,
  },
  {
    name: 'email',
    type: 'email',
    enabled: true,
    config: {
      recipients: ['admin@okaeri-resort.com'],
      onlyForLevels: ['critical'],
    },
  },
]
```

### KV Quota Monitor (`kv-quota-monitor.ts`)

Tracks Cloudflare KV namespace operations against free tier limits.

#### Free Tier Limits

- **Daily Writes**: 1,000 operations/day
- **Daily Reads**: 100,000 operations/day
- **Warning Threshold**: 80% usage
- **Critical Threshold**: 95% usage

#### Features

1. **Operation Tracking**
   - Write/read/delete/list operations
   - Operation timestamps and sizes
   - 24-hour rolling window
   - Automatic cleanup of old data

2. **Usage Analytics**
   - Current usage percentage
   - Estimated cost (if exceeding free tier)
   - Usage trends and predictions
   - Peak usage identification

3. **Quota Protection**
   - Pre-write quota checks
   - Automatic rate limiting
   - Operation queuing when near limits
   - Alternative storage fallback

#### Usage Example

```typescript
import { KVQuotaMonitor } from '@/lib/monitoring/kv-quota-monitor'

const kvMonitor = new KVQuotaMonitor(KV_NAMESPACE)

// Track a write operation
await kvMonitor.trackOperation({
  type: 'write',
  key: 'booking:2024-001',
  timestamp: new Date(),
  size: 1024, // bytes
  ttl: 3600, // seconds
})

// Check current quota
const stats = await kvMonitor.getUsageStats()
console.log(`KV Writes: ${stats.writesCount}/${stats.writesLimit} (${stats.percentage}%)`)

if (stats.percentage > 90) {
  // Near limit - take action
  await kvMonitor.enableRateLimiting()
}

// Get detailed analytics
const analytics = await kvMonitor.getAnalytics()
console.log('Daily pattern:', analytics.dailyPattern)
console.log('Peak hours:', analytics.peakHours)
console.log('Projected usage:', analytics.projection)
```

#### Quota Enforcement

```typescript
// Pre-write quota check
async function safeKVWrite(key: string, value: string) {
  const canWrite = await kvMonitor.checkQuotaBeforeWrite()

  if (!canWrite) {
    // Use fallback storage or queue the operation
    await fallbackStorage.set(key, value)
    return { queued: true }
  }

  await KV.put(key, value)
  await kvMonitor.trackOperation({
    type: 'write',
    key,
    timestamp: new Date(),
  })

  return { success: true }
}
```

### Email Quota Monitor (`email-quota-monitor.ts`)

Tracks email sending against Resend free tier limits.

#### Free Tier Limits

- **Daily Emails**: 100 emails/day
- **Monthly Emails**: 3,000 emails/month
- **Rate Limit**: 10 emails/second

#### Features

1. **Email Tracking**
   - Email count per day/month
   - Recipient tracking
   - Email type categorization
   - Delivery status monitoring

2. **Smart Queuing**
   - Priority-based email queue
   - Rate limiting enforcement
   - Retry logic with exponential backoff
   - Failed email tracking

3. **Quota Management**
   - Daily/monthly quota checks
   - Warning alerts at 80% usage
   - Critical alerts at 95% usage
   - Automatic queue pause when limit reached

#### Usage Example

```typescript
import { EmailQuotaMonitor } from '@/lib/monitoring/email-quota-monitor'

const emailMonitor = new EmailQuotaMonitor()

// Check quota before sending
const canSend = await emailMonitor.canSendEmail()
if (!canSend) {
  // Queue for next day or notify user
  await emailMonitor.queueEmail({
    to: 'guest@example.com',
    subject: 'Booking Confirmation',
    priority: 'high',
  })
  return
}

// Track sent email
await emailMonitor.trackEmail({
  to: 'guest@example.com',
  subject: 'Booking Confirmation',
  type: 'transactional',
  sentAt: new Date(),
  status: 'delivered',
})

// Get quota status
const quota = await emailMonitor.getQuotaStatus()
console.log(`Daily: ${quota.daily.used}/${quota.daily.limit}`)
console.log(`Monthly: ${quota.monthly.used}/${quota.monthly.limit}`)
```

#### Email Prioritization

```typescript
// Priority levels for email queue
type EmailPriority = 'critical' | 'high' | 'normal' | 'low'

const PRIORITY_ORDER = {
  critical: 1, // Password resets, security alerts
  high: 2, // Booking confirmations, payment receipts
  normal: 3, // General notifications
  low: 4, // Marketing, newsletters
}

// Smart queue processing
async function processEmailQueue() {
  const emails = await emailMonitor.getQueuedEmails()
  const sorted = emails.sort((a, b) =>
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  )

  for (const email of sorted) {
    if (await emailMonitor.canSendEmail()) {
      await sendEmail(email)
      await emailMonitor.trackEmail(email)
    } else {
      break // Stop when quota reached
    }
  }
}
```

### Bandwidth Monitor (`bandwidth-monitor.ts`)

Tracks bandwidth usage to stay within hosting provider limits.

#### Monitoring Scope

- **API Requests**: Request/response payload sizes
- **File Uploads**: Receipt images, CSV imports
- **File Downloads**: Reports, exports
- **Static Assets**: Cached with CDN awareness

#### Features

1. **Traffic Analysis**
   - Request/response size tracking
   - Bandwidth by endpoint
   - Peak traffic identification
   - Trend analysis

2. **Optimization Recommendations**
   - Large payload identification
   - Compression opportunities
   - Caching suggestions
   - CDN optimization

3. **Cost Projection**
   - Bandwidth cost estimation
   - Free tier utilization
   - Overage predictions

#### Usage Example

```typescript
import { BandwidthMonitor } from '@/lib/monitoring/bandwidth-monitor'

const bandwidthMonitor = new BandwidthMonitor()

// Track request
await bandwidthMonitor.trackRequest({
  path: '/api/bookings',
  method: 'GET',
  requestSize: 512, // bytes
  responseSize: 15360, // 15KB
  timestamp: new Date(),
})

// Track file upload
await bandwidthMonitor.trackUpload({
  fileType: 'image/jpeg',
  size: 2048000, // 2MB
  compressed: true,
  compressionRatio: 0.6,
})

// Get usage stats
const stats = await bandwidthMonitor.getUsageStats()
console.log(`Total bandwidth: ${stats.total / (1024 * 1024)} MB`)
console.log(`Top endpoints:`, stats.topEndpoints)

// Get optimization suggestions
const suggestions = await bandwidthMonitor.getOptimizationSuggestions()
// Returns: [
//   { type: 'enable-compression', endpoint: '/api/reports', savings: '45%' },
//   { type: 'add-caching', endpoint: '/api/units', savings: '30%' }
// ]
```

### Cron Job Monitor (`cron-monitor.ts`)

Monitors scheduled task health and execution.

#### Features

1. **Job Execution Tracking**
   - Execution start/end times
   - Success/failure status
   - Error logging
   - Execution duration

2. **Health Checks**
   - Missed execution detection
   - Long-running job alerts
   - Failed job retry tracking
   - Execution pattern analysis

3. **Alerting**
   - Missed cron alerts
   - Failed job notifications
   - Performance degradation alerts

#### Usage Example

```typescript
import { CronMonitor } from '@/lib/monitoring/cron-monitor'

const cronMonitor = new CronMonitor()

// Register a cron job
cronMonitor.registerJob({
  id: 'cleanup-old-logs',
  name: 'Cleanup Old Audit Logs',
  schedule: '0 0 * * *', // Daily at midnight
  timeout: 300000, // 5 minutes
})

// Track execution
const executionId = await cronMonitor.startExecution('cleanup-old-logs')

try {
  await cleanupOldLogs()
  await cronMonitor.endExecution(executionId, 'success')
} catch (error) {
  await cronMonitor.endExecution(executionId, 'failed', error.message)
}

// Get job health
const health = await cronMonitor.getJobHealth('cleanup-old-logs')
console.log('Success rate:', health.successRate)
console.log('Avg duration:', health.avgDuration)
console.log('Last run:', health.lastRun)
```

### Cleanup Monitor (`cleanup-monitor.ts`)

Monitors and manages automated cleanup tasks.

#### Cleanup Tasks

1. **Audit Log Retention**
   - Delete logs older than 90 days
   - Archive critical logs
   - Compression of old logs

2. **File Storage Cleanup**
   - Remove orphaned files
   - Delete expired temp files
   - Cleanup failed uploads

3. **Database Cleanup**
   - Archive completed bookings
   - Remove soft-deleted records
   - Vacuum and optimize

#### Usage Example

```typescript
import { CleanupMonitor } from '@/lib/monitoring/cleanup-monitor'

const cleanupMonitor = new CleanupMonitor()

// Configure cleanup task
await cleanupMonitor.configureTask({
  id: 'audit-retention',
  name: 'Audit Log Retention',
  schedule: '0 2 * * 0', // Weekly at 2 AM Sunday
  action: async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    await db.auditLogs.deleteWhere({ createdAt: { lt: cutoff } })
  },
  dryRun: false,
})

// Execute cleanup
const result = await cleanupMonitor.executeCleanup('audit-retention')
console.log('Cleaned up:', result.recordsDeleted, 'records')
console.log('Space freed:', result.spaceFreed, 'MB')
```

### Metrics Collector (`metrics-collector.ts`)

Collects and aggregates performance metrics.

#### Metrics Collected

1. **Application Metrics**
   - Page load times
   - API response times
   - Database query durations
   - Error rates

2. **Business Metrics**
   - Booking conversion rate
   - Average booking value
   - Guest retention rate
   - Revenue trends

3. **Infrastructure Metrics**
   - Serverless function cold starts
   - Database connection pool usage
   - Cache hit rates
   - CDN performance

#### Usage Example

```typescript
import { MetricsCollector } from '@/lib/monitoring/metrics-collector'

const metrics = new MetricsCollector()

// Track metric
metrics.recordMetric({
  name: 'api.booking.create.duration',
  value: 245, // milliseconds
  tags: {
    method: 'POST',
    status: '200',
    cached: false,
  },
  timestamp: new Date(),
})

// Get aggregated metrics
const apiMetrics = await metrics.getMetrics('api.*', {
  from: startDate,
  to: endDate,
  aggregation: 'avg',
})

// Get percentiles
const p95 = await metrics.getPercentile('api.response.time', 95)
const p99 = await metrics.getPercentile('api.response.time', 99)
```

## 🚨 Alert Configuration

### Alert Thresholds

```typescript
// src/config/monitoring.ts
export const ALERT_THRESHOLDS = {
  // KV Quota
  kv_writes_warning: 800, // 80% of 1000
  kv_writes_critical: 950, // 95% of 1000

  // Email Quota
  email_daily_warning: 80, // 80% of 100
  email_daily_critical: 95, // 95% of 100

  // Bandwidth
  bandwidth_warning: 8, // 80% of 10GB
  bandwidth_critical: 9.5, // 95% of 10GB

  // Performance
  api_response_time_warning: 1000, // 1 second
  api_response_time_critical: 3000, // 3 seconds

  // Error Rate
  error_rate_warning: 0.01, // 1%
  error_rate_critical: 0.05, // 5%
}
```

### Alert Actions

```typescript
// Configure alert actions
alertSystem.configureActions({
  warning: [
    { type: 'audit', enabled: true },
    { type: 'console', enabled: true },
  ],
  critical: [
    { type: 'audit', enabled: true },
    { type: 'console', enabled: true },
    { type: 'email', enabled: true, recipients: ['admin@example.com'] },
    { type: 'webhook', url: process.env.SLACK_WEBHOOK_URL },
  ],
})
```

## 📊 Dashboard Integration

### Monitoring Dashboard Component

```tsx
// src/components/MonitoringDashboard.tsx
import { useMonitoringMetrics } from '@/hooks/useMonitoringMetrics'

export function MonitoringDashboard() {
  const {
    kvQuota,
    emailQuota,
    bandwidth,
    alerts
  } = useMonitoringMetrics()

  return (
    <div className="grid grid-cols-4 gap-4">
      <QuotaCard
        title="KV Writes"
        current={kvQuota.writes}
        limit={kvQuota.limit}
        status={kvQuota.status}
      />
      <QuotaCard
        title="Email Quota"
        current={emailQuota.daily}
        limit={100}
        status={emailQuota.status}
      />
      <QuotaCard
        title="Bandwidth"
        current={bandwidth.used}
        limit={bandwidth.limit}
        unit="GB"
        status={bandwidth.status}
      />
      <AlertSummary alerts={alerts} />
    </div>
  )
}
```

## 🔧 Integration Patterns

### Centralized Monitoring

```typescript
// src/lib/monitoring/index.ts
export class MonitoringService {
  private kvMonitor: KVQuotaMonitor
  private emailMonitor: EmailQuotaMonitor
  private bandwidthMonitor: BandwidthMonitor
  private cronMonitor: CronMonitor
  private alertSystem: AlertSystem

  async checkAllQuotas() {
    const [kv, email, bandwidth] = await Promise.all([
      this.kvMonitor.getUsageStats(),
      this.emailMonitor.getQuotaStatus(),
      this.bandwidthMonitor.getUsageStats(),
    ])

    // Check thresholds and create alerts
    if (kv.percentage > 80) {
      await this.alertSystem.createAlert({
        source: 'kv-monitor',
        level: kv.percentage > 95 ? 'critical' : 'warning',
        title: 'KV Quota Alert',
        message: `KV writes at ${kv.percentage}%`,
      })
    }

    return { kv, email, bandwidth }
  }
}
```

### Middleware Integration

```typescript
// functions/_middleware.ts
export async function onRequest(context) {
  const { request, next } = context
  const bandwidthMonitor = new BandwidthMonitor()

  const startTime = Date.now()
  const response = await next()
  const duration = Date.now() - startTime

  // Track bandwidth
  await bandwidthMonitor.trackRequest({
    path: new URL(request.url).pathname,
    method: request.method,
    requestSize: parseInt(request.headers.get('content-length') || '0'),
    responseSize: parseInt(response.headers.get('content-length') || '0'),
    duration,
    timestamp: new Date(),
  })

  return response
}
```

## 📚 Related Documentation

- [Alert System Architecture](/docs/monitoring/alert-system.md)
- [Quota Management Strategy](/docs/monitoring/quota-strategy.md)
- [Performance Monitoring](/docs/monitoring/performance.md)
- [API Monitoring](/functions/api/monitoring/README.md)
- [Security Monitoring](/src/lib/security/README.md)

## 🔧 Maintenance Notes

- Monitor module runs continuously in production
- Alert history is retained for 30 days
- Metrics are aggregated hourly and stored for 90 days
- Quota checks run every 5 minutes
- Critical alerts trigger immediate notifications
- Review quota usage weekly to optimize costs

## 📈 Future Enhancements

- [ ] Machine learning for anomaly detection
- [ ] Predictive quota usage forecasting
- [ ] Advanced visualization dashboards
- [ ] Integration with external monitoring services
- [ ] Automated scaling recommendations
- [ ] Custom metric definitions via UI
- [ ] Alert rule builder interface
