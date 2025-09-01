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
- **Access Token**: 15 minutes expiry (short-lived for security)
- **Refresh Token**: 7 days expiry with rotation (server-side only)
- **Storage**: Memory-only via SecureTokenManager (XSS-resistant)
- **Transmission**: HTTPS only with Authorization Bearer headers

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

### Current Implementation: Memory-Only Storage (MOST SECURE)
The resort management system uses **memory-only storage** for JWT tokens via the `SecureTokenManager` class. This is the most secure approach for client-side token storage:

#### Implementation:
```typescript
// Tokens stored in private class variables only
class SecureTokenManager {
  private accessToken: string | null = null;  // Memory only
  private tokenFingerprint: string | null = null;
  
  // Tokens are NEVER stored in localStorage, sessionStorage, or cookies
  // This prevents XSS attacks from accessing tokens
}
```

#### Security Benefits:
1. **XSS Resistant**: Tokens in memory cannot be accessed by injected scripts
2. **No Persistence Vulnerability**: localStorage/sessionStorage can be read by any script
3. **Automatic Cleanup**: Tokens cleared when tab/browser closes
4. **Reduced Attack Surface**: No browser storage API exposure
5. **OWASP Compliant**: Aligns with latest security best practices

#### Additional Security Features:
1. **Browser Fingerprinting**: Detects token theft attempts
2. **Automatic Token Refresh**: Built-in lifecycle management
3. **Token Validation**: Format and XSS injection checks
4. **Suspicious Activity Detection**: Monitors for debugger usage

### Token Storage Environment Matrix

| Environment | Storage Method | Persistence | Web Storage | Security Level | Configuration |
|------------|---------------|-------------|-------------|----------------|---------------|
| **Production** | Memory-only | No | ❌ Forbidden | Maximum | Default, enforced |
| **Test/CI** | Memory-only | No | ❌ Forbidden | Maximum | Default, enforced |
| **Development** | Memory-only | No* | ⚠️ Conditional | High | Default |
| **Dev + Mock Auth** | Memory + SessionStorage | Yes (tab only) | ✅ Allowed | Medium | `VITE_MOCK_AUTH=true` |

#### Environment-Specific Behavior:

##### Production Environment
- **Storage**: Memory-only via private class variables
- **Persistence**: None - tokens cleared on page refresh
- **Web Storage**: Strictly forbidden - security audits fail if detected
- **Configuration**: Automatic, no configuration needed

##### Test/CI Environment
- **Storage**: Memory-only, all mocks use in-memory storage
- **Persistence**: None - fresh state for each test
- **Web Storage**: Forbidden - tests fail if localStorage/sessionStorage used
- **Configuration**: Enforced via test setup

##### Development Environment (Default)
- **Storage**: Memory-only by default
- **Persistence**: None unless mock auth enabled
- **Web Storage**: Not used unless `VITE_MOCK_AUTH=true`
- **Configuration**: Default secure behavior

##### Development with Mock Authentication
- **Storage**: Memory + optional sessionStorage for convenience
- **Persistence**: Tab-level only (sessionStorage)
- **Web Storage**: Allowed ONLY when `VITE_MOCK_AUTH=true` in `.env.development`
- **Configuration**: Explicitly opt-in via environment variable
- **Purpose**: Developer convenience for testing auth flows without constant re-login
- **Security Note**: This is ONLY for mock tokens, never real authentication

#### Enabling Development Token Persistence

To enable token persistence in development (for mock auth only):

```bash
# .env.development
VITE_MOCK_AUTH="true"  # Enables mock authentication mode
# This automatically enables sessionStorage for mock tokens
```

**Important Security Notes:**
1. Production ALWAYS uses memory-only storage regardless of configuration
2. sessionStorage is ONLY used for mock tokens in development
3. Real authentication tokens are NEVER persisted to Web Storage
4. Security audits check for production compliance only
5. The `VITE_MOCK_AUTH` flag is ignored in production builds

### Why NOT localStorage (Security Risk)
LocalStorage was the previous standard but has significant vulnerabilities:

#### Vulnerabilities:
- **XSS Exposure**: Any injected script can read localStorage
- **Persistence Risk**: Tokens remain even after closing tab
- **No Access Control**: Any JavaScript on the page can access
- **Cross-Tab Leakage**: Shared across all tabs of same origin

#### When localStorage Might Be Acceptable:
- Internal tools with strict CSP
- Non-sensitive applications
- Legacy systems with proper mitigations

However, memory-only storage is always preferred for security-critical applications

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

### Core Security Documentation
- **JWT Authentication Policy**: `/docs/security/JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md`
- **JWT Testing Patterns**: `/docs/security/JWT_TESTING_PATTERNS.md` - Comprehensive testing and implementation guide
- **Security Test Requirements**: `/docs/security/SECURITY_TEST_REQUIREMENTS.md`
- **Security Verification Scripts**: `/docs/implementation/SECURITY_VERIFICATION_SCRIPTS.md` - Automated security audits
- **Security Checklist**: `/docs/security/SECURITY_CHECKLIST.md`
- **Modern Security Headers**: `/docs/security/MODERN_SECURITY_HEADERS_GUIDE.md`

### Implementation References
- **Implementation Guide**: `/docs/implementation/SIMPLE_DATABASE_GUIDE.md`
- **Technical Decisions**: `/docs/TECHNICAL_DECISIONS.md`
- **Environment Config**: `/src/config/environment.ts`

---

**Document Status**: Authoritative  
**Last Updated**: August 2025  
**Review Schedule**: Quarterly