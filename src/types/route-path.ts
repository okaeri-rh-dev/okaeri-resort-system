import type { FileRoutesByTo } from "@/routeTree.gen";

/** A route path from the generated route tree, so a path that does not exist fails tsc. */
export type RoutePath = keyof FileRoutesByTo;
