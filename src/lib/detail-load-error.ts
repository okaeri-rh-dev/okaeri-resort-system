import { notFound } from "@tanstack/react-router";

// PGRST116: `.single()` matched no row. 22P02: the id is not a valid UUID.
const NO_ROW_CODES = new Set(["PGRST116", "22P02"]);

export function isNoRowError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    NO_ROW_CODES.has(String(error.code))
  );
}

/** For a by-id detail query: a missing record shows the route's notFoundComponent. */
export function throwDetailLoadError(error: unknown, entityLabel: string): never {
  if (isNoRowError(error)) throw notFound();
  console.error(`Failed to load ${entityLabel}:`, error);
  throw new Error(`Could not load this ${entityLabel}. Try again.`);
}
