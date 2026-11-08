import { createContext } from "react";

/** True inside AppShell's content area, so a loader there sizes itself to that area. */
export const ShellContentContext = createContext(false);
