/**
 * Mock Authentication Service
 * Provides realistic authentication behavior for development and testing
 */

import { AbstractBaseService, ServiceErrors } from "../base.service";
import type { User } from "@/types/common";
import { MockServiceUtils, DEFAULT_STABLE_CONFIG } from "@/lib/test-utils";
import type { MockServiceConfig } from "@/test/types/test-interfaces";
import { getEnvironmentConfig } from "@/test/config/mock-service-config";

/**
 * Authentication DTOs
 */
export interface LoginDTO {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  projectName?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Utility functions for mock operations (DEPRECATED - replaced with deterministic utils)
 * Kept for backward compatibility during transition
 */
// These functions are deprecated - use MockServiceUtils instead
// They remain here temporarily to avoid breaking existing code
async function simulateDelay(minMs: number = 200, maxMs: number = 800): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function simulateNetworkError(errorRate: number = 0.05): Promise<boolean> {
  return Math.random() < errorRate;
}

/**
 * Mock user data interface
 */
interface MockUserData {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  phoneNumber: string | null;
  timezone: string;
  language: string;
}

/**
 * Mock users database
 */
const mockUsers: MockUserData[] = [
  {
    id: "user-1",
    email: "admin@okaeri.ph",
    password: "Admin123!",
    name: "Admin User",
    role: "admin",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    emailVerified: true,
    phoneNumber: "+639171234567",
    timezone: "Asia/Manila",
    language: "en",
  },
  {
    id: "user-2",
    email: "manager@okaeri.ph",
    password: "Manager123!",
    name: "Manager User",
    role: "manager",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=manager",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    emailVerified: true,
    phoneNumber: "+639181234567",
    timezone: "Asia/Manila",
    language: "en",
  },
  {
    id: "user-3",
    email: "staff@okaeri.ph",
    password: "Staff123!",
    name: "Staff User",
    role: "staff",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=staff",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
    emailVerified: true,
    phoneNumber: "+639191234567",
    timezone: "Asia/Manila",
    language: "en",
  },
  {
    id: "user-4",
    email: "test@example.com",
    password: "Test123!",
    name: "Test User",
    role: "viewer",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=test",
    createdAt: new Date("2024-03-01"),
    updatedAt: new Date("2024-03-01"),
    emailVerified: false,
    phoneNumber: null,
    timezone: "Asia/Manila",
    language: "en",
  },
];

/**
 * Mock Authentication Service Implementation
 */
export class MockAuthService extends AbstractBaseService<User, RegisterDTO, Partial<User>> {
  private readonly DELAY_MS = { min: 200, max: 800 };
  private readonly TOKEN_EXPIRY = 3600; // 1 hour in seconds
  private readonly utils: MockServiceUtils;
  private readonly config: MockServiceConfig;

  constructor(config?: MockServiceConfig) {
    super();
    // CRITICAL: Prevent accidental production usage
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      throw new Error("🚨 MockAuthService cannot be used in production environment");
    }

    // Initialize configuration with fallbacks
    this.config = config || getEnvironmentConfig();
    this.utils = new MockServiceUtils(this.config);

    console.warn("⚠️ DEVELOPMENT ONLY: Using MockAuthService with plain-text passwords");
    console.info(
      `[MockAuthService] Initialized with ${this.config.deterministic ? "deterministic" : "non-deterministic"} behavior, error rate: ${this.config.errorRate}`
    );
  }

  /**
   * Login with email and password
   */
  async login(dto: LoginDTO): Promise<LoginResponse> {
    return this.utils.executeWithSimulation(
      async () => {
        // Find user by email
        const user = mockUsers.find((u) => u.email === dto.email);

        if (!user) {
          // Add extra delay for failed attempts (security)
          await this.utils.delayCalculator.execute(500, 1000, this.config.deterministic);
          throw ServiceErrors.Unauthorized();
        }

        // Check password
        if (user.password !== dto.password) {
          // Add extra delay for failed attempts (security)
          await this.utils.delayCalculator.execute(500, 1000, this.config.deterministic);
          throw ServiceErrors.Unauthorized();
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new ServiceErrors.Forbidden();
        }

        // Generate mock tokens using deterministic generator
        const token = this.utils.tokenGenerator.generateToken(
          user.id,
          user.role,
          this.TOKEN_EXPIRY
        );
        const refreshToken = this.utils.tokenGenerator.generateRefreshToken(user.id);

        // Return user without password - convert to User interface
        const { password, ...userData } = user;
        const apiUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role as any, // Role type conversion
          avatar: userData.avatar,
          createdAt: userData.createdAt.toISOString(),
          updatedAt: userData.updatedAt.toISOString(),
        };

        return {
          user: apiUser,
          token,
          refreshToken,
          expiresIn: this.TOKEN_EXPIRY,
        };
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "networkError"
    );
  }

