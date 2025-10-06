# ⏰ Scheduled Tasks (Cron Jobs) Documentation

## Overview

The Cron Jobs module provides **automated scheduled tasks** for the Okaeri Resort System using Cloudflare Workers Cron Triggers. These serverless scheduled functions handle cleanup, monitoring, and maintenance operations automatically, ensuring system health and data integrity while staying within free tier limits.

## 🏗️ Cron Jobs Architecture

```
cron/
└── cleanup-guest-bookings.ts    # Clean up expired pending bookings (4KB, ~120 lines)
```

## 📋 Scheduled Tasks

### Cleanup Guest Bookings

**Schedule**: Every 6 hours (`0 */6 * * *`)

Automatically removes expired pending guest bookings that haven't been confirmed.

#### Purpose

- Clean up abandoned bookings (pending > 24 hours)
- Free up unit availability
- Maintain database cleanliness
- Send notifications for expired bookings

#### Implementation

```typescript
export async function scheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const supabase = createSupabaseAdmin(env)
  const resend = createResendClient(env.RESEND_API_KEY)

  try {
    // 1. Find expired pending bookings (> 24 hours old)
    const expirationTime = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const { data: expiredBookings } = await supabase
      .from('bookings')
      .select('*, guest:guests(*), unit:units(*)')
      .eq('status', 'pending')
      .lt('created_at', expirationTime.toISOString())

    if (!expiredBookings || expiredBookings.length === 0) {
      console.log('No expired bookings to clean up')
      return
    }

    // 2. Update bookings to 'expired' status
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'expired' })
      .in('booking_id', expiredBookings.map(b => b.booking_id))

    if (error) throw error

    // 3. Send expiration notifications
    for (const booking of expiredBookings) {
      try {
        await resend.emails.send({
          from: 'Okaeri Resort <bookings@okaeri-resort.com>',
          to: booking.guest.email,
          subject: 'Booking Expired',
          html: `
            <p>Dear ${booking.guest_name},</p>
            <p>Your booking ${booking.booking_reference} has expired due to incomplete payment verification.</p>
            <p>If you would like to rebook, please visit our website.</p>
          `
        })
      } catch (emailError) {
        console.error(`Failed to send expiration email for ${booking.booking_id}:`, emailError)
      }
    }

    // 4. Log cleanup action
    await logAuditEvent({
      action: 'cron.cleanup_expired_bookings',
      entity_type: 'booking',
      changes: {
        before: null,
        after: { count: expiredBookings.length }
      },
      metadata: {
        booking_ids: expiredBookings.map(b => b.booking_id),
        scheduled_time: event.scheduledTime
      }
    })

    console.log(`Cleaned up ${expiredBookings.length} expired bookings`)
  } catch (error) {
    console.error('Cleanup cron error:', error)
    throw error  // Will be logged by Cloudflare
  }
}
```

#### Configuration

```toml
# wrangler.toml
[triggers]
crons = [
  "0 */6 * * *"  # Every 6 hours
]
```

#### Features

- **Automatic expiration**: 24-hour grace period for pending bookings
- **Email notifications**: Notify guests of expiration
- **Audit logging**: Track all cleanup operations
- **Error handling**: Graceful failure with logging
- **Batch processing**: Handles multiple expired bookings efficiently

## 🎯 Future Scheduled Tasks

### Planned Cron Jobs

```typescript
// 1. Daily quota check (every morning)
// Schedule: 0 8 * * *
async function dailyQuotaCheck(env: Env) {
  const quotas = await checkAllQuotas(env)
  if (quotas.kv.percentage > 80 || quotas.email.percentage > 80) {
    await sendQuotaAlert(quotas)
  }
}

// 2. Weekly reports (Sunday midnight)
// Schedule: 0 0 * * 0
async function weeklyReport(env: Env) {
  const stats = await generateWeeklyStats()
  await sendWeeklyReport(stats)
}

// 3. Audit log cleanup (monthly)
// Schedule: 0 0 1 * *
async function cleanupOldAuditLogs(env: Env) {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)  // 90 days
  await deleteAuditLogs({ createdBefore: cutoff })
}

// 4. Database maintenance (daily)
// Schedule: 0 3 * * *
async function dailyMaintenance(env: Env) {
  await vacuumDatabase()
  await updateStatistics()
  await reindexTables()
}

// 5. Booking reminders (daily)
// Schedule: 0 9 * * *
async function sendBookingReminders(env: Env) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const upcomingBookings = await getBookingsCheckinDate(tomorrow)

  for (const booking of upcomingBookings) {
    await sendCheckinReminder(booking)
  }
}
```

