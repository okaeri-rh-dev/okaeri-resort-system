# Modern Security Headers Guide

## Overview

This document provides updated security header recommendations for the Okaeri
Resort System, replacing deprecated headers with modern alternatives and
clarifying token storage best practices.

## Deprecated Headers - DO NOT USE

### X-XSS-Protection

**Status**: DEPRECATED  
**Previous Value**: `1; mode=block`  
**Recommendation**: Remove entirely or set to `0`

**Why it's deprecated:**

- Modern browsers have built-in XSS protections that supersede this header
- The XSS filter can introduce security vulnerabilities through filter bypasses
- Can be exploited to leak information through side-channel attacks
- Chrome removed support in 2019, other browsers following

**What to use instead:**

- Implement a strict Content Security Policy (CSP)
- Ensure no `unsafe-inline` or `unsafe-eval` in CSP
- Use proper input validation and output encoding

## Modern Security Headers Configuration

### Required Headers for Production

```javascript
// api/_lib/middleware.ts or vercel.json
const securityHeaders = {
  // 1. Content Security Policy - Primary XSS Protection
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self'; " + // NO unsafe-inline or unsafe-eval
    "style-src 'self'; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.neon.tech wss://*.neon.tech https://api.cloudflare.com; " +
    "media-src 'self' blob:; " +
    "object-src 'none'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "upgrade-insecure-requests; " +
    "block-all-mixed-content",

  // 2. Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // 3. Clickjacking protection (prefer frame-ancestors in CSP)
  "X-Frame-Options": "DENY",

  // 4. Force HTTPS
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",

  // 5. Control browser features
  "Permissions-Policy":
    "camera=(), " +
    "microphone=(), " +
    "geolocation=(), " +
    "payment=(), " +
    "usb=(), " +
    "bluetooth=(), " +
    "accelerometer=(), " +
    "gyroscope=()",

  // 6. Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // 7. DEPRECATED - Do not use
  // "X-XSS-Protection": "1; mode=block",  // REMOVE THIS
};
```

### Vercel.json Configuration

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://vercel.live https://vercel.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.neon.tech wss://*.neon.tech https://api.cloudflare.com https://vitals.vercel-analytics.com; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), payment=()"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

## Content Security Policy Deep Dive

### Critical CSP Directives for XSS Prevention

1. **script-src**: Controls script execution
   - ✅ Use: `'self'` and specific trusted domains
   - ❌ Avoid: `'unsafe-inline'` and `'unsafe-eval'`
   - 🔒 Better: Use nonces or hashes for inline scripts

2. **style-src**: Controls style application
   - ✅ Use: `'self'` and trusted CDNs
   - ⚠️ Careful: `'unsafe-inline'` often needed for CSS-in-JS
   - 🔒 Better: Use nonces for inline styles

3. **default-src**: Fallback for unspecified directives
   - ✅ Always set to `'self'` as baseline

### CSP with Nonces (Advanced)

For inline scripts that are absolutely necessary:

```javascript
// Generate nonce server-side
const nonce = crypto.randomBytes(16).toString("base64");

// Add to CSP header
`script-src 'self' 'nonce-${nonce}';`
// Use in HTML
`<script nonce="${nonce}">
  // Inline script content
</script>`;
```

## JWT Token Storage Security Matrix

### Storage Options Comparison

| Storage Method  | XSS Vulnerable | CSRF Vulnerable | Persistence  | Complexity | Recommendation                |
| --------------- | -------------- | --------------- | ------------ | ---------- | ----------------------------- |
| localStorage    | ✅ Yes         | ❌ No           | Permanent    | Low        | ⚠️ Acceptable with strict CSP |
| sessionStorage  | ✅ Yes         | ❌ No           | Tab only     | Low        | ⚠️ Acceptable with strict CSP |
| Memory only     | ❌ No          | ❌ No           | None         | High       | ✅ Most secure                |
| httpOnly Cookie | ❌ No          | ✅ Yes          | Configurable | Medium     | ❌ Not for JWT                |

