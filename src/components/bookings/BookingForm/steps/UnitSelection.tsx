import { format } from "date-fns";
import { CalendarDays, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NumberInput } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { PricingConfig } from "@/hooks/usePricingConfig";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/validations";
import type { Unit } from "@/types";

import type { StepProps } from "../types";

interface UnitSelectionProps extends StepProps {
  units?: Unit[];
  pricingConfig?: PricingConfig;
}

export function UnitSelection({
  form,
  calculatedTotal = 0,
  selectedUnit,
  isCheckingAvailability,
  onCheckAvailability,
  units = [],
  pricingConfig,
}: UnitSelectionProps) {
  const checkIn = form.watch("check_in");
  const checkOut = form.watch("check_out");

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="unit_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">Select Cabin</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger
                  className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm"
                  disabled={units.length === 0}
                >
                  <SelectValue placeholder="Choose accommodation" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.unit_id} value={unit.unit_id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{unit.unit_name}</span>
                      <span className="text-muted-foreground text-xs">
                        {unit.unit_type} •{" "}
                        {formatCurrency(pricingConfig?.base_rate ?? unit.base_rate)}/night • Max{" "}
                        {unit.max_occupancy} guests
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="check_in"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-base font-medium sm:text-sm">Check-in Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-12 touch-manipulation justify-start text-left text-base font-normal sm:h-10 sm:text-sm",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
                      {field.value ? (
                        format(new Date(field.value), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => field.onChange(date)}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="touch-manipulation"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="check_out"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-base font-medium sm:text-sm">Check-out Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-12 touch-manipulation justify-start text-left text-base font-normal sm:h-10 sm:text-sm",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
                      {field.value ? (
                        format(new Date(field.value), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => field.onChange(date)}
                    disabled={(date) => {
                      const checkInDate = checkIn ? new Date(checkIn) : new Date();
                      return date <= checkInDate;
                    }}
                    initialFocus
                    className="touch-manipulation"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="num_guests"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">Number of Guests</FormLabel>
            <FormControl>
              <NumberInput
                min={1}
                max={selectedUnit?.max_occupancy || 20}
                allowDecimals={false}
                className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm"
                startIcon={<Users className="h-5 w-5 sm:h-4 sm:w-4" />}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={(value) => {
                  field.onChange(value || 1); // Set minimum on blur
                  field.onBlur();
                }}
              />
            </FormControl>
            {selectedUnit && (
              <FormDescription>
                Base occupancy: {pricingConfig?.base_occupancy ?? selectedUnit.base_occupancy}{" "}
                guests (included) • Max: {selectedUnit.max_occupancy} guests
                {selectedUnit.max_occupancy >
                  (pricingConfig?.base_occupancy ?? selectedUnit.base_occupancy) && (
                  <span className="mt-1 block text-xs">
                    Extra person rate:{" "}
                    {formatCurrency(
                      pricingConfig?.extra_person_rate ?? selectedUnit.extra_person_rate
                    )}{" "}
                    per person per night
                  </span>
                )}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {selectedUnit && calculatedTotal > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Unit:</span>
                <span className="font-medium">{selectedUnit.unit_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Nights:</span>
                <span>
                  {Math.ceil(
                    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>{formatCurrency(calculatedTotal)}</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={onCheckAvailability}
              disabled={isCheckingAvailability}
            >
              {isCheckingAvailability ? "Checking..." : "Check Availability"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
