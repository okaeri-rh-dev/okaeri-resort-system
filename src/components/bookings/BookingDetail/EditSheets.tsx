import { useState, type ReactNode } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Callout,
  Checkbox,
  DatePicker,
  DateRangePicker,
  Form,
  FormField,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { useUpdateBooking, useUpdateBookingStay } from "@/hooks/useBookings";
import { useMultiUnitAvailability } from "@/hooks/useMultiUnitBookingQueries";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { useUnits } from "@/hooks/useUnits";
import {
  BOOKING_SOURCES,
  manilaDayOf,
  manilaDaySchema,
  nightsBetween,
  pickedDay,
  storedConfirmationCode,
  unavailableReason,
  withStayRules,
  type BookingChanges,
  type ManilaDay,
} from "@/lib/bookings";
import { formatCurrency } from "@/lib/formatters";
import { priceStayCabin } from "@/lib/pricing/cabin-pricing";
import { confirmationCodeSchema } from "@/lib/validations";
import type { Booking } from "@/types";

import { CabinPicker } from "../CabinPicker";
import { BookingSourceField, ConfirmationCodeField } from "../form-fields";

interface EditSheetProps {
  booking: Booking;
  open: boolean;
  onClose: () => void;
}

// SheetContent mounts the form only while open, so a closed sheet drops unsaved changes
const EditSheet = ({ open, onClose, children }: EditSheetProps & { children: ReactNode }) => (
  <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
    <SheetContent className="medium:max-w-md flex w-full flex-col gap-0 overflow-y-auto p-0">
      {children}
    </SheetContent>
  </Sheet>
);

function EditForm<TValues extends FieldValues>({
  booking,
  onClose,
  title,
  form,
  save,
  canSave = true,
  children,
}: Omit<EditSheetProps, "open"> & {
  title: string;
  form: UseFormReturn<TValues>;
  save: { submit: (values: TValues) => Promise<unknown>; isPending: boolean };
  /** False while the form already shows why it cannot save */
  canSave?: boolean;
  children: ReactNode;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);

  const onSubmit = async (values: TValues) => {
    setRefusal(null);
    try {
      await save.submit(values);
      onClose();
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : "The booking could not be saved.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col" noValidate>
        <SheetHeader className="border-b p-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{booking.booking_reference}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {children}
          {refusal && (
            <Callout tone="danger" title="Nothing was saved">
              {refusal}
            </Callout>
          )}
        </div>

        <div className="medium:flex-row medium:justify-end flex flex-col-reverse gap-2 border-t p-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Close
          </Button>
          <Button type="submit" disabled={save.isPending || !canSave}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}

const guestSchema = z.object({
  guest_name: z.string().trim().min(1, "Enter the guest's name").max(200, "Name too long"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  contact_number: z.string().trim().max(20, "Phone too long"),
  booking_source: z.enum(BOOKING_SOURCES),
  airbnb_confirmation_code: confirmationCodeSchema,
});

type GuestValues = z.infer<typeof guestSchema>;

export const GuestEditSheet = (props: EditSheetProps) => (
  <EditSheet {...props}>
    <GuestForm {...props} />
  </EditSheet>
);

/** Saves a form's changes through the shared booking update path */
function useSaveChanges<TValues>(booking: Booking, toChanges: (values: TValues) => BookingChanges) {
  const updateBooking = useUpdateBooking();
  return {
    submit: (values: TValues) =>
      updateBooking.mutateAsync({ bookingId: booking.booking_id, changes: toChanges(values) }),
    isPending: updateBooking.isPending,
  };
}

function GuestForm(props: Omit<EditSheetProps, "open">) {
  const { booking } = props;
  const save = useSaveChanges(booking, (values: GuestValues) => ({
    guest_name: values.guest_name,
    email: values.email || null,
    contact_number: values.contact_number || null,
    booking_source: values.booking_source,
    airbnb_confirmation_code: storedConfirmationCode(values),
  }));
  const form = useForm<GuestValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      guest_name: booking.guest_name ?? "",
      email: booking.email ?? "",
      contact_number: booking.contact_number ?? "",
      booking_source: booking.booking_source,
      airbnb_confirmation_code: booking.airbnb_confirmation_code ?? "",
    },
  });

  return (
    <EditForm {...props} title="Edit guest" form={form} save={save}>
      <FormField control={form.control} name="guest_name" label="Guest name">
        {(field) => <Input autoComplete="off" {...field} />}
      </FormField>
      <FormField control={form.control} name="email" label="Email (optional)">
        {(field) => <Input type="email" spellCheck={false} autoComplete="off" {...field} />}
      </FormField>
      <FormField control={form.control} name="contact_number" label="Contact number (optional)">
        {(field) => <Input type="tel" inputMode="tel" autoComplete="off" {...field} />}
      </FormField>
      <BookingSourceField control={form.control} isWebsite={booking.booking_source === "Website"} />
      {form.watch("booking_source") === "Airbnb" && (
        <ConfirmationCodeField control={form.control} />
      )}
    </EditForm>
  );
}

