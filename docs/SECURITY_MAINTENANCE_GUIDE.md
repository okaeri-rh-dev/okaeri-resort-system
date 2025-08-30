# Security Maintenance Guide

## Overview

This guide provides **practical, manageable** security maintenance practices for
the Okaeri Resort System. The focus is on **realistic tasks** that a small team
(1-3 developers) can maintain without dedicated security personnel.

## Daily Security Practices

### Automated Security Monitoring

**Time Required**: 5 minutes/day (automated alerts)

```typescript
// src/lib/monitoring/security-monitor.ts
export class SecurityMonitor {
  /**
   * Check for suspicious activity patterns
   */
  static async checkDailySecurityMetrics(): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check failed login attempts
    const failedLogins = await db
      .select({ count: sql`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          gte(loginAttempts.attemptedAt, yesterday),
          eq(loginAttempts.success, false)
        )
      );

    if (failedLogins[0]?.count > 50) {
      alerts.push({
        type: "HIGH_FAILED_LOGINS",
        count: failedLogins[0].count,
        message: `${failedLogins[0].count} failed login attempts in last 24 hours`,
      });
    }

    // Check for SecurityError exceptions
    const securityErrors = await db
      .select({ count: sql`count(*)` })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.createdAt, yesterday),
          eq(auditLogs.severity, "error"),
          like(auditLogs.errorMessage, "%SecurityError%")
        )
      );

    if (securityErrors[0]?.count > 0) {
      alerts.push({
        type: "SECURITY_VIOLATIONS",
        count: securityErrors[0].count,
        message: `${securityErrors[0].count} security violations detected`,
      });
    }

    return alerts;
  }
}
```

### Log Review Checklist

**Time Required**: 10 minutes/day

Daily log review focuses on:

- [ ] Any SecurityError exceptions in application logs
- [ ] Failed authentication attempts from same IP
- [ ] Cross-project access attempts (should be blocked)
- [ ] Unusual query patterns or performance issues

**Red Flags to Watch For**:

- Multiple failed logins from single IP
- SecurityError exceptions (indicates bypass attempts)
- TenantAccessError exceptions (indicates unauthorized access attempts)
- Extremely slow queries (could indicate attacks)

## Weekly Security Tasks

### Security Metrics Review

**Time Required**: 30 minutes/week

```typescript
// Weekly security report script
async function generateWeeklySecurityReport(): Promise<SecurityReport> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const metrics = await Promise.all([
    // Failed logins by project
    db
      .select({
        projectId: auditLogs.projectId,
        count: sql`count(*)`,
      })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.createdAt, oneWeekAgo),
          eq(auditLogs.action, "login_failed")
        )
      )
      .groupBy(auditLogs.projectId),

    // Security errors by type
    db
      .select({
        errorType: sql`split_part(${auditLogs.errorMessage}, ':', 1)`,
        count: sql`count(*)`,
      })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.createdAt, oneWeekAgo),
          like(auditLogs.errorMessage, "%SecurityError%")
        )
      )
      .groupBy(sql`split_part(${auditLogs.errorMessage}, ':', 1)`),

    // Top user activity by project
    db
      .select({
        userId: auditLogs.userId,
        projectId: auditLogs.projectId,
        actionCount: sql`count(*)`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, oneWeekAgo))
      .groupBy(auditLogs.userId, auditLogs.projectId)
      .orderBy(sql`count(*) DESC`)
      .limit(20),
  ]);

  return {
    period: "week",
    failedLoginsByProject: metrics[0],
    securityErrorsByType: metrics[1],
    topUserActivity: metrics[2],
    generatedAt: new Date(),
  };
}
```

### User Access Review

**Time Required**: 20 minutes/week

Review user permissions for:

- [ ] Users with access to multiple projects (verify legitimate)
- [ ] Inactive users who still have access (should be disabled)
- [ ] Users with elevated permissions (admin, manager roles)
- [ ] Recent permission changes

```sql
-- Weekly user access audit query
SELECT
  u.email,
  u.first_name,
  u.last_name,
  p.name as project_name,
  upp.role,
  upp.last_accessed_at,
  upp.created_at as access_granted
FROM user_project_permissions upp
JOIN users u ON u.id = upp.user_id
JOIN projects p ON p.id = upp.project_id
WHERE upp.is_active = true
ORDER BY upp.last_accessed_at DESC NULLS LAST;
```

## Monthly Security Reviews

### Security Configuration Audit

**Time Required**: 1 hour/month

Review these key security configurations:

#### Database Security

- [ ] Row Level Security (RLS) policies are active
- [ ] Connection limits are appropriate for usage
- [ ] Database user permissions are minimal
- [ ] Backup encryption is working

#### Application Security

- [ ] All repositories use SecureMultiTenantRepository
- [ ] No raw SQL queries bypass project filtering
- [ ] Input validation is consistent across endpoints
- [ ] Session management is working correctly

#### Infrastructure Security

- [ ] SSL certificates are current (check expiration)
- [ ] Environment variables are properly secured
- [ ] Logging is capturing security events
- [ ] Monitoring alerts are working

```typescript
// Monthly security audit script
async function monthlySecurityAudit(): Promise<SecurityAuditReport> {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const auditResults = {
    // Check for any unfiltered queries (should be 0)
    unfilteredQueries: await findPotentialUnfilteredQueries(),

    // Review user sessions
    longRunningSessions: await db
      .select()
      .from(sessions)
      .where(
        and(lt(sessions.lastActivity, oneMonthAgo), isNull(sessions.revokedAt))
      ),

    // Check permission grants in last 30 days
    recentPermissionChanges: await db
      .select()
      .from(userProjectPermissions)
      .where(gte(userProjectPermissions.createdAt, oneMonthAgo)),

    // Find inactive projects with active permissions
    inactiveProjectsWithAccess: await db
      .select({
        projectName: projects.name,
        userCount: sql`count(upp.user_id)`,
      })
      .from(projects)
      .leftJoin(
        userProjectPermissions,
        eq(projects.id, userProjectPermissions.projectId)
      )
      .where(
        and(
          eq(projects.isActive, false),
          eq(userProjectPermissions.isActive, true)
        )
      )
      .groupBy(projects.id, projects.name),
  };

  return auditResults;
}
```

### Performance Security Review

**Time Required**: 30 minutes/month

Monitor security-related performance:

- [ ] Query performance with security filters
- [ ] Database connection usage patterns
- [ ] Authentication response times
- [ ] Memory usage for security operations

```sql
-- Query to find slow queries with security implications
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time,
  (total_exec_time/calls) as avg_time_ms
