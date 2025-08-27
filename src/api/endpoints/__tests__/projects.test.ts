/**
 * Projects endpoint tests with multi-tenant scenarios and Philippine resort contexts
 * Tests project CRUD operations, team management, data export/import, and activity logging
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { server } from "@tests/mocks/server";
import { http, HttpResponse } from "msw";
import { projectsApi } from "../projects";
import { TEST_CONSTANTS, MOCK_USERS, philippineTestData } from "@tests/utils/test-utils";
import { mockHelpers } from "@tests/mocks/handlers";
import type {
  Project,
  ProjectMembership,
  CreateProjectRequest,
  UpdateProjectRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  PaginatedResponse,
} from "@/types/common";

// Mock project data with Philippine resort context
const MOCK_PROJECTS: Project[] = [
  {
    id: "project-boracay-1",
    name: "Okaeri Boracay Resort",
    type: "BEACH_RESORT",
    description: "Premium beachfront resort in Boracay Station 2",
    status: "ACTIVE",
    currency: "PHP",
    timezone: "Asia/Manila",
    locale: "en-PH",
    ownerId: MOCK_USERS.OWNER.id,
    config: {
      businessHours: "8:00-18:00",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      allowOnlineBooking: true,
      requireDeposit: true,
      depositPercentage: 50,
    },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "project-palawan-1",
    name: "Paradise Bay El Nido",
    type: "ECO_RESORT",
    description: "Eco-friendly resort in El Nido, Palawan",
    status: "ACTIVE",
    currency: "PHP",
    timezone: "Asia/Manila",
    locale: "en-PH",
    ownerId: MOCK_USERS.OWNER.id,
    config: {
      businessHours: "7:00-19:00",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      allowOnlineBooking: true,
      requireDeposit: false,
    },
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-20"),
  },
  {
    id: "project-bohol-1",
    name: "Sunset Villa Bohol",
    type: "VILLA",
    description: "Private villa rentals in Panglao Island",
    status: "ARCHIVED",
    currency: "PHP",
    timezone: "Asia/Manila",
    locale: "en-PH",
    ownerId: MOCK_USERS.OWNER.id,
    config: {
      businessHours: "8:00-17:00",
      checkInTime: "16:00",
      checkOutTime: "10:00",
      allowOnlineBooking: false,
      requireDeposit: true,
      depositPercentage: 30,
    },
    createdAt: new Date("2023-12-01"),
    updatedAt: new Date("2024-01-05"),
  },
];

const MOCK_PROJECT_MEMBERS: ProjectMembership[] = [
  {
    id: "membership-1",
    projectId: "project-boracay-1",
    userId: MOCK_USERS.OWNER.id,
    role: "OWNER",
    permissions: ["ALL"],
    invitedBy: null,
    joinedAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "membership-2",
    projectId: "project-boracay-1",
    userId: MOCK_USERS.MANAGER.id,
    role: "MANAGER",
    permissions: ["BOOKINGS_READ", "BOOKINGS_WRITE", "GUESTS_READ", "REPORTS_READ"],
    invitedBy: MOCK_USERS.OWNER.id,
    joinedAt: new Date("2024-01-02"),
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
  },
  {
    id: "membership-3",
    projectId: "project-boracay-1",
    userId: MOCK_USERS.STAFF.id,
    role: "STAFF",
    permissions: ["BOOKINGS_READ", "GUESTS_READ"],
    invitedBy: MOCK_USERS.MANAGER.id,
    joinedAt: new Date("2024-01-03"),
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-03"),
  },
];

const MOCK_ACTIVITY_LOGS = [
  {
    id: "activity-1",
    projectId: "project-boracay-1",
    userId: MOCK_USERS.OWNER.id,
    action: "PROJECT_CREATED",
    description: "Project created",
    metadata: { projectName: "Okaeri Boracay Resort" },
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "activity-2",
    projectId: "project-boracay-1",
    userId: MOCK_USERS.MANAGER.id,
    action: "BOOKING_CREATED",
    description: "New booking created for Juan Dela Cruz",
    metadata: { bookingId: "booking-123", guestName: "Juan Dela Cruz" },
    createdAt: new Date("2024-01-15"),
  },
];

describe("Projects API Endpoints", () => {
  beforeEach(() => {
    mockHelpers.reset();
    vi.clearAllMocks();

    // Setup project endpoints mock handlers
    server.use(
      http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects`, ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("search");
        const status = url.searchParams.get("status");

        let filteredProjects = [...MOCK_PROJECTS];

        if (search) {
          filteredProjects = filteredProjects.filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.description?.toLowerCase().includes(search.toLowerCase())
          );
        }

        if (status) {
          filteredProjects = filteredProjects.filter((p) => p.status === status);
        }

        return HttpResponse.json(filteredProjects);
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/paginated`, ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "10");
        const search = url.searchParams.get("search");

        let filteredProjects = [...MOCK_PROJECTS];

        if (search) {
          filteredProjects = filteredProjects.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase())
          );
        }

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

        return HttpResponse.json({
          data: paginatedProjects,
          meta: {
            page,
            limit,
            total: filteredProjects.length,
            pages: Math.ceil(filteredProjects.length / limit),
          },
        });
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id`, ({ params }) => {
        const project = MOCK_PROJECTS.find((p) => p.id === params.id);
        if (!project) {
          return HttpResponse.json({ error: "Project not found" }, { status: 404 });
        }
        return HttpResponse.json(project);
      }),

      http.post(`${TEST_CONSTANTS.API_BASE_URL}/projects`, async ({ request }) => {
        const data = (await request.json()) as CreateProjectRequest;

        // Validate required fields
        if (!data.name || !data.type) {
          return HttpResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check for duplicate name
        if (MOCK_PROJECTS.some((p) => p.name === data.name && p.status !== "ARCHIVED")) {
          return HttpResponse.json({ error: "Project name already exists" }, { status: 409 });
        }

        // Create new project
        const newProject: Project = {
          id: `project-${Date.now()}`,
          name: data.name,
          type: data.type,
          description: data.description || null,
          status: "ACTIVE",
          currency: data.currency || "PHP",
          timezone: data.timezone || "Asia/Manila",
          locale: data.locale || "en-PH",
          ownerId: MOCK_USERS.OWNER.id,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        MOCK_PROJECTS.push(newProject);
        return HttpResponse.json(newProject, { status: 201 });
      }),

      http.patch(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id`, async ({ params, request }) => {
        const projectId = params.id as string;
        const updates = (await request.json()) as UpdateProjectRequest;
        const projectIndex = MOCK_PROJECTS.findIndex((p) => p.id === projectId);

        if (projectIndex === -1) {
          return HttpResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Update project
        MOCK_PROJECTS[projectIndex] = {
          ...MOCK_PROJECTS[projectIndex],
          ...updates,
          updatedAt: new Date(),
        };

        return HttpResponse.json(MOCK_PROJECTS[projectIndex]);
      }),

      http.delete(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id`, ({ params }) => {
        const projectIndex = MOCK_PROJECTS.findIndex((p) => p.id === params.id);
        if (projectIndex === -1) {
          return HttpResponse.json({ error: "Project not found" }, { status: 404 });
        }

        MOCK_PROJECTS.splice(projectIndex, 1);
        return HttpResponse.json({ message: "Project deleted successfully" });
      }),

      http.post(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/archive`, ({ params }) => {
        const projectIndex = MOCK_PROJECTS.findIndex((p) => p.id === params.id);
        if (projectIndex === -1) {
          return HttpResponse.json({ error: "Project not found" }, { status: 404 });
        }

        MOCK_PROJECTS[projectIndex] = {
          ...MOCK_PROJECTS[projectIndex],
          status: "ARCHIVED",
          updatedAt: new Date(),
        };

        return HttpResponse.json(MOCK_PROJECTS[projectIndex]);
      }),

      http.post(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/restore`, ({ params }) => {
        const projectIndex = MOCK_PROJECTS.findIndex((p) => p.id === params.id);
        if (projectIndex === -1) {
          return HttpResponse.json({ error: "Project not found" }, { status: 404 });
        }

        MOCK_PROJECTS[projectIndex] = {
          ...MOCK_PROJECTS[projectIndex],
          status: "ACTIVE",
          updatedAt: new Date(),
        };

        return HttpResponse.json(MOCK_PROJECTS[projectIndex]);
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/stats`, ({ params }) => {
        const project = MOCK_PROJECTS.find((p) => p.id === params.id);
        if (!project) {
          return HttpResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Mock project statistics
        return HttpResponse.json({
          totalBookings: 156,
          totalRevenue: 2340000,
          occupancyRate: 0.78,
          averageRating: 4.6,
          totalGuests: 387,
          repeatCustomers: 23,
          monthlyGrowth: 0.12,
        });
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/members`, ({ params }) => {
        const members = MOCK_PROJECT_MEMBERS.filter((m) => m.projectId === params.id);
        return HttpResponse.json(members);
      }),

      http.post(
        `${TEST_CONSTANTS.API_BASE_URL}/projects/:id/members/invite`,
        async ({ params, request }) => {
          const data = (await request.json()) as InviteMemberRequest;

          // Validate email format
          if (!data.email.includes("@")) {
            return HttpResponse.json({ error: "Invalid email format" }, { status: 400 });
          }

          // Check if user already exists in project
          if (
            MOCK_PROJECT_MEMBERS.some((m) => m.projectId === params.id && m.userId === data.email)
          ) {
            return HttpResponse.json({ error: "User already member of project" }, { status: 409 });
          }

          // Create new membership
          const newMembership: ProjectMembership = {
            id: `membership-${Date.now()}`,
            projectId: params.id as string,
            userId: `user-${Date.now()}`, // Mock user ID
            role: data.role,
            permissions: data.permissions || [],
            invitedBy: MOCK_USERS.OWNER.id,
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          MOCK_PROJECT_MEMBERS.push(newMembership);
          return HttpResponse.json(newMembership, { status: 201 });
        }
      ),

      http.delete(
        `${TEST_CONSTANTS.API_BASE_URL}/projects/:projectId/members/:userId`,
        ({ params }) => {
          const membershipIndex = MOCK_PROJECT_MEMBERS.findIndex(
            (m) => m.projectId === params.projectId && m.userId === params.userId
          );

          if (membershipIndex === -1) {
            return HttpResponse.json({ error: "Member not found" }, { status: 404 });
          }

          // Don't allow removing the owner
          if (MOCK_PROJECT_MEMBERS[membershipIndex].role === "OWNER") {
            return HttpResponse.json({ error: "Cannot remove project owner" }, { status: 403 });
          }

          MOCK_PROJECT_MEMBERS.splice(membershipIndex, 1);
          return HttpResponse.json({ message: "Member removed successfully" });
        }
      ),

      http.patch(
        `${TEST_CONSTANTS.API_BASE_URL}/projects/:projectId/members/:userId`,
        async ({ params, request }) => {
          const updates = (await request.json()) as UpdateMemberRoleRequest;
          const membershipIndex = MOCK_PROJECT_MEMBERS.findIndex(
            (m) => m.projectId === params.projectId && m.userId === params.userId
          );

          if (membershipIndex === -1) {
            return HttpResponse.json({ error: "Member not found" }, { status: 404 });
          }

          // Don't allow changing owner role
          if (MOCK_PROJECT_MEMBERS[membershipIndex].role === "OWNER") {
            return HttpResponse.json({ error: "Cannot change owner role" }, { status: 403 });
          }

          // Update membership
          MOCK_PROJECT_MEMBERS[membershipIndex] = {
            ...MOCK_PROJECT_MEMBERS[membershipIndex],
            role: updates.role,
            permissions: updates.permissions || MOCK_PROJECT_MEMBERS[membershipIndex].permissions,
            updatedAt: new Date(),
          };

          return HttpResponse.json(MOCK_PROJECT_MEMBERS[membershipIndex]);
        }
      ),

      http.post(
        `${TEST_CONSTANTS.API_BASE_URL}/projects/:id/transfer`,
        async ({ params, request }) => {
          const { newOwnerId } = (await request.json()) as { newOwnerId: string };
          const projectIndex = MOCK_PROJECTS.findIndex((p) => p.id === params.id);

          if (projectIndex === -1) {
            return HttpResponse.json({ error: "Project not found" }, { status: 404 });
          }

          // Verify new owner is a member
          const newOwnerMembership = MOCK_PROJECT_MEMBERS.find(
            (m) => m.projectId === params.id && m.userId === newOwnerId
          );

          if (!newOwnerMembership) {
            return HttpResponse.json(
              { error: "New owner must be a project member" },
              { status: 400 }
            );
          }

          // Transfer ownership
          MOCK_PROJECTS[projectIndex] = {
            ...MOCK_PROJECTS[projectIndex],
            ownerId: newOwnerId,
            updatedAt: new Date(),
          };

          // Update memberships
          MOCK_PROJECT_MEMBERS.forEach((membership) => {
            if (membership.projectId === params.id) {
              if (membership.userId === newOwnerId) {
                membership.role = "OWNER";
                membership.permissions = ["ALL"];
              } else if (membership.role === "OWNER") {
                membership.role = "MANAGER";
                membership.permissions = [
                  "BOOKINGS_READ",
                  "BOOKINGS_WRITE",
                  "GUESTS_READ",
                  "REPORTS_READ",
                ];
              }
              membership.updatedAt = new Date();
            }
          });

          return HttpResponse.json(MOCK_PROJECTS[projectIndex]);
        }
      ),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/activity`, ({ request, params }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "10");

        const activityLogs = MOCK_ACTIVITY_LOGS.filter((log) => log.projectId === params.id);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedLogs = activityLogs.slice(startIndex, endIndex);

        return HttpResponse.json({
          data: paginatedLogs,
          meta: {
            page,
            limit,
            total: activityLogs.length,
            pages: Math.ceil(activityLogs.length / limit),
          },
        });
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/export`, ({ request, params }) => {
        const url = new URL(request.url);
        const format = url.searchParams.get("format");

        if (!format || !["json", "csv", "excel"].includes(format)) {
          return HttpResponse.json({ error: "Invalid export format" }, { status: 400 });
        }

        // Return mock blob data
        const mockData =
          format === "json"
            ? JSON.stringify({ project: MOCK_PROJECTS.find((p) => p.id === params.id) })
            : "Project Name,Type,Status\nOkaeri Resort,Beach Resort,Active";

        return new Response(mockData, {
          headers: {
            "Content-Type":
              format === "json"
                ? "application/json"
                : format === "csv"
                  ? "text/csv"
                  : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="project-export.${format}"`,
          },
        });
      }),

      http.post(
        `${TEST_CONSTANTS.API_BASE_URL}/projects/:id/import`,
        async ({ params, request }) => {
          const formData = await request.formData();
          const file = formData.get("file") as File;

          if (!file) {
            return HttpResponse.json({ error: "No file provided" }, { status: 400 });
          }

          // Mock successful import
          return HttpResponse.json({
            imported: 25,
            updated: 5,
            failed: 2,
            errors: [
              { row: 15, error: "Invalid date format" },
              { row: 23, error: "Missing required field" },
            ],
          });
        }
      )
    );
  });

  afterEach(() => {
    // Reset mock projects to original state
    MOCK_PROJECTS.splice(0);
    MOCK_PROJECTS.push(
      ...[
        {
          id: "project-boracay-1",
          name: "Okaeri Boracay Resort",
          type: "BEACH_RESORT",
          description: "Premium beachfront resort in Boracay Station 2",
          status: "ACTIVE",
          currency: "PHP",
          timezone: "Asia/Manila",
          locale: "en-PH",
          ownerId: MOCK_USERS.OWNER.id,
          config: {
            businessHours: "8:00-18:00",
            checkInTime: "14:00",
            checkOutTime: "12:00",
            allowOnlineBooking: true,
            requireDeposit: true,
            depositPercentage: 50,
          },
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-15"),
        },
        {
          id: "project-palawan-1",
          name: "Paradise Bay El Nido",
          type: "ECO_RESORT",
          description: "Eco-friendly resort in El Nido, Palawan",
          status: "ACTIVE",
          currency: "PHP",
          timezone: "Asia/Manila",
          locale: "en-PH",
          ownerId: MOCK_USERS.OWNER.id,
          config: {
            businessHours: "7:00-19:00",
            checkInTime: "15:00",
            checkOutTime: "11:00",
            allowOnlineBooking: true,
            requireDeposit: false,
          },
          createdAt: new Date("2024-01-10"),
          updatedAt: new Date("2024-01-20"),
        },
        {
          id: "project-bohol-1",
          name: "Sunset Villa Bohol",
          type: "VILLA",
          description: "Private villa rentals in Panglao Island",
          status: "ARCHIVED",
          currency: "PHP",
          timezone: "Asia/Manila",
          locale: "en-PH",
          ownerId: MOCK_USERS.OWNER.id,
          config: {
            businessHours: "8:00-17:00",
            checkInTime: "16:00",
            checkOutTime: "10:00",
            allowOnlineBooking: false,
            requireDeposit: true,
            depositPercentage: 30,
          },
          createdAt: new Date("2023-12-01"),
          updatedAt: new Date("2024-01-05"),
        },
      ]
    );

    MOCK_PROJECT_MEMBERS.splice(0);
    MOCK_PROJECT_MEMBERS.push(
      ...[
        {
          id: "membership-1",
          projectId: "project-boracay-1",
          userId: MOCK_USERS.OWNER.id,
          role: "OWNER",
          permissions: ["ALL"],
          invitedBy: null,
          joinedAt: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
        {
          id: "membership-2",
          projectId: "project-boracay-1",
          userId: MOCK_USERS.MANAGER.id,
          role: "MANAGER",
          permissions: ["BOOKINGS_READ", "BOOKINGS_WRITE", "GUESTS_READ", "REPORTS_READ"],
          invitedBy: MOCK_USERS.OWNER.id,
          joinedAt: new Date("2024-01-02"),
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "membership-3",
          projectId: "project-boracay-1",
          userId: MOCK_USERS.STAFF.id,
          role: "STAFF",
          permissions: ["BOOKINGS_READ", "GUESTS_READ"],
          invitedBy: MOCK_USERS.MANAGER.id,
          joinedAt: new Date("2024-01-03"),
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date("2024-01-03"),
        },
      ]
    );
  });

  describe("GET /projects", () => {
    it("should list all projects for current user", async () => {
      const projects = await projectsApi.getProjects();

      expect(projects).toHaveLength(3);
      expect(projects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Okaeri Boracay Resort",
            type: "BEACH_RESORT",
            currency: "PHP",
            timezone: "Asia/Manila",
          }),
        ])
      );
    });

    it("should filter projects by status", async () => {
      const activeProjects = await projectsApi.getProjects({ status: "ACTIVE" });

      expect(activeProjects).toHaveLength(2);
      expect(activeProjects.every((p) => p.status === "ACTIVE")).toBe(true);
    });

    it("should search projects by name", async () => {
      const searchResults = await projectsApi.getProjects({ search: "boracay" });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe("Okaeri Boracay Resort");
    });
  });

  describe("GET /projects/paginated", () => {
    it("should return paginated projects", async () => {
      const result = await projectsApi.getProjectsPaginated({
        page: 1,
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2,
      });
    });

    it("should handle second page pagination", async () => {
      const result = await projectsApi.getProjectsPaginated({
        page: 2,
        limit: 2,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(2);
    });

    it("should search within paginated results", async () => {
      const result = await projectsApi.getProjectsPaginated({
        page: 1,
        limit: 10,
        search: "Paradise",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Paradise Bay El Nido");
    });
  });

  describe("GET /projects/:id", () => {
    it("should return specific project with Philippine settings", async () => {
      const project = await projectsApi.getProject("project-boracay-1");

      expect(project).toMatchObject({
        id: "project-boracay-1",
        name: "Okaeri Boracay Resort",
        currency: "PHP",
        timezone: "Asia/Manila",
        locale: "en-PH",
        config: expect.objectContaining({
          checkInTime: "14:00",
          checkOutTime: "12:00",
          requireDeposit: true,
        }),
      });
    });

    it("should return 404 for non-existent project", async () => {
      await expect(projectsApi.getProject("non-existent")).rejects.toMatchObject({
        status: 404,
        message: "Project not found",
      });
    });
  });

  describe("POST /projects", () => {
    it("should create project with Philippine resort data", async () => {
      const projectData: CreateProjectRequest = {
        name: philippineTestData.validProjectNames[1],
        type: "BEACH_RESORT",
        description: "New beachfront resort in Siargao",
        currency: "PHP",
        timezone: "Asia/Manila",
        locale: "en-PH",
      };

      const result = await projectsApi.createProject(projectData);

      expect(result).toMatchObject({
        id: expect.stringContaining("project-"),
        name: projectData.name,
        type: projectData.type,
        description: projectData.description,
        currency: "PHP",
        timezone: "Asia/Manila",
        locale: "en-PH",
        status: "ACTIVE",
      });
    });

    it("should create project with minimal required fields", async () => {
      const projectData: CreateProjectRequest = {
        name: "Minimal Resort",
        type: "HOTEL",
      };

      const result = await projectsApi.createProject(projectData);

      expect(result).toMatchObject({
        name: "Minimal Resort",
        type: "HOTEL",
        currency: "PHP", // Default
        timezone: "Asia/Manila", // Default
        locale: "en-PH", // Default
      });
    });

    it("should validate required fields", async () => {
      const incompleteData = {
        name: "Test Resort",
        // Missing type
      } as CreateProjectRequest;

      await expect(projectsApi.createProject(incompleteData)).rejects.toMatchObject({
        status: 400,
        message: "Missing required fields",
      });
    });

    it("should prevent duplicate project names", async () => {
      const projectData: CreateProjectRequest = {
        name: "Okaeri Boracay Resort", // Existing name
        type: "BEACH_RESORT",
      };

      await expect(projectsApi.createProject(projectData)).rejects.toMatchObject({
        status: 409,
        message: "Project name already exists",
      });
    });
  });

  describe("PATCH /projects/:id", () => {
    it("should update project details", async () => {
      const updates: UpdateProjectRequest = {
        name: "Okaeri Boracay Premium Resort",
        description: "Updated premium beachfront resort",
        config: {
          businessHours: "7:00-20:00",
          allowOnlineBooking: false,
        },
      };

      const result = await projectsApi.updateProject("project-boracay-1", updates);

      expect(result).toMatchObject({
        id: "project-boracay-1",
        name: updates.name,
        description: updates.description,
        config: expect.objectContaining(updates.config),
        updatedAt: expect.any(Date),
      });
    });

    it("should return 404 for non-existent project", async () => {
      await expect(
        projectsApi.updateProject("non-existent", {
          name: "Updated Name",
        })
      ).rejects.toMatchObject({
        status: 404,
        message: "Project not found",
      });
    });
  });

  describe("DELETE /projects/:id", () => {
    it("should delete project successfully", async () => {
      await expect(projectsApi.deleteProject("project-bohol-1")).resolves.toBeUndefined();
    });

    it("should return 404 for non-existent project", async () => {
      await expect(projectsApi.deleteProject("non-existent")).rejects.toMatchObject({
        status: 404,
        message: "Project not found",
      });
    });
  });

  describe("POST /projects/:id/archive", () => {
    it("should archive project successfully", async () => {
      const result = await projectsApi.archiveProject("project-palawan-1");

      expect(result).toMatchObject({
        id: "project-palawan-1",
        status: "ARCHIVED",
        updatedAt: expect.any(Date),
      });
    });

    it("should return 404 for non-existent project", async () => {
      await expect(projectsApi.archiveProject("non-existent")).rejects.toMatchObject({
        status: 404,
        message: "Project not found",
      });
    });
  });

  describe("POST /projects/:id/restore", () => {
    it("should restore archived project", async () => {
      const result = await projectsApi.restoreProject("project-bohol-1");

      expect(result).toMatchObject({
        id: "project-bohol-1",
        status: "ACTIVE",
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("GET /projects/:id/stats", () => {
    it("should return project statistics", async () => {
      const stats = await projectsApi.getProjectStats("project-boracay-1");

      expect(stats).toMatchObject({
        totalBookings: expect.any(Number),
        totalRevenue: expect.any(Number),
        occupancyRate: expect.any(Number),
        averageRating: expect.any(Number),
        totalGuests: expect.any(Number),
        repeatCustomers: expect.any(Number),
        monthlyGrowth: expect.any(Number),
      });
    });

    it("should return 404 for non-existent project", async () => {
      await expect(projectsApi.getProjectStats("non-existent")).rejects.toMatchObject({
        status: 404,
        message: "Project not found",
      });
    });
  });

  describe("Team Management", () => {
    describe("GET /projects/:id/members", () => {
      it("should return project members", async () => {
        const members = await projectsApi.getProjectMembers("project-boracay-1");

        expect(members).toHaveLength(3);
        expect(members).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: "OWNER",
              permissions: ["ALL"],
            }),
            expect.objectContaining({
              role: "MANAGER",
              permissions: expect.arrayContaining(["BOOKINGS_READ", "BOOKINGS_WRITE"]),
            }),
            expect.objectContaining({
              role: "STAFF",
              permissions: expect.arrayContaining(["BOOKINGS_READ"]),
            }),
          ])
        );
      });

      it("should return empty array for project with no members", async () => {
        const members = await projectsApi.getProjectMembers("project-palawan-1");
        expect(members).toHaveLength(0);
      });
    });

    describe("POST /projects/:id/members/invite", () => {
      it("should invite new member successfully", async () => {
        const inviteData: InviteMemberRequest = {
          email: "newstaff@okaeriresort.ph",
          role: "STAFF",
          permissions: ["BOOKINGS_READ"],
        };

        const result = await projectsApi.inviteMember("project-boracay-1", inviteData);

        expect(result).toMatchObject({
          id: expect.stringContaining("membership-"),
          projectId: "project-boracay-1",
          role: "STAFF",
          permissions: ["BOOKINGS_READ"],
          invitedBy: MOCK_USERS.OWNER.id,
        });
      });

      it("should validate email format", async () => {
        const inviteData: InviteMemberRequest = {
          email: "invalid-email",
          role: "STAFF",
        };

        await expect(
          projectsApi.inviteMember("project-boracay-1", inviteData)
        ).rejects.toMatchObject({
          status: 400,
          message: "Invalid email format",
        });
      });

      it("should prevent duplicate invitations", async () => {
        const inviteData: InviteMemberRequest = {
          email: MOCK_USERS.MANAGER.email,
          role: "STAFF",
        };

        server.use(
          http.post(
            `${TEST_CONSTANTS.API_BASE_URL}/projects/project-boracay-1/members/invite`,
            () => {
              return HttpResponse.json(
                { error: "User already member of project" },
                { status: 409 }
              );
            }
          )
        );

        await expect(
          projectsApi.inviteMember("project-boracay-1", inviteData)
        ).rejects.toMatchObject({
          status: 409,
          message: "User already member of project",
        });
      });
    });

    describe("DELETE /projects/:projectId/members/:userId", () => {
      it("should remove member successfully", async () => {
        await expect(
          projectsApi.removeMember("project-boracay-1", MOCK_USERS.STAFF.id)
        ).resolves.toBeUndefined();
      });

      it("should prevent removing project owner", async () => {
        await expect(
          projectsApi.removeMember("project-boracay-1", MOCK_USERS.OWNER.id)
        ).rejects.toMatchObject({
          status: 403,
          message: "Cannot remove project owner",
        });
      });

      it("should return 404 for non-existent member", async () => {
        await expect(
          projectsApi.removeMember("project-boracay-1", "non-existent-user")
        ).rejects.toMatchObject({
          status: 404,
          message: "Member not found",
        });
      });
    });

    describe("PATCH /projects/:projectId/members/:userId", () => {
      it("should update member role and permissions", async () => {
        const updates: UpdateMemberRoleRequest = {
          role: "MANAGER",
          permissions: ["BOOKINGS_READ", "BOOKINGS_WRITE", "REPORTS_READ"],
        };

        const result = await projectsApi.updateMemberRole(
          "project-boracay-1",
          MOCK_USERS.STAFF.id,
          updates
        );

        expect(result).toMatchObject({
          userId: MOCK_USERS.STAFF.id,
          role: "MANAGER",
          permissions: updates.permissions,
          updatedAt: expect.any(Date),
        });
      });

      it("should prevent changing owner role", async () => {
        const updates: UpdateMemberRoleRequest = {
          role: "MANAGER",
        };

        await expect(
          projectsApi.updateMemberRole("project-boracay-1", MOCK_USERS.OWNER.id, updates)
        ).rejects.toMatchObject({
          status: 403,
          message: "Cannot change owner role",
        });
      });
    });

    describe("POST /projects/:id/transfer", () => {
      it("should transfer project ownership", async () => {
        const result = await projectsApi.transferOwnership(
          "project-boracay-1",
          MOCK_USERS.MANAGER.id
        );

        expect(result).toMatchObject({
          id: "project-boracay-1",
          ownerId: MOCK_USERS.MANAGER.id,
          updatedAt: expect.any(Date),
        });
      });

      it("should require new owner to be project member", async () => {
        await expect(
          projectsApi.transferOwnership("project-boracay-1", "non-member-user")
        ).rejects.toMatchObject({
          status: 400,
          message: "New owner must be a project member",
        });
      });
    });
  });

  describe("GET /projects/:id/activity", () => {
    it("should return project activity log", async () => {
      const result = await projectsApi.getActivityLog("project-boracay-1", {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "PROJECT_CREATED",
            description: "Project created",
          }),
          expect.objectContaining({
            action: "BOOKING_CREATED",
            metadata: expect.objectContaining({
              guestName: "Juan Dela Cruz",
            }),
          }),
        ])
      );

      expect(result.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1,
      });
    });
  });

  describe("Data Export/Import", () => {
    describe("GET /projects/:id/export", () => {
      it("should export project data in JSON format", async () => {
        const result = await projectsApi.exportProjectData("project-boracay-1", "json");

        expect(result).toBeInstanceOf(Blob);
      });

      it("should export project data in CSV format", async () => {
        const result = await projectsApi.exportProjectData("project-boracay-1", "csv");

        expect(result).toBeInstanceOf(Blob);
      });

      it("should export project data in Excel format", async () => {
        const result = await projectsApi.exportProjectData("project-boracay-1", "excel");

        expect(result).toBeInstanceOf(Blob);
      });

      it("should validate export format", async () => {
        server.use(
          http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/project-boracay-1/export`, () => {
            return HttpResponse.json({ error: "Invalid export format" }, { status: 400 });
          })
        );

        await expect(
          projectsApi.exportProjectData("project-boracay-1", "invalid" as any)
        ).rejects.toMatchObject({
          status: 400,
          message: "Invalid export format",
        });
      });
    });

    describe("POST /projects/:id/import", () => {
      it("should import project data successfully", async () => {
        const csvContent = "Name,Email,Phone\nJuan,juan@test.com,+639171234567";
        const file = new File([csvContent], "import.csv", { type: "text/csv" });

        const result = await projectsApi.importProjectData("project-boracay-1", file);

        expect(result).toMatchObject({
          imported: 25,
          updated: 5,
          failed: 2,
          errors: expect.arrayContaining([{ row: 15, error: "Invalid date format" }]),
        });
      });

      it("should handle missing file", async () => {
        // @ts-expect-error - Testing invalid input
        await expect(
          projectsApi.importProjectData("project-boracay-1", null)
        ).rejects.toMatchObject({
          status: 400,
          message: "No file provided",
        });
      });
    });
  });

  describe("Philippine resort-specific configurations", () => {
    it("should handle different resort types", async () => {
      const resortTypes = ["BEACH_RESORT", "ECO_RESORT", "VILLA", "HOTEL", "BOUTIQUE"];

      for (const type of resortTypes) {
        const projectData: CreateProjectRequest = {
          name: `Test ${type} Resort`,
          type,
        };

        const result = await projectsApi.createProject(projectData);
        expect(result.type).toBe(type);
      }
    });

    it("should handle Philippine timezone and locale settings", async () => {
      const project = await projectsApi.getProject("project-boracay-1");

      expect(project.timezone).toBe("Asia/Manila");
      expect(project.locale).toBe("en-PH");
      expect(project.currency).toBe("PHP");
    });

    it("should handle resort-specific configurations", async () => {
      const project = await projectsApi.getProject("project-boracay-1");

      expect(project.config).toMatchObject({
        businessHours: "8:00-18:00",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        requireDeposit: true,
        depositPercentage: 50,
      });
    });
  });

  describe("Multi-tenant isolation", () => {
    it("should only show projects for current user", async () => {
      // All mock projects belong to MOCK_USERS.OWNER
      const projects = await projectsApi.getProjects();

      expect(projects.every((p) => p.ownerId === MOCK_USERS.OWNER.id)).toBe(true);
    });

    it("should prevent access to other tenant's projects", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/other-tenant-project`, () => {
          return HttpResponse.json({ error: "Project not found" }, { status: 404 });
        })
      );

      await expect(projectsApi.getProject("other-tenant-project")).rejects.toMatchObject({
        status: 404,
        message: "Project not found",
      });
    });
  });
});