## 🔐 Security Considerations

### Cron Trigger Authentication

```typescript
// Verify cron trigger authenticity
export async function scheduled(event: ScheduledEvent, env: Env) {
  // Cloudflare automatically authenticates cron triggers
  // No additional auth needed for scheduled() function

  // However, if creating HTTP-triggered cron fallback:
  const cronSecret = env.CRON_SECRET_KEY
  const providedSecret = request.headers.get('X-Cron-Secret')

  if (providedSecret !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }
}
```

### Error Handling

```typescript
try {
  await performCleanup()
} catch (error) {
  // Log to monitoring system
  await logError({
    source: 'cron.cleanup',
    error: error.message,
    timestamp: new Date()
  })

  // Send alert if critical
  if (isCriticalError(error)) {
    await sendAlertToAdmin(error)
  }

  // Re-throw to mark cron as failed in Cloudflare
  throw error
}
```

## 📊 Monitoring Cron Jobs

### Cloudflare Dashboard

Monitor cron execution in Cloudflare Workers dashboard:
- Execution count
- Success/failure rate
- Execution duration
- Error logs

### Custom Monitoring

```typescript
// Track cron execution
await logAuditEvent({
  action: 'cron.executed',
  entity_type: 'system',
  metadata: {
    job: 'cleanup-guest-bookings',
    scheduled_time: event.scheduledTime,
    execution_time: Date.now(),
    duration: executionDuration,
    records_processed: count,
    status: 'success'
  }
})
```

## 🧪 Testing Cron Jobs

### Local Testing

```bash
# Trigger cron manually
wrangler dev --test-scheduled

# Or use HTTP endpoint for testing
curl -X POST http://localhost:8787/__scheduled?cron=0+*/6+*+*+*
```

### Integration Testing

```typescript
describe('Cleanup Cron', () => {
  it('expires pending bookings after 24 hours', async () => {
    // Create test booking
    const oldBooking = await createTestBooking({
      status: 'pending',
      created_at: new Date(Date.now() - 25 * 60 * 60 * 1000)  // 25 hours ago
    })

    // Run cron
    await scheduled({
      scheduledTime: Date.now(),
      cron: '0 */6 * * *'
    }, env)

    // Verify expiration
    const updated = await getBooking(oldBooking.booking_id)
    expect(updated.status).toBe('expired')
  })

  it('sends expiration notification', async () => {
    const booking = await createExpiredBooking()
    await scheduled(mockEvent, env)

    expect(mockResend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: booking.guest.email,
        subject: expect.stringContaining('Expired')
      })
    )
  })
})
```

## 📚 Related Documentation

- [Serverless Functions](/functions/README.md) - Cloudflare Workers overview
- [API Endpoints](/functions/api/README.md) - API documentation
- [Monitoring System](/src/lib/monitoring/README.md) - Quota monitoring
- [Audit Trail](/src/components/audit/README.md) - Audit logging

## 🎨 Best Practices

1. ✅ **Idempotent operations** - Crons may run multiple times
2. ✅ **Batch processing** - Handle multiple records efficiently
3. ✅ **Error logging** - Log all errors for debugging
4. ✅ **Graceful failures** - Don't block on single record failures
5. ✅ **Audit trail** - Log all cron executions
6. ✅ **Notifications** - Alert on critical failures
7. ✅ **Monitoring** - Track execution metrics
8. ✅ **Testing** - Test cron logic thoroughly
9. ✅ **Documentation** - Document schedule and purpose
10. ✅ **Cleanup** - Remove old logs and data

## 🔧 Configuration

### Schedule Patterns

```bash
# Every 6 hours
0 */6 * * *

# Daily at 2 AM
0 2 * * *

# Weekly on Sunday at midnight
0 0 * * 0

# Monthly on 1st at midnight
0 0 1 * *

# Every 15 minutes
*/15 * * * *
```

### Environment Variables

```bash
# Supabase
SUPABASE_SERVICE_ROLE_KEY=xxx

# Email
RESEND_API_KEY=xxx

# Cron Configuration
CLEANUP_GRACE_PERIOD_HOURS=24
MAX_RECORDS_PER_RUN=100
```

## 📈 Performance Considerations

- **Batch size**: Process max 100 records per run
- **Execution time**: Keep under 30 seconds (Cloudflare limit)
- **Database queries**: Use indexes for efficiency
- **Email sending**: Batch or queue for large volumes
- **Error recovery**: Continue processing on single failures