const notesSchema = z.object({ special_requests: z.string(), internal_notes: z.string() });

type NotesValues = z.infer<typeof notesSchema>;

export const NotesEditSheet = (props: EditSheetProps) => (
  <EditSheet {...props}>
    <NotesForm {...props} />
  </EditSheet>
);

function NotesForm(props: Omit<EditSheetProps, "open">) {
  const { booking } = props;
  // A Cancelled booking allows only its internal note to change (docs/adr/0007)
  const internalOnly = booking.booking_status === "Cancelled";
  const save = useSaveChanges(booking, (values: NotesValues) => ({
    ...(!internalOnly && { special_requests: values.special_requests.trim() || null }),
    internal_notes: values.internal_notes.trim() || null,
  }));
  const form = useForm<NotesValues>({
    resolver: zodResolver(notesSchema),
    defaultValues: {
      special_requests: booking.special_requests ?? "",
      internal_notes: booking.internal_notes ?? "",
    },
  });

  return (
    <EditForm {...props} title="Edit notes" form={form} save={save}>
      {!internalOnly && (
        <FormField
          control={form.control}
          name="special_requests"
          label="Special request"
          description="What the guest asked for."
        >
          {(field) => <Textarea rows={3} {...field} />}
        </FormField>
      )}
      <FormField
        control={form.control}
        name="internal_notes"
        label="Internal note"
        description="Staff only. The guest never sees it."
      >
        {(field) => <Textarea rows={3} {...field} />}
      </FormField>
    </EditForm>
  );
}

const staySchema = withStayRules(
  z.object({
    check_in: manilaDaySchema,
    check_out: manilaDaySchema,
    cabins: z.array(z.object({ unitId: z.string(), guests: z.number().int().min(1) })),
  })
);

type StayValues = z.infer<typeof staySchema>;

export const StayEditSheet = (props: EditSheetProps) => (
  <EditSheet {...props}>
    <StayForm {...props} />
  </EditSheet>
);

const dayLabel = (day: ManilaDay) => format(parseISO(day), "EEE, MMM d");

