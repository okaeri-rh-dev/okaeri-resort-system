# Authentication Persistence Fix

## Problem

Authentication tokens were not persisting across page reloads in development
mode, causing users to be logged out when the page refreshed. The issue was that
tokens were stored only in memory (for security), which gets cleared on page
reload.

## Solution

Modified the `SecureTokenManager` to use `sessionStorage` for token persistence
in development mode with mock authentication, while maintaining memory-only
storage for production (security best practice).

## Changes Made

### 1. SecureTokenManager (`src/lib/security/secure-token-manager.ts`)

#### Added Development Mode Detection

```typescript
private isDevelopmentMockAuth(): boolean {
  return import.meta.env.DEV && (
    (window as any).__VITE_ENV__?.VITE_MOCK_AUTH === "true" ||
    import.meta.env.VITE_MOCK_AUTH === "true"
  );
}
```

#### Token Restoration on Initialization

In the constructor, tokens are now restored from sessionStorage in dev mode:

```typescript
if (this.isDevelopmentMockAuth()) {
  const storedToken = sessionStorage.getItem("mock_access_token");
  const storedRefreshToken = sessionStorage.getItem("mock_refresh_token");

  if (storedToken) {
    console.log(
      "[SecureTokenManager] Restoring mock tokens from sessionStorage"
    );
    this.accessToken = storedToken;
  }
}
```

#### Token Persistence on Store

When storing tokens, they're now also persisted to sessionStorage in dev mode:

```typescript
if (this.isDevelopmentMockAuth()) {
  console.log(
    "[SecureTokenManager] Persisting mock tokens to sessionStorage for dev mode"
  );
  sessionStorage.setItem("mock_access_token", accessToken);
  if (refreshToken) {
    sessionStorage.setItem("mock_refresh_token", refreshToken);
  }
}
```

#### Token Cleanup on Logout

When clearing tokens, sessionStorage is also cleared in dev mode:

```typescript
if (this.isDevelopmentMockAuth()) {
  sessionStorage.removeItem("mock_access_token");
  sessionStorage.removeItem("mock_refresh_token");
}
```

### 2. Development Helpers (`src/main.tsx`)

Added development helpers to expose auth store and token manager for testing:

```typescript
if (config.isDevelopment) {
  (window as any).__AUTH_STORE__ = authStore;
  (window as any).__TOKEN_MANAGER__ = secureTokenManager;
}
```

## Testing

### Manual Testing Steps

1. Start the dev server with `npm run dev`
2. Navigate to http://localhost:5173/login
3. Login with credentials (e.g., admin@okaeri.com / admin123)
4. Open browser DevTools console
5. Verify tokens are stored: `sessionStorage.getItem('mock_access_token')`
6. Refresh the page (F5 or Cmd+R)
7. Verify you're still logged in and can access protected routes

### Test Files Created

- `/test-auth-persistence.html` - Simple HTML test page for token storage
- `/tests/manual/auth-persistence.test.ts` - Manual test suite for auth
  persistence

### Console Testing

```javascript
// Test login and token storage
await window.__AUTH_STORE__.getState().login("admin@okaeri.com", "admin123");

// Check tokens in sessionStorage
sessionStorage.getItem("mock_access_token");
sessionStorage.getItem("mock_refresh_token");

// Test token restoration after reload
window.__TOKEN_MANAGER__.getAccessToken();

// Test logout and cleanup
await window.__AUTH_STORE__.getState().logout();
```

## Security Considerations

### Production Security

- In production, tokens remain in memory only (no sessionStorage)
- This prevents XSS attacks from accessing stored tokens
- Refresh tokens will be managed server-side via httpOnly cookies

### Development Convenience

- sessionStorage is used ONLY in development mode with mock auth
- This provides a better developer experience without compromising production
  security
- The `isDevelopmentMockAuth()` helper ensures this only happens when:
  - `import.meta.env.DEV` is true (development mode)
  - `VITE_MOCK_AUTH` environment variable is "true"

## Environment Configuration

Ensure your `.env.development` file contains:

```env
VITE_MOCK_AUTH=true
```

## Important Notes

1. This fix is for **development mode only** with mock authentication
2. Production environments maintain secure memory-only token storage
3. sessionStorage is cleared on browser tab close (more secure than
   localStorage)
4. Tokens persist across page reloads but not across browser sessions

## Future Improvements (Phase 5)

- Implement httpOnly cookie-based refresh tokens for production
- Add secure token rotation mechanism
- Implement server-side session management
- Add CSRF protection for cookie-based auth
