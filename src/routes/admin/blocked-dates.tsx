import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { z } from "zod";

import { BlockFormSheet, type BlockFormTarget } from "@/components/blocks/BlockFormSheet";
import { BlockList } from "@/components/blocks/BlockList";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button, Callout, PageHeader, Skeleton } from "@/components/patterns";
import { useBlocks, type Block } from "@/hooks/useBlocks";
import { useUserRole } from "@/hooks/useUserRole";
import { blockPhase } from "@/lib/blocks";
import { requireStaff } from "@/lib/route-guards";
import { toManilaDateString } from "@/lib/timezone";
import { allUnitsQuery } from "@/stores/useUnitStore";

const blockedDatesSearchSchema = z.object({
  past: z.boolean().optional(),
  /** The open sheet: "new", "closure" or a block id */
  sheet: z.string().optional(),
});

export const Route = createFileRoute("/admin/blocked-dates")({
  validateSearch: blockedDatesSearchSchema,
  beforeLoad: async () => {
    await requireStaff();
  },
  component: BlockedDatesPage,
});

function BlockedDatesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const showPast = search.past === true;
  const { isManager, isLoading: isLoadingRole } = useUserRole();
  const { data: blocks = [], isLoading, error, refetch } = useBlocks({ includePast: showPast });
  const { data: units = [] } = useQuery(allUnitsQuery());

  const today = toManilaDateString(new Date());
  const sortedUnits = [...units].sort((a, b) =>
    a.unit_name.localeCompare(b.unit_name, undefined, { numeric: true })
  );
  const cabinName = (unitId: string) =>
    units.find((unit) => unit.unit_id === unitId)?.unit_name ?? "Cabin";
  // Same nights: the whole resort first, then cabins in name order
  const cabinOrder = (block: Block) =>
    block.unit_id === null ? -1 : sortedUnits.findIndex((unit) => unit.unit_id === block.unit_id);
  const byNights = (a: Block, b: Block) =>
    a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date);
  const current = blocks
    .filter((block) => blockPhase(block, today) !== "over")
    .sort((a, b) => byNights(a, b) || cabinOrder(a) - cabinOrder(b));
  const past = blocks
    .filter((block) => blockPhase(block, today) === "over")
    .sort((a, b) => byNights(b, a) || cabinOrder(a) - cabinOrder(b));

  const setSearch = (next: z.infer<typeof blockedDatesSearchSchema>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  const openSheet = (sheet: string) => setSearch({ sheet });

  const sheetBlock = blocks.find((block) => block.blackout_id === search.sheet);
  const target: BlockFormTarget | null =
    search.sheet === "new" && isManager
      ? { wholeResort: false }
      : search.sheet === "closure" && isManager
        ? { wholeResort: true }
        : sheetBlock
          ? { block: sheetBlock }
          : null;

  const actions =
    !isLoadingRole && isManager ? (
      <>
        <Button variant="outline" onClick={() => openSheet("closure")}>
          Close the resort
        </Button>
        <Button onClick={() => openSheet("new")}>
          <Plus className="size-4" aria-hidden="true" />
          Block dates
        </Button>
      </>
    ) : undefined;

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <PageHeader
          title="Blocked dates"
          description="Nights a cabin, or the whole resort, can't be booked."
          actions={actions}
        />
        {!isLoadingRole && !isManager && (
          <p className="text-muted-foreground text-sm">Ask a manager to change blocked dates.</p>
        )}

        {error ? (
          <Callout tone="danger" title="Could not load blocked dates">
            <p>Check your connection, then try again.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
              Try again
            </Button>
          </Callout>
        ) : isLoading ? (
          <BlockListSkeleton />
        ) : (
          <section className="space-y-2" aria-label="Current and upcoming blocks">
            <BlockList
              blocks={current}
              today={today}
              cabinName={cabinName}
              onOpen={(block) => openSheet(block.blackout_id)}
              empty="No current or upcoming blocked dates."
            />
          </section>
        )}

        {!error && (
          <section className="space-y-2" aria-label="Past blocks">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showPast}
              onClick={() => setSearch({ past: showPast ? undefined : true })}
            >
              {showPast ? "Hide past blocks" : "Show past blocks"}
            </Button>
            {showPast && !isLoading && (
              <BlockList
                blocks={past}
                today={today}
                cabinName={cabinName}
                onOpen={(block) => openSheet(block.blackout_id)}
                empty="No past blocks."
              />
            )}
          </section>
        )}
      </div>

      <BlockFormSheet
        target={target}
        units={sortedUnits}
        canManage={isManager}
        onClose={() => setSearch({ sheet: undefined })}
      />
    </ErrorBoundary>
  );
}

function BlockListSkeleton() {
  return (
    <div className="bg-card divide-y rounded-lg border" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <Skeleton className="medium:w-64 h-5 w-full" />
          <Skeleton className="medium:w-32 h-5 w-24" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
