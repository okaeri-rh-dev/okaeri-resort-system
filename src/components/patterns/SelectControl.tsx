import type * as React from "react";

import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SelectControlProps extends Omit<
  React.ComponentProps<typeof SelectTrigger>,
  "value" | "defaultValue" | "onChange"
> {
  value: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** The `SelectItem`s. */
  children: React.ReactNode;
}

/**
 * A Select to return from a `FormField` render child. FormField hands its id and ARIA props to
 * the element it renders; this passes them on to the trigger, so the field label names it and
 * the validation message describes it. An empty or missing `value` shows the placeholder.
 *
 * Use it for every single-choice dropdown in a form; reach for the raw `Select` parts only
 * outside a `FormField` (a filter or toolbar control).
 *
 * @example
 * <FormField control={form.control} name="season" label="Season">
 *   {({ value, onChange, ...field }) => (
 *     <SelectControl {...field} value={value} onValueChange={onChange} placeholder="Choose a season">
 *       <SelectItem value="peak">Peak</SelectItem>
 *       <SelectItem value="regular">Regular</SelectItem>
 *     </SelectControl>
 *   )}
 * </FormField>
 */
export function SelectControl({
  value,
  onValueChange,
  placeholder,
  disabled,
  children,
  ...triggerProps
}: SelectControlProps) {
  return (
    <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
