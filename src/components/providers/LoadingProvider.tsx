import React, { createContext, useContext, useEffect, useState } from "react";

// ============================================
// LINK LOADING WRAPPER
// ============================================
import { Link as RouterLink, useRouter, type LinkProps } from "@tanstack/react-router";

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
