import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { z } from "zod";

import { BlockFormSheet, type BlockFormTarget } from "@/components/blocks/BlockFormSheet";
import { BlockList } from "@/components/blocks/BlockList";
import { LoadErrorCallout } from "@/components/blocks/LoadErrorCallout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button, PageHeader, Skeleton } from "@/components/patterns";
import { useBlockCabins, useBlocks } from "@/hooks/useBlocks";
import { useUserRole } from "@/hooks/useUserRole";
import { blockPhase } from "@/lib/blocks";
import { requireStaff } from "@/lib/route-guards";
import { toManilaDateString } from "@/lib/timezone";

const NEW_BLOCK_SHEETS = ["new", "closure"];

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
  const opensBlock = search.sheet !== undefined && !NEW_BLOCK_SHEETS.includes(search.sheet);
  // A link to a past block must find it even while the past list is folded
  const {
    data: blocks = [],
    isLoading,
    error,
    refetch,
  } = useBlocks({
    includePast: showPast || opensBlock,
  });
  const { sortedUnits, cabinName, sortBlocks } = useBlockCabins();

  const today = toManilaDateString(new Date());
  const current = sortBlocks(blocks.filter((block) => blockPhase(block, today) !== "over"));
  const past = sortBlocks(
    (showPast ? blocks : []).filter((block) => blockPhase(block, today) === "over"),
    { newestFirst: true }
  );

  const setSearch = (next: z.infer<typeof blockedDatesSearchSchema>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  const openSheet = (sheet: string) => setSearch({ sheet });

  const sheetTarget = (): BlockFormTarget | null => {
    if (search.sheet === "new") return isManager ? { wholeResort: false } : null;
    if (search.sheet === "closure") return isManager ? { wholeResort: true } : null;
    const block = blocks.find(({ blackout_id }) => blackout_id === search.sheet);
    return block ? { block } : null;
  };

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
          <LoadErrorCallout title="Could not load blocked dates" onRetry={() => void refetch()} />
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
        target={sheetTarget()}
        units={sortedUnits}
        cabinName={cabinName}
        today={today}
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
