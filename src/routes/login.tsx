import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    // Redirect to dashboard if already authenticated
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: LoginPage,
});
