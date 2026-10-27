import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  buttonVariants,
  Callout,
  Checkbox,
  DatePicker,
  Form,
  FormField,
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
  blockErrorMessage,
  useCreateBlocks,
  useDeleteBlock,
  useUpdateBlock,
  type Block,
} from "@/hooks/useBlocks";
import {
  blockFormMode,
  blockNightsLabel,
  blockPhase,
  describeBlockNights,
  type BlockFormMode,
} from "@/lib/blocks";
import { toManilaDateString } from "@/lib/timezone";
import type { Tables } from "@/types/database.types";

type Unit = Pick<Tables<"units">, "unit_id" | "unit_name">;

/** What the sheet opens on: an existing block, or a new one for cabins or the whole resort. */
export type BlockFormTarget = { block: Block } | { wholeResort: boolean };

interface BlockFormSheetProps {
  target: BlockFormTarget | null;
  units: Unit[];
  canManage: boolean;
  onClose: () => void;
}

export function BlockFormSheet({ target, units, canManage, onClose }: BlockFormSheetProps) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="medium:max-w-md flex w-full flex-col gap-0 overflow-y-auto p-0">
        {target && (
          <BlockFormBody
            key={"block" in target ? target.block.blackout_id : String(target.wholeResort)}
            target={target}
            units={units}
            canManage={canManage}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

const toNight = (date: Date) => format(date, "yyyy-MM-dd");

const blockFormSchema = z
  .object({
    wholeResort: z.boolean(),
    unitIds: z.array(z.string()),
    firstNight: z.date().optional(),
    lastNight: z.date().optional(),
    reason: z.string().trim(),
  })
  .superRefine(({ wholeResort, unitIds, firstNight, lastNight, reason }, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (!wholeResort && unitIds.length === 0) issue("unitIds", "Pick at least one cabin.");
    if (!firstNight) issue("firstNight", "Pick the first blocked night.");
    if (!lastNight) issue("lastNight", "Pick the last blocked night.");
    if (firstNight && lastNight && lastNight < firstNight) {
      issue("lastNight", "Pick a last night on or after the first night.");
    }
    if (!reason) issue("reason", "Add a reason, for example “Aircon cleaning”.");
  });

type BlockFormValues = z.infer<typeof blockFormSchema>;

const titles: Record<BlockFormMode, string> = {
  create: "Block dates",
  edit: "Edit block",
  "last-night-only": "Edit block",
  "read-only": "Blocked dates",
};

function BlockFormBody({
  target,
  units,
  canManage,
  onClose,
}: Omit<BlockFormSheetProps, "target"> & { target: BlockFormTarget }) {
  const block = "block" in target ? target.block : undefined;
  const today = toManilaDateString(new Date());
  const mode = blockFormMode(block, today, canManage);

  const createBlocks = useCreateBlocks();
  const updateBlock = useUpdateBlock();
  const deleteBlock = useDeleteBlock();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<BlockFormValues>({
    resolver: zodResolver(blockFormSchema),
    defaultValues: {
      wholeResort: block ? block.unit_id === null : "wholeResort" in target && target.wholeResort,
      unitIds: block?.unit_id ? [block.unit_id] : [],
      firstNight: block ? parseISO(block.start_date) : undefined,
      lastNight: block ? parseISO(block.end_date) : undefined,
      reason: block?.reason ?? "",
    },
  });

  const wholeResort = form.watch("wholeResort");
  const firstNight = form.watch("firstNight");
  const lastNight = form.watch("lastNight");
  const datesChosen = firstNight && lastNight && lastNight >= firstNight;
  const cabinName = (unitId: string | null) =>
    unitId === null
      ? "Whole resort"
      : (units.find((unit) => unit.unit_id === unitId)?.unit_name ?? "Cabin");

  // New nights start today at the earliest; the database already locks past and running nights.
  const isBeforeToday = (date: Date) => toNight(date) < today;
  const isBeforeFirstNight = (date: Date) =>
    isBeforeToday(date) || (firstNight !== undefined && date < firstNight);

  const onSubmit = async (values: BlockFormValues) => {
    if (!values.firstNight || !values.lastNight) return;
    const nights = {
      start_date: toNight(values.firstNight),
      end_date: toNight(values.lastNight),
    };
    setRefusal(null);
    try {
      if (!block) {
        await createBlocks.mutateAsync({
          unitIds: values.wholeResort ? null : values.unitIds,
          ...nights,
          reason: values.reason,
        });
      } else if (mode === "last-night-only") {
        await updateBlock.mutateAsync({
          id: block.blackout_id,
          changes: { end_date: nights.end_date },
        });
      } else {
        await updateBlock.mutateAsync({
          id: block.blackout_id,
          changes: { ...nights, reason: values.reason },
        });
      }
      onClose();
    } catch (error) {
      setRefusal(blockErrorMessage(error));
    }
  };

  const onDelete = async () => {
    if (!block) return;
    setRefusal(null);
    try {
      await deleteBlock.mutateAsync(block.blackout_id);
      onClose();
    } catch (error) {
      setRefusal(blockErrorMessage(error));
    }
  };

  const isSaving = createBlocks.isPending || updateBlock.isPending;
  const title = mode === "create" && wholeResort ? "Close the resort" : titles[mode];
  const saveLabel = block ? "Save changes" : wholeResort ? "Close the resort" : "Block dates";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col" noValidate>
        <SheetHeader className="border-b p-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Blocked nights can't be booked in the admin app or by guests.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {block && blockPhase(block, today) === "over" && (
            <Callout tone="neutral">This block is over. It can't be changed.</Callout>
          )}
          {mode === "read-only" && !canManage && (
            <Callout tone="neutral">Ask a manager to change blocked dates.</Callout>
          )}
          {mode === "last-night-only" && (
            <Callout tone="info">
              This block has started. You can change only the last night.
            </Callout>
          )}

          {mode === "create" ? (
            <CabinPicker form={form} units={units} />
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium">Cabin</p>
              <p className="text-sm">
                {block?.unit_id === null ? (
                  <StatusBadge tone="danger">Whole resort</StatusBadge>
                ) : (
                  cabinName(block?.unit_id ?? null)
                )}
              </p>
              {mode !== "read-only" && (
                <p className="text-muted-foreground text-xs">
                  To block other cabins, add a new block.
                </p>
              )}
            </div>
          )}

          {mode === "read-only" && block ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Nights</p>
              <p className="text-sm tabular-nums">
                {blockNightsLabel(block.start_date, block.end_date)}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {mode === "last-night-only" && block ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">First blocked night</p>
                    <p className="py-2 text-sm tabular-nums">
                      {format(parseISO(block.start_date), "EEE d MMM")}
                    </p>
                  </div>
                ) : (
                  <FormField control={form.control} name="firstNight" label="First blocked night">
                    {(field) => (
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        isDateDisabled={isBeforeToday}
                        placeholder="Pick a night"
                        aria-label="First blocked night"
                        className="w-full"
                      />
                    )}
                  </FormField>
                )}
                <FormField control={form.control} name="lastNight" label="Last blocked night">
                  {(field) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      isDateDisabled={isBeforeFirstNight}
                      placeholder="Pick a night"
                      aria-label="Last blocked night"
                      className="w-full"
                    />
                  )}
                </FormField>
              </div>
              {datesChosen && (
                <p className="text-muted-foreground text-xs tabular-nums">
                  {describeBlockNights(toNight(firstNight), toNight(lastNight))}
                </p>
              )}
            </div>
          )}

          {mode === "create" || mode === "edit" ? (
            <FormField
              control={form.control}
              name="reason"
              label="Reason"
              description="Staff only. Guests see “unavailable”."
            >
              {(field) => <Textarea rows={2} placeholder="Aircon cleaning" {...field} />}
            </FormField>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium">Reason</p>
              <p className="text-sm break-words">{block?.reason}</p>
            </div>
          )}

          {refusal && (
            <Callout tone="danger" title="Nothing was saved">
              {refusal}
            </Callout>
          )}
        </div>

        {mode !== "read-only" && (
          <div className="medium:flex-row medium:justify-end flex flex-col-reverse gap-2 border-t p-4">
            {block && mode === "edit" && (
              <Button
                type="button"
                variant="outline"
                className="medium:mr-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={isSaving}
              >
                Delete block
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {saveLabel}
            </Button>
          </div>
        )}
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription>
              {block &&
                `${cabinName(block.unit_id)}, ${blockNightsLabel(block.start_date, block.end_date)}. `}
              Guests can book these nights again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the block</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => void onDelete()}
            >
              Delete block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}

