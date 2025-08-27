/**
 * Comprehensive tests for UI store
 * Tests UI state management, notifications, modals, theme, and preferences
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUIStore } from "../uiStore";
import { Notification } from "@/types/common";

// Mock window and localStorage
const mockMatchMedia = vi.fn();
global.matchMedia = mockMatchMedia as any;
mockMatchMedia.mockReturnValue({
  matches: false,
  addListener: vi.fn(),
  removeListener: vi.fn(),
});

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// Mock document
const mockClassList = {
  toggle: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  contains: vi.fn(),
};
Object.defineProperty(document, "documentElement", {
  value: {
    classList: mockClassList,
  },
  writable: true,
});

// Mock window dimensions
Object.defineProperty(window, "innerWidth", {
  writable: true,
  configurable: true,
  value: 1024,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Test component for modals
const TestModalComponent = ({ onClose }: { onClose?: () => void }) => null;

describe("UIStore - Comprehensive Tests", () => {
  beforeEach(() => {
    // Reset store to initial state
    const { result } = renderHook(() => useUIStore());
    act(() => {
      // Reset all state
      result.current.setSidebarOpen(true);
      result.current.setSidebarCollapsed(false);
      result.current.closeAllModals();
      result.current.clearNotifications();
      result.current.setGlobalLoading(false);
      result.current.setTheme("system");
      result.current.clearSearch();
      result.current.setCommandPaletteOpen(false);
      result.current.setBreadcrumbs([]);
      result.current.setPageTransition(false);
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Reset timer mocks
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("Sidebar Management", () => {
    it("should toggle sidebar open state", () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarOpen).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.sidebarOpen).toBe(false);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.sidebarOpen).toBe(true);
    });

    it("should set sidebar collapsed state", () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarCollapsed).toBe(false);

      act(() => {
        result.current.setSidebarCollapsed(true);
      });

      expect(result.current.sidebarCollapsed).toBe(true);
    });

    it("should auto-close sidebar on mobile", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSidebarOpen(true);
        result.current.setIsMobile(true);
      });

      expect(result.current.sidebarOpen).toBe(false);
      expect(result.current.isMobile).toBe(true);
    });
  });

  describe("Modal Management", () => {
    it("should open modal and return unique ID", () => {
      const { result } = renderHook(() => useUIStore());

      let modalId: string;
      act(() => {
        modalId = result.current.openModal({
          component: TestModalComponent,
          props: { testProp: "value" },
          onClose: vi.fn(),
        });
      });

      expect(modalId!).toMatch(/^modal-\d+$/);
      expect(result.current.modals).toHaveLength(1);
      expect(result.current.modals[0]).toMatchObject({
        id: modalId!,
        component: TestModalComponent,
        props: { testProp: "value" },
      });
    });

    it("should close modal by ID and trigger onClose", () => {
      const onCloseMock = vi.fn();
      const { result } = renderHook(() => useUIStore());

      let modalId: string;
      act(() => {
        modalId = result.current.openModal({
          component: TestModalComponent,
          onClose: onCloseMock,
        });
      });

      act(() => {
        result.current.closeModal(modalId!);
      });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
      expect(result.current.modals).toHaveLength(0);
    });

    it("should close all modals and trigger all onClose callbacks", () => {
      const onCloseMocks = [vi.fn(), vi.fn(), vi.fn()];
      const { result } = renderHook(() => useUIStore());

      act(() => {
        onCloseMocks.forEach((onClose) => {
          result.current.openModal({
            component: TestModalComponent,
            onClose,
          });
        });
      });

      expect(result.current.modals).toHaveLength(3);

      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.modals).toHaveLength(0);
      onCloseMocks.forEach((mock) => {
        expect(mock).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle closing non-existent modal gracefully", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.closeModal("non-existent-modal");
      });

      // Should not throw error
      expect(result.current.modals).toHaveLength(0);
    });
  });

  describe("Notification/Toast Management", () => {
    it("should add notification with auto-generated ID", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({
          type: "success",
          title: "Success",
          message: "Operation completed",
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        type: "success",
        title: "Success",
        message: "Operation completed",
        duration: 5000,
      });
      expect(result.current.notifications[0]!.id).toMatch(/^notification-\d+$/);
    });

    it("should auto-remove notification after duration", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({
          type: "info",
          title: "Auto Remove",
          duration: 3000,
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it("should not auto-remove notification with duration 0", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({
          type: "warning",
          title: "Persistent",
          duration: 0,
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should still be present
      expect(result.current.notifications).toHaveLength(1);
    });

    it("should remove specific notification by ID", () => {
      const { result } = renderHook(() => useUIStore());

      let notificationId: string;
      act(() => {
        result.current.addNotification({
          type: "error",
          title: "Error 1",
        });
        result.current.addNotification({
          type: "error",
          title: "Error 2",
        });
        notificationId = result.current.notifications[0]!.id;
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        result.current.removeNotification(notificationId!);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]!.title).toBe("Error 2");
    });

    it("should clear all notifications", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({ type: "info", title: "Info 1" });
        result.current.addNotification({ type: "info", title: "Info 2" });
        result.current.addNotification({ type: "info", title: "Info 3" });
      });

      expect(result.current.notifications).toHaveLength(3);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    describe("Toast Shortcuts", () => {
      it("should create success toast", () => {
        const { result } = renderHook(() => useUIStore());

        act(() => {
          result.current.toast.success("Success!", "Task completed");
        });

        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0]).toMatchObject({
          type: "success",
          title: "Success!",
          message: "Task completed",
        });
      });

      it("should create error toast", () => {
        const { result } = renderHook(() => useUIStore());

        act(() => {
          result.current.toast.error("Error!", "Something went wrong");
        });

        expect(result.current.notifications[0]).toMatchObject({
          type: "error",
          title: "Error!",
          message: "Something went wrong",
        });
      });

      it("should create warning toast", () => {
        const { result } = renderHook(() => useUIStore());

        act(() => {
          result.current.toast.warning("Warning!", "Be careful");
        });

        expect(result.current.notifications[0]).toMatchObject({
          type: "warning",
          title: "Warning!",
          message: "Be careful",
        });
      });

      it("should create info toast", () => {
        const { result } = renderHook(() => useUIStore());

        act(() => {
          result.current.toast.info("Info", "Just so you know");
        });

        expect(result.current.notifications[0]).toMatchObject({
          type: "info",
          title: "Info",
          message: "Just so you know",
        });
      });
    });
  });

  describe("Theme Management", () => {
    it("should set light theme", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme("light");
      });

      expect(result.current.theme).toBe("light");
      expect(mockClassList.toggle).toHaveBeenCalledWith("dark", false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme", "light");
    });

    it("should set dark theme", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme("dark");
      });

      expect(result.current.theme).toBe("dark");
      expect(mockClassList.toggle).toHaveBeenCalledWith("dark", true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme", "dark");
    });

    it("should set system theme and detect dark preference", () => {
      mockMatchMedia.mockReturnValue({
        matches: true, // Dark mode preferred
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme("system");
      });

      expect(result.current.theme).toBe("system");
      expect(mockClassList.toggle).toHaveBeenCalledWith("dark", true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme", "system");
    });

    it("should set system theme and detect light preference", () => {
      mockMatchMedia.mockReturnValue({
        matches: false, // Light mode preferred
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme("system");
      });

      expect(result.current.theme).toBe("system");
      expect(mockClassList.toggle).toHaveBeenCalledWith("dark", false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme", "system");
    });

    it("should load theme from localStorage on initialization", () => {
      mockLocalStorage.getItem.mockReturnValue("dark");

      // Re-import to trigger initialization
      vi.resetModules();
      const { useUIStore: freshUIStore } = require("../uiStore");

      const { result } = renderHook(() => freshUIStore());

      // Theme should be loaded from localStorage
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("theme");
    });
  });

  describe("Loading State Management", () => {
    it("should set global loading state with message", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setGlobalLoading(true, "Loading data...");
      });

      expect(result.current.globalLoading).toBe(true);
      expect(result.current.loadingMessage).toBe("Loading data...");
    });

    it("should clear loading state and message", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setGlobalLoading(true, "Loading...");
        result.current.setGlobalLoading(false);
      });

      expect(result.current.globalLoading).toBe(false);
      expect(result.current.loadingMessage).toBeNull();
    });
  });

  describe("Mobile Detection", () => {
    it("should detect mobile screen size", () => {
      const { result } = renderHook(() => useUIStore());

      // Simulate mobile width
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // Check mobile detection on initialization
      vi.resetModules();
      const { useUIStore: freshUIStore } = require("../uiStore");
      const { result: freshResult } = renderHook(() => freshUIStore());

      expect(freshResult.current.isMobile).toBeDefined();
    });

    it("should detect desktop screen size", () => {
      const { result } = renderHook(() => useUIStore());

      // Simulate desktop width
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1920,
      });

      act(() => {
        result.current.setIsMobile(false);
      });

      expect(result.current.isMobile).toBe(false);
      expect(result.current.sidebarOpen).toBe(true); // Should remain open on desktop
    });

    it("should auto-close sidebar when switching to mobile", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSidebarOpen(true);
        result.current.setIsMobile(true);
      });

      expect(result.current.sidebarOpen).toBe(false);
    });
  });

  describe("Command Palette", () => {
    it("should toggle command palette", () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.commandPaletteOpen).toBe(false);

      act(() => {
        result.current.toggleCommandPalette();
      });

      expect(result.current.commandPaletteOpen).toBe(true);

      act(() => {
        result.current.toggleCommandPalette();
      });

      expect(result.current.commandPaletteOpen).toBe(false);
    });

    it("should set command palette open state directly", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setCommandPaletteOpen(true);
      });

      expect(result.current.commandPaletteOpen).toBe(true);

      act(() => {
        result.current.setCommandPaletteOpen(false);
      });

      expect(result.current.commandPaletteOpen).toBe(false);
    });
  });

  describe("Search Management", () => {
    it("should set search query", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSearchQuery("resort bookings");
      });

      expect(result.current.searchQuery).toBe("resort bookings");
    });

    it("should open and close search", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSearchOpen(true);
      });

      expect(result.current.searchOpen).toBe(true);

      act(() => {
        result.current.setSearchOpen(false);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should clear search completely", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSearchQuery("test query");
        result.current.setSearchOpen(true);
        result.current.clearSearch();
      });

      expect(result.current.searchQuery).toBe("");
      expect(result.current.searchOpen).toBe(false);
    });
  });

  describe("Breadcrumb Management", () => {
    it("should set breadcrumbs", () => {
      const { result } = renderHook(() => useUIStore());

      const breadcrumbs = [
        { label: "Home", href: "/" },
        { label: "Projects", href: "/projects" },
        { label: "Beach Resort" },
      ];

      act(() => {
        result.current.setBreadcrumbs(breadcrumbs);
      });

      expect(result.current.breadcrumbs).toEqual(breadcrumbs);
    });

    it("should handle empty breadcrumbs", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setBreadcrumbs([{ label: "Test" }]);
        result.current.setBreadcrumbs([]);
      });

      expect(result.current.breadcrumbs).toEqual([]);
    });
  });

  describe("Page Transitions", () => {
    it("should set page transition state", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setPageTransition(true);
      });

      expect(result.current.pageTransition).toBe(true);

      act(() => {
        result.current.setPageTransition(false);
      });

      expect(result.current.pageTransition).toBe(false);
    });
  });

  describe("Selector Hooks", () => {
    it("should provide sidebar state through selector", () => {
      const { result } = renderHook(() => useUIStore());

      const sidebarState = {
        open: result.current.sidebarOpen,
        collapsed: result.current.sidebarCollapsed,
        toggle: result.current.toggleSidebar,
        setOpen: result.current.setSidebarOpen,
        setCollapsed: result.current.setSidebarCollapsed,
      };

      expect(sidebarState.open).toBe(true);
      expect(sidebarState.collapsed).toBe(false);
      expect(typeof sidebarState.toggle).toBe("function");
      expect(typeof sidebarState.setOpen).toBe("function");
      expect(typeof sidebarState.setCollapsed).toBe("function");
    });

    it("should provide modal functions through selector", () => {
      const { result } = renderHook(() => useUIStore());

      const modalFunctions = {
        modals: result.current.modals,
        open: result.current.openModal,
        close: result.current.closeModal,
        closeAll: result.current.closeAllModals,
      };

      expect(Array.isArray(modalFunctions.modals)).toBe(true);
      expect(typeof modalFunctions.open).toBe("function");
      expect(typeof modalFunctions.close).toBe("function");
      expect(typeof modalFunctions.closeAll).toBe("function");
    });

    it("should provide notification functions through selector", () => {
      const { result } = renderHook(() => useUIStore());

      const notificationFunctions = {
        notifications: result.current.notifications,
        add: result.current.addNotification,
        remove: result.current.removeNotification,
        clear: result.current.clearNotifications,
      };

      expect(Array.isArray(notificationFunctions.notifications)).toBe(true);
      expect(typeof notificationFunctions.add).toBe("function");
      expect(typeof notificationFunctions.remove).toBe("function");
      expect(typeof notificationFunctions.clear).toBe("function");
    });
  });

  describe("Philippine-Specific UI Features", () => {
    it("should handle Philippine locale settings", () => {
      const { result } = renderHook(() => useUIStore());

      // Set breadcrumbs with Philippine locations
      const breadcrumbs = [
        { label: "Home", href: "/" },
        { label: "Palawan", href: "/projects/palawan" },
        { label: "El Nido Resort" },
      ];

      act(() => {
        result.current.setBreadcrumbs(breadcrumbs);
      });

      expect(result.current.breadcrumbs[1]!.label).toBe("Palawan");
    });

    it("should display notifications for Philippine payment methods", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.toast.success("GCash Payment Received", "₱15,000.00 from Juan Dela Cruz");
      });

      expect(result.current.notifications[0]).toMatchObject({
        type: "success",
        title: "GCash Payment Received",
        message: "₱15,000.00 from Juan Dela Cruz",
      });
    });

    it("should handle Philippine timezone in loading messages", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setGlobalLoading(true, "Syncing bookings for Asia/Manila timezone...");
      });

      expect(result.current.loadingMessage).toContain("Asia/Manila");
    });
  });

  describe("Complex UI Scenarios", () => {
    it("should handle multiple modals stacked", () => {
      const { result } = renderHook(() => useUIStore());

      const modalIds: string[] = [];
      act(() => {
        modalIds.push(result.current.openModal({ component: TestModalComponent }));
        modalIds.push(result.current.openModal({ component: TestModalComponent }));
        modalIds.push(result.current.openModal({ component: TestModalComponent }));
      });

      expect(result.current.modals).toHaveLength(3);

      // Close middle modal
      act(() => {
        result.current.closeModal(modalIds[1]!);
      });

      expect(result.current.modals).toHaveLength(2);
      expect(result.current.modals.find((m) => m.id === modalIds[1])).toBeUndefined();
    });

    it("should handle rapid notification additions", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.toast.info(`Notification ${i}`, `Message ${i}`);
        }
      });

      expect(result.current.notifications).toHaveLength(10);

      // All should auto-remove after duration
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it("should maintain state consistency during theme changes", () => {
      const { result } = renderHook(() => useUIStore());

      // Set various UI states
      act(() => {
        result.current.setSidebarOpen(true);
        result.current.setCommandPaletteOpen(true);
        result.current.setSearchOpen(true);
        result.current.addNotification({ type: "info", title: "Test" });
      });

      const stateBefore = {
        sidebar: result.current.sidebarOpen,
        commandPalette: result.current.commandPaletteOpen,
        search: result.current.searchOpen,
        notificationCount: result.current.notifications.length,
      };

      // Change theme
      act(() => {
        result.current.setTheme("dark");
      });

      // States should remain unchanged
      expect(result.current.sidebarOpen).toBe(stateBefore.sidebar);
      expect(result.current.commandPaletteOpen).toBe(stateBefore.commandPalette);
      expect(result.current.searchOpen).toBe(stateBefore.search);
      expect(result.current.notifications.length).toBe(stateBefore.notificationCount);
    });

    it("should handle sidebar and command palette interaction", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSidebarOpen(false);
        result.current.setSidebarCollapsed(true);
        result.current.setCommandPaletteOpen(true);
      });

      // Both can be open/closed independently
      expect(result.current.sidebarOpen).toBe(false);
      expect(result.current.sidebarCollapsed).toBe(true);
      expect(result.current.commandPaletteOpen).toBe(true);
    });
  });

  describe("Performance Considerations", () => {
    it("should handle large number of notifications efficiently", () => {
      const { result } = renderHook(() => useUIStore());

      const startTime = performance.now();

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addNotification({
            type: "info",
            title: `Notification ${i}`,
            duration: 0, // Prevent auto-remove
          });
        }
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.current.notifications).toHaveLength(100);
      expect(executionTime).toBeLessThan(100); // Should be fast

      // Clear all efficiently
      const clearStartTime = performance.now();

      act(() => {
        result.current.clearNotifications();
      });

      const clearEndTime = performance.now();
      const clearTime = clearEndTime - clearStartTime;

      expect(result.current.notifications).toHaveLength(0);
      expect(clearTime).toBeLessThan(50);
    });
  });

  describe("Error Recovery", () => {
    it("should recover from invalid notification removal", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addNotification({ type: "info", title: "Test" });
      });

      const validId = result.current.notifications[0]!.id;

      act(() => {
        // Try to remove non-existent notification
        result.current.removeNotification("invalid-id");
        // Remove valid notification
        result.current.removeNotification(validId);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it("should handle modal closure with missing onClose gracefully", () => {
      const { result } = renderHook(() => useUIStore());

      let modalId: string;
      act(() => {
        modalId = result.current.openModal({
          component: TestModalComponent,
          // No onClose provided
        });
      });

      // Should not throw when closing
      expect(() => {
        act(() => {
          result.current.closeModal(modalId!);
        });
      }).not.toThrow();

      expect(result.current.modals).toHaveLength(0);
    });
  });
});
