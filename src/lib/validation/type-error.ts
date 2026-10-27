/**
 * A Zod `error` param that keeps Zod 3's `required_error` / `invalid_type_error` behaviour: one
 * message for a missing value, another (or Zod's default) for a value of the wrong type.
 */
export function typeError(required: string, invalid?: string) {
  return (issue: { input: unknown }) => (issue.input === undefined ? required : invalid);
}
