import React from "react";

import { format, parseISO } from "date-fns";
import { Filter, X } from "lucide-react";

import {
  Button,
  Checkbox,
  InlineCalendar,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  TableSearch,
} from "@/components/patterns";
import { BOOKING_SOURCES, pickedDay, type BookingsSearch } from "@/lib/bookings";
import { useAllUnits } from "@/stores/useUnitStore";
import { PAYMENT_STATUSES } from "@/types";

import type { BookingFiltersProps } from "../types";

type ListKey = "source" | "payment" | "cabin";

interface Option {
  value: string;
  label: string;
}

const lowercaseOptions = (labels: readonly string[]): Option[] =>
  labels.map((label) => ({ value: label.toLowerCase(), label }));

const SOURCE_OPTIONS = lowercaseOptions(BOOKING_SOURCES);
const PAYMENT_OPTIONS = lowercaseOptions(PAYMENT_STATUSES);

const toggled = (picked: string[] | undefined, value: string, on: boolean) => {
  const next = (picked ?? []).filter((item) => item !== value);
  return on ? [...next, value] : next;
};

const dateRangeLabel = (from: string | undefined, to: string | undefined) => {
  if (from && to)
    return `${format(parseISO(from), "d MMM")} – ${format(parseISO(to), "d MMM yyyy")}`;
  if (from) return `From ${format(parseISO(from), "d MMM yyyy")}`;
  if (to) return `Until ${format(parseISO(to), "d MMM yyyy")}`;
  return undefined;
};

const CheckboxGroup = ({
  title,
  options,
  picked,
  onToggle,
}: {
  title: string;
  options: Option[];
  picked: string[] | undefined;
  onToggle: (value: string, on: boolean) => void;
}) => (
  <fieldset className="space-y-2">
    <legend className="text-sm font-medium">{title}</legend>
    <div className="grid grid-cols-2 gap-2">
      {options.map(({ value, label }) => (
        <Label
          key={value}
          className="coarse:min-h-11 flex min-w-0 items-center gap-2 rounded-md border p-2 text-sm font-normal"
        >
          <Checkbox
            checked={picked?.includes(value) ?? false}
            onCheckedChange={(checked) => onToggle(value, checked === true)}
          />
          <span className="truncate">{label}</span>
        </Label>
      ))}
    </div>
  </fieldset>
);

const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <Button variant="secondary" size="sm" aria-label={`Remove filter ${label}`} onClick={onRemove}>
    {label}
    <X className="size-3" aria-hidden="true" />
  </Button>
);

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  search,
  setSearch,
  hasActiveFilters,
  resultCount,
  totalCount,
}) => {
  const { data: units = [] } = useAllUnits();
  const cabinOptions: Option[] = units.map((unit) => ({
    value: unit.unit_id,
    label: unit.unit_code || unit.unit_name,
  }));

  const optionsFor: Record<ListKey, Option[]> = {
    source: SOURCE_OPTIONS,
    payment: PAYMENT_OPTIONS,
    cabin: cabinOptions,
  };

  // parseBookingsSearch drops an emptied list, so the router leaves it out of the URL
  const toggle = (key: ListKey, value: string, on: boolean) =>
    setSearch({ [key]: toggled(search[key], value, on) } as Partial<BookingsSearch>);

  const dateLabel = dateRangeLabel(search.from, search.to);
  const activeFilterCount = [search.source, search.payment, search.cabin, dateLabel].filter(
    Boolean
  ).length;

  const chips = (["source", "payment", "cabin"] as const).flatMap((key) =>
    (search[key] ?? []).map((value) => ({
      key: `${key}-${value}`,
      label: optionsFor[key].find((option) => option.value === value)?.label ?? value,
      onRemove: () => toggle(key, value, false),
    }))
  );
  if (dateLabel) {
    chips.push({
      key: "dates",
      label: dateLabel,
      onRemove: () => setSearch({ from: undefined, to: undefined }),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="medium:w-64 medium:flex-none min-w-0 flex-1">
          <TableSearch
            value={search.q ?? ""}
            onChange={(q) => setSearch({ q })}
            placeholder="Search bookings..."
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={
                activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : undefined
              }
            >
              <Filter className="size-4" aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs font-semibold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="medium:max-w-md flex w-full flex-col gap-6 overflow-y-auto">
            <SheetHeader className="p-0">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Changes apply to the list at once.</SheetDescription>
            </SheetHeader>
            <CheckboxGroup
              title="Source"
              options={SOURCE_OPTIONS}
              picked={search.source}
              onToggle={(value, on) => toggle("source", value, on)}
            />
            <CheckboxGroup
              title="Payment status"
              options={PAYMENT_OPTIONS}
              picked={search.payment}
              onToggle={(value, on) => toggle("payment", value, on)}
            />
            <CheckboxGroup
              title="Cabin"
              options={cabinOptions}
              picked={search.cabin}
              onToggle={(value, on) => toggle("cabin", value, on)}
            />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Date range</legend>
              <p className="text-muted-foreground text-xs">
                Shows bookings with any night in the range.
              </p>
              <InlineCalendar
                variant="range"
                selected={{
                  from: search.from ? parseISO(search.from) : undefined,
                  to: search.to ? parseISO(search.to) : undefined,
                }}
                onSelect={(range) =>
                  setSearch({
                    from: range?.from ? pickedDay(range.from) : undefined,
                    to: range?.to ? pickedDay(range.to) : undefined,
                  })
                }
              />
            </fieldset>
          </SheetContent>
        </Sheet>
        {resultCount !== undefined && totalCount !== undefined && (
          <span className="text-muted-foreground ml-auto text-sm">
            <span className="text-foreground font-medium">{resultCount}</span>
            {hasActiveFilters ? ` of ${totalCount} bookings` : " bookings"}
          </span>
        )}
      </div>
      {chips.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap gap-2">
          {chips.map(({ key, label, onRemove }) => (
            <li key={key}>
              <FilterChip label={label} onRemove={onRemove} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
