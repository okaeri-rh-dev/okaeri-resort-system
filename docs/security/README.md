# Security Model - Single Source of Truth

## Overview

This document is the **authoritative source** for security implementation in the Okaeri Resort System. 
The system is designed as an **internal family business application** with strong security appropriate 
for a small resort operation.

## Authentication: JWT (CSRF-Immune)

### Why JWT?
- **Stateless**: No server-side session storage needed
- **CSRF-Immune**: Tokens in Authorization headers are not automatically sent by browsers
- **Mobile-Ready**: Same auth mechanism for web and future mobile apps
- **Scalable**: Works seamlessly with serverless architecture

### Implementation
```typescript
// JWT tokens are sent in Authorization headers
Authorization: Bearer <jwt-token>

// NOT in cookies (which would need CSRF protection)
```

### Token Security
- **Access Token**: 1 hour expiry
- **Refresh Token**: 7 days expiry with rotation
- **Storage**: See Token Storage Best Practices section below
- **Transmission**: HTTPS only (enforced by HSTS headers)

## Data Isolation: Application-Level Filtering

### Why Not Row-Level Security (RLS)?
- **Simplicity**: Easier to understand and debug
- **Transparency**: Clear audit trail in application logs
- **Flexibility**: Easy to modify business rules without database changes
- **Testing**: Can test with mock data without database

### Implementation
```typescript
// Every query includes project_id filtering
export async function getBookings(userId: string, projectId: string) {
  // 1. Verify user has access to project
  await verifyProjectAccess(userId, projectId);
  
  // 2. Query with project filter
  return db.query.bookings.findMany({
    where: eq(bookings.projectId, projectId)
  });
}
```

### Security Layers
1. **Authentication**: JWT verification
2. **Authorization**: User → Project access check
3. **Data Filtering**: All queries filtered by project_id
4. **Audit Logging**: All data access logged

## Why JWT Doesn't Need CSRF Protection

### Understanding CSRF Attacks
CSRF (Cross-Site Request Forgery) exploits the browser's automatic inclusion of credentials:
- **Cookies**: Automatically sent with every request to the domain
- **Basic Auth**: Automatically included if cached by browser
- **Client Certificates**: Automatically presented

### JWT is CSRF-Immune Because:

1. **Manual Inclusion Required**
   ```javascript
   // Developer must explicitly add the token
   fetch('/api/bookings', {
     headers: {
       'Authorization': `Bearer ${token}` // Not automatic
     }
   });
   ```

2. **Malicious Sites Can't Access Tokens**
   ```html
   <!-- This malicious form can't include your JWT -->
   <form action="https://okaeri.com/api/delete" method="POST">
     <!-- No way to add Authorization header from HTML form -->
   </form>
   ```

3. **Same-Origin Policy Protection**
   - Malicious JavaScript can't read localStorage from different origin
   - Can't make credentialed requests with custom headers cross-origin

### Common Misconception
"We need CSRF tokens with JWT" - **FALSE**
- CSRF tokens prevent automatic credential inclusion
- JWTs are never automatically included
- Adding CSRF to JWT is redundant security theater

## Security Best Practices

### Headers Configuration