FROM pg_stat_statements
WHERE query LIKE '%project_id%'
AND mean_exec_time > 100 -- queries taking > 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

## Quarterly Security Updates

### Dependency Security Scan

**Time Required**: 2 hours/quarter

```bash
# Security dependency audit
npm audit --audit-level high
npm audit fix

# Check for outdated packages with security implications
npm outdated

# Review specific security-related packages
npm ls | grep -E "(auth|security|crypto|session|jwt)"
```

### Security Test Suite Execution

**Time Required**: 1 hour/quarter

Run comprehensive security test suite:

```bash
# Full security test execution
npm run test:security

# Security test with coverage report
npm run test:security -- --coverage

# Performance impact measurement
npm run test:security:performance

# Integration security tests
npm run test:security:integration
```

### Access Control Review

**Time Required**: 1 hour/quarter

Quarterly deep-dive into access patterns:

1. **User Activity Analysis**
   - Users who haven't logged in for 90+ days
   - Users accessing multiple projects
   - Permission escalations in the quarter

2. **Data Access Patterns**
   - Most accessed booking records
   - Cross-project query attempts (should be blocked)
   - Bulk operations by user and project

3. **Security Incident Review**
   - All SecurityError exceptions in the quarter
   - Failed authentication patterns
   - Unusual access time patterns

## Annual Security Practices

### External Security Review

**Time Required**: 4-8 hours/year (mostly coordination)

Consider these annual practices:

1. **Third-party Security Scan** (if budget allows)
   - Penetration testing of login system
   - Multi-tenant isolation validation
   - Database security assessment

2. **Code Security Review**
   - Review all raw SQL queries
   - Validate input sanitization patterns
   - Check authentication flow completeness

3. **Compliance Audit**
   - Data retention policy compliance
   - Backup and recovery testing
   - Privacy policy alignment with code

### Security Documentation Update

**Time Required**: 2 hours/year

Annual updates to:

- [ ] Security procedures documentation
- [ ] Incident response procedures
- [ ] User access management processes
- [ ] Data retention and deletion policies

## Security Incident Response

### Immediate Response (0-1 hour)

1. **Isolate the Issue**

   ```typescript
   // Emergency user suspension
   await db
     .update(users)
     .set({
       isActive: false,
       lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
     })
     .where(eq(users.id, suspiciousUserId));
   ```

2. **Document the Incident**
   ```typescript
   // Log security incident
   await db.insert(securityAuditLogs).values({
     eventType: "SECURITY_INCIDENT",
     action: "user_suspended",
     userId: suspiciousUserId,
     threatLevel: "high",
     metadata: { reason: "Suspicious access pattern detected" },
   });
   ```

### Investigation Phase (1-24 hours)

1. **Gather Evidence**
   - Pull all audit logs for affected user/project
   - Check database query logs
   - Review authentication attempts

2. **Assess Impact**
   - Determine which projects/data may be affected
   - Check for any unauthorized changes
   - Validate tenant isolation held

3. **Notify Stakeholders**
   - Inform project owners if data may be compromised
   - Update team on incident status
   - Document timeline of events

### Recovery Phase (24-72 hours)

1. **Fix Root Cause**
   - Apply security patches if needed
   - Update access controls
   - Strengthen monitoring

2. **Validate Security**
   - Run full security test suite
   - Verify tenant isolation
   - Test authentication flows

3. **Update Procedures**
   - Update incident response procedures
   - Add new monitoring checks
   - Schedule additional security reviews

## Security Metrics Dashboard

### Key Metrics to Track

**Daily**

- Failed login attempts
- SecurityError exceptions
- Cross-project access attempts

**Weekly**

- User access patterns
- Query performance trends
- Security alert volume

**Monthly**

- Permission change frequency
- Inactive user cleanup
- Database security health

### Simple Monitoring Setup

```typescript
// Simple security metrics for small teams
export const securityMetrics = {
  // Daily alerts via email/Slack
  dailyAlerts: [
    "High failed login count (>50/day)",
    "Security exceptions detected",
    "Unusual query patterns",
  ],

  // Weekly summary stats
  weeklyStats: [
    "Total authentication attempts",
    "Cross-project query blocks",
    "User access changes",
  ],

  // Monthly health checks
  monthlyChecks: [
    "Dependency security status",
    "User permission audit",
    "Performance impact assessment",
  ],
};
```

## Summary

This maintenance guide provides:

✅ **Realistic workload** - Tasks sized for small team capacity  
✅ **Practical procedures** - Actionable steps, not theoretical concepts  
✅ **Automated where possible** - Minimal manual effort for daily tasks  
✅ **Scalable approach** - Procedures that work for 1-10 projects  
✅ **Cost-conscious** - Focus on free/built-in security tools

The security maintenance workload averages **2-3 hours per month** for a small
team, which is manageable alongside feature development while maintaining robust
security for the resort management system.
