import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_QUERY_LENGTH = 100;

// Queries can reach regex and LIKE filters, so only plain search characters pass
const sanitizeQuery = (query: string) =>
  query.replace(/[^\w\s@.,-]/g, "").slice(0, MAX_QUERY_LENGTH);

export interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Names the field. Defaults to the placeholder. */
  "aria-label"?: string;
  /** Placement only (width, flex position). */
  className?: string;
}

/**
 * The search field above a table, with a clear button once there's a query. It keeps only
 * letters, digits, spaces and `@ . , -`, up to 100 characters.
 *
 * @example
 * ```tsx
 * <TableSearch value={search} onChange={setSearch} placeholder="Search bookings" />
 * ```
 */
export function TableSearch({
  value,
  onChange,
  placeholder = "Search...",
  "aria-label": ariaLabel,
  className,
}: TableSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Input
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(event) => onChange(sanitizeQuery(event.target.value))}
        maxLength={MAX_QUERY_LENGTH}
        spellCheck={false}
        className="w-full max-w-sm pr-9"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-0 right-0"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X className="size-3" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
