export const ROUTES = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  projects: "/projects",
  expenses: "/expenses",
  reports: "/reports",
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
