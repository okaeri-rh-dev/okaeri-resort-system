/** PROTOTYPE — create and edit a block, with the conflict list and the cancel-and-save action. */
import { useEffect, useMemo, useState } from "react";

import { addDays, format, parseISO } from "date-fns";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Callout,
  Checkbox,
  DatePicker,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusBadge,
  Textarea,
} from "@/components/patterns";

import {
  blockPhase,
  cabinName,
  CABINS,
  findConflicts,
  nightsLabel,
  shortDate,
  todayIso,
  type Conflict,
  type ProtoBlock,
  type ProtoRole,
} from "./model";
import { useProtoBlocks } from "./use-proto-blocks";

export interface BlockFormTarget {
  block?: ProtoBlock;
  prefill?: { unitIds?: string[] | null; firstNight?: string; lastNight?: string };
}

const toDate = (value: string) => (value ? parseISO(value) : undefined);
const toIso = (value: Date | undefined) => (value ? format(value, "yyyy-MM-dd") : "");

export function BlockFormSheet({
  target,
  onClose,
  role,
}: {
  target: BlockFormTarget | null;
  onClose: () => void;
  role: ProtoRole;
}) {
  const store = useProtoBlocks();
  const block = target?.block;
  const phase = block ? blockPhase(block) : "upcoming";
  const readOnly = role === "staff" || phase === "over";
  const onlyEndDate = phase === "running";

  const [wholeResort, setWholeResort] = useState(false);
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [firstNight, setFirstNight] = useState("");
  const [lastNight, setLastNight] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const prefillUnits = target.block
      ? target.block.unitId === null
        ? null
        : [target.block.unitId]
      : (target.prefill?.unitIds ?? []);
    setWholeResort(prefillUnits === null);
    setUnitIds(prefillUnits ?? []);
    setFirstNight(target.block?.firstNight ?? target.prefill?.firstNight ?? "");
    setLastNight(target.block?.lastNight ?? target.prefill?.lastNight ?? "");
    setReason(target.block?.reason ?? "");
    setRefused(false);
    setError(null);
  }, [target]);

  const scope = wholeResort ? null : unitIds;
  // The saved block already has no conflicts, so an edit can only conflict on nights it adds.
  const conflicts = useMemo(
    () => findConflicts(store.bookings, scope, firstNight, lastNight),
    [store.bookings, scope, firstNight, lastNight]
  );
  const hasCheckedIn = conflicts.some((conflict) => conflict.checkedIn);

  const drafts = (): Omit<ProtoBlock, "id">[] =>
    (scope === null ? [null] : scope).map((unitId) => ({ unitId, firstNight, lastNight, reason }));

  const validate = () => {
    if (scope !== null && scope.length === 0) return "Pick at least one cabin, or Whole resort.";
    if (!firstNight || !lastNight) return "Pick the first and the last blocked night.";
    if (lastNight < firstNight) return "The last night must be on or after the first night.";
    if (!block && firstNight < todayIso()) return "A new block can't start in the past.";
    if (!reason.trim()) return "Add a reason, for example “Aircon cleaning”.";
    return null;
  };

  const save = () => {
    const problem = validate();
    setError(problem);
    if (problem || conflicts.length > 0) return;
    store.saveBlocks(drafts(), block?.id);
    onClose();
  };

  const confirmCancelAndSave = (confirmed: Conflict[]) => {
    const result = store.cancelAndSave(confirmed, drafts(), block?.id);
    setConfirmOpen(false);
    if (result.ok) onClose();
    else setRefused(true);
  };

  const title = block
    ? readOnly
      ? "Blocked dates"
      : "Edit block"
    : wholeResort
      ? "Close the resort"
      : "Block dates";

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="medium:max-w-md flex w-full flex-col gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Blocked nights can't be booked in the admin app or by guests.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {phase === "over" && (
            <Callout tone="neutral">This block is over. It can't be changed.</Callout>
          )}
          {onlyEndDate && role === "manager" && (
            <Callout tone="info">
              This block has started. You can change only the last night.
            </Callout>
          )}
          {role === "staff" && phase !== "over" && (
            <Callout tone="neutral">Ask a manager to change blocked dates.</Callout>
          )}

          <fieldset className="space-y-2" disabled={readOnly || !!block}>
            <legend className="text-sm font-medium">Which cabins</legend>
            <label htmlFor="proto-whole-resort" className="flex items-center gap-2 text-sm">
              <Checkbox
                id="proto-whole-resort"
                checked={wholeResort}
                onCheckedChange={(checked) => setWholeResort(checked === true)}
                disabled={readOnly || !!block}
              />
              Whole resort (every cabin, also cabins added later)
            </label>
            {!wholeResort && (
              <div className="grid grid-cols-3 gap-2">
                {CABINS.map((cabin) => (
                  <label
                    key={cabin.id}
                    className="coarse:min-h-11 flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <Checkbox
                      checked={unitIds.includes(cabin.id)}
                      disabled={readOnly || !!block}
                      onCheckedChange={(checked) =>
                        setUnitIds((ids) =>
                          checked ? [...ids, cabin.id] : ids.filter((id) => id !== cabin.id)
                        )
                      }
                    />
                    {cabin.name}
                  </label>
                ))}
              </div>
            )}
            {block && !readOnly && (
              <p className="text-muted-foreground text-xs">
                To block other cabins, add a new block.
              </p>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">First blocked night</p>
              {readOnly || onlyEndDate ? (
                <p className="py-2 text-sm">{firstNight ? shortDate(firstNight) : "—"}</p>
              ) : (
                <DatePicker
                  value={toDate(firstNight)}
                  onChange={(value) => setFirstNight(toIso(value))}
                  aria-label="First blocked night"
                />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Last blocked night</p>
              {readOnly ? (
                <p className="py-2 text-sm">{lastNight ? shortDate(lastNight) : "—"}</p>
              ) : (
                <DatePicker
                  value={toDate(lastNight)}
                  onChange={(value) => setLastNight(toIso(value))}
                  aria-label="Last blocked night"
                />
              )}
            </div>
          </div>
          {firstNight && lastNight && lastNight >= firstNight && (
            <p className="text-muted-foreground text-xs">
              {nightsLabel({ firstNight, lastNight })}. Guests can still check out on{" "}
              {shortDate(firstNight)}. The next check-in is{" "}
              {format(addDays(parseISO(lastNight), 1), "EEE d MMM")}.
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="proto-block-reason">Reason</Label>
            <Textarea
              id="proto-block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={readOnly || onlyEndDate}
              placeholder="Aircon cleaning"
              rows={2}
            />
            <p className="text-muted-foreground text-xs">Staff only. Guests see “unavailable”.</p>
          </div>

          {refused && (
            <Callout tone="danger" title="Nothing was saved">
              The bookings on these nights changed since you checked. Look at the new list, then try
              again.
            </Callout>
          )}

          {conflicts.length > 0 && !readOnly && (
            <ConflictList conflicts={conflicts} hasCheckedIn={hasCheckedIn} />
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        {!readOnly && (
          <div className="flex flex-col gap-2 border-t p-4">
            {conflicts.length > 0 && !hasCheckedIn && (
              <Button
                variant="destructive"
                onClick={() => {
                  const problem = validate();
                  setError(problem);
                  if (!problem) setConfirmOpen(true);
                }}
              >
                Cancel {conflicts.length === 1 ? "this booking" : "these bookings"} and save the
                block
              </Button>
            )}
            <div className="flex gap-2">
              {block && phase === "upcoming" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    store.deleteBlock(block.id);
                    onClose();
                  }}
                >
                  Delete block
                </Button>
              )}
              <Button className="flex-1" onClick={save} disabled={conflicts.length > 0}>
                {block ? "Save changes" : wholeResort ? "Close the resort" : "Block dates"}
              </Button>
            </div>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Cancel {conflicts.length} {conflicts.length === 1 ? "booking" : "bookings"} and save
                the block?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <ul className="list-disc pl-5">
                    {conflicts.map(({ booking }) => (
                      <li key={booking.id}>
                        {booking.reference}, {booking.guest}
                      </li>
                    ))}
                  </ul>
                  <p>
                    Payments are not changed. Refund any paid amount by hand. The guests are not
                    told: contact them yourself.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep the bookings</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmCancelAndSave(conflicts)}>
                Cancel and save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function ConflictList({
  conflicts,
  hasCheckedIn,
}: {
  conflicts: Conflict[];
  hasCheckedIn: boolean;
}) {
  return (
    <section className="space-y-2" aria-label="Bookings on these nights">
      <Callout
        tone="warning"
        title={`${conflicts.length} ${conflicts.length === 1 ? "booking uses" : "bookings use"} these nights`}
      >
        {hasCheckedIn
          ? "A guest is checked in. Change the block dates, then save."
          : "Move them in the booking form, or cancel them here and save the block."}
      </Callout>
      <ul className="divide-y rounded-md border">
        {conflicts.map(({ booking, partial, checkedIn }) => (
          <li key={booking.id} className="space-y-1 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">
                {booking.reference} · {booking.guest}
              </span>
              <StatusBadge
                tone={checkedIn ? "info" : booking.status === "Pending" ? "warning" : "success"}
              >
                {checkedIn ? "Checked in" : booking.status}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground text-xs">
              {booking.unitIds.map(cabinName).join(", ")} · {shortDate(booking.checkIn)} →{" "}
              {shortDate(booking.checkOut)}
            </p>
            {partial && (
              <p className="text-xs">
                <StatusBadge tone="neutral">Partial</StatusBadge>{" "}
                <span className="text-muted-foreground">
                  {partial}. Cancel cancels the whole booking; to keep part of it, edit the booking.
                </span>
              </p>
            )}
            {checkedIn && (
              <p className="text-xs font-medium">Guest is checked in: change the block dates.</p>
            )}
            <a href="#open-booking" className="text-primary text-xs underline">
              Open booking
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
