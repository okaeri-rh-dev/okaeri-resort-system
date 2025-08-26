import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // Redirect to dashboard if already authenticated
    if (context.auth?.isAuthenticated) {
      throw redirect({
        to: "/dashboard",
      });
    }

    return {
      isHomePage: true,
    };
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
            <Link to="/login" className="w-full">
              <Button variant="ocean" className="w-full">
                Get Started
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🏖️ Bookings</CardTitle>
            <CardDescription>Manage Airbnb and direct bookings seamlessly</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/register" className="w-full">
              <Button variant="coral" className="w-full">
                Sign Up Now
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💰 Financials</CardTitle>
            <CardDescription>Track income, expenses, and generate reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login" className="w-full">
              <Button variant="palm" className="w-full">
                View Demo
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action Section */}
      <div className="from-ocean-50 to-sand-50 mt-8 rounded-lg border bg-gradient-to-r p-6 text-center">
        <h2 className="mb-4 text-2xl font-semibold">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-6">
          Join hundreds of resort owners who trust Okaeri to manage their properties.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/register">
            <Button variant="ocean" size="lg">
              Create Account
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg">
              Sign In
            </Button>
          </Link>
        </div>
      </div>

      <div className="from-ocean-50 to-sand-50 mt-12 rounded-lg border bg-gradient-to-r p-6">
        <h2 className="mb-4 text-2xl font-semibold">Phase 1.6 Complete ✅</h2>
        <p className="text-muted-foreground mb-4">
          Protected routes with TanStack Router and comprehensive security:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Authentication guards with beforeLoad hooks
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Role-based access control with permissions
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Session monitoring and timeout handling
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Secure token validation and refresh
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Project context loading and validation
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Comprehensive audit logging and security events
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Enhanced error boundaries with user-friendly
            messages
          </li>
          <li className="flex items-center gap-2">
            <span className="text-palm-600">✓</span> Mobile-optimized navigation and auth flows
          </li>
        </ul>
      </div>
    </div>
  );
}
