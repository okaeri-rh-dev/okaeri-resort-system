/**
 * PROTOTYPE — three throwaway variants of /admin/bookings on fixture data, switched by `?v=1|2|3`.
 * Branch proto/bookings-overhaul only; never merged. Plan: docs/plans/2026-10-21-bookings-overhaul.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { F1Stepper } from "@/components/bookings/prototype/F1Stepper";
import { F2OnePage } from "@/components/bookings/prototype/F2OnePage";
import { PrototypeSwitcher } from "@/components/bookings/prototype/PrototypeSwitcher";
import { ProtoStoreProvider } from "@/components/bookings/prototype/store";
import { V1Agenda } from "@/components/bookings/prototype/V1Agenda";
import { V2Views } from "@/components/bookings/prototype/V2Views";
import { V3Timeline } from "@/components/bookings/prototype/V3Timeline";
import { requireStaff } from "@/lib/route-guards";

const searchSchema = z.object({
  v: z.union([z.literal(1), z.literal(2), z.literal(3)]).catch(1),
  d: z.enum(["full", "quiet"]).optional(),
  q: z.string().optional(),
  cabin: z.string().optional(),
  pay: z.enum(["due", "paid"]).optional(),
  src: z.enum(["guest", "walk-in"]).optional(),
  view: z.enum(["upcoming", "inhouse", "action", "past", "cancelled"]).optional(),
  sel: z.string().optional(),
  panel: z.enum(["verify"]).optional(),
  new: z.boolean().optional(),
  flow: z.union([z.literal(1), z.literal(2), z.literal(3)]).catch(1),
  step: z.number().optional(),
  newCabin: z.string().optional(),
  newFrom: z.string().optional(),
  from: z.number().optional(),
  span: z.union([z.literal(7), z.literal(14), z.literal(30)]).optional(),
});

export const Route = createFileRoute("/admin/prototype/bookings")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    await requireStaff();
  },
  component: PrototypeBookingsPage,
});

function PrototypeBookingsPage() {
  const { v, d, flow, new: isNew } = Route.useSearch();
  const flowPage = isNew && flow !== 3;
  return (
    <ProtoStoreProvider scenario={d ?? "full"}>
      <div className="pb-24">
        {flowPage && flow === 1 && <F1Stepper />}
        {flowPage && flow === 2 && <F2OnePage />}
        {!flowPage && v === 1 && <V1Agenda />}
        {!flowPage && v === 2 && <V2Views />}
        {!flowPage && v === 3 && <V3Timeline />}
      </div>
      <PrototypeSwitcher />
    </ProtoStoreProvider>
  );
}
