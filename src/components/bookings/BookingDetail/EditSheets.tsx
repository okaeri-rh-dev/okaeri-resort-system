import { useState, type ReactNode } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Callout,
  Form,
  FormField,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@/components/patterns";
import { useUpdateBooking } from "@/hooks/useBookings";
import { BOOKING_SOURCES, storedConfirmationCode, type BookingChanges } from "@/lib/bookings";
import { confirmationCodeSchema } from "@/lib/validations";
import type { Booking } from "@/types";

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
  toChanges,
  children,
}: Omit<EditSheetProps, "open"> & {
  title: string;
  form: UseFormReturn<TValues>;
  toChanges: (values: TValues) => BookingChanges;
  children: ReactNode;
}) {
  const updateBooking = useUpdateBooking();
  const [refusal, setRefusal] = useState<string | null>(null);

  const onSubmit = async (values: TValues) => {
    setRefusal(null);
    try {
      await updateBooking.mutateAsync({
        bookingId: booking.booking_id,
        changes: toChanges(values),
      });
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
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={updateBooking.isPending}
          >
            Close
          </Button>
          <Button type="submit" disabled={updateBooking.isPending}>
            {updateBooking.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
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

function GuestForm(props: Omit<EditSheetProps, "open">) {
  const { booking } = props;
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
    <EditForm
      {...props}
      title="Edit guest"
      form={form}
      toChanges={(values) => ({
        guest_name: values.guest_name,
        email: values.email || null,
        contact_number: values.contact_number || null,
        booking_source: values.booking_source,
        airbnb_confirmation_code: storedConfirmationCode(values),
      })}
    >
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
  const form = useForm<NotesValues>({
    resolver: zodResolver(notesSchema),
    defaultValues: {
      special_requests: booking.special_requests ?? "",
      internal_notes: booking.internal_notes ?? "",
    },
  });

  return (
    <EditForm
      {...props}
      title="Edit notes"
      form={form}
      toChanges={(values) => ({
        ...(!internalOnly && { special_requests: values.special_requests.trim() || null }),
        internal_notes: values.internal_notes.trim() || null,
      })}
    >
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
