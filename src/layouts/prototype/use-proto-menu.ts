/** PROTOTYPE — which menu variant and previewed role are showing. */
import { useEffect, useState } from "react";

import type { AuditRole } from "@/lib/audit-roles";

import { variants, type MenuVariant } from "./side-menu-variants";

const STORAGE_KEY = "proto-side-menu";

export interface ProtoState {
  variant: MenuVariant["key"];
  role: AuditRole | "real";
}

function readInitial(): ProtoState {
  const params = new URLSearchParams(window.location.search);
  const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ProtoState>;
  const variant = (params.get("variant") ?? stored.variant ?? "A") as MenuVariant["key"];
  const role = (params.get("role") ?? stored.role ?? "real") as ProtoState["role"];
  return { variant: variants.some((v) => v.key === variant) ? variant : "A", role };
}

/** Variant and previewed role survive in-app navigation (the layout stays mounted) and reloads. */
export function useProtoMenu() {
  const [state, setState] = useState<ProtoState>(readInitial);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return {
    variant: variants.find((v) => v.key === state.variant) ?? variants[0],
    previewRole: state.role === "real" ? null : state.role,
    state,
    setState,
  };
}
