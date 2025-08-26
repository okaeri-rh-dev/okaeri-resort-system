/**
 * Multi-project management store using Zustand
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Project, ProjectMembership, Property } from "@/types/common";
import { apiClient } from "@/lib/api-client";

interface ProjectState {
  // Current active project
  activeProject: Project | null;
  activeProjectId: string | null;

  // All user's projects
  projects: Project[];
  projectMemberships: ProjectMembership[];

  // Properties for active project
  properties: Property[];

  // UI state
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
}

interface ProjectActions {
  // Project management
  fetchProjects: () => Promise<void>;
  fetchProjectById: (projectId: string) => Promise<Project>;
  createProject: (data: CreateProjectData) => Promise<Project>;
  updateProject: (projectId: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  archiveProject: (projectId: string) => Promise<void>;

  // Active project
  setActiveProject: (projectId: string | null) => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;

  // Properties
  fetchProperties: () => Promise<void>;
  createProperty: (data: CreatePropertyData) => Promise<Property>;
  updateProperty: (propertyId: string, data: Partial<Property>) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;

  // Team management
  inviteTeamMember: (email: string, role: string) => Promise<void>;
  removeTeamMember: (userId: string) => Promise<void>;
  updateMemberRole: (userId: string, role: string) => Promise<void>;

  // State management
  setProjects: (projects: Project[]) => void;
  setActiveProjectLocal: (project: Project | null) => void;
  setProperties: (properties: Property[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Utility
  getProjectById: (projectId: string) => Project | undefined;
  getPropertyById: (propertyId: string) => Property | undefined;
  hasProjectAccess: (projectId: string) => boolean;
  refreshIfNeeded: () => Promise<void>;
}

interface CreateProjectData {
  name: string;
  type: string;
  description?: string;
  currency?: string;
  timezone?: string;
  locale?: string;
}

interface CreatePropertyData {
  name: string;
  type: string;
  capacity: number;
  bedrooms?: number;
  bathrooms?: number;
  address?: any;
  amenities?: string[];
  rates: any;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        activeProject: null,
        activeProjectId: null,
        projects: [],
        projectMemberships: [],
        properties: [],
        isLoading: false,
        error: null,
        lastFetch: null,

        // Project management
        fetchProjects: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.get<Project[]>("/projects");
            const projects = response.data;

            set((state) => {
              state.projects = projects;
              state.lastFetch = Date.now();
              state.isLoading = false;
            });

            // If no active project is set and projects exist, set the first one
            if (!get().activeProjectId && projects.length > 0) {
              await get().setActiveProject(projects[0]!.id);
            }
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to fetch projects";
            });
            throw error;
          }
        },

        fetchProjectById: async (projectId: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.get<Project>(`/projects/${projectId}`);
            const project = response.data;

            set((state) => {
              // Update project in the list
              const index = state.projects.findIndex((p) => p.id === projectId);
              if (index !== -1) {
                state.projects[index] = project;
              } else {
                state.projects.push(project);
              }

              // Update active project if it's the same
              if (state.activeProjectId === projectId) {
                state.activeProject = project;
              }

              state.isLoading = false;
            });

            return project;
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to fetch project";
            });
            throw error;
          }
        },

        createProject: async (data: CreateProjectData) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.post<Project>("/projects", data);
            const project = response.data;

            set((state) => {
              state.projects.push(project);
              state.isLoading = false;
            });

            // Set as active project
            await get().setActiveProject(project.id);

            return project;
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to create project";
            });
            throw error;
          }
        },

        updateProject: async (projectId: string, data: Partial<Project>) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.patch<Project>(`/projects/${projectId}`, data);
            const updatedProject = response.data;

            set((state) => {
              const index = state.projects.findIndex((p) => p.id === projectId);
              if (index !== -1) {
                state.projects[index] = updatedProject;
              }

              if (state.activeProjectId === projectId) {
                state.activeProject = updatedProject;
              }

              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to update project";
            });
            throw error;
          }
        },

        deleteProject: async (projectId: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await apiClient.delete(`/projects/${projectId}`);

            set((state) => {
              state.projects = state.projects.filter((p) => p.id !== projectId);

              // If deleted project was active, clear it
              if (state.activeProjectId === projectId) {
                state.activeProject = null;
                state.activeProjectId = null;
                state.properties = [];
              }

              state.isLoading = false;
            });

            // Set another project as active if available
            const remainingProjects = get().projects;
            if (remainingProjects.length > 0) {
              await get().setActiveProject(remainingProjects[0]!.id);
            }
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to delete project";
            });
            throw error;
          }
        },

        archiveProject: async (projectId: string) => {
          await get().updateProject(projectId, { status: "ARCHIVED" as any });
        },

        // Active project management
        setActiveProject: async (projectId: string | null) => {
          if (!projectId) {
            set((state) => {
              state.activeProject = null;
              state.activeProjectId = null;
              state.properties = [];
            });
            apiClient.setActiveProject(null);
            return;
          }

          // Check if project exists in state
          let project = get().projects.find((p) => p.id === projectId);

          // If not in state, fetch it
          if (!project) {
            try {
              project = await get().fetchProjectById(projectId);
            } catch (error) {
              console.error("Failed to fetch project:", error);
              return;
            }
          }

          set((state) => {
            state.activeProject = project || null;
            state.activeProjectId = projectId;
          });

          // Update API client with active project
          apiClient.setActiveProject(projectId);

          // Fetch properties for the new active project
          await get().fetchProperties();
        },

        switchProject: async (projectId: string) => {
          await get().setActiveProject(projectId);
        },

        // Properties management
        fetchProperties: async () => {
          const { activeProjectId } = get();
          if (!activeProjectId) return;

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.get<Property[]>(
              `/projects/${activeProjectId}/properties`
            );

            set((state) => {
              state.properties = response.data;
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to fetch properties";
            });
            throw error;
          }
        },

        createProperty: async (data: CreatePropertyData) => {
          const { activeProjectId } = get();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.post<Property>(
              `/projects/${activeProjectId}/properties`,
              data
            );
            const property = response.data;

            set((state) => {
              state.properties.push(property);
              state.isLoading = false;
            });

            return property;
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to create property";
            });
            throw error;
          }
        },

        updateProperty: async (propertyId: string, data: Partial<Property>) => {
          const { activeProjectId } = get();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.patch<Property>(
              `/projects/${activeProjectId}/properties/${propertyId}`,
              data
            );
            const updatedProperty = response.data;

            set((state) => {
              const index = state.properties.findIndex((p) => p.id === propertyId);
              if (index !== -1) {
                state.properties[index] = updatedProperty;
              }
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to update property";
            });
            throw error;
          }
        },

        deleteProperty: async (propertyId: string) => {
          const { activeProjectId } = get();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await apiClient.delete(`/projects/${activeProjectId}/properties/${propertyId}`);

            set((state) => {
              state.properties = state.properties.filter((p) => p.id !== propertyId);
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to delete property";
            });
            throw error;
          }
        },

        // Team management
        inviteTeamMember: async (email: string, role: string) => {
          const { activeProjectId } = get();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await apiClient.post(`/projects/${activeProjectId}/members/invite`, {
              email,
              role,
            });

            // Refresh project to get updated members
            await get().fetchProjectById(activeProjectId);

            set((state) => {
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to invite team member";
            });
            throw error;
          }
        },

        removeTeamMember: async (userId: string) => {
          const { activeProjectId } = get();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await apiClient.delete(`/projects/${activeProjectId}/members/${userId}`);

            // Refresh project to get updated members
            await get().fetchProjectById(activeProjectId);

            set((state) => {
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to remove team member";
            });
            throw error;
          }
        },

        updateMemberRole: async (userId: string, role: string) => {
          const { activeProjectId } = get();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await apiClient.patch(`/projects/${activeProjectId}/members/${userId}`, {
              role,
            });

            // Refresh project to get updated members
            await get().fetchProjectById(activeProjectId);

            set((state) => {
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to update member role";
            });
            throw error;
          }
        },

        // State management
        setProjects: (projects: Project[]) => {
          set((state) => {
            state.projects = projects;
          });
        },

        setActiveProjectLocal: (project: Project | null) => {
          set((state) => {
            state.activeProject = project;
            state.activeProjectId = project?.id || null;
          });
        },

        setProperties: (properties: Property[]) => {
          set((state) => {
            state.properties = properties;
          });
        },

        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading;
          });
        },

        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        // Utility functions
        getProjectById: (projectId: string) => {
          return get().projects.find((p) => p.id === projectId);
        },

        getPropertyById: (propertyId: string) => {
          return get().properties.find((p) => p.id === propertyId);
        },

        hasProjectAccess: (projectId: string) => {
          return get().projects.some((p) => p.id === projectId);
        },

        refreshIfNeeded: async () => {
          const { lastFetch } = get();
          const now = Date.now();

          if (!lastFetch || now - lastFetch > CACHE_DURATION) {
            await get().fetchProjects();
          }
        },
      })),
      {
        name: "project-storage",
        partialize: (state) => ({
          activeProjectId: state.activeProjectId,
          projects: state.projects,
          lastFetch: state.lastFetch,
        }),
        onRehydrateStorage: () => (state) => {
          // Set active project in API client after rehydration
          if (state?.activeProjectId) {
            apiClient.setActiveProject(state.activeProjectId);
          }
        },
      }
    ),
    {
      name: "ProjectStore",
    }
  )
);

// Selector hooks for better performance
export const useActiveProject = () => useProjectStore((state) => state.activeProject);
export const useProjects = () => useProjectStore((state) => state.projects);
export const useProperties = () => useProjectStore((state) => state.properties);
export const useProjectLoading = () => useProjectStore((state) => state.isLoading);
export const useProjectError = () => useProjectStore((state) => state.error);
