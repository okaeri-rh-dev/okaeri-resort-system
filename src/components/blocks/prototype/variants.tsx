/** PROTOTYPE — three places to manage blocks. Switch with ?variant=A|B|C. */
import { useState, type CSSProperties } from "react";

import { addDays, format } from "date-fns";
import { Plus } from "lucide-react";

import { Button, Card, PageHeader, StatusBadge } from "@/components/patterns";
import { cn } from "@/lib/utils";

import type { BlockFormTarget } from "./BlockFormSheet";
import {
  blockPhase,
  cabinName,
  CABINS,
  nightBlocked,
  nightBooking,
  nightsLabel,
  todayIso,
  type ProtoBlock,
  type ProtoRole,
} from "./model";
import { useProtoBlocks } from "./use-proto-blocks";

export interface VariantProps {
  role: ProtoRole;
  open: (target: BlockFormTarget) => void;
}

const hatch: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, var(--border) 0 2px, transparent 2px 7px)",
};

const phaseBadge = (block: ProtoBlock) => {
  const phase = blockPhase(block);
  if (phase === "running") return <StatusBadge tone="warning">Now</StatusBadge>;
  if (phase === "over") return <StatusBadge tone="neutral">Over</StatusBadge>;
  return <StatusBadge tone="info">Upcoming</StatusBadge>;
};

const byStart = (a: ProtoBlock, b: ProtoBlock) => a.firstNight.localeCompare(b.firstNight);

function AddButtons({ role, open }: VariantProps) {
  if (role === "staff") return null;
  return (
    <>
      <Button variant="outline" onClick={() => open({ prefill: { unitIds: null } })}>
        Close the resort
      </Button>
      <Button onClick={() => open({ prefill: { unitIds: [] } })}>
        <Plus className="size-4" aria-hidden="true" />
        Block dates
      </Button>
    </>
  );
}

/* ---------------------------------------------------------------- A */

export function VariantA(props: VariantProps) {
  const { blocks } = useProtoBlocks();
  const [showPast, setShowPast] = useState(false);
  const current = blocks.filter((block) => blockPhase(block) !== "over").sort(byStart);
  const past = blocks
    .filter((block) => blockPhase(block) === "over")
    .sort(byStart)
    .reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blocked dates"
        description="Nights a cabin, or the whole resort, can't be booked."
        actions={<AddButtons {...props} />}
      />
      <BlockList blocks={current} open={props.open} empty="No upcoming blocked dates." />
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => setShowPast((value) => !value)}>
          {showPast ? "Hide" : "Show"} past blocks ({past.length})
        </Button>
        {showPast && <BlockList blocks={past} open={props.open} empty="No past blocks." />}
      </div>
    </div>
  );
}

