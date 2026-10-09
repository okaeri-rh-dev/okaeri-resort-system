import { create } from "zustand";
import { devtools } from "zustand/middleware";

// ============================================
// TYPES
// ============================================
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

export type ModalType =
  | "createBooking"
  | "editBooking"
  | "createUnit"
  | "editUnit"
  | "createGuest"
  | "editGuest"
  | "paymentProof"
  | "confirmDelete"
  | "bulkAction"
  | null;

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

// ============================================
// ZUSTAND STORE
// ============================================
interface UIStore {
  // Loading states
  isLoading: boolean;
  loadingMessage: string | null;
  globalError: string | null;

  // Modal states
  activeModal: ModalType;
  modalData: unknown;

  // Toast notifications
  toasts: Toast[];

  // Confirm dialog
  confirmDialog: ConfirmDialogState;

  // Sidebar state
  isSidebarCollapsed: boolean;

  // Theme
  theme: "light" | "dark" | "system";

  // Actions - Loading
  setLoading: (loading: boolean, message?: string) => void;
  setGlobalError: (error: string | null) => void;

  // Actions - Modals
  openModal: (modal: ModalType, data?: unknown) => void;
  closeModal: () => void;

  // Actions - Toasts
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Actions - Confirm Dialog
  openConfirmDialog: (options: Omit<ConfirmDialogState, "isOpen">) => void;
  closeConfirmDialog: () => void;

  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Actions - Theme
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Helper functions
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
  showWarning: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;

  // Async action wrapper with loading state
  withLoading: <T>(
    action: () => Promise<T>,
    loadingMessage?: string,
    errorMessage?: string
  ) => Promise<T | undefined>;
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      isLoading: false,
      loadingMessage: null,
      globalError: null,
      activeModal: null,
      modalData: null,
      toasts: [],
      confirmDialog: {
        isOpen: false,
        title: "",
        description: "",
        onConfirm: () => {},
      },
      isSidebarCollapsed: false,
      theme: "system",

      // Loading actions
      setLoading: (loading, message = undefined) =>
        set({ isLoading: loading, loadingMessage: message }),

      setGlobalError: (error) => set({ globalError: error }),

      // Modal actions
      openModal: (modal, data = undefined) => set({ activeModal: modal, modalData: data }),

      closeModal: () => set({ activeModal: null, modalData: null }),

      // Toast actions
      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast: Toast = { ...toast, id };

        set((state) => ({ toasts: [...state.toasts, newToast] }));

        // Auto remove toast after duration
        if (toast.duration !== 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, toast.duration || 5000);
        }
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),

      clearToasts: () => set({ toasts: [] }),

      // Confirm dialog actions
      openConfirmDialog: (options) =>
        set({
          confirmDialog: {
            ...options,
            isOpen: true,
          },
        }),

      closeConfirmDialog: () =>
        set((state) => ({
          confirmDialog: {
            ...state.confirmDialog,
            isOpen: false,
          },
        })),

      // Sidebar actions
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

      // Theme actions
      setTheme: (theme) => {
        set({ theme });

        // Apply theme to document
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system") {
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
          root.classList.add(systemTheme);
        } else {
          root.classList.add(theme);
        }

        // Save to localStorage
        localStorage.setItem("theme", theme);
      },

      // Helper functions
      showSuccess: (title, description) => {
        get().addToast({ title, description, type: "success" });
      },

      showError: (title, description) => {
        get().addToast({ title, description, type: "error" });
      },

      showWarning: (title, description) => {
        get().addToast({ title, description, type: "warning" });
      },

      showInfo: (title, description) => {
        get().addToast({ title, description, type: "info" });
      },

      // Async action wrapper
      withLoading: async (action, loadingMessage, errorMessage) => {
        const { setLoading, showError } = get();

        try {
          setLoading(true, loadingMessage);
          const result = await action();
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "An error occurred";
          showError(errorMessage || "Operation failed", message);
          console.error("Action failed:", error);
          return undefined;
        } finally {
          setLoading(false);
        }
      },
    }),
    {
      name: "UIStore",
    }
  )
);

// ============================================
// HOOKS
// ============================================

// Hook for handling async operations with loading state

// Hook for confirmation dialogs

// Hook for managing form state with loading

// Hook for keyboard shortcuts

// Initialize theme on app start
export const initializeTheme = () => {
  const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
  const theme = savedTheme || "system";

  useUIStore.getState().setTheme(theme);

  // Listen for system theme changes
  if (theme === "system" && typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => {
      useUIStore.getState().setTheme("system");
    });
  }
};
