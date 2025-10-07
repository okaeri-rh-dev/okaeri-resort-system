import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Users } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, NumberInput } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  formatCurrency,
  unitFormWithRateValidationSchema,
  type UnitFormData,
} from "@/lib/validations";

import { cn } from "@/lib/utils";
import { useCreateUnit, useUpdateUnit } from "@/stores/useUnitStore";
import type { Unit, UnitType } from "@/types";

interface UnitFormProps {
  unit?: Unit; // For editing existing unit
  onSuccess?: (unit: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function UnitForm({ unit, onSuccess, onCancel, className }: UnitFormProps) {
  const createUnitMutation = useCreateUnit();
  const updateUnitMutation = useUpdateUnit();

  const isEditing = !!unit;

  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitFormWithRateValidationSchema),
    defaultValues: {
      unit_name: unit?.unit_name || "",
      unit_code: unit?.unit_code || "",
      unit_type: (unit?.unit_type as unknown as UnitType) || "Standard",
      base_occupancy: unit?.base_occupancy || 2,
      max_occupancy: unit?.max_occupancy || 2,
      base_rate: unit?.base_rate || 0,
      weekend_rate: unit?.weekend_rate || unit?.base_rate || 0,
      extra_person_rate: unit?.extra_person_rate || 0,
    },
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const watchedBaseRate = form.watch("base_rate");
  // Weekend rate removed from UI, will use base_rate
  const watchedExtraPersonRate = form.watch("extra_person_rate");
  const watchedBaseOccupancy = form.watch("base_occupancy");
  const watchedMaxOccupancy = form.watch("max_occupancy");

  // Sync weekend_rate with base_rate since weekend_rate field is hidden from UI
  useEffect(() => {
    form.setValue("weekend_rate", watchedBaseRate || 0);
  }, [watchedBaseRate, form]);

  const onSubmit = async (data: UnitFormData) => {
    try {
      const unitData = {
        ...data,
        weekend_rate: data.base_rate, // Automatically set weekend_rate to base_rate
        unit_type: "Standard" as const,
      };

      if (isEditing && unit) {
        await updateUnitMutation.mutateAsync({
          unitId: unit.unit_id,
          updates: unitData,
        });
        toast.success("Cabin updated successfully!");
      } else {
        await createUnitMutation.mutateAsync({
          ...unitData,
          unit_status: "Available" as const,
          amenities: null,
        });
        toast.success("Cabin created successfully!");
      }

      onSuccess?.(unitData);
    } catch (error) {
      toast.error(
        isEditing
          ? "Failed to update cabin. Please try again."
          : "Failed to create cabin. Please try again."
      );
      console.error("Unit form error:", error);
    }
  };

  return (
    <Card className={cn("mx-auto w-full max-w-3xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {isEditing ? "Edit Cabin" : "Create New Cabin"}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="unit_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cabin Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Ocean View Standard A" {...field} />
                      </FormControl>
                      <FormDescription>Descriptive name for the cabin</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cabin Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., A101"
                          className="uppercase"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormDescription>
                        Unique alphanumeric code (letters and numbers only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="base_occupancy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Occupancy</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={1}
                          max={20}
                          allowDecimals={false}
                          className="pl-10"
                          startIcon={<Users className="h-4 w-4" />}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          onBlur={(value) => {
                            field.onChange(value || 1); // Set minimum on blur
                            field.onBlur();
                          }}
                        />
                      </FormControl>
                      <FormDescription>Number of guests included in base rate</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_occupancy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Occupancy</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={1}
                          max={20}
                          allowDecimals={false}
                          className="pl-10"
                          startIcon={<Users className="h-4 w-4" />}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          onBlur={(value) => {
                            field.onChange(value || 1); // Set minimum on blur
                            field.onBlur();
                          }}
                        />
                      </FormControl>
                      <FormDescription>Maximum number of guests allowed</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pricing</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="base_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Rate (Weekdays)</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={100}
                          max={1000000}
                          allowDecimals={true}
                          className="pl-10"
                          placeholder="2500.00"
                          startIcon={<span className="text-sm font-medium">₱</span>}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          onBlur={(value) => {
                            field.onChange(value || 100); // Set minimum on blur
                            field.onBlur();
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Rate per night (Sunday - Thursday)
                        {watchedBaseRate > 0 && (
                          <span className="mt-1 block text-xs">
                            {formatCurrency(watchedBaseRate)} per night
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Extra Person Rate */}
              <FormField
                control={form.control}
                name="extra_person_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Extra Person Rate</FormLabel>
                    <FormControl>
                      <NumberInput
                        min={0}
                        max={50000}
                        allowDecimals={true}
                        className="pl-10"
                        placeholder="500.00"
                        startIcon={<span className="text-sm font-medium">₱</span>}
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        onBlur={(value) => {
                          field.onChange(value || 0); // Set minimum on blur
                          field.onBlur();
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Additional charge per person exceeding base occupancy
                      {watchedExtraPersonRate > 0 &&
                        watchedBaseOccupancy > 0 &&
                        watchedMaxOccupancy > watchedBaseOccupancy && (
                          <span className="mt-1 block text-xs">
                            {formatCurrency(watchedExtraPersonRate)} per extra person per night (up
                            to {watchedMaxOccupancy - watchedBaseOccupancy} extra guests)
                          </span>
                        )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Rate Summary */}
              {watchedBaseRate > 0 && (
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="mb-2 font-medium">Rate Summary</h4>
                  <div className="text-sm">
                    <div>
                      <span className="text-muted-foreground">Nightly Rate:</span>
                      <p className="font-medium text-lg">{formatCurrency(watchedBaseRate)}</p>
                    </div>
                  </div>
                  {watchedBaseOccupancy > 0 && watchedMaxOccupancy > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Capacity:</span>
                          <p className="font-medium">
                            {watchedBaseOccupancy}/{watchedMaxOccupancy} guests
                          </p>
                        </div>
                        {watchedExtraPersonRate > 0 &&
                          watchedMaxOccupancy > watchedBaseOccupancy && (
                            <div>
                              <span className="text-muted-foreground">Extra Person:</span>
                              <p className="font-medium">
                                +{formatCurrency(watchedExtraPersonRate)}/night
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                  {watchedBaseOccupancy > watchedMaxOccupancy && (
                    <p className="mt-2 text-xs text-red-600">
                      ⚠️ Base occupancy cannot exceed maximum occupancy
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={createUnitMutation.isPending || updateUnitMutation.isPending}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={createUnitMutation.isPending || updateUnitMutation.isPending}
                className="min-w-[120px]"
              >
                {createUnitMutation.isPending || updateUnitMutation.isPending
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Cabin"
                    : "Create Cabin"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
