# Security Checklist - Okaeri Resort System

> **⚠️ LEGACY COMPLIANCE WARNING**
>
> This document has been updated to reflect the current system scope as an
> internal family business management tool. Previous references to government
> regulatory compliance have been transformed to reflect internal operational
> requirements. The system handles only staff data and internal operations, not
> customer personal data or payment processing.

## Daily Security Tasks

- [ ] Monitor application logs for authentication failures
- [ ] Check for any security alerts in Vercel dashboard
- [ ] Review error logs for potential security issues

## Weekly Security Tasks

- [ ] Review user access logs for anomalies
- [ ] Check for failed login attempts exceeding threshold
- [ ] Verify backup processes are running correctly
- [ ] Review database query performance (potential DoS indicator)

## Monthly Security Tasks

- [ ] Run dependency security audit: `npm audit`
- [ ] Review and update user permissions
- [ ] Check for unused user accounts
- [ ] Verify SSL certificates are valid
- [ ] Test backup restoration process
- [ ] Review API rate limiting effectiveness

## Quarterly Security Tasks (Every 90 Days)

### Secret Rotation

- [ ] Generate new JWT_SECRET
- [ ] Generate new JWT_REFRESH_SECRET
- [ ] Update secrets in Vercel Dashboard
- [ ] Test authentication after rotation
- [ ] Clear all user sessions
- [ ] Document rotation in audit log

### Security Audit

- [ ] Run full security scan workflow
- [ ] Review CSP headers effectiveness
- [ ] Test RLS policies with different user roles
- [ ] Verify CORS configuration
- [ ] Check for new security advisories
- [ ] Update security documentation

### Compliance Review

- [ ] Review data retention compliance
- [ ] Verify privacy policy is current
- [ ] Check staff data handling procedures
- [ ] Review financial audit trails
- [ ] Update incident response plan

## Annual Security Tasks

### Comprehensive Security Assessment

- [ ] Third-party security assessment (if budget allows)
- [ ] Review and update security policies
- [ ] Security training for family members
- [ ] Disaster recovery drill
- [ ] Review insurance coverage for cyber incidents

### Internal Operational Requirements Audit

- [ ] Internal data management review
- [ ] Internal audit requirements for financial records
- [ ] Review data handling procedures
- [ ] Update internal policies
- [ ] Review staff data management processes

## Incident Response Checklist

### If Security Breach Detected:

#### Immediate Actions (First Hour)

- [ ] Isolate affected systems
- [ ] Change all critical passwords
- [ ] Revoke all active sessions
- [ ] Enable emergency maintenance mode
- [ ] Document initial findings

#### Short-term Actions (First 24 Hours)

- [ ] Rotate all secrets and API keys
- [ ] Review access logs for breach timeline
- [ ] Identify affected data and users
- [ ] Patch vulnerability if identified
- [ ] Notify affected users if required

#### Follow-up Actions (First Week)

- [ ] Complete incident report
- [ ] Implement additional security measures
- [ ] Review and update security procedures
- [ ] Consider security audit
- [ ] Update documentation

## Development Security Checklist

### Before Each Deploy

- [ ] Run security tests: `npm run test:security`
- [ ] Check for hardcoded secrets
- [ ] Verify environment variables are set
- [ ] Review code changes for security implications
- [ ] Test authentication flows

### Code Review Security Points

- [ ] No hardcoded credentials
- [ ] Input validation on all user inputs
- [ ] Proper error handling (no stack traces to users)
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (proper escaping)
- [ ] CSRF protection enabled
- [ ] Rate limiting on sensitive endpoints

## Security Configuration Checklist

### CSP Headers

- [ ] No 'unsafe-inline' in script-src
- [ ] No 'unsafe-eval' in script-src
- [ ] Specific domains whitelisted (not wildcards)
- [ ] Frame-ancestors set to 'none'
- [ ] Upgrade-insecure-requests enabled

### Authentication

- [ ] JWT expiry set appropriately (1 hour)
- [ ] Refresh token rotation enabled
- [ ] Session timeout configured (30 minutes)
- [ ] Maximum login attempts enforced
- [ ] Password complexity requirements met

### Database Security

- [ ] RLS enabled on all tables
- [ ] RLS policies tested for each role
- [ ] Connection pooling configured
- [ ] Query timeout limits set
- [ ] Audit logging enabled

### API Security

- [ ] Rate limiting configured
- [ ] API authentication required
- [ ] Input validation on all endpoints
- [ ] Output encoding for responses
- [ ] CORS properly configured

## Monitoring Checklist

### What to Monitor

- [ ] Failed authentication attempts
- [ ] Unusual data access patterns
- [ ] API rate limit violations
- [ ] Database query performance
- [ ] Error rates and types
- [ ] User session anomalies

### Alert Thresholds

- [ ] 5+ failed logins from same IP
- [ ] 10+ failed logins for same user
- [ ] API calls exceeding rate limit
- [ ] Database queries taking >5 seconds
- [ ] 500 errors exceeding 1% of requests
- [ ] Unusual geographic access patterns

## Security Tools & Commands

### Quick Security Checks

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Check for secrets in code
grep -r "secret\|password\|key\|token" --include="*.ts" --include="*.js" src/

# Test CSP headers
curl -I https://okaeri-resort.vercel.app | grep Content-Security

# Check SSL certificate
openssl s_client -connect okaeri-resort.vercel.app:443 -servername okaeri-resort.vercel.app
```

### Database Security Queries

```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- View active sessions
SELECT * FROM sessions
WHERE expires_at > NOW()
ORDER BY created_at DESC;

-- Check failed login attempts
SELECT email, COUNT(*) as attempts
FROM audit_logs
WHERE action = 'login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY email
HAVING COUNT(*) > 3;
```

## Security Contacts

### Internal

- **Primary Admin:** [Family member name]
- **Backup Admin:** [Family member name]
- **Technical Contact:** [Developer name]

### External

- **Vercel Support:** https://vercel.com/support
- **Neon Database:** https://neon.tech/support
- **Cloudflare:** https://support.cloudflare.com

### Emergency

- **Local IT Support:** Contact family tech coordinator
- **Security Incident Response:** Internal escalation procedures

## Security Documentation

### Key Documents

- `/docs/security/SECURITY_AUDIT_2025_08.md` - Latest security audit
- `/docs/security/SECRET_MANAGEMENT_GUIDE.md` - Secret handling procedures
- `/docs/security/SECURITY_CHECKLIST.md` - This document
- `/.github/workflows/security-scan.yml` - Automated security scanning

### Update Schedule

- This checklist: Review monthly
- Security audit: Update quarterly
- Secret guide: Update when procedures change
- Incident response: Update after any incident

## Notes

- Keep this checklist updated with lessons learned
- Add new items as threats evolve
- Remove obsolete items to keep it relevant
- Share with family members involved in operations
- Print a copy for offline reference

---

**Last Updated:** August 28, 2025  
**Next Review:** September 28, 2025  
**Document Owner:** Okaeri Resort System Administrator
