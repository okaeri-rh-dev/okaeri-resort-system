/**
 * Unauthorized Access Route
 * Displayed when users attempt to access resources they don't have permission for
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

const UnauthorizedSearchSchema = z.object({
  redirect: z.string().optional(),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/unauthorized")({
  validateSearch: UnauthorizedSearchSchema,

  beforeLoad: ({ search }) => {
    return {
      searchParams: search,
    };
  },

  component: UnauthorizedComponent,
});

function UnauthorizedComponent() {
  const search = Route.useSearch();
  const searchParams = search;

  const getReasonMessage = (reason?: string) => {
    switch (reason) {
      case "insufficient_role":
        return "You don't have the required role to access this resource.";
      case "insufficient_permission":
        return "You don't have the necessary permissions to perform this action.";
      case "project_access":
        return "You don't have access to the requested project.";
      case "custom_validation":
        return "Access denied due to security restrictions.";
      default:
        return "You don't have permission to access this resource.";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Access Denied
          </h1>

          {/* Message */}
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {getReasonMessage(searchParams?.reason)}
          </p>

          {/* Additional info */}
          <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              What can you do?
            </h3>
            <ul className="mt-2 text-left text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center">
                <span className="mr-2">•</span>
                Contact your administrator for access
              </li>
              <li className="flex items-center">
                <span className="mr-2">•</span>
                Check if you're logged into the correct account
              </li>
              <li className="flex items-center">
                <span className="mr-2">•</span>
                Return to a page you have access to
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <Link to="/_protected/dashboard">
              <button
                type="button"
                className="bg-ocean-600 hover:bg-ocean-700 focus:ring-ocean-500 w-full rounded-md px-4 py-3 font-medium text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-gray-800"
              >
                Return to Dashboard
              </button>
            </Link>

            {searchParams?.redirect && (
              <Link to={searchParams.redirect}>
                <button
                  type="button"
                  className="w-full rounded-md border border-gray-300 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
                >
                  Try Original Request
                </button>
              </Link>
            )}

            <Link to="/">
              <button
                type="button"
                className="w-full text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Go to Homepage
              </button>
            </Link>
          </div>

          {/* Support */}
          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Need help? Contact{" "}
              <a
                href="mailto:support@okaeri-resort.com"
                className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400"
              >
                support@okaeri-resort.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
