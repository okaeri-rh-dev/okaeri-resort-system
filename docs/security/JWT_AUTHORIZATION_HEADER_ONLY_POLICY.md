# JWT Authorization Header ONLY Policy

## CRITICAL: Authentication Method

This system uses **JWT tokens via Authorization headers EXCLUSIVELY**.

We do NOT use:

- ❌ HttpOnly cookies
- ❌ Regular cookies
- ❌ Session cookies
- ❌ CSRF tokens (not needed since we don't use cookies)

We ONLY use:

- ✅ JWT in Authorization: Bearer <token> header

## WHAT WE USE vs WHAT WE DON'T USE

### ✅ WHAT WE USE (The ONLY Method)

```
CLIENT                      SERVER
  |                           |
  |  POST /api/login          |
  |  (credentials)            |
  |-------------------------->|
  |                           |
  |  200 OK                   |
  |  { token: "eyJ..." }      |
  |<--------------------------|
  |                           |
  |  GET /api/protected       |
  |  Authorization: Bearer eyJ|
  |-------------------------->|
  |                           |
  |  200 OK (authenticated)   |
  |<--------------------------|
```

### ❌ WHAT WE DON'T USE (NEVER Do This)

```
INCORRECT - Cookie with JWT (NEVER DO THIS):
Client → [Cookie: token=eyJ...] → Server

INCORRECT - HttpOnly Cookie (NEVER DO THIS):
Client → [Cookie: auth=eyJ...; HttpOnly] → Server

INCORRECT - CSRF Token (NOT NEEDED):
Client → [X-CSRF-Token: abc123] → Server
```

## Visual Authentication Flow Diagram

```
✅ CORRECT Authentication Flow:
═══════════════════════════════════════════════════════════════

1. Login Request:
   Browser → [POST /api/login with credentials] → Server

2. Server Response:
   Server → [JSON: { token: "eyJ..." }] → Browser

3. Browser Stores Token:
   localStorage.setItem('token', 'eyJ...')
   OR
   sessionStorage.setItem('token', 'eyJ...')
   OR
   In-memory variable: this.token = 'eyJ...'

4. Authenticated Request:
   Browser → [GET /api/data + Header: Authorization: Bearer eyJ...] → Server

5. Server Validates:
   - Extracts token from Authorization header
   - Validates JWT signature
   - Checks expiration
   - Returns data if valid


❌ INCORRECT (NOT USED IN THIS SYSTEM):
═══════════════════════════════════════════════════════════════

Cookie-Based Flow (WE DON'T DO THIS):
Browser → [Cookie automatically sent] → Server
         ↑
         CSRF vulnerability exists here
         (This is why cookie-based systems need CSRF tokens)

THIS IS NOT OUR SYSTEM! We use Authorization headers which are
CSRF-immune by design.
```

## Common Misconceptions - CLARIFIED

### Misconception #1: "We need CSRF tokens"

**❌ WRONG**

- **Reality**: No, CSRF only applies to cookie-based auth
- **Why it's mentioned**: We mention CSRF only to explain why we DON'T need it
- **The truth**: Authorization headers are immune to CSRF attacks by design

### Misconception #2: "HttpOnly cookies are more secure"

**❌ WRONG**

- **Reality**: We use Authorization headers which are CSRF-immune
- **Our approach**: JWT in Authorization header provides security without CSRF
  complexity
- **The truth**: HttpOnly cookies would require CSRF tokens; we avoid both

### Misconception #3: "The docs mention CSRF so we must use it"

**❌ WRONG**

- **Reality**: CSRF is mentioned only to explain why we DON'T need it
- **Documentation purpose**: Educational - explaining our security design
  choices
- **The truth**: We achieve CSRF protection by NOT using cookies at all

### Misconception #4: "We should store JWT in cookies for persistence"

**❌ WRONG**

- **Reality**: We NEVER store JWT in cookies
- **Our approach**: Use localStorage, sessionStorage, or in-memory storage
- **The truth**: Cookies would introduce CSRF vulnerabilities we're avoiding

## Test Examples - Ensuring NO Cookie Usage

```typescript
// ═══════════════════════════════════════════════════════════════
// TEST: Ensure we NEVER use cookies for auth
// ═══════════════════════════════════════════════════════════════

describe("JWT Authorization Header ONLY - Security Tests", () => {
  // This test ensures we NEVER store JWT in cookies
  it("should NEVER store JWT in cookies", async () => {
    // Perform login
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    const { token } = await response.json();

    // This should ALWAYS pass - no auth cookies should exist
    expect(document.cookie).not.toContain("token");
    expect(document.cookie).not.toContain("jwt");
    expect(document.cookie).not.toContain("auth");
    expect(document.cookie).not.toContain("session");
    expect(document.cookie).not.toContain("Bearer");

    // Verify token is NOT in any cookie
    const allCookies = document.cookie.split(";");
    allCookies.forEach((cookie) => {
      const [name, value] = cookie.split("=");
      // No cookie should contain a JWT pattern
      expect(value).not.toMatch(
        /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
      );
    });
  });

  // This test ensures we ALWAYS use Authorization headers
  it("should ONLY use Authorization header for JWT", async () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

    // Mock the fetch to intercept headers
    const originalFetch = global.fetch;
    let capturedHeaders: any = {};

    global.fetch = jest.fn((url, options) => {
      capturedHeaders = options?.headers || {};
      return Promise.resolve(new Response("{}"));
    });

    // Make authenticated request
    await makeAuthenticatedRequest("/api/data", token);

    // Verify correct header usage
    expect(capturedHeaders.Authorization).toMatch(/^Bearer .+/);
    expect(capturedHeaders.Cookie).toBeUndefined(); // No cookies!
    expect(capturedHeaders["X-CSRF-Token"]).toBeUndefined(); // No CSRF!

    global.fetch = originalFetch;
  });

  // Test that server rejects cookie-based auth attempts
  it("should REJECT authentication via cookies", async () => {
    // Even if someone manually sets a cookie with a valid JWT
    const validToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    document.cookie = `token=${validToken}; path=/`;

    // Request WITHOUT Authorization header (only cookie)
    const response = await fetch("/api/protected", {
      method: "GET",
      credentials: "include", // This includes cookies
      // NOTE: No Authorization header here!
    });

    // Server should REJECT this request
    expect(response.status).toBe(401);
    expect(response.statusText).toBe("Unauthorized");

    const error = await response.json();
    expect(error.message).toBe("Authorization header required");

    // Clean up
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  // Test that CSRF tokens are not required or used
  it("should NOT require or use CSRF tokens", async () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

    // Make request with Authorization header but NO CSRF token
    const response = await fetch("/api/protected", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // NOTE: No X-CSRF-Token header!
      },
      body: JSON.stringify({ data: "test" }),
    });

    // Should succeed without CSRF token
    expect(response.status).toBe(200);

    // Verify server doesn't send CSRF tokens
    expect(response.headers.get("X-CSRF-Token")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// HELPER: Correct way to make authenticated requests
// ═══════════════════════════════════════════════════════════════

function makeAuthenticatedRequest(url: string, token: string) {
  // ✅ CORRECT: Using Authorization header
  return fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

// ❌ NEVER DO THIS
function incorrectAuthRequest_NEVER_USE(url: string, token: string) {
  // Setting cookie - WRONG!
  document.cookie = `token=${token}`;

  return fetch(url, {
    method: "GET",
    credentials: "include", // Sends cookies - WRONG!
  });
}
```

## Implementation Code - The ONLY Way

### Client-Side Token Management

```typescript
// ═══════════════════════════════════════════════════════════════
// CORRECT Implementation - Authorization Headers ONLY
// ═══════════════════════════════════════════════════════════════

class JWTAuthService {
  private token: string | null = null;

  // Store token (NEVER in cookies)
  storeToken(token: string): void {
    // Option 1: In-memory (most secure, lost on refresh)
    this.token = token;

    // Option 2: SessionStorage (cleared on tab close)
    sessionStorage.setItem("jwt_token", token);

    // Option 3: LocalStorage (persistent, needs XSS protection)
    localStorage.setItem("jwt_token", token);

    // ❌ NEVER DO THIS:
    // document.cookie = `token=${token}`; // WRONG!
    // document.cookie = `jwt=${token}; HttpOnly`; // WRONG!
    // document.cookie = `auth=${token}; Secure; SameSite=Strict`; // WRONG!
  }

  // Get headers for authenticated requests
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();

    if (!token) {
      throw new Error("No authentication token available");
    }

    // ✅ CORRECT: Return Authorization header ONLY
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // ❌ NEVER include cookies or CSRF tokens:
    // headers['Cookie'] = `token=${token}`; // WRONG!
    // headers['X-CSRF-Token'] = csrfToken; // NOT NEEDED!
  }

  // Clear token on logout
  logout(): void {
    // Clear from all storage locations
    this.token = null;
    sessionStorage.removeItem("jwt_token");
    localStorage.removeItem("jwt_token");

    // Defensive: Ensure no auth cookies exist
    // (they shouldn't, but this is defensive programming)
    this.clearAnyCookies();
  }

  private clearAnyCookies(): void {
    // This should never find anything, but we check anyway
    const cookieNames = ["token", "jwt", "auth", "session", "bearer"];

    cookieNames.forEach((name) => {
      // Clear any cookie that might exist with these names
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
    });
  }

  private getToken(): string | null {
    // Try memory first
    if (this.token) return this.token;

    // Then sessionStorage
    const sessionToken = sessionStorage.getItem("jwt_token");
    if (sessionToken) return sessionToken;

    // Finally localStorage
    return localStorage.getItem("jwt_token");

    // ❌ NEVER get token from cookies:
    // return this.getCookie('token'); // WRONG!
  }
}
```

### Server-Side Token Validation

```typescript
// ═══════════════════════════════════════════════════════════════
// SERVER: Validate Authorization Header ONLY
// ═══════════════════════════════════════════════════════════════

export function authenticateRequest(req: Request): AuthResult {
  // ✅ CORRECT: Only check Authorization header
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return {
      authenticated: false,
      error: "Authorization header required",
    };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      error: "Authorization header must use Bearer scheme",
    };
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    return {
      authenticated: true,
      user: decoded,
    };
  } catch (error) {
    return {
      authenticated: false,
      error: "Invalid or expired token",
    };
  }

  // ❌ NEVER check cookies for auth:
  // const cookieToken = req.cookies.get('token'); // WRONG!
  // const sessionCookie = req.cookies.get('session'); // WRONG!
}

// Middleware to enforce Authorization header usage
export function requireAuth(handler: Handler): Handler {
  return async (req, res) => {
    const auth = authenticateRequest(req);

    if (!auth.authenticated) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: auth.error,
        note: "This API requires JWT via Authorization header",
      });
    }

    // Attach user to request and continue
    req.user = auth.user;
    return handler(req, res);
  };
}
```

## Why We DON'T Need CSRF Tokens

### The CSRF Attack Vector (Why It Doesn't Apply to Us)

CSRF attacks work by exploiting the browser's automatic inclusion of cookies.
Here's why we're immune:

```
CSRF Attack on Cookie-Based System (NOT US):
════════════════════════════════════════════

1. User logs into legitimate-bank.com
2. Browser stores authentication cookie
3. User visits evil-site.com
4. Evil site contains: <form action="legitimate-bank.com/transfer" method="POST">
5. Browser AUTOMATICALLY includes cookie ← This is the vulnerability
6. Transfer happens without user consent

Why This DOESN'T Work Against Our System:
════════════════════════════════════════════

1. User logs into our-app.com
2. JWT stored in localStorage/sessionStorage (NOT cookie)
3. User visits evil-site.com
4. Evil site tries: <form action="our-app.com/api/action" method="POST">
5. Browser does NOT include Authorization header ← We're safe!
6. Request fails with 401 Unauthorized
```

### Security Comparison

| Aspect             | Cookie + CSRF Token       | JWT via Auth Header (OUR APPROACH) |
| ------------------ | ------------------------- | ---------------------------------- |
| CSRF Protection    | Requires CSRF tokens      | Inherently protected               |
| Complexity         | High (manage CSRF tokens) | Low (just JWT)                     |
| Cross-domain API   | Complicated               | Simple                             |
| Mobile App Support | Difficult                 | Native                             |
| Stateless          | No (CSRF token state)     | Yes (completely stateless)         |
| Performance        | Slower (CSRF validation)  | Faster (no CSRF overhead)          |

## Absolute Rules for Developers

### 🟢 ALWAYS DO THIS

```typescript
// ✅ Send JWT via Authorization header
fetch("/api/endpoint", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// ✅ Store JWT in memory/sessionStorage/localStorage
sessionStorage.setItem("token", jwt);

// ✅ Clear all storage on logout
sessionStorage.removeItem("token");
localStorage.removeItem("token");
```

### 🔴 NEVER DO THIS

```typescript
// ❌ NEVER store JWT in cookies
document.cookie = `token=${jwt}`;

// ❌ NEVER send JWT via cookies
fetch("/api/endpoint", {
  credentials: "include", // NO!
});

// ❌ NEVER implement CSRF tokens
headers["X-CSRF-Token"] = csrfToken; // NOT NEEDED!

// ❌ NEVER check cookies for auth on server
const token = req.cookies.token; // WRONG!
```

## Quick Reference Card

```
╔════════════════════════════════════════════════════════════════╗
║                  JWT AUTHENTICATION QUICK REFERENCE            ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Storage:        localStorage / sessionStorage / memory        ║
║  Transmission:   Authorization: Bearer <token>                 ║
║  CSRF Tokens:    NOT NEEDED (we don't use cookies)            ║
║  Cookies:        NEVER USED FOR AUTH                          ║
║                                                                ║
║  Login Response:   { "token": "eyJ..." }                      ║
║  Logout Action:    Clear token from storage                   ║
║  Auth Check:       Validate Authorization header ONLY         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

## Summary

This document definitively establishes that the Okaeri Resort Management System:

1. **USES** JWT tokens via Authorization headers **EXCLUSIVELY**
2. **DOES NOT USE** cookies for authentication
3. **DOES NOT NEED** CSRF tokens because we don't use cookies
4. **MENTIONS** CSRF only to explain why it's not needed

Any confusion about CSRF in the documentation is purely educational - we mention
it to explain our security design choice of avoiding cookies entirely, thereby
eliminating CSRF vulnerabilities by design.

---

**Document Version**: 2.0.0  
**Last Updated**: 2025-08-30  
**Status**: AUTHORITATIVE - This supersedes all other authentication
documentation  
**Owner**: Security Team  
**Classification**: Critical Security Policy
