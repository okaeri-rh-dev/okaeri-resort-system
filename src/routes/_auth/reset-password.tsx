/**
 * Reset Password Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic reset password route (for password reset with token)
 */

import { createFileRoute } from "@tanstack/react-router";
import React from "react";

function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
            <p className="text-muted-foreground text-sm">
              This feature will be implemented in a future phase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_auth/reset-password")({
  component: ResetPasswordPage,
});
