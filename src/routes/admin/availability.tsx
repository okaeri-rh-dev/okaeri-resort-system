import { lazy, Suspense } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { AvailabilityTimeline } from "@/components/blocks/AvailabilityTimeline";
import { BlockFormSheet, type BlockFormTarget } from "@/components/blocks/BlockFormSheet";
import { BlockList } from "@/components/blocks/BlockList";
import { LoadErrorCallout } from "@/components/blocks/LoadErrorCallout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/patterns";
import { useBlockCabins, useBlocks } from "@/hooks/useBlocks";
import { useUserRole } from "@/hooks/useUserRole";
import { blockPhase } from "@/lib/blocks";
import { isManilaDay } from "@/lib/bookings/stay";
import { requireStaff } from "@/lib/route-guards";
import { toManilaDateString } from "@/lib/timezone";

const UnitsTable = lazy(() =>
  import("@/components/units/UnitsTable").then((m) => ({ default: m.UnitsTable }))
);

const WHOLE_RESORT = "resort";
const manilaDay = z.string().refine(isManilaDay);

const availabilitySearchSchema = z.object({
  view: z.enum(["calendar", "units"]).optional().catch(undefined),
  /** The first night on the timeline */
  date: manilaDay.optional().catch(undefined),
  /** The open sheet: "new" or a block id */
  sheet: z.string().optional(),
  /** A new block's row and nights, picked on the timeline: a unit id or "resort" */
  cabin: z.string().optional(),
  first: manilaDay.optional().catch(undefined),
  last: manilaDay.optional().catch(undefined),
});

type AvailabilitySearch = z.infer<typeof availabilitySearchSchema>;

export const Route = createFileRoute("/admin/availability")({
  validateSearch: availabilitySearchSchema,
  beforeLoad: async () => {
    await requireStaff();
  },
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { isManager, isLoading: isLoadingRole } = useUserRole();
  const canManage = !isLoadingRole && isManager;
  const today = toManilaDateString(new Date());

  const opensBlock = search.sheet !== undefined && search.sheet !== "new";
  // A block tapped on an earlier window can be over, so the list reaches back to find it
  const {
    data: blocks = [],
    isLoading: isLoadingBlocks,
    error: blocksError,
    refetch: refetchBlocks,
  } = useBlocks({ includePast: opensBlock });
  const { sortedUnits, cabinName, sortBlocks } = useBlockCabins();
  const upcoming = sortBlocks(blocks.filter((block) => blockPhase(block, today) !== "over"));

  const setSearch = (next: AvailabilitySearch) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  const closeSheet = () =>
    setSearch({ sheet: undefined, cabin: undefined, first: undefined, last: undefined });

  // Staff cannot open the form from this page; managers open blocks and new blocks
  const sheetTarget = (): BlockFormTarget | null => {
    if (!canManage || !search.sheet) return null;
    if (search.sheet === "new") {
      const wholeResort = search.cabin === WHOLE_RESORT;
      return {
        wholeResort,
        unitIds: search.cabin && !wholeResort ? [search.cabin] : undefined,
        firstNight: search.first,
        lastNight: search.last,
      };
    }
    const block = blocks.find(({ blackout_id }) => blackout_id === search.sheet);
    return block ? { block } : null;
  };

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <PageHeader title="Availability" description="Bookings and blocked dates per cabin." />

        <Tabs
          value={search.view ?? "calendar"}
          onValueChange={(view) => setSearch({ view: view === "units" ? "units" : undefined })}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="units">Cabins Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-6">
            <ErrorBoundary level="component">
              <AvailabilityTimeline
                units={sortedUnits}
                today={today}
                startNight={search.date ?? today}
                onStartNightChange={(night) =>
                  setSearch({ date: night === today ? undefined : night })
                }
                canManage={canManage}
                onOpenBlock={(block) => setSearch({ sheet: block.blackout_id })}
                onPickRange={({ unitId, firstNight, lastNight }) =>
                  setSearch({
                    sheet: "new",
                    cabin: unitId ?? WHOLE_RESORT,
                    first: firstNight,
                    last: lastNight,
                  })
                }
              />
            </ErrorBoundary>

            <section className="space-y-2" aria-labelledby="upcoming-blocks-heading">
              <h2 id="upcoming-blocks-heading" className="font-display text-lg font-semibold">
                Upcoming blocks
              </h2>
              {!isLoadingRole && !isManager && (
                <p className="text-muted-foreground text-sm">
                  Ask a manager to change blocked dates.
                </p>
              )}
              {blocksError ? (
                <LoadErrorCallout
                  title="Could not load blocked dates"
                  onRetry={() => void refetchBlocks()}
                />
              ) : isLoadingBlocks ? (
                <Skeleton className="h-24 w-full rounded-lg" />
              ) : (
                <BlockList
                  blocks={upcoming}
                  today={today}
                  cabinName={cabinName}
                  onOpen={
                    canManage ? (block) => setSearch({ sheet: block.blackout_id }) : undefined
                  }
                  empty="No current or upcoming blocked dates."
                />
              )}
            </section>
          </TabsContent>

          <TabsContent value="units" className="space-y-4">
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
                  </div>
                }
              >
                <UnitsTable />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>

      <BlockFormSheet
        target={sheetTarget()}
        units={sortedUnits}
        cabinName={cabinName}
        today={today}
        canManage={canManage}
        onClose={closeSheet}
      />
    </ErrorBoundary>
  );
}
