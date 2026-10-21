import { useEffect, useEffectEvent } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { Building2, Users } from "lucide-react";
import { useForm, type Control, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormField,
  Input,
  NumberInput,
  Separator,
} from "@/components/patterns";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { unitFormWithoutPricingValidationSchema, type UnitFormData } from "@/lib/validations";
import { useCreateUnit, useUpdateUnit } from "@/stores/useUnitStore";
import type { Unit, UnitType } from "@/types";

interface UnitFormProps {
  unit?: Unit; // For editing existing unit
  onSuccess?: (unit: Partial<Unit>) => void;
  onCancel?: () => void;
  className?: string;
}

export function UnitForm({ unit, onSuccess, onCancel, className }: UnitFormProps) {
  const createUnitMutation = useCreateUnit();
  const updateUnitMutation = useUpdateUnit();

  // Fetch global pricing configuration
  const { data: pricingConfig, isLoading: _isPricingLoading } = usePricingConfig();

  const isEditing = !!unit;

  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitFormWithoutPricingValidationSchema) as Resolver<UnitFormData>,
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
          <Building2 className="h-5 w-5" aria-hidden="true" />
          {isEditing ? "Edit Cabin" : "Create New Cabin"}
        </CardTitle>
      </CardHeader>

      <CardContent className="@container">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField
                  control={form.control as Control<UnitFormData>}
                  name="unit_name"
                  label="Cabin Name"
                  description="Descriptive name for the cabin"
                >
                  {(field) => (
                    <Input
                      placeholder="e.g., Ocean View Standard A"
                      {...field}
                      autoComplete="off"
                    />
                  )}
                </FormField>

                <FormField
                  control={form.control as Control<UnitFormData>}
                  name="unit_code"
                  label="Cabin Code"
                  description="Unique alphanumeric code (letters and numbers only)"
                >
                  {(field) => (
                    <Input
                      placeholder="e.g., A101"
                      className="uppercase"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField
                  control={form.control as Control<UnitFormData>}
                  name="base_occupancy"
                  label="Base Occupancy"
                  description="Number of guests included in base rate"
                >
                  {(field) => (
                    <NumberInput
                      min={1}
                      max={20}
                      allowDecimals={false}
                      startIcon={<Users className="h-4 w-4" aria-hidden="true" />}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      onBlur={(value) => {
                        field.onChange(value || 1); // Set minimum on blur
                        field.onBlur();
                      }}
                    />
                  )}
                </FormField>

                <FormField
                  control={form.control as Control<UnitFormData>}
                  name="max_occupancy"
                  label="Maximum Occupancy"
                  description="Maximum number of guests allowed"
                >
                  {(field) => (
                    <NumberInput
                      min={1}
                      max={20}
                      allowDecimals={false}
                      startIcon={<Users className="h-4 w-4" aria-hidden="true" />}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      onBlur={(value) => {
                        field.onChange(value || 1); // Set minimum on blur
                        field.onBlur();
                      }}
                    />
                  )}
                </FormField>
              </div>
            </div>

            <Separator />

            {/* Pricing Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Pricing</h3>

              <Callout tone="info" title="This cabin uses global pricing configuration.">
                All cabins automatically inherit rates from your resort-wide pricing settings.
              </Callout>
              {pricingConfig && (
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Base Rate</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(pricingConfig.base_rate)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Weekend Rate</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(pricingConfig.weekend_rate)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Extra Person Rate</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(pricingConfig.extra_person_rate)}
                    </dd>
                  </div>
                </dl>
              )}
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/admin/units/pricing">Manage Global Pricing Settings →</Link>
              </Button>
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
                className="min-w-32"
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
