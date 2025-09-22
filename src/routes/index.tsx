import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    // Redirect authenticated users to the dashboard
    if (context?.isAuthenticated) {
      throw redirect({
        to: "/dashboard",
      });
    } else {
      // Redirect unauthenticated users to login
      throw redirect({
        to: "/login",
      });
    }
  },
});