### localStorage Security Requirements

If using localStorage for JWT tokens (current implementation), you MUST:

1. **Implement Strict CSP**

   ```javascript
   // No unsafe-inline or unsafe-eval
   "script-src 'self';";
   ```

2. **Sanitize All Inputs**

   ```typescript
   // Use Zod for validation
   const schema = z.object({
     email: z.string().email(),
     name: z.string().min(1).max(100),
   });
   ```

3. **No Third-Party Scripts**
   - Review all dependencies
   - Use Subresource Integrity (SRI)
   - Regular vulnerability scanning

4. **Security Monitoring**
   ```typescript
   // Log suspicious activity
   if (detectXSSAttempt(input)) {
     logSecurityEvent("XSS_ATTEMPT", { input, user });
     blockRequest();
   }
   ```

## Philippine Data Privacy Act Compliance

### Security Headers for DPA Compliance

1. **Data in Transit**: Enforce HTTPS

   ```
   Strict-Transport-Security: max-age=63072000; includeSubDomains
   ```

2. **Data Integrity**: Prevent tampering

   ```
   Content-Security-Policy: ...; require-sri-for script style
   ```

3. **Access Control**: Limit features
   ```
   Permissions-Policy: camera=(), microphone=(), geolocation=()
   ```

## Testing Security Headers

### Automated Tests

```typescript
describe("Security Headers", () => {
  test("should have modern security headers", async () => {
    const response = await fetch("/api/health");

    // Required headers
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Strict-Transport-Security")).toBeTruthy();

    // Deprecated headers should not exist
    const xssProtection = response.headers.get("X-XSS-Protection");
    expect(xssProtection === null || xssProtection === "0").toBeTruthy();
  });

  test("CSP should not have unsafe directives", async () => {
    const response = await fetch("/api/health");
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });
});
```

### Manual Verification

```bash
# Check headers with curl
curl -I https://okaeri-resort.vercel.app

# Verify CSP
curl -I https://okaeri-resort.vercel.app | grep -i content-security-policy

# Check for deprecated headers
curl -I https://okaeri-resort.vercel.app | grep -i x-xss-protection
# Should return nothing or "X-XSS-Protection: 0"
```

## Migration Checklist

### Phase 1: Update Headers (Immediate)

- [ ] Remove X-XSS-Protection header from all configurations
- [ ] Update CSP to remove unsafe-inline and unsafe-eval
- [ ] Add Permissions-Policy header
- [ ] Add Referrer-Policy header
- [ ] Update HSTS to include preload

### Phase 2: Strengthen Token Storage (Next Sprint)

- [ ] Audit all localStorage access points
- [ ] Implement CSP violation reporting
- [ ] Add security event logging
- [ ] Consider migration to memory-only storage

### Phase 3: Advanced Security (Future)

- [ ] Implement CSP nonces for necessary inline scripts
- [ ] Add Subresource Integrity for external resources
- [ ] Implement Content Security Policy reporting
- [ ] Regular penetration testing

## Common Pitfalls to Avoid

1. **Don't mix authentication methods**
   - Use JWT in headers OR cookies, never both
   - JWT in headers = no CSRF needed
   - Cookies = CSRF protection required

2. **Don't rely on deprecated headers**
   - X-XSS-Protection is not a security feature
   - CSP is the modern replacement

3. **Don't use unsafe CSP directives**
   - `unsafe-inline` defeats XSS protection
   - `unsafe-eval` allows code injection

4. **Don't store sensitive data in JWT**
   - JWTs are readable by anyone
   - Only store user ID and roles

## References

- [MDN: X-XSS-Protection Deprecation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [OWASP: XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Philippine Data Privacy Act](https://www.privacy.gov.ph/data-privacy-act/)

---

**Document Status**: Current  
**Last Updated**: August 2025  
**Next Review**: November 2025  
**Owner**: Security Team
