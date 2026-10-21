import { useEffect, useState } from "react";

import { createRouter, RouterProvider } from "@tanstack/react-router";

import { clearRoleCache } from "@/lib/audit-roles";
import { auth } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { QueryProvider } from "@/providers/QueryProvider";
import type { RouterContext } from "@/routes/__root";
import { routeTree } from "@/routeTree.gen";
import { useBookingStore } from "@/stores/useBookingStore";
import { initializeTheme } from "@/stores/useUIStore";

import "@/styles/calendar.css";

// Custom event type for auth state changes
interface AuthStateChangeEvent extends CustomEvent {
  detail: {
    isAuthenticated: boolean;
  };
}

// Extend WindowEventMap to include custom events
declare global {
  interface WindowEventMap {
    authStateChange: AuthStateChangeEvent;
  }
}

// Create the router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    isAuthenticated: false, // Initial value, will be updated
  } as RouterContext,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30_000, // 30s — keep preloaded data fresh on hover→click
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Initialize theme
    initializeTheme();

    // Check authentication status
    const checkAuth = async () => {
      try {
        const authenticated = await auth.isAuthenticated();
        setIsAuthenticated(authenticated);

        // Update router context with auth state
        router.update({
          context: {
            queryClient,
            isAuthenticated: authenticated,
          },
        });
      } catch (error) {
        console.error("Authentication check failed:", error);
        setIsAuthenticated(false);

        // Update router context with auth state
        router.update({
          context: {
            queryClient,
            isAuthenticated: false,
          },
        });
      }
    };

    void checkAuth();

    // Initialize optimistic bookings cleanup timer
    const { startCleanupTimer, stopCleanupTimer } = useBookingStore.getState();
    startCleanupTimer();

    // Listen for auth state changes
    const handleAuthChange = (event: AuthStateChangeEvent) => {
      const newAuthState = event.detail.isAuthenticated;
      setIsAuthenticated(newAuthState);
      clearRoleCache();

      // Update router context
      router.update({
        context: {
          queryClient,
          isAuthenticated: newAuthState,
        },
      });
    };

    // Listen for custom auth events (if auth library emits them)
    window.addEventListener("authStateChange", handleAuthChange);

    return () => {
      window.removeEventListener("authStateChange", handleAuthChange);
      // Cleanup the optimistic bookings timer
      stopCleanupTimer();
    };
  }, []);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading Okaeri Resort System...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}

export default App;
