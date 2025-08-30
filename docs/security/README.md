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
- **Storage**: localStorage with XSS protection via React's built-in escaping
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
```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=63072000",
  "Content-Security-Policy": "default-src 'self'..."
}
```

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

- **Implementation Guide**: `/docs/implementation/SIMPLE_DATABASE_GUIDE.md`
- **Technical Decisions**: `/docs/TECHNICAL_DECISIONS.md`
- **Security Checklist**: `/docs/security/SECURITY_CHECKLIST.md`
- **Environment Config**: `/src/config/environment.ts`

---

**Document Status**: Authoritative  
**Last Updated**: August 2025  
**Review Schedule**: Quarterly