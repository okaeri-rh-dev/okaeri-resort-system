// src/components/units/UnitEdit/index.tsx

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useLoaderData, useNavigate } from "@tanstack/react-router";
import { Save, X } from "lucide-react";

import { unitEditSchema, type UnitEditInput } from "@/lib/validation/entity-schemas";
import { useEntityEdit } from "@/hooks/entity";
import { DetailPageLayout } from "@/components/entity-detail";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Unit } from "@/types/entity-detail.types";

export interface UnitEditPageProps {
  unit?: Unit;
}

export function UnitEditPage() {
  const { unitId } = useParams({ from: "/_authenticated/units/$unitId/edit" });
  const { unit } = useLoaderData({ from: "/_authenticated/units/$unitId/edit" });
  const navigate = useNavigate();

  // Initialize form with default values from unit
  const form = useForm<UnitEditInput>({
    resolver: zodResolver(unitEditSchema),
    defaultValues: {
      unit_name: unit.unit_name || "",
      unit_code: unit.unit_code || "",
      unit_type: unit.unit_type || "",
      max_occupancy: unit.max_occupancy || 1,
      base_rate: unit.base_rate || 0,
      weekend_rate: unit.weekend_rate || 0,
      extra_person_rate: unit.extra_person_rate || 0,
      cleaning_fee: 0, // Not in DB schema - will be added in Phase 3
      amenities: (unit.amenities as string[]) || undefined,
    },
  });

  // Setup mutation with navigation on success
  const updateUnit = useEntityEdit("unit", unitId, {
    onSuccess: () => {
      navigate({ to: "/units/$unitId", params: { unitId } });
    },
  });

  // Form submission handler
  const onSubmit = (data: UnitEditInput) => {
    updateUnit.mutate(data);
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/units/$unitId", params: { unitId } });
  };

  return (
    <DetailPageLayout
      title="Edit Unit"
      subtitle={`${unit.unit_name} (${unit.unit_code})`}
      breadcrumbs={[
        { label: "Units", to: "/units" },
        { label: unit.unit_name, to: `/units/${unitId}` },
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unit_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Deluxe Villa 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., DV-001" {...field} />
                      </FormControl>
                      <FormDescription>Automatically converted to uppercase</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Villa">Villa</SelectItem>
                          <SelectItem value="Room">Room</SelectItem>
                          <SelectItem value="Suite">Suite</SelectItem>
                          <SelectItem value="Cottage">Cottage</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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

          {/* Pricing Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="base_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Rate</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>₱ Philippine Peso per night</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weekend_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekend Rate (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormDescription>₱ Special rate for weekends</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="extra_person_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extra Person Rate (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormDescription>₱ Additional charge per extra guest</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cleaning_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cleaning Fee (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormDescription>₱ One-time cleaning charge</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateUnit.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateUnit.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
