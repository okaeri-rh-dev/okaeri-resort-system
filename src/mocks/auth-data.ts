// [PHASE 1-4 MOCK DATA - Remove entire file in Phase 5.2]
import type { User } from "@/types/common";

export const MOCK_USERS = {
  // Primary test user (matches auth-flow.spec.ts line 19)
  owner: {
    id: "dev-user-001",
    email: "owner@okaeriresort.ph",
    password: "correct-password",
    name: "Resort Owner",
    role: "OWNER" as const,
    projects: ["okaeri-resort-001"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Staff user for role-based testing (matches auth-flow.spec.ts line 372)
  staff: {
    id: "dev-user-002",
    email: "staff@okaeriresort.ph",
    password: "correct-password",
    name: "Staff Member",
    role: "MEMBER" as const,
    projects: ["okaeri-resort-001"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

// Mock JWT tokens
export function generateMockToken(userId: string): string {
  // Create a valid JWT structure (header.payload.signature)
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "");
  const userKey = userId === "dev-user-001" ? "owner" : "staff";
  const userEmail = MOCK_USERS[userKey]?.email || "unknown@example.com";

  const payload = btoa(
    JSON.stringify({
      sub: userId,
      email: userEmail,
      role: MOCK_USERS[userKey]?.role || "MEMBER",
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      iat: Math.floor(Date.now() / 1000),
    })
  ).replace(/=/g, "");
  const signature = btoa("mock-signature").replace(/=/g, "");

  return `${header}.${payload}.${signature}`;
}
