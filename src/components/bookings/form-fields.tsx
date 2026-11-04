import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormField, SelectControl, SelectItem } from "@/components/patterns";
import { STAFF_BOOKING_SOURCES, type BookingSource } from "@/lib/bookings";

interface BookingSourceFieldProps<
  TFieldValues extends FieldValues & { booking_source?: BookingSource },
> {
  control: Control<TFieldValues>;
  /** Website bookings keep their source, so the picker shows it locked. */
  isWebsite?: boolean;
}

/** The booking source picker: Walk-in, Direct or Airbnb. */
export function BookingSourceField<
  TFieldValues extends FieldValues & { booking_source?: BookingSource },
>({ control, isWebsite = false }: BookingSourceFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={"booking_source" as FieldPath<TFieldValues>}
      label="Booking source"
      description={isWebsite ? "Booked on the website. This cannot change." : undefined}
    >
      {({ value, onChange, ...field }) => (
        <SelectControl {...field} value={value} onValueChange={onChange} disabled={isWebsite}>
          {isWebsite && <SelectItem value="Website">Website</SelectItem>}
          {STAFF_BOOKING_SOURCES.map((source) => (
            <SelectItem key={source} value={source}>
              {source}
            </SelectItem>
          ))}
        </SelectControl>
      )}
    </FormField>
  );
}
