import { useEffect, useEffectEvent } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { Building2, Info, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  unitFormWithoutPricingValidationSchema,
  type UnitFormData,
} from "@/lib/validations";
import { useCreateUnit, useUpdateUnit } from "@/stores/useUnitStore";
import type { Unit, UnitType } from "@/types";

interface UnitFormProps {
  unit?: Unit; // For editing existing unit
  onSuccess?: (unit: Unit) => void;
  onCancel?: () => void;
  className?: string;
}

export function UnitForm({ unit, onSuccess, onCancel, className }: UnitFormProps) {
  const createUnitMutation = useCreateUnit();
  const updateUnitMutation = useUpdateUnit();

  // Fetch global pricing configuration
  const { data: pricingConfig, isLoading: isPricingLoading } = usePricingConfig();

  const isEditing = !!unit;

  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitFormWithoutPricingValidationSchema),
    defaultValues: {
      unit_name: unit?.unit_name || "",
      unit_code: unit?.unit_code || "",
      unit_type: (unit?.unit_type as unknown as UnitType) || "Standard",
      base_occupancy: unit?.base_occupancy || 2,
      max_occupancy: unit?.max_occupancy || 2,
      // Pricing fields removed - will be auto-populated from global config
      base_rate: 0,
      weekend_rate: 0,
      extra_person_rate: 0,
    },
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const watchedBaseOccupancy = form.watch("base_occupancy");
  const watchedMaxOccupancy = form.watch("max_occupancy");

  // Extract form.setValue into useEffectEvent to remove form from dependencies
  const adjustMaxOccupancy = useEffectEvent((baseOccupancy: number) => {
    form.setValue("max_occupancy", baseOccupancy || 1);
  });

  useEffect(() => {
    if (watchedBaseOccupancy > watchedMaxOccupancy) {
      adjustMaxOccupancy(watchedBaseOccupancy);
    }
  }, [watchedBaseOccupancy, watchedMaxOccupancy]);

  const onSubmit = async (data: UnitFormData) => {
    try {
      if (!pricingConfig) {
        toast.error("Unable to load pricing configuration. Please try again.");
        return;
      }

      // Auto-populate pricing from global config (hidden from user)
      const unitData = {
        ...data,
        base_rate: pricingConfig.base_rate, // Use global base rate
        weekend_rate: pricingConfig.weekend_rate, // Use global weekend rate
        extra_person_rate: pricingConfig.extra_person_rate, // Use global extra person rate
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
                        <Input
                          placeholder="e.g., Ocean View Standard A"
                          {...field}
                          autoComplete="off"
                        />
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
                          autoComplete="off"
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

            {/* Pricing Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Pricing</h3>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">This cabin uses global pricing configuration.</p>
                    <p className="text-muted-foreground text-sm">
                      All cabins automatically inherit rates from your resort-wide pricing settings.
                    </p>
                    {pricingConfig && (
                      <div className="mt-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base Rate:</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(pricingConfig.base_rate)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weekend Rate:</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(pricingConfig.weekend_rate)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Extra Person Rate:</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(pricingConfig.extra_person_rate)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 border-t pt-3">
                      <Link to="/admin/units/pricing">
                        <Button variant="link" size="sm" className="h-auto p-0">
                          Manage Global Pricing Settings →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
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
