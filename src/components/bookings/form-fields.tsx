import { useId, type ReactNode } from "react";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Checkbox, Label } from "@/components/patterns";

interface WalkInFieldProps<TFieldValues extends FieldValues & { is_walk_in?: boolean }> {
  control: Control<TFieldValues>;
  description: ReactNode;
}

/** The "Walk-in booking" checkbox, with its label and help beside it. */
export function WalkInField<TFieldValues extends FieldValues & { is_walk_in?: boolean }>({
  control,
  description,
}: WalkInFieldProps<TFieldValues>) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <Controller
      control={control}
      name={"is_walk_in" as FieldPath<TFieldValues>}
      render={({ field }) => (
        <div className="bg-muted/40 flex items-start gap-3 rounded-md border p-4">
          <Checkbox
            id={id}
            checked={field.value ?? false}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            onBlur={field.onBlur}
            aria-describedby={descriptionId}
            className="mt-1"
          />
          <div className="space-y-1 leading-none">
            <Label htmlFor={id}>Walk-in booking</Label>
            <p id={descriptionId} className="text-muted-foreground text-sm">
              {description}
            </p>
          </div>
        </div>
      )}
    />
  );
}
