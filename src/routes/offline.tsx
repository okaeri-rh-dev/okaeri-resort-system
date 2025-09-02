/**
 * Offline Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic offline page
 */

import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";

function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">You're Offline</h1>
          <p className="text-muted-foreground">
            Please check your internet connection and try again.
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
});
