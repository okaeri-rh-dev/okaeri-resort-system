import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Redirect to dashboard if already authenticated
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Home Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading homepage..." />}>
      <HomePage />
    </Suspense>
  ),
});

function HomePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="from-ocean-600 to-ocean-400 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent">
          Welcome to Okaeri Resort Management System
        </h1>
        <p className="text-muted-foreground mt-2">
          Your comprehensive solution for resort operations in La Union, Philippines
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>📊 Dashboard</CardTitle>
            <CardDescription>Real-time insights into your resort performance</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ocean" className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🏖️ Bookings</CardTitle>
            <CardDescription>Manage Airbnb and direct bookings seamlessly</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="coral" className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💰 Financials</CardTitle>
            <CardDescription>Track income, expenses, and generate reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="palm" className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="from-ocean-50 to-sand-50 mt-12 rounded-lg border bg-gradient-to-r p-6">
        <h2 className="mb-4 text-2xl font-semibold">Phase 1.4 Complete ✅</h2>
        <p className="text-muted-foreground mb-4">
          Enhanced TanStack Router with comprehensive routing enhancements:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> File-based routing with full type safety
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Authentication guards with enhanced security
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Route loaders with intelligent data prefetching
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Zod schema validation for search parameters
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Comprehensive error boundaries and suspense
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Optimized caching strategies with
            stale-while-revalidate
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Context-aware navigation with loading states
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Production-ready route utilities and helpers
          </li>
        </ul>
      </div>
    </div>
  );
}
