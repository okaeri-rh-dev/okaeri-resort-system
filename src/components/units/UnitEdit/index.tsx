// src/components/units/UnitEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { DollarSign, Info, Save, X } from "lucide-react";
import { useForm, type Control, type Resolver } from "react-hook-form";

import { formatCurrency } from "@/components/entity-detail";
import { DetailPageLayout } from "@/components/patterns";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="unit_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cabin Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Deluxe Villa 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="unit_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cabin Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., DV-001" {...field} />
                      </FormControl>
                      <FormDescription>Automatically converted to uppercase</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="unit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cabin Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cabin type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* units_unit_type_check allows exactly these */}
                          <SelectItem value="Standard">Standard</SelectItem>
                          <SelectItem value="Deluxe">Deluxe</SelectItem>
                          <SelectItem value="Suite">Suite</SelectItem>
                          <SelectItem value="Villa">Villa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as Control<UnitEditWithoutPricingInput>}
                  name="max_occupancy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Occupancy</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                        />
                      </FormControl>
                      <FormDescription>Maximum number of guests (1-20)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing Section - Now Global */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-medium">This cabin uses global pricing configuration.</p>
                    <p className="text-muted-foreground text-sm">
                      All cabins automatically inherit rates from your resort-wide pricing settings.
                      When you save this unit, pricing will be synced with the global configuration.
                    </p>

                    {pricingConfig && (
                      <div className="border-border bg-muted mt-4 space-y-2 rounded-md border p-4">
                        <p className="text-foreground text-sm font-medium">Current Global Rates:</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div>
                            <p className="text-muted-foreground text-xs">Base Rate</p>
                            <p className="text-foreground text-base font-semibold tabular-nums">
                              {formatCurrency(pricingConfig.base_rate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Weekend Rate</p>
                            <p className="text-foreground text-base font-semibold tabular-nums">
                              {formatCurrency(pricingConfig.weekend_rate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Extra Person</p>
                            <p className="text-foreground text-base font-semibold tabular-nums">
                              {formatCurrency(pricingConfig.extra_person_rate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <Link to="/admin/units/pricing">
                        <Button variant="link" size="sm" className="h-auto gap-2 p-0">
                          <DollarSign className="h-3 w-3" />
                          Manage Global Pricing Settings →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
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
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateUnit.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateUnit.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
