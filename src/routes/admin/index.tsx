/**
 * Admin Index Route - Redirects to Dashboard
 *
 * When users navigate to /admin, they are automatically redirected
 * to the admin dashboard. This provides a clean URL structure.
 *
 * @route /admin → /admin/dashboard
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    // Redirect to admin dashboard
    throw redirect({
      to: "/admin/dashboard",
      replace: true,
    });
  },
});
