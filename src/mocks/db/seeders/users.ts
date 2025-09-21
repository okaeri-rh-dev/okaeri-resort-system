/**
 * User Data Seeder
 * Creates realistic Philippine resort staff and admin users
 */

import type { User } from "@/types/common";
import { UserRole } from "@/types/common";

export const userSeeds: User[] = [
  // Resort Owner
  {
    id: "user_owner_001",
    email: "maria.santos@okaeriresort.ph",
    name: "Maria Elena Santos",
    role: UserRole.ADMIN,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=maria",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    lastLogin: "2024-01-15T09:30:00.000Z",
  },

  // Resort Manager
  {
    id: "user_manager_001",
    email: "juan.delacruz@okaeriresort.ph",
    name: "Juan Carlos Dela Cruz",
    role: UserRole.MANAGER,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=juan",
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    lastLogin: "2024-01-15T08:15:00.000Z",
  },

  // Front Desk Staff
  {
    id: "user_staff_001",
    email: "anna.reyes@okaeriresort.ph",
    name: "Anna Marie Reyes",
    role: UserRole.STAFF,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=anna",
    createdAt: "2024-01-03T00:00:00.000Z",
    updatedAt: "2024-01-03T00:00:00.000Z",
    lastLogin: "2024-01-15T06:45:00.000Z",
  },

  // Operations Staff
  {
    id: "user_staff_002",
    email: "miguel.garcia@okaeriresort.ph",
    name: "Miguel Angelo Garcia",
    role: UserRole.STAFF,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=miguel",
    createdAt: "2024-01-04T00:00:00.000Z",
    updatedAt: "2024-01-04T00:00:00.000Z",
    lastLogin: "2024-01-14T18:20:00.000Z",
  },

  // Housekeeping Supervisor
  {
    id: "user_staff_003",
    email: "lisa.fernandez@okaeriresort.ph",
    name: "Lisa Mae Fernandez",
    role: UserRole.STAFF,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lisa",
    createdAt: "2024-01-05T00:00:00.000Z",
    updatedAt: "2024-01-05T00:00:00.000Z",
    lastLogin: "2024-01-15T07:00:00.000Z",
  },

  // Finance Assistant
  {
    id: "user_staff_004",
    email: "robert.mendoza@okaeriresort.ph",
    name: "Robert James Mendoza",
    role: UserRole.STAFF,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=robert",
    createdAt: "2024-01-06T00:00:00.000Z",
    updatedAt: "2024-01-06T00:00:00.000Z",
    lastLogin: "2024-01-15T08:30:00.000Z",
  },

  // Guest Relations Officer
  {
    id: "user_staff_005",
    email: "sophia.tan@okaeriresort.ph",
    name: "Sophia Grace Tan",
    role: UserRole.STAFF,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sophia",
    createdAt: "2024-01-07T00:00:00.000Z",
    updatedAt: "2024-01-07T00:00:00.000Z",
    lastLogin: "2024-01-15T10:15:00.000Z",
  },

  // Assistant Manager
  {
    id: "user_manager_002",
    email: "carlo.rivera@okaeriresort.ph",
    name: "Carlo Antonio Rivera",
    role: UserRole.MANAGER,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=carlo",
    createdAt: "2024-01-08T00:00:00.000Z",
    updatedAt: "2024-01-08T00:00:00.000Z",
    lastLogin: "2024-01-15T09:00:00.000Z",
  },

  // Test Viewer Account
  {
    id: "user_viewer_001",
    email: "test.viewer@okaeriresort.ph",
    name: "Test Viewer Account",
    role: UserRole.VIEWER,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=viewer",
    createdAt: "2024-01-10T00:00:00.000Z",
    updatedAt: "2024-01-10T00:00:00.000Z",
    lastLogin: "2024-01-15T11:00:00.000Z",
  },

  // Super Admin (System Administrator)
  {
    id: "user_superadmin_001",
    email: "admin@okaeriresort.ph",
    name: "System Administrator",
    role: UserRole.SUPER_ADMIN,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    lastLogin: "2024-01-15T12:00:00.000Z",
  },
];

/**
 * Quick access to specific user types for testing
 */
export const usersByRole = {
  superAdmin: userSeeds.filter((u) => u.role === UserRole.SUPER_ADMIN),
  admin: userSeeds.filter((u) => u.role === UserRole.ADMIN),
  manager: userSeeds.filter((u) => u.role === UserRole.MANAGER),
  staff: userSeeds.filter((u) => u.role === UserRole.STAFF),
  viewer: userSeeds.filter((u) => u.role === UserRole.VIEWER),
};

/**
 * Common test users for easy reference
 */
export const testUsers = {
  owner: userSeeds[0], // Maria Santos
  manager: userSeeds[1], // Juan Dela Cruz
  frontDesk: userSeeds[2], // Anna Reyes
  operations: userSeeds[3], // Miguel Garcia
  housekeeping: userSeeds[4], // Lisa Fernandez
  finance: userSeeds[5], // Robert Mendoza
  guestRelations: userSeeds[6], // Sophia Tan
  assistantManager: userSeeds[7], // Carlo Rivera
  viewer: userSeeds[8], // Test Viewer
  superAdmin: userSeeds[9], // System Admin
};

/**
 * Mock login credentials (for development only)
 */
export const mockCredentials = {
  [testUsers.owner.email]: "Owner123!",
  [testUsers.manager.email]: "Manager123!",
  [testUsers.frontDesk.email]: "Staff123!",
  [testUsers.operations.email]: "Staff123!",
  [testUsers.housekeeping.email]: "Staff123!",
  [testUsers.finance.email]: "Staff123!",
  [testUsers.guestRelations.email]: "Staff123!",
  [testUsers.assistantManager.email]: "Manager123!",
  [testUsers.viewer.email]: "Viewer123!",
  [testUsers.superAdmin.email]: "Admin123!",
};
