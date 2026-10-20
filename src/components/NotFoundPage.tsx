import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/patterns";

export function NotFoundPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-foreground mb-4 text-6xl font-bold">404</h1>
          <h2 className="text-foreground mb-2 text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="space-y-4">
          <Link to="/">
            <Button className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>

          <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        <div className="text-muted-foreground mt-8 text-sm">
          <p>Okaeri Resort Management System</p>
        </div>
      </div>
    </div>
  );
}
