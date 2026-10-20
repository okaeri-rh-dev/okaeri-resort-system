import React from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/lib/query-client";

// ============================================
// QUERY PROVIDER COMPONENT
// ============================================
interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Not under browser automation: the floating button covers the compact bottom bar */}
      {import.meta.env.DEV && !navigator.webdriver && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
