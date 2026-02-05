import React, { createContext, useContext, useEffect, useState } from "react";

// ============================================
// LINK LOADING WRAPPER
// ============================================
import { LinkProps, Link as RouterLink, useRouter } from "@tanstack/react-router";

import { PageTransitionSkeleton } from "@/components/skeletons";
import { logger } from "@/lib/logger";

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

const useLoading = () => {
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
  // TODO: Replace with actual router state when implementing global navigation
  const isNavigating = false; // Placeholder - will integrate with router.state.isLoading
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>();

  const router = useRouter();

  // Handle route navigation loading
  useEffect(() => {
    // TanStack Router v1 uses router.state.isLoading for navigation state
    // For now, navigation loading is handled by LoadingLink component
    // TODO: Integrate with router.state.isLoading or useRouterState hook
    // when implementing global navigation indicators

    // Cleanup function (no subscriptions needed)
    return () => {};
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
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
const _useQueryLoading = () => {
  const { setGlobalLoading } = useLoading();

  const startLoading = (message?: string) => {
    setGlobalLoading(true, message);
  };

  const stopLoading = () => {
    setGlobalLoading(false);
  };

  return { startLoading, stopLoading };
};

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

const _usePerformanceMonitoring = () => {
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
          logger.info("Navigation Performance:", { metrics: newMetrics });
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

const _useAdaptiveLoading = () => {
  const [networkCondition, setNetworkCondition] = useState<NetworkCondition>({
    effectiveType: undefined,
    downlink: 0,
    rtt: 0,
  });

  useEffect(() => {
    // Check for Network Information API support
    if ("connection" in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
