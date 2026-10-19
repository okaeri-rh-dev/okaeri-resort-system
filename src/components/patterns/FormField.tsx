import type * as React from "react";

import type {
  ControllerProps,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";

import {
  Form,
  FormControl,
  FormDescription,
  FormField as FormFieldController,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export { Form };

export interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends Pick<
  ControllerProps<TFieldValues, TName>,
  "control" | "name" | "rules" | "defaultValue" | "disabled"
> {
  label: React.ReactNode;
  /** Inline help under the control. Help is text first; tooltips are the last resort. */
  description?: React.ReactNode;
  /** Renders the control. Spread `field` onto it; the pattern wires id, label and ARIA. */
  children: (field: ControllerRenderProps<TFieldValues, TName>) => React.ReactElement;
  /** Placement only (grid column, margin). */
  className?: string;
}

/**
 * A react-hook-form field: label, control, inline description and the validation message,
 * wired together so the label names the control and the message sits next to it.
 *
 * Wrap the form in `Form` (react-hook-form's provider) and pass the control as a render child.
 *
 * @example
 * ```tsx
 * const form = useForm<GuestDetails>();
 * <Form {...form}>
 *   <form onSubmit={form.handleSubmit(save)}>
 *     <FormField control={form.control} name="email" label="Email">
 *       {(field) => <Input type="email" autoComplete="email" spellCheck={false} {...field} />}
 *     </FormField>
 *   </form>
 * </Form>
 * ```
 */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  label,
  description,
  children,
  className,
  ...controllerProps
}: FormFieldProps<TFieldValues, TName>) {
  return (
    <FormFieldController
      {...controllerProps}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>{children(field)}</FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
