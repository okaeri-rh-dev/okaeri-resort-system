import type * as React from "react";

import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/patterns";

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
 * A Select for a `FormField` render child. FormField hands its id and ARIA props to the
 * element it renders; this passes them on to the trigger, so the field label names it.
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
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
