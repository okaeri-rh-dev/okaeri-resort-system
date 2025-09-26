import { CalendarDays, Users } from "lucide-react";
import { format } from "date-fns";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { formatCurrency } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { StepProps } from "../types";
import type { Unit } from "@/types";

interface UnitSelectionProps extends StepProps {
  units?: Unit[];
}

export function UnitSelection({
  form,
  calculatedTotal = 0,
  selectedUnit,
  isCheckingAvailability,
  onCheckAvailability,
  units = [],
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
            <FormLabel className="text-base sm:text-sm font-medium">Select Cabin</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger
                  className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
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
                      <span className="text-xs text-muted-foreground">
                        {unit.unit_type} • {formatCurrency(unit.base_rate)}/night • Max{" "}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="check_in"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-base sm:text-sm font-medium">Check-in Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-12 sm:h-10 text-base sm:text-sm justify-start text-left font-normal touch-manipulation",
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
              <FormLabel className="text-base sm:text-sm font-medium">Check-out Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-12 sm:h-10 text-base sm:text-sm justify-start text-left font-normal touch-manipulation",
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
            <FormLabel className="text-base sm:text-sm font-medium">Number of Guests</FormLabel>
            <FormControl>
              <NumberInput
                min={1}
                max={selectedUnit?.max_occupancy || 20}
                allowDecimals={false}
                className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
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
                Base occupancy: {selectedUnit.base_occupancy} guests (included) • Max:{" "}
                {selectedUnit.max_occupancy} guests
                {selectedUnit.max_occupancy > selectedUnit.base_occupancy && (
                  <span className="block text-xs mt-1">
                    Extra person rate: {formatCurrency(selectedUnit.extra_person_rate)} per person
                    per night
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
