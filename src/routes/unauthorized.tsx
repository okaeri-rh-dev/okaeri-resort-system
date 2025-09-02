/**
 * Unauthorized Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic unauthorized page
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/routes/paths";

function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-destructive text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this resource.
          </p>
          <Button asChild>
            <Link to={ROUTES.login}>Back to Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
});