function StayForm(props: Omit<EditSheetProps, "open">) {
  const { booking } = props;
  const { isManager } = useUserRole();
  const { data: units = [] } = useUnits();
  const { data: pricingConfig } = usePricingConfig();
  const updateStay = useUpdateBookingStay();
  const [recompute, setRecompute] = useState(false);
  const form = useForm<StayValues>({
    resolver: zodResolver(staySchema),
    defaultValues: {
      check_in: manilaDayOf(booking.check_in),
      check_out: manilaDayOf(booking.check_out),
      cabins: (booking.booking_units ?? []).map((bookingUnit) => ({
        unitId: bookingUnit.unit_id,
        guests: bookingUnit.assigned_guests ?? 1,
      })),
    },
  });
  const [checkIn, checkOut, cabins] = form.watch(["check_in", "check_out", "cabins"]);
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  const { data: availability, isFetching } = useMultiUnitAvailability(
    units.map((unit) => unit.unit_id),
    checkIn ?? "",
    checkOut ?? "",
    { enabled: nights > 0, excludeBookingId: booking.booking_id }
  );
  const notFree = (unitId: string) => (nights > 0 ? unavailableReason(availability, unitId) : null);
  const pickedNotFree = cabins.some((cabin) => notFree(cabin.unitId));

  const stayChanged =
    JSON.stringify({ check_in: checkIn, check_out: checkOut, cabins }) !==
    JSON.stringify(form.formState.defaultValues);
  const pricedCabins = cabins.map((cabin) => {
    const unit = units.find((u) => u.unit_id === cabin.unitId);
    return unit ? priceStayCabin(unit, pricingConfig, checkIn, checkOut, cabin.guests) : null;
  });
  const newTotal = pricedCabins.reduce((sum, cabin) => sum + (cabin?.subtotal ?? 0), 0);
  // An Airbnb booking's total is the payout (ADR 0006), and without the pricing config each cabin's own rates would apply
  const showNewPrice =
    booking.booking_source !== "Airbnb" &&
    stayChanged &&
    nights > 0 &&
    !!pricingConfig &&
    pricedCabins.every((cabin) => cabin !== null) &&
    newTotal !== booking.total_amount;
  const priceChange = `Total ${formatCurrency(booking.total_amount)} → ${formatCurrency(newTotal)}`;
  const recomputing = isManager && showNewPrice && recompute;

  // Same table as enforce_booking_edit_rules: staff keep Confirmed dates, and a stay in progress keeps its check-in day
  const datesLocked = booking.booking_status === "Confirmed" && !isManager;
  const checkInLocked = booking.booking_status === "CheckedIn";

  const setDays = (days: { check_in?: ManilaDay; check_out?: ManilaDay }) => {
    if (days.check_in) form.setValue("check_in", days.check_in);
    form.setValue("check_out", days.check_out ?? "", { shouldValidate: !!days.check_out });
  };

  return (
    <EditForm
      {...props}
      title="Edit stay"
      form={form}
      save={{
        submit: (values: StayValues) =>
          updateStay.mutateAsync({
            bookingId: booking.booking_id,
            stay: { check_in: values.check_in, check_out: values.check_out },
            cabins: recomputing
              ? pricedCabins.filter((cabin) => cabin !== null)
              : values.cabins.map((cabin) => ({
                  unit_id: cabin.unitId,
                  assigned_guests: cabin.guests,
                })),
            recompute: recomputing,
          }),
        isPending: updateStay.isPending,
      }}
      canSave={cabins.length > 0 && !pickedNotFree && !isFetching}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium">Stay dates</p>
        {datesLocked ? (
          <>
            <p className="text-sm">
              {dayLabel(checkIn)} → {dayLabel(checkOut)}
            </p>
            <p className="text-muted-foreground text-xs">
              Only a manager can change the dates of a confirmed booking.
            </p>
          </>
        ) : checkInLocked ? (
          <>
            <p className="text-sm">Check-in {dayLabel(checkIn)}</p>
            <DatePicker
              aria-label="Check-out day"
              placeholder="Check-out day"
              value={checkOut ? parseISO(checkOut) : undefined}
              isDateDisabled={(date) => pickedDay(date) <= checkIn}
              onChange={(date) => setDays({ check_out: date && pickedDay(date) })}
              className="w-full"
            />
            <p className="text-muted-foreground text-xs">
              The guest has checked in, so the check-in day stays.
            </p>
          </>
        ) : (
          <DateRangePicker
            aria-label="Stay dates"
            placeholder="Check-in → check-out"
            value={{ from: parseISO(checkIn), to: checkOut ? parseISO(checkOut) : undefined }}
            numberOfMonths={2}
            startHint="Select check-in day"
            endHint="Select check-out day"
            allowSameDay={false}
            onChange={(range) =>
              setDays({
                check_in: range?.from && pickedDay(range.from),
                check_out: range?.to && pickedDay(range.to),
              })
            }
            className="w-full"
          />
        )}
        {form.formState.errors.check_out && (
          <p className="text-destructive text-xs">{form.formState.errors.check_out.message}</p>
        )}
      </div>

      <CabinPicker
        units={units}
        cabins={cabins}
        onChange={(next) => form.setValue("cabins", next)}
        hasDates={nights > 0}
        isChecking={isFetching}
        notFree={notFree}
      />
      {cabins.length === 0 && <p className="text-destructive text-sm">Add at least one cabin.</p>}
      {pickedNotFree && (
        <p className="text-destructive text-sm">
          A picked cabin is not free on these dates. Remove it or pick other dates.
        </p>
      )}
      {showNewPrice &&
        (isManager ? (
          <div className="space-y-1">
            <Label
              htmlFor="recompute-total"
              className="coarse:min-h-11 flex items-center gap-2 text-sm font-normal"
            >
              <Checkbox
                id="recompute-total"
                checked={recompute}
                onCheckedChange={(checked) => setRecompute(checked === true)}
              />
              Recompute total from current rates
            </Label>
            <p className="text-muted-foreground pl-6 text-xs tabular-nums">{priceChange}</p>
          </div>
        ) : (
          <div className="text-muted-foreground space-y-1 text-xs">
            <p className="tabular-nums">{priceChange}</p>
            <p>Ask a manager to update the total</p>
          </div>
        ))}
    </EditForm>
  );
}
