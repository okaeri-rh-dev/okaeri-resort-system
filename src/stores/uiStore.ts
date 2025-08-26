/**
 * UI state management store using Zustand
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Notification } from "@/types/common";

interface Modal {
  id: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  onClose?: () => void;
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Modals
  modals: Modal[];

  // Notifications/Toasts
  notifications: Notification[];

  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;

  // Theme
  theme: "light" | "dark" | "system";

  // Mobile
  isMobile: boolean;

  // Command palette
  commandPaletteOpen: boolean;

  // Search
  searchQuery: string;
  searchOpen: boolean;

  // Breadcrumbs
  breadcrumbs: Array<{ label: string; href?: string }>;

  // Page transitions
  pageTransition: boolean;
}

interface UIActions {
  // Sidebar actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Modal actions
  openModal: (modal: Omit<Modal, "id">) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;

  // Notification actions
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Loading actions
  setGlobalLoading: (loading: boolean, message?: string) => void;

  // Theme actions
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Mobile actions
  setIsMobile: (isMobile: boolean) => void;

  // Command palette
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  clearSearch: () => void;

  // Breadcrumb actions
  setBreadcrumbs: (breadcrumbs: Array<{ label: string; href?: string }>) => void;

  // Page transition actions
  setPageTransition: (transitioning: boolean) => void;

  // Toast shortcuts
  toast: {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
  };
}

let notificationIdCounter = 0;
let modalIdCounter = 0;

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      sidebarOpen: true,
      sidebarCollapsed: false,
      modals: [],
      notifications: [],
      globalLoading: false,
      loadingMessage: null,
      theme: "system",
      isMobile: false,
      commandPaletteOpen: false,
      searchQuery: "",
      searchOpen: false,
      breadcrumbs: [],
      pageTransition: false,

      // Sidebar actions
      toggleSidebar: () => {
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen;
        });
      },

      setSidebarOpen: (open: boolean) => {
        set((state) => {
          state.sidebarOpen = open;
        });
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set((state) => {
          state.sidebarCollapsed = collapsed;
        });
      },

      // Modal actions
      openModal: (modal: Omit<Modal, "id">) => {
        const id = `modal-${++modalIdCounter}`;
        set((state) => {
          state.modals.push({
            id,
            ...modal,
          });
        });
        return id;
      },

      closeModal: (id: string) => {
        set((state) => {
          const index = state.modals.findIndex((m) => m.id === id);
          if (index !== -1) {
            const modal = state.modals[index];
            modal?.onClose?.();
            state.modals.splice(index, 1);
          }
        });
      },

      closeAllModals: () => {
        const { modals } = get();
        modals.forEach((modal) => modal.onClose?.());
        set((state) => {
          state.modals = [];
        });
      },

      // Notification actions
      addNotification: (notification: Omit<Notification, "id">) => {
        const id = `notification-${++notificationIdCounter}`;
        const fullNotification: Notification = {
          id,
          duration: 5000, // Default 5 seconds
          ...notification,
        };

        set((state) => {
          state.notifications.push(fullNotification);
        });

        // Auto-remove after duration
        if (fullNotification.duration && fullNotification.duration > 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, fullNotification.duration);
        }
      },

      removeNotification: (id: string) => {
        set((state) => {
          const index = state.notifications.findIndex((n) => n.id === id);
          if (index !== -1) {
            state.notifications.splice(index, 1);
          }
        });
      },

      clearNotifications: () => {
        set((state) => {
          state.notifications = [];
        });
      },

      // Loading actions
      setGlobalLoading: (loading: boolean, message?: string) => {
        set((state) => {
          state.globalLoading = loading;
          state.loadingMessage = message || null;
        });
      },

      // Theme actions
      setTheme: (theme: "light" | "dark" | "system") => {
        set((state) => {
          state.theme = theme;
        });

        // Apply theme to document
        if (theme === "system") {
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
          document.documentElement.classList.toggle("dark", systemTheme === "dark");
        } else {
          document.documentElement.classList.toggle("dark", theme === "dark");
        }

        // Save to localStorage
        localStorage.setItem("theme", theme);
      },

      // Mobile actions
      setIsMobile: (isMobile: boolean) => {
        set((state) => {
          state.isMobile = isMobile;
          // Auto-close sidebar on mobile
          if (isMobile) {
            state.sidebarOpen = false;
          }
        });
      },

      // Command palette
      toggleCommandPalette: () => {
        set((state) => {
          state.commandPaletteOpen = !state.commandPaletteOpen;
        });
      },

      setCommandPaletteOpen: (open: boolean) => {
        set((state) => {
          state.commandPaletteOpen = open;
        });
      },

      // Search actions
      setSearchQuery: (query: string) => {
        set((state) => {
          state.searchQuery = query;
        });
      },

      setSearchOpen: (open: boolean) => {
        set((state) => {
          state.searchOpen = open;
        });
      },

      clearSearch: () => {
        set((state) => {
          state.searchQuery = "";
          state.searchOpen = false;
        });
      },

      // Breadcrumb actions
      setBreadcrumbs: (breadcrumbs: Array<{ label: string; href?: string }>) => {
        set((state) => {
          state.breadcrumbs = breadcrumbs;
        });
      },

      // Page transition actions
      setPageTransition: (transitioning: boolean) => {
        set((state) => {
          state.pageTransition = transitioning;
        });
      },

      // Toast shortcuts
      toast: {
        success: (title: string, message?: string) => {
          get().addNotification({
            type: "success",
            title,
            message,
          });
        },
        error: (title: string, message?: string) => {
          get().addNotification({
            type: "error",
            title,
            message,
          });
        },
        warning: (title: string, message?: string) => {
          get().addNotification({
            type: "warning",
            title,
            message,
          });
        },
        info: (title: string, message?: string) => {
          get().addNotification({
            type: "info",
            title,
            message,
          });
        },
      },
    })),
    {
      name: "UIStore",
    }
  )
);

// Selector hooks for better performance
export const useSidebar = () =>
  useUIStore((state) => ({
    open: state.sidebarOpen,
    collapsed: state.sidebarCollapsed,
    toggle: state.toggleSidebar,
    setOpen: state.setSidebarOpen,
    setCollapsed: state.setSidebarCollapsed,
  }));

export const useModals = () =>
  useUIStore((state) => ({
    modals: state.modals,
    open: state.openModal,
    close: state.closeModal,
    closeAll: state.closeAllModals,
  }));

export const useNotifications = () =>
  useUIStore((state) => ({
    notifications: state.notifications,
    add: state.addNotification,
    remove: state.removeNotification,
    clear: state.clearNotifications,
  }));

export const useToast = () => useUIStore((state) => state.toast);

export const useTheme = () =>
  useUIStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
  }));

export const useCommandPalette = () =>
  useUIStore((state) => ({
    open: state.commandPaletteOpen,
    toggle: state.toggleCommandPalette,
    setOpen: state.setCommandPaletteOpen,
  }));

export const useSearch = () =>
  useUIStore((state) => ({
    query: state.searchQuery,
    open: state.searchOpen,
    setQuery: state.setSearchQuery,
    setOpen: state.setSearchOpen,
    clear: state.clearSearch,
  }));

export const useBreadcrumbs = () =>
  useUIStore((state) => ({
    breadcrumbs: state.breadcrumbs,
    setBreadcrumbs: state.setBreadcrumbs,
  }));

export const useGlobalLoading = () =>
  useUIStore((state) => ({
    loading: state.globalLoading,
    message: state.loadingMessage,
    setLoading: state.setGlobalLoading,
  }));

// Initialize theme on app load
if (typeof window !== "undefined") {
  const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
  if (savedTheme) {
    useUIStore.getState().setTheme(savedTheme);
  }

  // Detect mobile
  const checkMobile = () => {
    const isMobile = window.innerWidth < 768;
    useUIStore.getState().setIsMobile(isMobile);
  };

  checkMobile();
  window.addEventListener("resize", checkMobile);
}
