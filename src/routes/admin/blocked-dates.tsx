/**
 * PROTOTYPE — Blocked dates admin UI ticket (#159, map #153). Throwaway: lives on
 * proto/blocked-dates-admin-ui only. Three places to manage blocks on one route, switchable with
 * ?variant=A|B|C; ?role=staff previews the view-only state. Data is in memory, not the database.
 */
import { useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { BlockFormSheet, type BlockFormTarget } from "@/components/blocks/prototype/BlockFormSheet";
import { PrototypeSwitcher } from "@/components/blocks/prototype/PrototypeSwitcher";
import { variants } from "@/components/blocks/prototype/variants";
import { requireStaff } from "@/lib/route-guards";

const searchSchema = z.object({
  variant: z.enum(["A", "B", "C"]).optional(),
  role: z.enum(["staff", "manager"]).optional(),
});

export const Route = createFileRoute("/admin/blocked-dates")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    await requireStaff();
  },
  component: BlockedDatesPrototype,
});

function BlockedDatesPrototype() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [target, setTarget] = useState<BlockFormTarget | null>(null);
  const variantKey = search.variant ?? "A";
  const role = search.role ?? "manager";
  const variant = variants.find((v) => v.key === variantKey) ?? variants[0];

  return (
    <>
      <variant.Component role={role} open={setTarget} />
      <BlockFormSheet target={target} onClose={() => setTarget(null)} role={role} />
      <PrototypeSwitcher
        variantKey={variantKey}
        role={role}
        onChange={(next) => void navigate({ search: { ...search, ...next }, replace: true })}
      />
    </>
  );
}
