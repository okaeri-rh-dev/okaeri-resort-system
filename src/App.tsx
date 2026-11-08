import { useEffect, useState } from "react";

import { createRouter, RouterProvider } from "@tanstack/react-router";

import { PageLoader } from "@/components/patterns";
import { clearRoleCache } from "@/lib/audit-roles";
import { auth } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { QueryProvider } from "@/providers/QueryProvider";
import type { RouterContext } from "@/routes/__root";
import { routeTree } from "@/routeTree.gen";
import { useBookingStore } from "@/stores/useBookingStore";
import { initializeTheme } from "@/stores/useUIStore";

import "@/styles/calendar.css";

// Create the router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    isAuthenticated: false, // Initial value, will be updated
  } as RouterContext,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30_000, // 30s — keep preloaded data fresh on hover→click
  // Rendered in the nearest parent outlet: full screen above the shell, content area inside it
  defaultPendingComponent: PageLoader,
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

    // Token refreshes are skipped so they do not clear the role cache
    const {
      data: { subscription },
    } = auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;

      const newAuthState = !!session;
      setIsAuthenticated(newAuthState);
      clearRoleCache();
      router.update({
        context: {
          queryClient,
          isAuthenticated: newAuthState,
        },
      });
    });

    return () => {
      subscription.unsubscribe();
      // Cleanup the optimistic bookings timer
      stopCleanupTimer();
    };
  }, []);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return <PageLoader />;
  }

  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}

export default App;
