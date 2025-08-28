/**
 * Manual test for auth persistence across page reloads
 * Run this in the browser console to verify auth persistence is working
 */

// Test 1: Login and verify tokens are stored
async function testLogin() {
  console.log("📝 Test 1: Login and Token Storage");

  // Login using the auth store
  const authStore = (window as any).__AUTH_STORE__;
  if (!authStore) {
    console.error("Auth store not exposed. Add to window in dev mode.");
    return;
  }

  await authStore.login("admin@okaeri.com", "admin123");

  // Check sessionStorage
  const accessToken = sessionStorage.getItem("mock_access_token");
  const refreshToken = sessionStorage.getItem("mock_refresh_token");

  console.log("✅ Login successful");
  console.log("Access Token in sessionStorage:", !!accessToken);
  console.log("Refresh Token in sessionStorage:", !!refreshToken);

  return { accessToken, refreshToken };
}

// Test 2: Simulate page reload and check token restoration
function testTokenRestoration() {
  console.log("📝 Test 2: Token Restoration After Reload");

  // Check sessionStorage
  const accessToken = sessionStorage.getItem("mock_access_token");
  const refreshToken = sessionStorage.getItem("mock_refresh_token");

  console.log("Tokens in sessionStorage:", {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
  });

  // Check if SecureTokenManager restored them
  const tokenManager = (window as any).__TOKEN_MANAGER__;
  if (tokenManager) {
    const currentToken = tokenManager.getAccessToken();
    console.log("Token restored in memory:", !!currentToken);
    console.log("Tokens match:", currentToken === accessToken);
  }

  // Check auth store state
  const authStore = (window as any).__AUTH_STORE__;
  if (authStore) {
    const state = authStore.getState();
    console.log("Auth store state:", {
      isAuthenticated: state.isAuthenticated,
      hasUser: !!state.user,
      userEmail: state.user?.email,
    });
  }
}

// Test 3: Logout and verify cleanup
async function testLogout() {
  console.log("📝 Test 3: Logout and Cleanup");

  const authStore = (window as any).__AUTH_STORE__;
  if (!authStore) {
    console.error("Auth store not exposed");
    return;
  }

  await authStore.logout();

  // Check sessionStorage is cleared
  const accessToken = sessionStorage.getItem("mock_access_token");
  const refreshToken = sessionStorage.getItem("mock_refresh_token");

  console.log("✅ Logout complete");
  console.log("Tokens cleared from sessionStorage:", !accessToken && !refreshToken);

  // Check auth state
  const state = authStore.getState();
  console.log("Auth state cleared:", !state.isAuthenticated && !state.user);
}

// Export test suite
export const authPersistenceTests = {
  testLogin,
  testTokenRestoration,
  testLogout,

  // Run all tests
  async runAll() {
    console.log("🚀 Running Auth Persistence Tests...\n");

    // Test 1: Login
    await this.testLogin();
    console.log("");

    // Test 2: Check restoration (would normally be after reload)
    this.testTokenRestoration();
    console.log("");

    // Test 3: Logout
    await this.testLogout();
    console.log("");

    console.log("✅ All tests complete!");
  },
};

// Instructions for manual testing
console.log(`
=== Auth Persistence Manual Test ===

To test auth persistence:

1. Open browser DevTools console
2. Run: await authPersistenceTests.testLogin()
3. Refresh the page (F5 or Cmd+R)
4. Run: authPersistenceTests.testTokenRestoration()
5. Navigate around the app - you should stay logged in
6. Run: await authPersistenceTests.testLogout()

Note: Make sure VITE_MOCK_AUTH=true is set in your environment.
`);
