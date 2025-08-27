/**
 * Comprehensive tests for project store
 * Tests multi-tenant project management, team operations, and properties
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProjectStore } from "../projectStore";
import { PhilippineDataGenerator } from "@tests/utils/tdd-helpers";
import { MOCK_USERS } from "@tests/utils/test-utils";

// Mock dependencies
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    setActiveProject: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api-client";

// Mock data builders
const createMockProject = (overrides = {}) => ({
  id: `project-${Date.now()}`,
  name: PhilippineDataGenerator.resortName(),
  type: "RESORT",
  description: "A beautiful beach resort in the Philippines",
  currency: "PHP",
  timezone: "Asia/Manila",
  locale: "en-PH",
  status: "ACTIVE",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockProperty = (overrides = {}) => ({
  id: `property-${Date.now()}`,
  name: `Villa ${Math.floor(Math.random() * 100)}`,
  type: "VILLA",
  capacity: 8,
  bedrooms: 3,
  bathrooms: 2,
  address: PhilippineDataGenerator.address(),
  amenities: ["WiFi", "Pool", "Kitchen", "Air Conditioning"],
  rates: {
    peak: PhilippineDataGenerator.phpAmount(15000, 25000),
    regular: PhilippineDataGenerator.phpAmount(10000, 18000),
    low: PhilippineDataGenerator.phpAmount(7000, 12000),
  },
  ...overrides,
});

describe("ProjectStore - Multi-Tenant Management Tests", () => {
  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useProjectStore());
    act(() => {
      result.current.setProjects([]);
      result.current.setActiveProjectLocal(null);
      result.current.setProperties([]);
      result.current.setError(null);
      result.current.setLoading(false);
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Project Management", () => {
    it("should fetch all user projects and set first as active", async () => {
      const mockProjects = [
        createMockProject({ id: "project-1", name: "Paradise Beach Resort" }),
        createMockProject({ id: "project-2", name: "Sunset Villa" }),
        createMockProject({ id: "project-3", name: "Ocean View Lodge" }),
      ];

      (apiClient.get as any).mockResolvedValue({ data: mockProjects });

      const { result } = renderHook(() => useProjectStore());

      await act(async () => {
        await result.current.fetchProjects();
      });

      expect(result.current.projects).toEqual(mockProjects);
      expect(result.current.activeProjectId).toBe("project-1");
      expect(result.current.activeProject).toEqual(mockProjects[0]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastFetch).toBeTruthy();

      expect(apiClient.get).toHaveBeenCalledWith("/projects");
      expect(apiClient.setActiveProject).toHaveBeenCalledWith("project-1");
    });

    it("should handle fetch projects error", async () => {
      const error = new Error("Network error");
      (apiClient.get as any).mockRejectedValue(error);

      const { result } = renderHook(() => useProjectStore());

      await expect(
        act(async () => {
          await result.current.fetchProjects();
        })
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Network error");
    });

    it("should not set active project if no projects exist", async () => {
      (apiClient.get as any).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useProjectStore());

      await act(async () => {
        await result.current.fetchProjects();
      });

      expect(result.current.projects).toEqual([]);
      expect(result.current.activeProjectId).toBe(null);
      expect(result.current.activeProject).toBe(null);
    });

    it("should fetch project by ID and update state", async () => {
      const mockProject = createMockProject({ id: "project-123" });
      (apiClient.get as any).mockResolvedValue({ data: mockProject });

      const { result } = renderHook(() => useProjectStore());

      const project = await act(async () => {
        return await result.current.fetchProjectById("project-123");
      });

      expect(project).toEqual(mockProject);
      expect(result.current.projects).toContainEqual(mockProject);
      expect(apiClient.get).toHaveBeenCalledWith("/projects/project-123");
    });

    it("should update active project if fetched project is currently active", async () => {
      const originalProject = createMockProject({ id: "project-123", name: "Original Name" });
      const updatedProject = { ...originalProject, name: "Updated Name" };

      const { result } = renderHook(() => useProjectStore());

      // Set initial state
      act(() => {
        result.current.setProjects([originalProject]);
        result.current.setActiveProjectLocal(originalProject);
      });

      (apiClient.get as any).mockResolvedValue({ data: updatedProject });

      await act(async () => {
        await result.current.fetchProjectById("project-123");
      });

      expect(result.current.activeProject).toEqual(updatedProject);
      expect(result.current.projects[0]).toEqual(updatedProject);
    });
  });

  describe("Create Project", () => {
    it("should create new project and set as active", async () => {
      const projectData = {
        name: "New Beach Resort",
        type: "RESORT",
        description: "A new resort project",
        currency: "PHP",
        timezone: "Asia/Manila",
        locale: "en-PH",
      };

      const createdProject = createMockProject({ ...projectData, id: "new-project-123" });
      (apiClient.post as any).mockResolvedValue({ data: createdProject });

      const { result } = renderHook(() => useProjectStore());

      const project = await act(async () => {
        return await result.current.createProject(projectData);
      });

      expect(project).toEqual(createdProject);
      expect(result.current.projects).toContainEqual(createdProject);
      expect(result.current.activeProjectId).toBe("new-project-123");
      expect(result.current.activeProject).toEqual(createdProject);

      expect(apiClient.post).toHaveBeenCalledWith("/projects", projectData);
      expect(apiClient.setActiveProject).toHaveBeenCalledWith("new-project-123");
    });

    it("should handle create project error", async () => {
      const projectData = {
        name: "New Resort",
        type: "RESORT",
      };

      const error = new Error("Creation failed");
      (apiClient.post as any).mockRejectedValue(error);

      const { result } = renderHook(() => useProjectStore());

      await expect(
        act(async () => {
          await result.current.createProject(projectData);
        })
      ).rejects.toThrow("Creation failed");

      expect(result.current.error).toBe("Creation failed");
    });
  });

  describe("Update Project", () => {
    it("should update project and refresh active project if same", async () => {
      const originalProject = createMockProject({
        id: "project-123",
        name: "Original Resort",
      });

      const updateData = {
        name: "Updated Resort Name",
        description: "Updated description",
      };

      const updatedProject = { ...originalProject, ...updateData };

      const { result } = renderHook(() => useProjectStore());

      // Set initial state
      act(() => {
        result.current.setProjects([originalProject]);
        result.current.setActiveProjectLocal(originalProject);
      });

      (apiClient.patch as any).mockResolvedValue({ data: updatedProject });

      await act(async () => {
        await result.current.updateProject("project-123", updateData);
      });

      expect(result.current.projects[0]).toEqual(updatedProject);
      expect(result.current.activeProject).toEqual(updatedProject);
      expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-123", updateData);
    });

    it("should archive project", async () => {
      const project = createMockProject({ id: "project-123", status: "ACTIVE" });
      const archivedProject = { ...project, status: "ARCHIVED" };

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
      });

      (apiClient.patch as any).mockResolvedValue({ data: archivedProject });

      await act(async () => {
        await result.current.archiveProject("project-123");
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-123", {
        status: "ARCHIVED",
      });
    });
  });

  describe("Delete Project", () => {
    it("should delete project and switch to another if active", async () => {
      const projects = [
        createMockProject({ id: "project-1" }),
        createMockProject({ id: "project-2" }),
        createMockProject({ id: "project-3" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      // Set initial state with project-2 as active
      act(() => {
        result.current.setProjects(projects);
        result.current.setActiveProjectLocal(projects[1]);
      });

      (apiClient.delete as any).mockResolvedValue({});

      await act(async () => {
        await result.current.deleteProject("project-2");
      });

      // Project should be removed
      expect(result.current.projects).toHaveLength(2);
      expect(result.current.projects.find((p) => p.id === "project-2")).toBeUndefined();

      // Should switch to first remaining project
      expect(result.current.activeProjectId).toBe("project-1");

      expect(apiClient.delete).toHaveBeenCalledWith("/projects/project-2");
    });

    it("should clear active project if deleting last project", async () => {
      const project = createMockProject({ id: "project-123" });

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectLocal(project);
        result.current.setProperties([createMockProperty()]);
      });

      (apiClient.delete as any).mockResolvedValue({});

      await act(async () => {
        await result.current.deleteProject("project-123");
      });

      expect(result.current.projects).toHaveLength(0);
      expect(result.current.activeProject).toBe(null);
      expect(result.current.activeProjectId).toBe(null);
      expect(result.current.properties).toHaveLength(0);
    });
  });

  describe("Active Project Management", () => {
    it("should set active project and fetch properties", async () => {
      const project = createMockProject({ id: "project-123" });
      const mockProperties = [
        createMockProperty({ id: "prop-1" }),
        createMockProperty({ id: "prop-2" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
      });

      (apiClient.get as any).mockResolvedValue({ data: mockProperties });

      await act(async () => {
        await result.current.setActiveProject("project-123");
      });

      expect(result.current.activeProject).toEqual(project);
      expect(result.current.activeProjectId).toBe("project-123");
      expect(result.current.properties).toEqual(mockProperties);

      expect(apiClient.setActiveProject).toHaveBeenCalledWith("project-123");
      expect(apiClient.get).toHaveBeenCalledWith("/projects/project-123/properties");
    });

    it("should fetch project if not in state when setting active", async () => {
      const project = createMockProject({ id: "project-456" });
      const mockProperties = [];

      const { result } = renderHook(() => useProjectStore());

      (apiClient.get as any)
        .mockResolvedValueOnce({ data: project }) // fetchProjectById
        .mockResolvedValueOnce({ data: mockProperties }); // fetchProperties

      await act(async () => {
        await result.current.setActiveProject("project-456");
      });

      expect(result.current.activeProject).toEqual(project);
      expect(result.current.projects).toContainEqual(project);
      expect(apiClient.get).toHaveBeenCalledWith("/projects/project-456");
    });

    it("should clear active project when setting to null", async () => {
      const project = createMockProject({ id: "project-123" });

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectLocal(project);
        result.current.setProperties([createMockProperty()]);
      });

      await act(async () => {
        await result.current.setActiveProject(null);
      });

      expect(result.current.activeProject).toBe(null);
      expect(result.current.activeProjectId).toBe(null);
      expect(result.current.properties).toHaveLength(0);
      expect(apiClient.setActiveProject).toHaveBeenCalledWith(null);
    });

    it("should handle error when fetching non-existent project", async () => {
      const error = new Error("Project not found");
      (apiClient.get as any).mockRejectedValue(error);

      const { result } = renderHook(() => useProjectStore());

      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await act(async () => {
        await result.current.setActiveProject("non-existent");
      });

      expect(result.current.activeProject).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch project:", error);

      consoleSpy.mockRestore();
    });

    it("should use switchProject as alias for setActiveProject", async () => {
      const project = createMockProject({ id: "project-123" });

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
      });

      const setActiveProjectSpy = vi.spyOn(result.current, "setActiveProject");

      (apiClient.get as any).mockResolvedValue({ data: [] });

      await act(async () => {
        await result.current.switchProject("project-123");
      });

      expect(setActiveProjectSpy).toHaveBeenCalledWith("project-123");
      expect(result.current.activeProjectId).toBe("project-123");
    });
  });

  describe("Properties Management", () => {
    it("should fetch properties for active project", async () => {
      const mockProperties = [
        createMockProperty({ id: "prop-1", name: "Beach Villa" }),
        createMockProperty({ id: "prop-2", name: "Ocean Suite" }),
        createMockProperty({ id: "prop-3", name: "Garden Cottage" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setActiveProjectLocal(createMockProject({ id: "project-123" }));
      });

      (apiClient.get as any).mockResolvedValue({ data: mockProperties });

      await act(async () => {
        await result.current.fetchProperties();
      });

      expect(result.current.properties).toEqual(mockProperties);
      expect(apiClient.get).toHaveBeenCalledWith("/projects/project-123/properties");
    });

    it("should not fetch properties if no active project", async () => {
      const { result } = renderHook(() => useProjectStore());

      await act(async () => {
        await result.current.fetchProperties();
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should create property for active project", async () => {
      const propertyData = {
        name: "New Villa",
        type: "VILLA",
        capacity: 10,
        bedrooms: 4,
        bathrooms: 3,
        address: PhilippineDataGenerator.address(),
        amenities: ["Pool", "WiFi"],
        rates: {
          peak: "20000.00",
          regular: "15000.00",
          low: "10000.00",
        },
      };

      const createdProperty = createMockProperty({ ...propertyData, id: "new-prop-123" });

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setActiveProjectLocal(createMockProject({ id: "project-123" }));
      });

      (apiClient.post as any).mockResolvedValue({ data: createdProperty });

      const property = await act(async () => {
        return await result.current.createProperty(propertyData);
      });

      expect(property).toEqual(createdProperty);
      expect(result.current.properties).toContainEqual(createdProperty);

      expect(apiClient.post).toHaveBeenCalledWith("/projects/project-123/properties", propertyData);
    });

    it("should require active project to create property", async () => {
      const { result } = renderHook(() => useProjectStore());

      await expect(
        act(async () => {
          await result.current.createProperty({
            name: "Test Villa",
            type: "VILLA",
            capacity: 6,
          });
        })
      ).rejects.toThrow("No active project selected");
    });

    it("should update property", async () => {
      const originalProperty = createMockProperty({
        id: "prop-123",
        name: "Original Villa",
        capacity: 6,
      });

      const updateData = {
        name: "Updated Villa",
        capacity: 8,
      };

      const updatedProperty = { ...originalProperty, ...updateData };

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setActiveProjectLocal(createMockProject({ id: "project-123" }));
        result.current.setProperties([originalProperty]);
      });

      (apiClient.patch as any).mockResolvedValue({ data: updatedProperty });

      await act(async () => {
        await result.current.updateProperty("prop-123", updateData);
      });

      expect(result.current.properties[0]).toEqual(updatedProperty);
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/project-123/properties/prop-123",
        updateData
      );
    });

    it("should delete property", async () => {
      const properties = [
        createMockProperty({ id: "prop-1" }),
        createMockProperty({ id: "prop-2" }),
        createMockProperty({ id: "prop-3" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setActiveProjectLocal(createMockProject({ id: "project-123" }));
        result.current.setProperties(properties);
      });

      (apiClient.delete as any).mockResolvedValue({});

      await act(async () => {
        await result.current.deleteProperty("prop-2");
      });

      expect(result.current.properties).toHaveLength(2);
      expect(result.current.properties.find((p) => p.id === "prop-2")).toBeUndefined();

      expect(apiClient.delete).toHaveBeenCalledWith("/projects/project-123/properties/prop-2");
    });
  });

  describe("Team Management", () => {
    it("should invite team member and refresh project", async () => {
      const project = createMockProject({ id: "project-123" });
      const updatedProject = {
        ...project,
        members: [
          { userId: "user-1", role: "OWNER" },
          { userId: "user-2", role: "MANAGER" },
        ],
      };

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectLocal(project);
      });

      (apiClient.post as any).mockResolvedValue({});
      (apiClient.get as any).mockResolvedValue({ data: updatedProject });

      await act(async () => {
        await result.current.inviteTeamMember("manager@resort.ph", "MANAGER");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/projects/project-123/members/invite", {
        email: "manager@resort.ph",
        role: "MANAGER",
      });

      expect(apiClient.get).toHaveBeenCalledWith("/projects/project-123");
      expect(result.current.activeProject).toEqual(updatedProject);
    });

    it("should remove team member", async () => {
      const project = createMockProject({
        id: "project-123",
        members: [
          { userId: "user-1", role: "OWNER" },
          { userId: "user-2", role: "MANAGER" },
        ],
      });

      const updatedProject = {
        ...project,
        members: [{ userId: "user-1", role: "OWNER" }],
      };

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectLocal(project);
      });

      (apiClient.delete as any).mockResolvedValue({});
      (apiClient.get as any).mockResolvedValue({ data: updatedProject });

      await act(async () => {
        await result.current.removeTeamMember("user-2");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/projects/project-123/members/user-2");

      expect(result.current.activeProject).toEqual(updatedProject);
    });

    it("should update member role", async () => {
      const project = createMockProject({
        id: "project-123",
        members: [
          { userId: "user-1", role: "OWNER" },
          { userId: "user-2", role: "STAFF" },
        ],
      });

      const updatedProject = {
        ...project,
        members: [
          { userId: "user-1", role: "OWNER" },
          { userId: "user-2", role: "MANAGER" },
        ],
      };

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectLocal(project);
      });

      (apiClient.patch as any).mockResolvedValue({});
      (apiClient.get as any).mockResolvedValue({ data: updatedProject });

      await act(async () => {
        await result.current.updateMemberRole("user-2", "MANAGER");
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-123/members/user-2", {
        role: "MANAGER",
      });

      expect(result.current.activeProject).toEqual(updatedProject);
    });

    it("should require active project for team operations", async () => {
      const { result } = renderHook(() => useProjectStore());

      await expect(
        act(async () => {
          await result.current.inviteTeamMember("test@resort.ph", "STAFF");
        })
      ).rejects.toThrow("No active project selected");

      await expect(
        act(async () => {
          await result.current.removeTeamMember("user-123");
        })
      ).rejects.toThrow("No active project selected");

      await expect(
        act(async () => {
          await result.current.updateMemberRole("user-123", "MANAGER");
        })
      ).rejects.toThrow("No active project selected");
    });
  });

  describe("Utility Functions", () => {
    it("should get project by ID", () => {
      const projects = [
        createMockProject({ id: "project-1" }),
        createMockProject({ id: "project-2" }),
        createMockProject({ id: "project-3" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects(projects);
      });

      const project = result.current.getProjectById("project-2");
      expect(project).toEqual(projects[1]);

      const nonExistent = result.current.getProjectById("project-999");
      expect(nonExistent).toBeUndefined();
    });

    it("should get property by ID", () => {
      const properties = [
        createMockProperty({ id: "prop-1" }),
        createMockProperty({ id: "prop-2" }),
        createMockProperty({ id: "prop-3" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProperties(properties);
      });

      const property = result.current.getPropertyById("prop-2");
      expect(property).toEqual(properties[1]);

      const nonExistent = result.current.getPropertyById("prop-999");
      expect(nonExistent).toBeUndefined();
    });

    it("should check project access", () => {
      const projects = [
        createMockProject({ id: "project-1" }),
        createMockProject({ id: "project-2" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects(projects);
      });

      expect(result.current.hasProjectAccess("project-1")).toBe(true);
      expect(result.current.hasProjectAccess("project-2")).toBe(true);
      expect(result.current.hasProjectAccess("project-3")).toBe(false);
    });

    it("should refresh if cache expired", async () => {
      const mockProjects = [createMockProject()];
      (apiClient.get as any).mockResolvedValue({ data: mockProjects });

      const { result } = renderHook(() => useProjectStore());

      // Set lastFetch to expired time (more than 5 minutes ago)
      act(() => {
        (result.current as any).lastFetch = Date.now() - 6 * 60 * 1000;
      });

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(apiClient.get).toHaveBeenCalledWith("/projects");
    });

    it("should not refresh if cache is still valid", async () => {
      const { result } = renderHook(() => useProjectStore());

      // Set lastFetch to recent time
      act(() => {
        (result.current as any).lastFetch = Date.now() - 2 * 60 * 1000;
      });

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("Multi-Tenant Isolation", () => {
    it("should isolate data between projects", async () => {
      const project1 = createMockProject({ id: "project-1", name: "Resort A" });
      const project2 = createMockProject({ id: "project-2", name: "Resort B" });

      const propertiesProject1 = [
        createMockProperty({ id: "prop-1-1", name: "Villa A1" }),
        createMockProperty({ id: "prop-1-2", name: "Villa A2" }),
      ];

      const propertiesProject2 = [
        createMockProperty({ id: "prop-2-1", name: "Villa B1" }),
        createMockProperty({ id: "prop-2-2", name: "Villa B2" }),
      ];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project1, project2]);
      });

      // Set project 1 as active and load its properties
      (apiClient.get as any).mockResolvedValueOnce({ data: propertiesProject1 });

      await act(async () => {
        await result.current.setActiveProject("project-1");
      });

      expect(result.current.activeProjectId).toBe("project-1");
      expect(result.current.properties).toEqual(propertiesProject1);

      // Switch to project 2
      (apiClient.get as any).mockResolvedValueOnce({ data: propertiesProject2 });

      await act(async () => {
        await result.current.setActiveProject("project-2");
      });

      expect(result.current.activeProjectId).toBe("project-2");
      expect(result.current.properties).toEqual(propertiesProject2);
      expect(result.current.properties).not.toEqual(propertiesProject1);
    });

    it("should clear properties when switching projects", async () => {
      const project1 = createMockProject({ id: "project-1" });
      const project2 = createMockProject({ id: "project-2" });

      const properties1 = [createMockProperty()];
      const properties2 = [];

      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setProjects([project1, project2]);
      });

      (apiClient.get as any).mockResolvedValueOnce({ data: properties1 });

      await act(async () => {
        await result.current.setActiveProject("project-1");
      });

      expect(result.current.properties).toHaveLength(1);

      (apiClient.get as any).mockResolvedValueOnce({ data: properties2 });

      await act(async () => {
        await result.current.setActiveProject("project-2");
      });

      expect(result.current.properties).toHaveLength(0);
    });
  });

  describe("Philippine-Specific Features", () => {
    it("should set Philippine defaults for new project", async () => {
      const projectData = {
        name: "Boracay Paradise Resort",
        type: "RESORT",
        currency: "PHP",
        timezone: "Asia/Manila",
        locale: "en-PH",
      };

      const createdProject = createMockProject(projectData);
      (apiClient.post as any).mockResolvedValue({ data: createdProject });

      const { result } = renderHook(() => useProjectStore());

      const project = await act(async () => {
        return await result.current.createProject(projectData);
      });

      expect(project.currency).toBe("PHP");
      expect(project.timezone).toBe("Asia/Manila");
      expect(project.locale).toBe("en-PH");
    });

    it("should handle Philippine property addresses", () => {
      const property = createMockProperty();

      // Address should be Philippine format
      expect(property.address).toContain(",");
      expect(property.address).toMatch(/\d{4}$/); // Zip code
    });

    it("should handle PHP rates for properties", () => {
      const property = createMockProperty();

      expect(property.rates.peak).toMatch(/^\d+(\.\d{2})?$/);
      expect(property.rates.regular).toMatch(/^\d+(\.\d{2})?$/);
      expect(property.rates.low).toMatch(/^\d+(\.\d{2})?$/);

      const peakRate = parseFloat(property.rates.peak);
      const regularRate = parseFloat(property.rates.regular);
      const lowRate = parseFloat(property.rates.low);

      expect(peakRate).toBeGreaterThan(regularRate);
      expect(regularRate).toBeGreaterThan(lowRate);
    });
  });

  describe("State Management", () => {
    it("should manage loading states", () => {
      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should manage error states", () => {
      const { result } = renderHook(() => useProjectStore());

      act(() => {
        result.current.setError("Test error");
      });

      expect(result.current.error).toBe("Test error");

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe("Persistence", () => {
    it("should persist active project ID", () => {
      const { result } = renderHook(() => useProjectStore());

      const project = createMockProject({ id: "project-123" });

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectLocal(project);
      });

      // Simulated persisted state
      expect(result.current.activeProjectId).toBe("project-123");
    });

    it("should set active project in API client on rehydration", () => {
      const { result } = renderHook(() => useProjectStore());

      // Simulate rehydration with active project
      const onRehydrate = (useProjectStore as any).persist.onRehydrateStorage();
      if (onRehydrate) {
        onRehydrate({ activeProjectId: "project-123" });
      }

      expect(apiClient.setActiveProject).toHaveBeenCalledWith("project-123");
    });
  });

  describe("Immer Immutability", () => {
    it("should maintain immutability when updating projects", () => {
      const { result } = renderHook(() => useProjectStore());

      const originalProjects = [createMockProject({ id: "project-1" })];

      act(() => {
        result.current.setProjects(originalProjects);
      });

      const projectsBefore = result.current.projects;

      act(() => {
        result.current.setProjects([...originalProjects, createMockProject({ id: "project-2" })]);
      });

      const projectsAfter = result.current.projects;

      // References should be different due to Immer
      expect(projectsBefore).not.toBe(projectsAfter);
      expect(projectsAfter).toHaveLength(2);
    });
  });
});