function BlockList({
  blocks,
  open,
  empty,
}: {
  blocks: ProtoBlock[];
  open: VariantProps["open"];
  empty: string;
}) {
  if (blocks.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ul className="bg-card divide-y rounded-lg border">
      {blocks.map((block) => (
        <li key={block.id}>
          <button
            type="button"
            onClick={() => open({ block })}
            className="hover:bg-accent coarse:min-h-11 flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm transition-colors duration-150"
          >
            <span className="medium:w-64 w-full font-medium tabular-nums">
              {nightsLabel(block)}
            </span>
            <span className="medium:w-32">
              {block.unitId === null ? (
                <StatusBadge tone="danger">Whole resort</StatusBadge>
              ) : (
                cabinName(block.unitId)
              )}
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{block.reason}</span>
            {phaseBadge(block)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- B */

const DAYS = 28;

export function VariantB(props: VariantProps) {
  const { blocks, bookings } = useProtoBlocks();
  const [pending, setPending] = useState<{ unitId: string | null; night: string } | null>(null);
  const nights = Array.from({ length: DAYS }, (_, index) =>
    format(addDays(new Date(), index - 2), "yyyy-MM-dd")
  );
  const today = todayIso();

  const tapFree = (unitId: string | null, night: string) => {
    if (props.role === "staff" || night < today) return;
    if (!pending || pending.unitId !== unitId) {
      setPending({ unitId, night });
      return;
    }
    const [firstNight, lastNight] = [pending.night, night].sort();
    setPending(null);
    props.open({ prefill: { unitIds: unitId === null ? null : [unitId], firstNight, lastNight } });
  };

  const rows: { unitId: string | null; label: string }[] = [
    { unitId: null, label: "Whole resort" },
    ...CABINS.map((cabin) => ({ unitId: cabin.id, label: cabin.name })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="Bookings and blocked dates per cabin. Tap two nights in a row to block them."
        actions={<AddButtons {...props} />}
      />
      {pending && (
        <p className="text-sm">
          First night {pending.night}. Tap the last night in the same row.{" "}
          <button type="button" className="text-primary underline" onClick={() => setPending(null)}>
            Clear
          </button>
        </p>
      )}
      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="bg-card sticky left-0 z-10 w-28 p-2 text-left font-medium">Cabin</th>
              {nights.map((night) => (
                <th
                  key={night}
                  className={cn(
                    "w-11 p-1 text-center font-normal tabular-nums",
                    night === today && "text-primary font-semibold"
                  )}
                >
                  <div>{format(new Date(night), "EEEEE")}</div>
                  <div>{format(new Date(night), "d")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t">
                <th className="bg-card sticky left-0 z-10 p-2 text-left font-medium">
                  {row.label}
                </th>
                {nights.map((night) => {
                  const closure = blocks.find(
                    (block) =>
                      block.unitId === null && block.firstNight <= night && night <= block.lastNight
                  );
                  const block =
                    row.unitId === null ? closure : nightBlocked(blocks, row.unitId, night);
                  const booking =
                    row.unitId === null ? undefined : nightBooking(bookings, row.unitId, night);
                  const isPending = pending?.unitId === row.unitId && pending.night === night;
                  return (
                    <td key={night} className="h-11 p-0.5">
                      {block ? (
                        <button
                          type="button"
                          title={block.reason}
                          onClick={() => props.open({ block })}
                          style={hatch}
                          className="bg-muted size-full rounded-sm hover:opacity-80"
                        >
                          <span className="sr-only">Blocked: {block.reason}</span>
                        </button>
                      ) : booking ? (
                        <div
                          title={`${booking.reference} ${booking.guest}`}
                          className="bg-primary/20 text-foreground flex size-full items-center justify-center rounded-sm"
                        >
                          {booking.checkIn === night ? booking.guest.split(" ")[0][0] : ""}
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`${row.label} ${night} free`}
                          onClick={() => tapFree(row.unitId, night)}
                          className={cn(
                            "hover:bg-accent size-full rounded-sm",
                            isPending && "bg-primary text-primary-foreground"
                          )}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span style={hatch} className="bg-muted inline-block size-4 rounded-sm" /> Blocked
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-primary/20 inline-block size-4 rounded-sm" /> Booked
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-4 rounded-sm border" /> Free
        </span>
      </div>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Upcoming blocks</h2>
        <BlockList
          blocks={blocks.filter((block) => blockPhase(block) !== "over").sort(byStart)}
          open={props.open}
          empty="No upcoming blocked dates."
        />
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- C */

export function VariantC(props: VariantProps) {
  const { blocks, bookings } = useProtoBlocks();
  const today = todayIso();
  const closures = blocks
    .filter((b) => b.unitId === null && blockPhase(b) !== "over")
    .sort(byStart);
  const strip = Array.from({ length: 14 }, (_, index) =>
    format(addDays(new Date(), index), "yyyy-MM-dd")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cabins"
        description="Each cabin's state tonight and its blocked dates."
        actions={
          props.role === "manager" && (
            <Button variant="outline" onClick={() => props.open({ prefill: { unitIds: null } })}>
              Close the resort
            </Button>
          )
        }
      />
      {closures.length > 0 && (
        <Card className="space-y-2 p-4">
          <h2 className="font-display text-lg font-semibold">Resort closures</h2>
          <BlockList blocks={closures} open={props.open} empty="" />
        </Card>
      )}
      <div className="expanded:grid-cols-3 grid gap-4">
        {CABINS.map((cabin) => {
          const tonightBlock = nightBlocked(blocks, cabin.id, today);
          const tonightBooking = nightBooking(bookings, cabin.id, today);
          const own = blocks
            .filter((b) => b.unitId === cabin.id && blockPhase(b) !== "over")
            .sort(byStart);
          return (
            <Card key={cabin.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{cabin.name}</h2>
                {tonightBlock ? (
                  <StatusBadge tone="danger">Blocked</StatusBadge>
                ) : tonightBooking ? (
                  <StatusBadge tone="info">Booked</StatusBadge>
                ) : (
                  <StatusBadge tone="success">Free</StatusBadge>
                )}
              </div>
              {tonightBlock && (
                <p className="text-muted-foreground text-xs">Tonight: {tonightBlock.reason}</p>
              )}
              <div className="flex gap-0.5" aria-label="Next 14 nights">
                {strip.map((night) => {
                  const blocked = nightBlocked(blocks, cabin.id, night);
                  const booked = nightBooking(bookings, cabin.id, night);
                  return (
                    <span
                      key={night}
                      title={night}
                      style={blocked ? hatch : undefined}
                      className={cn(
                        "h-6 flex-1 rounded-sm border",
                        blocked && "bg-muted",
                        !blocked && booked && "bg-primary/20"
                      )}
                    />
                  );
                })}
              </div>
              <ul className="space-y-1 text-sm">
                {own.length === 0 && (
                  <li className="text-muted-foreground text-xs">No blocked dates ahead.</li>
                )}
                {own.map((block) => (
                  <li key={block.id}>
                    <button
                      type="button"
                      onClick={() => props.open({ block })}
                      className="hover:bg-accent coarse:min-h-11 w-full rounded-md px-2 py-1 text-left"
                    >
                      <span className="block tabular-nums">{nightsLabel(block)}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {block.reason}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {props.role === "manager" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => props.open({ prefill: { unitIds: [cabin.id] } })}
                >
                  Block dates
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- prototype
export const variants = [
  { key: "A", name: "Own page, list", Component: VariantA },
  { key: "B", name: "Timeline on Availability", Component: VariantB },
  { key: "C", name: "Per cabin", Component: VariantC },
] as const;
