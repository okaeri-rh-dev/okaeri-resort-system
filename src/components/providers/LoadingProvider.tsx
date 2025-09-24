import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { PageTransitionSkeleton } from "@/components/skeletons";

// ============================================
// LOADING STATE CONTEXT
// ============================================

interface LoadingState {
  isNavigating: boolean;
  isGlobalLoading: boolean;
  loadingMessage?: string;
  setGlobalLoading: (loading: boolean, message?: string) => void;
}

const LoadingContext = createContext<LoadingState | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};

// ============================================
// LOADING PROVIDER COMPONENT
// ============================================

interface LoadingProviderProps {
  children: React.ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>();

  const router = useRouter();

  // Handle route navigation loading
  useEffect(() => {
    const handleNavigationStart = () => {
      setIsNavigating(true);
    };

    const handleNavigationEnd = () => {
      // Add a small delay to prevent flashing
      setTimeout(() => {
        setIsNavigating(false);
      }, 100);
    };

    // Listen to router events if available
    // Note: This depends on TanStack Router's event system
    // Adjust based on actual router implementation
    const unsubscribe = router.subscribe?.("navigationStart", (event: any) => {
      if (event.type === "navigationStart") {
        handleNavigationStart();
      } else if (event.type === "navigationEnd") {
        handleNavigationEnd();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [router]);

  const setGlobalLoadingState = (loading: boolean, message?: string) => {
    setIsGlobalLoading(loading);
    setLoadingMessage(message);
  };

  const value: LoadingState = {
    isNavigating,
    isGlobalLoading,
    loadingMessage,
    setGlobalLoading: setGlobalLoadingState,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {isNavigating && <PageTransitionSkeleton />}
      {isGlobalLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl space-y-4 max-w-sm mx-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <div className="text-center text-sm text-neutral-600">
              {loadingMessage || "Loading..."}
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

// ============================================
// QUERY LOADING HOOKS
// ============================================

/**
 * Hook to integrate TanStack Query loading states with our skeleton system
 */
export const useQueryLoading = () => {
  const { setGlobalLoading } = useLoading();

  const startLoading = (message?: string) => {
    setGlobalLoading(true, message);
  };

  const stopLoading = () => {
    setGlobalLoading(false);
  };

  return { startLoading, stopLoading };
};

// ============================================
// LINK LOADING WRAPPER
// ============================================

import { Link as RouterLink, LinkProps } from "@tanstack/react-router";

interface LoadingLinkProps extends LinkProps {
  children: React.ReactNode;
  showLoading?: boolean;
  loadingDelay?: number;
  onClick?: (e: React.MouseEvent) => void;
}

export const LoadingLink: React.FC<LoadingLinkProps> = ({
  children,
  showLoading = true,
  loadingDelay = 150,
  onClick,
  ...props
}) => {
  const { setGlobalLoading } = useLoading();

  const handleClick = (e: React.MouseEvent) => {
    if (showLoading) {
      // Add a small delay to prevent flashing on fast navigation
      setTimeout(() => {
        setGlobalLoading(true, "Navigating...");
      }, loadingDelay);
    }

    // Call original onClick if provided
    onClick?.(e);
  };

  return (
    <RouterLink {...props} onMouseDown={handleClick}>
      {children}
    </RouterLink>
  );
};

// ============================================
// PERFORMANCE MONITORING
// ============================================

interface PerformanceMetrics {
  navigationStart: number;
  navigationEnd: number;
  skeletonDisplayTime: number;
  totalLoadTime: number;
}

export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const startNavigation = () => {
    const start = performance.now();
    return {
      end: () => {
        const end = performance.now();
        const newMetrics: PerformanceMetrics = {
          navigationStart: start,
          navigationEnd: end,
          skeletonDisplayTime: 0, // Will be calculated based on skeleton display
          totalLoadTime: end - start,
        };
        setMetrics(newMetrics);

        // Log performance for analytics
        if (process.env.NODE_ENV === "development") {
          console.log("Navigation Performance:", newMetrics);
        }

        return newMetrics;
      },
    };
  };

  return { metrics, startNavigation };
};

// ============================================
// ADAPTIVE LOADING STRATEGIES
// ============================================

interface NetworkCondition {
  effectiveType: "slow-2g" | "2g" | "3g" | "4g" | undefined;
  downlink: number;
  rtt: number;
}

export const useAdaptiveLoading = () => {
  const [networkCondition, setNetworkCondition] = useState<NetworkCondition>({
    effectiveType: undefined,
    downlink: 0,
    rtt: 0,
  });

  useEffect(() => {
    // Check for Network Information API support
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;

      const updateNetworkInfo = () => {
        setNetworkCondition({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        });
      };

      updateNetworkInfo();
      connection.addEventListener("change", updateNetworkInfo);

      return () => {
        connection.removeEventListener("change", updateNetworkInfo);
      };
    }
  }, []);

  const getOptimalLoadingStrategy = () => {
    const { effectiveType, downlink } = networkCondition;

    // For slow connections, show skeletons longer and load less data initially
    if (effectiveType === "slow-2g" || effectiveType === "2g" || downlink < 1) {
      return {
        skeletonMinDuration: 500,
        enableProgressive: true,
        reducedAnimations: true,
        priority: "essential",
      };
    }

    // For fast connections, minimize skeleton display time
    if (effectiveType === "4g" && downlink > 10) {
      return {
        skeletonMinDuration: 100,
        enableProgressive: false,
        reducedAnimations: false,
        priority: "full",
      };
    }

    // Default strategy for 3G and moderate connections
    return {
      skeletonMinDuration: 200,
      enableProgressive: true,
      reducedAnimations: false,
      priority: "balanced",
    };
  };

  return { networkCondition, getOptimalLoadingStrategy };
};
