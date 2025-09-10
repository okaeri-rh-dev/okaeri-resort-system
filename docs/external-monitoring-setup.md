# External Monitoring Setup Guide - Phase 5.5

## Overview

This document provides step-by-step instructions for setting up external
monitoring for the Okaeri Resort System using Uptime Robot and other monitoring
services. External monitoring is crucial for detecting issues before staff
notice them.

**Target Services**:

- Uptime Robot (Primary uptime monitoring)
- Vercel Analytics (Built-in performance monitoring)
- Health check endpoint validation

---

## Uptime Robot Configuration

### 1. Account Setup

#### Step 1: Create Uptime Robot Account

1. Go to [https://uptimerobot.com](https://uptimerobot.com)
2. Click **"Sign Up for Free"**
3. Use resort management email: `operations@okaeriresort.com` (or equivalent)
4. Verify email address
5. Complete account setup

#### Step 2: Account Configuration

- **Account Name**: Okaeri Resort System Monitoring
- **Timezone**: Asia/Manila (Philippine Time)
- **Default Notification Email**: Primary operations email

### 2. Monitor Configuration

#### Primary Application Monitor

**Monitor Type**: HTTP(s)  
**Friendly Name**: `Okaeri Resort System - Main App`  
**URL**: `https://okaeri-resort.vercel.app/` (production URL)  
**Monitoring Interval**: 5 minutes  
**Monitor Timeout**: 30 seconds  
**HTTP Method**: GET  
**Expected Status Code**: 200

#### Health Check Monitor

**Monitor Type**: HTTP(s)  
**Friendly Name**: `Okaeri Resort System - Health Check`  
**URL**: `https://okaeri-resort.vercel.app/api/health-check`  
**Monitoring Interval**: 5 minutes  
**Monitor Timeout**: 15 seconds  
**HTTP Method**: GET  
**Expected Status Code**: 200  
**Keyword Monitoring**: Enable  
**Keyword to Monitor**: `"status":"healthy"`

#### Authentication API Monitor

**Monitor Type**: HTTP(s)  
**Friendly Name**: `Okaeri Resort System - Auth API`  
**URL**: `https://okaeri-resort.vercel.app/api/auth/login`  
**Monitoring Interval**: 10 minutes  
**Monitor Timeout**: 20 seconds  
**HTTP Method**: POST  
**Expected Status Code**: 400 (validation error expected with empty body)

### 3. Alerting Configuration

#### Alert Contact Setup

1. **Primary Contact** (Immediate alerts):
   - **Type**: Email
   - **Email**: operations@okaeriresort.com
   - **Name**: Operations Team
   - **Enable for**: Up/Down notifications

2. **Secondary Contact** (Management):
   - **Type**: Email
   - **Email**: manager@okaeriresort.com
   - **Name**: Resort Management
   - **Enable for**: Down notifications only

3. **SMS Alerts** (Critical only):
   - **Type**: SMS
   - **Phone**: +63-XXX-XXX-XXXX (operations phone)
   - **Enable for**: Down notifications after 2 failed checks

#### Alert Rules

1. **Immediate Email Alert**:
   - **Trigger**: Service down (first failure)
   - **Recipients**: Operations Team
   - **Message**: "🚨 URGENT: Okaeri Resort System is DOWN - {monitor_name}
     failed"

2. **Management Alert**:
   - **Trigger**: Service down for 10+ minutes
   - **Recipients**: Resort Management
   - **Message**: "⚠️ SERVICE OUTAGE: Resort system has been down for 10+
     minutes"

3. **Recovery Notification**:
   - **Trigger**: Service back up
   - **Recipients**: Operations Team, Management
   - **Message**: "✅ RECOVERED: Okaeri Resort System is back online -
     {duration} downtime"

### 4. Advanced Monitoring Features

#### Multi-Location Monitoring

Enable monitoring from multiple geographic locations:

- ✅ **Singapore** (Primary - closest to Philippines)
- ✅ **Tokyo** (Secondary - matches Vercel edge)
- ✅ **Los Angeles** (Tertiary - global perspective)

#### SSL Certificate Monitoring

- **Enable SSL Monitoring**: Yes
- **Certificate Expiry Alert**: 30 days before expiration
- **SSL Grade Monitoring**: Enable (minimum A- grade)

#### Performance Monitoring

- **Response Time Alerts**:
  - Warning: > 3 seconds response time
  - Critical: > 5 seconds response time
- **Downtime Sensitivity**: Medium (2 failures = down)

---

## Vercel Built-in Analytics

### 1. Vercel Analytics Setup

#### Enable Analytics

1. Log into Vercel Dashboard
2. Navigate to project: `okaeri-resort-system`
3. Go to **Analytics** tab
4. Click **"Enable Analytics"**
5. Configure data retention: 30 days (free tier)

#### Key Metrics to Monitor

- **Page Views**: Track staff usage patterns
- **Response Times**: API performance monitoring
- **Error Rates**: 4xx/5xx error tracking
- **Geographic Distribution**: Verify Philippine traffic

### 2. Speed Insights Configuration

#### Enable Speed Insights

1. In Vercel Dashboard → **Speed Insights**
2. Click **"Enable Speed Insights"**
3. Add Web Vitals tracking code (already included in build)

#### Core Web Vitals Monitoring

- **LCP (Largest Contentful Paint)**: Target < 2.5s
- **FID (First Input Delay)**: Target < 100ms
- **CLS (Cumulative Layout Shift)**: Target < 0.1

---

## Health Check Endpoint Details

### Endpoint Specification

**URL**: `/api/health-check`  
**Method**: GET  
**Expected Response Format**:

```json
{
  "status": "healthy",
  "timestamp": "2025-09-10T14:30:00.000Z",
  "uptime": 3600.45,
  "version": "Phase-5.5",
  "requestId": "req_abc123",
  "checks": {
    "database": true,
    "redis": true,
    "environment": true
  },
  "database": {
    "status": "connected",
    "responseTime": 45,
    "connectionPool": {
      "active": 2,
      "idle": 8,
      "total": 10
    }
  },
  "system": {
    "memory": {
      "used": 128,
      "total": 512
    }
  }
}
```

### Health Check Monitoring Rules

#### Uptime Robot Keywords

- **Primary Keyword**: `"status":"healthy"`
- **Secondary Keyword**: `"database":true`
- **Failure Keyword**: `"error"` (should NOT be present)

#### Response Time Expectations

- **Target**: < 500ms
- **Warning**: > 1000ms
- **Critical**: > 2000ms or timeout

---

## Additional Monitoring Services (Optional)

### 1. StatusCake (Backup Monitoring)

Free tier option for redundant monitoring:

- **Website**: https://statuscake.com
- **Free Plan**: 10 monitors, 5-minute intervals
- **Use Case**: Backup to Uptime Robot

### 2. Pingdom (Performance Focus)

For detailed performance analysis:

- **Website**: https://pingdom.com
- **Free Plan**: 1 monitor, 1-minute intervals
- **Use Case**: Detailed load time analysis

### 3. Google Analytics (User Monitoring)

For staff usage analytics:

- **Setup**: Add GA4 tracking code
- **Focus**: Staff usage patterns, session duration
- **Privacy**: Configure for internal use only

---

## Monitoring Dashboard Setup

### 1. Create Status Page (Optional)

Using Uptime Robot's status page feature:

1. Go to **Status Pages** in Uptime Robot
2. Create new status page: "Okaeri Resort System Status"
3. Add monitors: Main App, Health Check, Auth API
4. **URL**: `https://status.okaeriresort.com` (if custom domain available)
5. **Public**: No (internal use only)

### 2. Mobile Monitoring App

Install Uptime Robot mobile app:

- **iOS**: Download from App Store
- **Android**: Download from Google Play
- **Login**: Use resort operations account
- **Notifications**: Enable push notifications

---

## Incident Response Procedures

### 1. Alert Escalation Flow

#### Level 1 - Service Degradation (3-5s response time)

- **Action**: Monitor closely, no immediate action
- **Notification**: Email to operations team
- **Timeline**: Continue monitoring for 15 minutes

#### Level 2 - Service Down (1-2 failed checks)

- **Action**: Immediate investigation
- **Notification**: Email + SMS to operations
- **Timeline**: Respond within 5 minutes

#### Level 3 - Extended Outage (10+ minutes down)

- **Action**: Activate incident response
- **Notification**: Management + operations team
- **Timeline**: Execute rollback if needed

### 2. Response Checklist

#### Immediate Actions (First 5 minutes)

1. ✅ **Verify alert legitimacy** (check multiple locations)
2. ✅ **Check Vercel status** (https://vercel.status.io)
3. ✅ **Test health check manually** from different location
4. ✅ **Review recent deployments** in Vercel dashboard
5. ✅ **Check database connectivity** via health endpoint

#### Investigation Actions (5-15 minutes)

1. ✅ **Review error logs** in Vercel dashboard
2. ✅ **Check performance metrics** for anomalies
3. ✅ **Test API endpoints** individually
4. ✅ **Verify SSL certificate** status
5. ✅ **Check domain DNS** resolution

#### Resolution Actions (15+ minutes)

1. ✅ **Execute rollback** if deployment-related
2. ✅ **Contact Vercel support** if platform issue
3. ✅ **Implement temporary fixes** if possible
4. ✅ **Document incident** for post-mortem
5. ✅ **Update stakeholders** on resolution

---

## Monitoring Cost Analysis

### Uptime Robot Free Tier

- **Monitors**: 50 monitors
- **Interval**: 5-minute checks
- **Locations**: Multiple locations included
- **Alerts**: Email, SMS, webhooks
- **Cost**: $0/month

### Potential Paid Upgrades

- **Pro Plan** ($7/month): 1-minute intervals, more locations
- **Business Plan** ($15/month): Advanced features, priority support

### Total Monitoring Budget

- **Phase 5.5**: $0/month (free tiers)
- **Future scaling**: $7-15/month for enhanced features

---

## Implementation Timeline

### Week 1 (Pre-Deployment)

- [ ] Create Uptime Robot account
- [ ] Configure basic monitors (main app, health check)
- [ ] Set up email alerting
- [ ] Test alert system

### Week 2 (Deployment Week)

- [ ] Enable Vercel Analytics
- [ ] Add SSL monitoring
- [ ] Configure multi-location checks
- [ ] Set up SMS alerts

### Week 3 (Post-Deployment)

- [ ] Review monitoring effectiveness
- [ ] Adjust alert thresholds based on real data
- [ ] Add additional monitors if needed
- [ ] Document any incidents

### Ongoing Maintenance

- [ ] Monthly review of monitoring data
- [ ] Quarterly adjustment of thresholds
- [ ] Annual review of monitoring strategy
- [ ] Update contact information as needed

---

## Troubleshooting Common Monitoring Issues

### False Positive Alerts

**Issue**: Monitor reports down but service is accessible  
**Solutions**:

1. Check if monitor is from single location
2. Verify monitor timeout settings (increase if needed)
3. Test from same geographic location as monitor
4. Review Vercel deployment status

### Missing Alerts

**Issue**: Service was down but no alerts received  
**Solutions**:

1. Verify alert contact settings
2. Check spam/junk folders
3. Test alert contacts manually
4. Review monitor configuration

### High Response Times

**Issue**: Monitor reports slow response times  
**Solutions**:

1. Check Vercel function cold start times
2. Review database query performance
3. Analyze third-party service dependencies
4. Consider geographic distance to monitoring location

---

## Monitoring Success Metrics

### Uptime Targets

- **Monthly Uptime**: > 99.5%
- **Response Time**: < 2 seconds average
- **Error Rate**: < 0.1% of requests

### Alert Response Metrics

- **Alert Response Time**: < 5 minutes
- **Incident Resolution**: < 30 minutes average
- **False Positive Rate**: < 5% of alerts

### Business Impact Metrics

- **Staff Productivity**: Minimal monitoring-related interruptions
- **System Reliability**: Staff confidence in system availability
- **Operational Efficiency**: Proactive issue detection

---

## Conclusion

External monitoring is essential for maintaining system reliability and staff
confidence. The configuration outlined above provides comprehensive monitoring
coverage while remaining within budget constraints.

**Key Benefits**:

- ✅ 24/7 automated monitoring
- ✅ Multi-location perspective
- ✅ Proactive issue detection
- ✅ Detailed performance insights
- ✅ Incident response automation

**Next Steps**:

1. Implement Uptime Robot monitoring
2. Enable Vercel analytics
3. Test alert system thoroughly
4. Document any customizations needed
5. Train staff on monitoring dashboard access

---

**Configuration Owner**: Resort Operations Team  
**Review Schedule**: Monthly monitoring review  
**Update Schedule**: As needed for system changes  
**Emergency Contact**: operations@okaeriresort.com
