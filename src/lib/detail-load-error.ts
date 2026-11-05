import { notFound } from "@tanstack/react-router";

// PGRST116: `.single()` matched no row. 22P02: the id is not a valid UUID.
const NOT_FOUND_CODES = new Set(["PGRST116", "22P02"]);

export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    NOT_FOUND_CODES.has(String(error.code))
  );
}

/** For a by-id detail query: notFound() for a missing record, else a friendly Error. */
export function throwDetailLoadError(error: unknown, entityLabel: string): never {
  if (isNotFoundError(error)) throw notFound();
  console.error(`Failed to load ${entityLabel}:`, error);
  throw new Error(`Could not load this ${entityLabel}. Try again.`);
}
