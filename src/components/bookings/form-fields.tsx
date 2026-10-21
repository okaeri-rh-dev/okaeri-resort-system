import { useId, type ComponentProps, type ReactNode } from "react";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import {
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/patterns";

type FormSelectProps = Omit<
  ComponentProps<typeof SelectTrigger>,
  "value" | "onChange" | "children"
> & {
  value?: string;
  onChange: (value: string) => void;
  placeholder: string;
  children: ReactNode;
};

/**
 * A Select to return from a `FormField` render child. The field's id and ARIA land on the
 * trigger, so the label names it and the validation message describes it.
 */
export function FormSelect({
  value,
  onChange,
  placeholder,
  children,
  ...triggerProps
}: FormSelectProps) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

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