function CabinPicker({
  form,
  units,
}: {
  form: ReturnType<typeof useForm<BlockFormValues>>;
  units: Unit[];
}) {
  const wholeResort = form.watch("wholeResort");
  const unitIds = form.watch("unitIds");
  const error = form.formState.errors.unitIds?.message;

  const toggleUnit = (unitId: string, checked: boolean) =>
    form.setValue(
      "unitIds",
      checked ? [...unitIds, unitId] : unitIds.filter((id) => id !== unitId),
      { shouldValidate: form.formState.isSubmitted }
    );

  return (
    <fieldset className="space-y-2" aria-describedby={error ? "block-cabins-error" : undefined}>
      <legend className="text-sm font-medium">Cabins</legend>
      <Label
        htmlFor="block-whole-resort"
        className="coarse:min-h-11 flex items-center gap-2 text-sm font-normal"
      >
        <Checkbox
          id="block-whole-resort"
          checked={wholeResort}
          onCheckedChange={(checked) =>
            form.setValue("wholeResort", checked === true, {
              shouldValidate: form.formState.isSubmitted,
            })
          }
        />
        Whole resort (every cabin, also cabins added later)
      </Label>
      {!wholeResort && (
        <div className="grid grid-cols-2 gap-2">
          {units.map((unit) => (
            <Label
              key={unit.unit_id}
              htmlFor={`block-cabin-${unit.unit_id}`}
              className="coarse:min-h-11 flex min-w-0 items-center gap-2 rounded-md border p-2 text-sm font-normal"
            >
              <Checkbox
                id={`block-cabin-${unit.unit_id}`}
                checked={unitIds.includes(unit.unit_id)}
                onCheckedChange={(checked) => toggleUnit(unit.unit_id, checked === true)}
              />
              <span className="truncate">{unit.unit_name}</span>
            </Label>
          ))}
        </div>
      )}
      {error && !wholeResort && (
        <p id="block-cabins-error" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