#### Modern Security Headers (Recommended)
```json
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' https://*.neon.tech wss://*.neon.tech; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

#### Legacy Browser Support (Optional)
```json
{
  "X-XSS-Protection": "0"  // Disabled to prevent filter bypasses in legacy browsers
}
```

**Note on X-XSS-Protection**: This header is deprecated in modern browsers and can actually introduce vulnerabilities through filter bypasses. Modern browsers have built-in XSS protections that supersede this header. Set to "0" to disable the problematic filter, or omit entirely for modern applications.

### Input Validation
- All user inputs validated with Zod schemas
- SQL injection prevented via parameterized queries
- XSS prevented via React's automatic escaping

### Rate Limiting
- Login: 5 attempts per 15 minutes
- API: 100 requests per 15 minutes
- Configurable per endpoint

### Audit Logging
- All authentication events
- Data modifications
- Failed access attempts
- Suspicious patterns

## Token Storage Best Practices

### Current Implementation: localStorage
The resort management system currently uses localStorage for JWT token storage. This approach is acceptable for an internal family business application with proper mitigations:

#### Pros:
- Simple implementation
- Tokens persist across browser tabs
- Works with the current architecture

#### Cons:
- Vulnerable to XSS attacks if mitigations fail
- Tokens accessible to any JavaScript code

#### Required Mitigations:
1. **Strict Content Security Policy**
   - No `unsafe-inline` or `unsafe-eval` for scripts
   - Whitelist only trusted domains
   - Use nonces or hashes for any inline scripts

2. **Input Sanitization**
   - All user inputs validated with Zod schemas
   - React's automatic escaping for rendered content
   - DOMPurify for any HTML content if needed

3. **Third-Party Script Control**
   - No third-party scripts without security review
   - Subresource Integrity (SRI) for external resources
   - Regular dependency vulnerability scanning

4. **Regular Security Audits**
   - Quarterly security assessments
   - Automated vulnerability scanning in CI/CD
   - Penetration testing for production releases

### Alternative: In-Memory Storage (More Secure)
For enhanced security, consider storing tokens only in JavaScript memory:

```typescript
// Token stored in memory only
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  
  // Tokens lost on page refresh - requires refresh token in httpOnly cookie
  // or silent re-authentication flow
}
```

#### Pros:
- Immune to XSS localStorage attacks
- Tokens cleared on page navigation/refresh
- Better for high-security requirements

#### Cons:
- Complex implementation with refresh flows
- Poor user experience (frequent re-authentication)
- Requires additional infrastructure

### Alternative: HttpOnly Cookies (Most Secure)
For maximum security, store tokens in httpOnly cookies:

#### Pros:
- Not accessible via JavaScript (XSS-proof)
- Automatic inclusion in requests
- Works with browser security model

#### Cons:
- Requires CSRF protection
- More complex server-side implementation
- Not suitable for current JWT-only architecture
- Would require significant refactoring

### Recommendation for Okaeri Resort System
Given the internal nature of the application and family business context:

1. **Continue with localStorage** but ensure all mitigations are in place
2. **Implement strict CSP** without unsafe-inline/unsafe-eval
3. **Regular security audits** to verify XSS protections
4. **Monitor for suspicious activity** through audit logs
5. **Consider migration to in-memory storage** in future phases if security requirements increase

## Compliance Considerations

### Philippine Data Privacy Act
- Guest data encrypted at rest
- Access logs maintained
- Data retention policies enforced
- Regular security assessments

### Financial Records
- Audit trail for all transactions
- Immutable payment records
- Regular backups
- Secure deletion after retention period

## Quick Security Checklist

### ✅ What We Have
- [x] JWT authentication (CSRF-immune)
- [x] Application-level data filtering
- [x] Input validation on all endpoints
- [x] Rate limiting
- [x] Security headers
- [x] HTTPS enforcement
- [x] Audit logging

### ❌ What We Don't Need
- [ ] ~~CSRF tokens (redundant with JWT)~~
- [ ] ~~Row-Level Security (using app-level filtering)~~
- [ ] ~~Session storage (stateless JWT)~~
- [ ] ~~Complex RBAC (simple role system sufficient)~~

## References

- **JWT Authentication Policy**: `/docs/security/JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md`
- **Security Test Requirements**: `/docs/security/SECURITY_TEST_REQUIREMENTS.md`
- **Implementation Guide**: `/docs/implementation/SIMPLE_DATABASE_GUIDE.md`
- **Technical Decisions**: `/docs/TECHNICAL_DECISIONS.md`
- **Security Checklist**: `/docs/security/SECURITY_CHECKLIST.md`
- **Environment Config**: `/src/config/environment.ts`

---

**Document Status**: Authoritative  
**Last Updated**: August 2025  
**Review Schedule**: Quarterly