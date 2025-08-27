// [PHASE 1-4 MOCK SERVICE - Remove entire file in Phase 5.2]
import { MOCK_USERS, generateMockToken } from "./auth-data";
import type { User } from "@/types/common";
import { simulateApiDelay } from "@/lib/api-utils";

interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

class MockAuthService {
  private loginAttempts = new Map<string, number[]>();

  async login(email: string, password: string): Promise<LoginResponse> {
    // Check if mock auth is enabled
    if (!import.meta.env.DEV || !import.meta.env.VITE_MOCK_AUTH) {
      throw new Error("Mock auth only available in development");
    }

    console.warn("[MOCK AUTH] Using mock authentication - DO NOT USE IN PRODUCTION");

    // Simulate API delay
    await simulateApiDelay(500, 1000);

    // Check rate limiting
    const attempts = this.loginAttempts.get(email) || [];
    const recentAttempts = attempts.filter((t) => t > Date.now() - 60000);

    if (recentAttempts.length >= 5) {
      throw new Error("Too many login attempts. Please try again later.");
    }

    this.loginAttempts.set(email, [...recentAttempts, Date.now()]);

    // Find user
    const user = Object.values(MOCK_USERS).find((u) => u.email === email);

    if (!user || user.password !== password) {
      throw new Error("Invalid credentials");
    }

    // Return successful login
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword as User,
      token: generateMockToken(user.id),
      refreshToken: generateMockToken(user.id) + "-refresh",
    };
  }

  async register(data: any): Promise<LoginResponse> {
    console.warn("[MOCK AUTH] Mock registration - DO NOT USE IN PRODUCTION");
    await simulateApiDelay(1000, 1500);

    // Check if email already exists
    if (Object.values(MOCK_USERS).some((u) => u.email === data.email)) {
      throw new Error("User already exists");
    }

    // Create new mock user
    const newUser: User = {
      id: `dev-user-${Date.now()}`,
      email: data.email,
      name: data.name,
      role: "MEMBER",
      projects: ["okaeri-resort-001"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      user: newUser,
      token: generateMockToken(newUser.id),
      refreshToken: generateMockToken(newUser.id) + "-refresh",
    };
  }

  async logout(): Promise<void> {
    console.warn("[MOCK AUTH] Mock logout");
    await simulateApiDelay(200, 400);
  }

  async refresh(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    console.warn("[MOCK AUTH] Mock token refresh");
    await simulateApiDelay(300, 600);

    // Extract user ID from refresh token (mock implementation)
    const userId = refreshToken.includes("dev-user-001") ? "dev-user-001" : "dev-user-002";

    return {
      token: generateMockToken(userId),
      refreshToken: generateMockToken(userId) + "-refresh",
    };
  }

  async fetchCurrentUser(token: string): Promise<User> {
    console.warn("[MOCK AUTH] Fetching mock user");
    await simulateApiDelay(300, 600);

    // Extract user from token (mock implementation)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const user = Object.values(MOCK_USERS).find((u) => u.email === payload.email);

      if (!user) throw new Error("User not found");

      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch {
      throw new Error("Invalid token");
    }
  }

  async resetPassword(email: string): Promise<void> {
    console.warn("[MOCK AUTH] Mock password reset");
    await simulateApiDelay(500, 1000);

    if (!Object.values(MOCK_USERS).some((u) => u.email === email)) {
      // Don't reveal if user exists
    }
  }
}

export const mockAuthService = new MockAuthService();
