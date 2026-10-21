import { useId } from "react";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Label, Switch } from "@/components/patterns";

interface ActiveSwitchFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  description: string;
}

/** The "Active" toggle row of a settings form: label and help on the left, switch on the right. */
export function ActiveSwitchField<TFieldValues extends FieldValues>({
  control,
  name,
  description,
}: ActiveSwitchFieldProps<TFieldValues>) {
  const switchId = useId();
  const descriptionId = `${switchId}-description`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor={switchId} className="text-base">
              Active
            </Label>
            <p id={descriptionId} className="text-muted-foreground text-sm">
              {description}
            </p>
          </div>
          <Switch
            id={switchId}
            aria-describedby={descriptionId}
            checked={field.value}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        </div>
      )}
    />
  );
}
