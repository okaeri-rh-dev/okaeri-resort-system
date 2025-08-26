import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { queryClient } from "@/lib/query-client";
import { config } from "@/config";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./index.css";

// Create the router with file-based routing
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Initialize app version
if (typeof window !== "undefined") {
  window.__ORMS_VERSION__ = config.app.version;
  window.__ORMS_ENV__ = config.app.environment;
}

// Log app initialization in development
if (config.isDevelopment) {
  console.log(
    `%c🏝️ Okaeri Resort Management System v${config.app.version}`,
    "color: #0ea5e9; font-size: 16px; font-weight: bold;"
  );
  console.log(`%c📍 Environment: ${config.app.environment}`, "color: #10b981; font-size: 12px;");
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
