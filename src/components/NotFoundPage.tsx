import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="mb-4 text-6xl font-bold text-gray-900">404</h1>
          <h2 className="mb-2 text-2xl font-semibold text-gray-700">Page Not Found</h2>
          <p className="text-gray-600">
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

        <div className="mt-8 text-sm text-gray-500">
          <p>Okaeri Resort Management System</p>
        </div>
      </div>
    </div>
  );
}
