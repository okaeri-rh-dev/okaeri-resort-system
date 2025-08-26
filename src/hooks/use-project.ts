/**
 * Custom hook for project management operations
 */

import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { queryClient, queryKeys, invalidateQueries } from "@/lib/query-client";
import type { Project, Property } from "@/types/common";

export function useProject() {
  const navigate = useNavigate();
  const toast = useUIStore((state) => state.toast);
  const user = useAuthStore((state) => state.user);

  const {
    activeProject,
    activeProjectId,
    projects,
    properties,
    isLoading,
    error,
    setActiveProject,
    fetchProjects,
    fetchProperties,
    createProject,
    updateProject,
    deleteProject,
    createProperty,
    updateProperty,
    deleteProperty,
    clearError,
  } = useProjectStore();

  // Fetch projects query
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user,
  });

  // Fetch properties query
  const propertiesQuery = useQuery({
    queryKey: queryKeys.properties.list(activeProjectId || ""),
    queryFn: fetchProperties,
    staleTime: 5 * 60 * 1000,
    enabled: !!activeProjectId,
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      toast.success("Project created", `${project.name} has been created successfully.`);
      invalidateQueries.projects();
    },
    onError: (error: any) => {
      toast.error("Failed to create project", error.message);
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => updateProject(id, data),
    onSuccess: () => {
      toast.success("Project updated", "Project has been updated successfully.");
      invalidateQueries.projects();
    },
    onError: (error: any) => {
      toast.error("Failed to update project", error.message);
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      toast.success("Project deleted", "Project has been deleted successfully.");
      invalidateQueries.projects();
      navigate({ to: "/dashboard" });
    },
    onError: (error: any) => {
      toast.error("Failed to delete project", error.message);
    },
  });

  // Create property mutation
  const createPropertyMutation = useMutation({
    mutationFn: createProperty,
    onSuccess: (property) => {
      toast.success("Property created", `${property.name} has been created successfully.`);
      if (activeProjectId) {
        invalidateQueries.properties(activeProjectId);
      }
    },
    onError: (error: any) => {
      toast.error("Failed to create property", error.message);
    },
  });

  // Update property mutation
  const updatePropertyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Property> }) => updateProperty(id, data),
    onSuccess: () => {
      toast.success("Property updated", "Property has been updated successfully.");
      if (activeProjectId) {
        invalidateQueries.properties(activeProjectId);
      }
    },
    onError: (error: any) => {
      toast.error("Failed to update property", error.message);
    },
  });

  // Delete property mutation
  const deletePropertyMutation = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => {
      toast.success("Property deleted", "Property has been deleted successfully.");
      if (activeProjectId) {
        invalidateQueries.properties(activeProjectId);
      }
    },
    onError: (error: any) => {
      toast.error("Failed to delete property", error.message);
    },
  });

  // Switch active project
  const switchProject = useCallback(
    async (projectId: string) => {
      try {
        await setActiveProject(projectId);
        toast.info(
          "Project switched",
          `Switched to ${projects.find((p) => p.id === projectId)?.name || "project"}`
        );
      } catch (error: any) {
        toast.error("Failed to switch project", error.message);
      }
    },
    [setActiveProject, projects, toast]
  );

  // Check if user has access to current project
  const hasProjectAccess = useMemo(() => {
    if (!user || !activeProjectId) return false;

    // Super admin has access to all projects
    if (user.role === "SUPER_ADMIN") return true;

    // Check if user is member of the project
    return user.projects?.some((p) => p.projectId === activeProjectId) || false;
  }, [user, activeProjectId]);

  // Get user's role in current project
  const projectRole = useMemo(() => {
    if (!user || !activeProjectId) return null;

    // Super admin has owner role in all projects
    if (user.role === "SUPER_ADMIN") return "OWNER";

    // Find user's role in the project
    const membership = user.projects?.find((p) => p.projectId === activeProjectId);
    return membership?.role || null;
  }, [user, activeProjectId]);

  // Check if user can perform action in project
  const canPerformAction = useCallback(
    (action: string) => {
      if (!projectRole) return false;

      const roleHierarchy = {
        OWNER: 5,
        ADMIN: 4,
        MANAGER: 3,
        MEMBER: 2,
        VIEWER: 1,
      };

      const actionRequirements: Record<string, number> = {
        delete: 5,
        manage_team: 4,
        create: 3,
        update: 3,
        approve: 3,
        view: 1,
      };

      const userLevel = roleHierarchy[projectRole as keyof typeof roleHierarchy] || 0;
      const requiredLevel = actionRequirements[action] || 5;

      return userLevel >= requiredLevel;
    },
    [projectRole]
  );

  // Auto-select first project if none selected
  useEffect(() => {
    if (!activeProjectId && projects.length > 0 && !isLoading) {
      setActiveProject(projects[0]!.id);
    }
  }, [activeProjectId, projects, isLoading, setActiveProject]);

  return {
    // State
    activeProject,
    activeProjectId,
    projects,
    properties,
    isLoading: isLoading || projectsQuery.isLoading || propertiesQuery.isLoading,
    error,

    // Actions
    switchProject,
    createProject: createProjectMutation.mutate,
    updateProject: updateProjectMutation.mutate,
    deleteProject: deleteProjectMutation.mutate,
    createProperty: createPropertyMutation.mutate,
    updateProperty: updatePropertyMutation.mutate,
    deleteProperty: deletePropertyMutation.mutate,
    clearError,

    // Permissions
    hasProjectAccess,
    projectRole,
    canPerformAction,

    // Query states
    projectsLoading: projectsQuery.isLoading,
    propertiesLoading: propertiesQuery.isLoading,

    // Mutation states
    createProjectPending: createProjectMutation.isPending,
    updateProjectPending: updateProjectMutation.isPending,
    deleteProjectPending: deleteProjectMutation.isPending,
    createPropertyPending: createPropertyMutation.isPending,
    updatePropertyPending: updatePropertyMutation.isPending,
    deletePropertyPending: deletePropertyMutation.isPending,
  };
}

// Hook to get a specific project
export function useProjectById(projectId: string) {
  const { projects } = useProject();
  return projects.find((p) => p.id === projectId);
}

// Hook to get a specific property
export function usePropertyById(propertyId: string) {
  const { properties } = useProject();
  return properties.find((p) => p.id === propertyId);
}

// Hook to require project selection
export function useRequireProject() {
  const navigate = useNavigate();
  const { activeProjectId, projects, isLoading } = useProject();

  useEffect(() => {
    if (!isLoading && !activeProjectId && projects.length === 0) {
      // No projects available, redirect to create project
      navigate({ to: "/settings/project" });
    }
  }, [activeProjectId, projects, isLoading, navigate]);

  return { activeProjectId, isLoading };
}
