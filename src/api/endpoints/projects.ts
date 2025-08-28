/**
 * Projects API endpoints
 */

import { apiClient } from "@/api/client";
import { secureTokenManager } from "@/lib/security/secure-token-manager";
import type {
  Project,
  ProjectMembership,
  PaginatedResponse,
  PaginationParams,
  FilterParams,
} from "@/types/common";

export interface CreateProjectRequest {
  name: string;
  type: string;
  description?: string;
  currency?: string;
  timezone?: string;
  locale?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: string;
  config?: any;
}

export interface InviteMemberRequest {
  email: string;
  role: string;
  permissions?: any[];
}

export interface UpdateMemberRoleRequest {
  role: string;
  permissions?: any[];
}

export const projectsApi = {
  /**
   * Get all projects for the current user
   */
  getProjects: async (params?: FilterParams): Promise<Project[]> => {
    const response = await apiClient.get<Project[]>("/projects", params);
    return response.data;
  },

  /**
   * Get paginated projects
   */
  getProjectsPaginated: async (
    params: PaginationParams & FilterParams
  ): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get<PaginatedResponse<Project>>("/projects/paginated", params);
    return response.data;
  },

  /**
   * Get a specific project by ID
   */
  getProject: async (projectId: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${projectId}`);
    return response.data;
  },

  /**
   * Create a new project
   */
  createProject: async (data: CreateProjectRequest): Promise<Project> => {
    const response = await apiClient.post<Project>("/projects", data);
    return response.data;
  },

  /**
   * Update a project
   */
  updateProject: async (projectId: string, data: UpdateProjectRequest): Promise<Project> => {
    const response = await apiClient.patch<Project>(`/projects/${projectId}`, data);
    return response.data;
  },

  /**
   * Delete a project
   */
  deleteProject: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}`);
  },

  /**
   * Archive a project
   */
  archiveProject: async (projectId: string): Promise<Project> => {
    const response = await apiClient.post<Project>(`/projects/${projectId}/archive`);
    return response.data;
  },

  /**
   * Restore an archived project
   */
  restoreProject: async (projectId: string): Promise<Project> => {
    const response = await apiClient.post<Project>(`/projects/${projectId}/restore`);
    return response.data;
  },

  /**
   * Get project statistics
   */
  getProjectStats: async (projectId: string): Promise<any> => {
    const response = await apiClient.get(`/projects/${projectId}/stats`);
    return response.data;
  },

  /**
   * Get project members
   */
  getProjectMembers: async (projectId: string): Promise<ProjectMembership[]> => {
    const response = await apiClient.get<ProjectMembership[]>(`/projects/${projectId}/members`);
    return response.data;
  },

  /**
   * Invite a member to project
   */
  inviteMember: async (
    projectId: string,
    data: InviteMemberRequest
  ): Promise<ProjectMembership> => {
    const response = await apiClient.post<ProjectMembership>(
      `/projects/${projectId}/members/invite`,
      data
    );
    return response.data;
  },

  /**
   * Remove a member from project
   */
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/members/${userId}`);
  },

  /**
   * Update member role and permissions
   */
  updateMemberRole: async (
    projectId: string,
    userId: string,
    data: UpdateMemberRoleRequest
  ): Promise<ProjectMembership> => {
    const response = await apiClient.patch<ProjectMembership>(
      `/projects/${projectId}/members/${userId}`,
      data
    );
    return response.data;
  },

  /**
   * Transfer project ownership
   */
  transferOwnership: async (projectId: string, newOwnerId: string): Promise<Project> => {
    const response = await apiClient.post<Project>(`/projects/${projectId}/transfer`, {
      newOwnerId,
    });
    return response.data;
  },

  /**
   * Get project activity log
   */
  getActivityLog: async (
    projectId: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<any>> => {
    const response = await apiClient.get<PaginatedResponse<any>>(
      `/projects/${projectId}/activity`,
      params
    );
    return response.data;
  },

  /**
   * Export project data
   */
  exportProjectData: async (projectId: string, format: "json" | "csv" | "excel"): Promise<Blob> => {
    const token = secureTokenManager.getAccessToken();
    if (!token) {
      throw new Error("No authentication token available");
    }

    const response = await fetch(`/api/projects/${projectId}/export?format=${format}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  },

  /**
   * Import project data
   */
  importProjectData: async (projectId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.upload(`/projects/${projectId}/import`, formData);
    return response.data;
  },
};
