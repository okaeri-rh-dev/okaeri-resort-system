/**
 * Catch-All Route (404) - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic 404 page
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import React from "react";
import { buttonVariants } from "@/components/ui/button";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-muted-foreground text-6xl font-bold">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
          <Link to="/" className={buttonVariants({ variant: "default" })}>
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/$_")({
  component: NotFoundPage,
});
