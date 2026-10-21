// src/components/units/UnitEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { DollarSign, Save, X } from "lucide-react";
import { useForm, type Control, type Resolver } from "react-hook-form";

import { formatCurrency } from "@/components/entity-detail";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailPageLayout,
  Form,
  FormField,
  Input,
  SelectControl,
  SelectItem,
} from "@/components/patterns";
import { useEntityEdit } from "@/hooks/entity";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import {
  unitEditWithoutPricingSchema,
  type UnitEditWithoutPricingInput,
} from "@/lib/validation/entity-schemas";
import type { Unit } from "@/types/entity-detail.types";

export interface UnitEditPageProps {
  unit?: Unit;
}

export function UnitEditPage() {
  const { unitId } = useParams({ from: "/admin/units/$unitId/edit" });
  const { unit } = useLoaderData({ from: "/admin/units/$unitId/edit" });
  const navigate = useNavigate();

  // Fetch global pricing configuration
  const { data: pricingConfig } = usePricingConfig();

  // Initialize form with default values from unit
  const form = useForm<UnitEditWithoutPricingInput>({
    resolver: zodResolver(unitEditWithoutPricingSchema) as Resolver<UnitEditWithoutPricingInput>,
    defaultValues: {
      unit_name: unit.unit_name || "",
      unit_code: unit.unit_code || "",
      unit_type: unit.unit_type || "",
      max_occupancy: unit.max_occupancy || 1,
      // Pricing fields removed from form - will be auto-populated from global config
      base_rate: 0,
      weekend_rate: 0,
      extra_person_rate: 0,
      amenities: (unit.amenities as string[]) || undefined,
    },
  });

  // Setup mutation with navigation on success
  const updateUnit = useEntityEdit("unit", unitId, {
    onSuccess: () => {
      navigate({ to: "/admin/units/$unitId", params: { unitId } });
    },
  });

  // Form submission handler with global pricing auto-population
  const onSubmit = (data: UnitEditWithoutPricingInput) => {
    if (!pricingConfig) {
      console.error("Pricing config not loaded");
      return;
    }

    // Pricing comes from the global config; units has no cleaning_fee column
    updateUnit.mutate({
      unit_name: data.unit_name,
      unit_code: data.unit_code,
      unit_type: data.unit_type,
      max_occupancy: data.max_occupancy,
      amenities: data.amenities,
      base_rate: pricingConfig.base_rate,
      weekend_rate: pricingConfig.weekend_rate,
      extra_person_rate: pricingConfig.extra_person_rate,
    });
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/admin/units/$unitId", params: { unitId } });
  };

  return (
    <DetailPageLayout
      title="Edit Cabin"
      subtitle={`${unit.unit_name} (${unit.unit_code})`}
      breadcrumbs={[
        { label: "Cabins", to: "/admin/units" },
        { label: unit.unit_name, to: "/admin/units/$unitId", params: { unitId } },
        { label: "Edit" },
      ]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="@container space-y-4">
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="unit_name"
                  label="Cabin Name"
                >
                  {(field) => <Input placeholder="e.g., Deluxe Villa 1" {...field} />}
                </FormField>

                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="unit_code"
                  label="Cabin Code"
                  description="Automatically converted to uppercase"
                >
                  {(field) => <Input placeholder="e.g., DV-001" spellCheck={false} {...field} />}
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="unit_type"
                  label="Cabin Type"
                >
                  {(field) => (
                    <SelectControl
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select cabin type"
                    >
                      {/* units_unit_type_check allows exactly these */}
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Deluxe">Deluxe</SelectItem>
                      <SelectItem value="Suite">Suite</SelectItem>
                      <SelectItem value="Villa">Villa</SelectItem>
                    </SelectControl>
                  )}
                </FormField>

                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="max_occupancy"
                  label="Max Occupancy"
                  description="Maximum number of guests (1-20)"
                >
                  {(field) => (
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                    />
                  )}
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Section - Now Global */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="@container space-y-4">
                <Callout tone="info" title="This cabin uses global pricing configuration.">
                  All cabins automatically inherit rates from your resort-wide pricing settings.
                  When you save this unit, pricing will be synced with the global configuration.
                </Callout>

                {pricingConfig && (
                  <div className="bg-muted space-y-2 rounded-md border p-4">
                    <p className="text-sm font-medium">Current Global Rates:</p>
                    <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
                      <div>
                        <p className="text-muted-foreground text-xs">Base Rate</p>
                        <p className="text-base font-semibold tabular-nums">
                          {formatCurrency(pricingConfig.base_rate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Weekend Rate</p>
                        <p className="text-base font-semibold tabular-nums">
                          {formatCurrency(pricingConfig.weekend_rate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Extra Person</p>
                        <p className="text-base font-semibold tabular-nums">
                          {formatCurrency(pricingConfig.extra_person_rate)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button asChild variant="link" size="sm" className="h-auto gap-2 p-0">
                  <Link to="/admin/units/pricing">
                    <DollarSign className="h-3 w-3" aria-hidden="true" />
                    Manage Global Pricing Settings →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updateUnit.isPending}
            >
              <X className="mr-2 h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateUnit.isPending}>
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {updateUnit.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