  /**
   * Logout (clear tokens)
   */
  async logout(): Promise<void> {
    return this.utils.executeWithSimulation(
      async () => {
        // In a real implementation, this would invalidate the token server-side
        console.log("[MockAuthService] User logged out");
      },
      100,
      300
    );
  }

  /**
   * Register a new user
   */
  async register(dto: RegisterDTO): Promise<LoginResponse> {
    return this.utils.executeWithSimulation(
      async () => {
        // Check if email already exists
        const existingUser = mockUsers.find((u) => u.email === dto.email);
        if (existingUser) {
          throw ServiceErrors.Conflict("Email already registered");
        }

        // Create new user
        const newUser: MockUserData = {
          id: `user-${Date.now()}`,
          email: dto.email,
          password: dto.password,
          name: dto.fullName,
          role: "viewer",
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${dto.email}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false, // Requires email verification
          phoneNumber: null,
          timezone: "Asia/Manila",
          language: "en",
        };

        // Add to mock database
        mockUsers.push(newUser);

        // Generate tokens using deterministic generator
        const token = this.utils.tokenGenerator.generateToken(
          newUser.id,
          newUser.role,
          this.TOKEN_EXPIRY
        );
        const refreshToken = this.utils.tokenGenerator.generateRefreshToken(newUser.id);

        // Convert to User interface
        const { password, ...userData } = newUser;
        const apiUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role as any, // Role type conversion
          avatar: userData.avatar,
          createdAt: userData.createdAt.toISOString(),
          updatedAt: userData.updatedAt.toISOString(),
        };

        return {
          user: apiUser,
          token,
          refreshToken,
          expiresIn: this.TOKEN_EXPIRY,
        };
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "validationError"
    );
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return this.utils.executeWithSimulation(
      async () => {
        if (!this.utils.tokenGenerator.isValidToken(refreshToken)) {
          throw ServiceErrors.Unauthorized();
        }

        const userId = this.utils.tokenGenerator.extractUserId(refreshToken);
        const user = mockUsers.find((u) => u.id === userId);

        if (!user) {
          throw ServiceErrors.Unauthorized();
        }

        return {
          token: this.utils.tokenGenerator.generateToken(user.id, user.role, this.TOKEN_EXPIRY),
          refreshToken: this.utils.tokenGenerator.generateRefreshToken(user.id),
          expiresIn: this.TOKEN_EXPIRY,
        };
      },
      200,
      400,
      "authError"
    );
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    return this.utils.executeWithSimulation(
      async () => {
        const user = mockUsers.find((u) => u.email === email);
        if (!user) {
          // Don't reveal if email exists (security)
          console.log(
            `[MockAuthService] Password reset requested for non-existent email: ${email}`
          );
          return;
        }

        console.log(`[MockAuthService] Password reset email sent to ${email}`);
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max
    );
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return this.utils.executeWithSimulation(
      async () => {
        // In mock, we'll just validate the token format
        if (!token || token.length < 20) {
          throw ServiceErrors.ValidationFailed({ token: "Invalid reset token" });
        }

        console.log("[MockAuthService] Password reset successful");
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "validationError"
    );
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    return this.utils.executeWithSimulation(
      async () => {
        // Extract user ID from token (mock implementation)
        const userId = token.split("-")[1];
        const user = mockUsers.find((u) => u.id === userId);

        if (!user) {
          throw ServiceErrors.ValidationFailed({ token: "Invalid verification token" });
        }

        user.emailVerified = true;
        user.updatedAt = new Date();

        console.log(`[MockAuthService] Email verified for user ${user.id}`);
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "validationError"
    );
  }

  /**
   * Get current user
   */
  async getCurrentUser(token: string): Promise<User> {
    return this.utils.executeWithSimulation(
      async () => {
        if (!this.utils.tokenGenerator.isValidToken(token)) {
          throw ServiceErrors.Unauthorized();
        }

        const userId = this.utils.tokenGenerator.extractUserId(token);
        const user = mockUsers.find((u) => u.id === userId);

        if (!user) {
          throw ServiceErrors.Unauthorized();
        }

        // Convert to User interface
        const { password, ...userData } = user;
        const apiUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role as any,
          avatar: userData.avatar,
          createdAt: userData.createdAt.toISOString(),
          updatedAt: userData.updatedAt.toISOString(),
        };
        return apiUser;
      },
      100,
      200,
      "authError"
    );
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    return this.utils.executeWithSimulation(
      async () => {
        const userIndex = mockUsers.findIndex((u) => u.id === userId);
        if (userIndex === -1) {
          throw ServiceErrors.NotFound("User", userId);
        }

        const user = mockUsers[userIndex];
        const updatedUser: MockUserData = {
          ...user,
          name: data.name || user.name,
          avatar: data.avatar || user.avatar,
          id: user.id, // Prevent ID change
          email: user.email, // Prevent email change without verification
          role: user.role, // Prevent role change
          updatedAt: new Date(),
        };

        mockUsers[userIndex] = updatedUser;

        // Convert to User interface
        const { password, ...userData } = updatedUser;
        const apiUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role as any,
          avatar: userData.avatar,
          createdAt: userData.createdAt.toISOString(),
          updatedAt: userData.updatedAt.toISOString(),
        };
        return apiUser;
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "validationError"
    );
  }

  /**
   * Change password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    return this.utils.executeWithSimulation(
      async () => {
        const user = mockUsers.find((u) => u.id === userId);
        if (!user) {
          throw ServiceErrors.NotFound("User", userId);
        }

        if (user.password !== oldPassword) {
          throw ServiceErrors.ValidationFailed({ oldPassword: "Incorrect password" });
        }

        user.password = newPassword;
        user.updatedAt = new Date();

        console.log(`[MockAuthService] Password changed for user ${userId}`);
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "validationError"
    );
  }

  // Helper methods (DEPRECATED - now handled by MockServiceUtils)
  // These methods are kept for backward compatibility during transition
  private generateMockToken(userId: string, role: string): string {
    return this.utils.tokenGenerator.generateToken(userId, role, this.TOKEN_EXPIRY);
  }

  private generateMockRefreshToken(userId: string): string {
    return this.utils.tokenGenerator.generateRefreshToken(userId);
  }

  private isValidMockToken(token: string): boolean {
    return this.utils.tokenGenerator.isValidToken(token);
  }

  private extractUserIdFromToken(token: string): string {
    return this.utils.tokenGenerator.extractUserId(token);
  }

  /**
   * Update mock service configuration (for testing)
   */
  public updateConfig(newConfig: MockServiceConfig): void {
    // Update the internal config reference
    Object.assign(this.config, newConfig);
    this.utils.updateConfig(newConfig);
  }

  /**
   * Reset mock service to initial state (for testing)
   */
  public reset(): void {
    this.utils.reset();
  }

  /**
   * Get current configuration (for testing)
   */
  public getConfig(): MockServiceConfig {
    return this.config;
  }

  // Base service implementation (not used for auth)
  async list() {
    throw new Error("Method not applicable for AuthService");
  }

  async get(id: string) {
    const user = mockUsers.find((u) => u.id === id);
    if (!user) throw ServiceErrors.NotFound("User", id);

    // Convert to User interface
    const { password, ...userData } = user;
    const apiUser: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role as any,
      avatar: userData.avatar,
      createdAt: userData.createdAt.toISOString(),
      updatedAt: userData.updatedAt.toISOString(),
    };
    return apiUser;
  }

  async search() {
    throw new Error("Method not applicable for AuthService");
  }

  async create(data: RegisterDTO) {
    return this.register(data).then((response) => response.user);
  }

  async update(id: string, data: Partial<User>) {
    return this.updateProfile(id, data);
  }

  async delete() {
    throw new Error("Method not applicable for AuthService");
  }

  async batchCreate() {
    throw new Error("Method not applicable for AuthService");
  }

  async batchUpdate() {
    throw new Error("Method not applicable for AuthService");
  }

  async batchDelete() {
    throw new Error("Method not applicable for AuthService");
  }
}

export default MockAuthService;
