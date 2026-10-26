/** PROTOTYPE — floating switcher for the menu variants and a role preview. Hidden in production. */
import { useEffect } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { AuditRole } from "@/lib/audit-roles";

import { variants } from "./side-menu-variants";
import type { ProtoState } from "./use-proto-menu";

const ROLES = [AuditRole.STAFF, AuditRole.MANAGER, AuditRole.OWNER, AuditRole.ADMIN];

export function PrototypeSwitcher({
  state,
  setState,
}: {
  state: ProtoState;
  setState: (state: ProtoState) => void;
}) {
  const index = variants.findIndex((v) => v.key === state.variant);
  const step = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    setState({ ...state, variant: next.key });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="bg-foreground text-background shadow-popover medium:bottom-4 fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1 text-xs">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => step(-1)}
        className="rounded-full p-2 hover:opacity-70"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="font-medium whitespace-nowrap">
        {variants[index].key} {variants[index].name}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => step(1)}
        className="rounded-full p-2 hover:opacity-70"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
      <label className="flex items-center gap-1 pr-2 whitespace-nowrap">
        <span className="opacity-70">Menu as</span>
        <select
          value={state.role}
          onChange={(event) =>
            setState({ ...state, role: event.target.value as ProtoState["role"] })
          }
          className="bg-foreground rounded px-1 py-0.5"
        >
          <option value="real">my role</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
