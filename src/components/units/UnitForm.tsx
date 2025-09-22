import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bath,
  Bed,
  Building2,
  Car,
  Coffee,
  DollarSign,
  Tv,
  Users,
  Utensils,
  Wifi,
  Wind,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

// Common amenities with icons
const AMENITIES_OPTIONS = [
  { id: "wifi", label: "Free WiFi", icon: Wifi },
  { id: "parking", label: "Free Parking", icon: Car },
  { id: "aircon", label: "Air Conditioning", icon: Wind },
  { id: "tv", label: "Smart TV", icon: Tv },
  { id: "kitchen", label: "Kitchenette", icon: Utensils },
  { id: "coffee", label: "Coffee Maker", icon: Coffee },
  { id: "bathroom", label: "Private Bathroom", icon: Bath },
  { id: "balcony", label: "Private Balcony", icon: Building2 },
  { id: "pool_access", label: "Pool Access", icon: Bath },
  { id: "beach_access", label: "Beach Access", icon: Bath },
  { id: "extra_bed", label: "Extra Bed Available", icon: Bed },
  { id: "breakfast", label: "Complimentary Breakfast", icon: Coffee },
];

const UNIT_TYPES: { value: UnitType; label: string; description: string }[] = [
  {
    value: "Standard",
    label: "Standard",
    description: "Compact unit perfect for couples",
  },
  {
    value: "Deluxe",
    label: "Deluxe",
    description: "Spacious unit with enhanced amenities",
  },
  {
    value: "Suite",
    label: "Suite",
    description: "Premium unit with separate living area",
  },
  {
    value: "Villa",
    label: "Villa",
    description: "Luxury standalone accommodation",
  },
];

export function UnitForm({ unit, onSuccess, onCancel, className }: UnitFormProps) {
  const createUnitMutation = useCreateUnit();
  const updateUnitMutation = useUpdateUnit();

  const isEditing = !!unit;

  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitFormWithRateValidationSchema),
    defaultValues: {
      unit_name: unit?.unit_name || "",
      unit_code: unit?.unit_code || "",
      unit_type: unit?.unit_type || undefined,
      base_occupancy: unit?.base_occupancy || 2,
      max_occupancy: unit?.max_occupancy || 2,
      base_rate: unit?.base_rate || 0,
      weekend_rate: unit?.weekend_rate || 0,
      extra_person_rate: unit?.extra_person_rate || 0,
      amenities: unit?.amenities || [],
    },
    mode: "onChange",
  });

  const watchedBaseRate = form.watch("base_rate");
  const watchedWeekendRate = form.watch("weekend_rate");
  const watchedExtraPersonRate = form.watch("extra_person_rate");
  const watchedBaseOccupancy = form.watch("base_occupancy");
  const watchedMaxOccupancy = form.watch("max_occupancy");
  const watchedUnitType = form.watch("unit_type");
  const selectedAmenities = form.watch("amenities") || [];

  const handleAmenityToggle = (amenityId: string) => {
    const current = form.getValues("amenities") || [];
    const newAmenities = current.includes(amenityId)
      ? current.filter((id) => id !== amenityId)
      : [...current, amenityId];

    form.setValue("amenities", newAmenities, { shouldValidate: true });
  };

  const onSubmit = async (data: UnitFormData) => {
    try {
      const unitData = {
        ...data,
        amenities: data.amenities || [],
      };

      if (isEditing && unit) {
        await updateUnitMutation.mutateAsync({
          unitId: unit.unit_id,
          updates: unitData,
        });
        toast.success("Unit updated successfully!");
      } else {
        await createUnitMutation.mutateAsync({
          ...unitData,
          unit_status: "Available" as const,
        });
        toast.success("Unit created successfully!");
      }

      onSuccess?.(unitData);
    } catch (error) {
      toast.error(
        isEditing
          ? "Failed to update unit. Please try again."
          : "Failed to create unit. Please try again."
      );
      console.error("Unit form error:", error);
    }
  };

  const getSuggestedRates = (unitType: UnitType) => {
    switch (unitType) {
      case "Standard":
        return { base: 2500, weekend: 3000, extraPerson: 500, baseOccupancy: 2, maxOccupancy: 2 };
      case "Deluxe":
        return { base: 3500, weekend: 4000, extraPerson: 750, baseOccupancy: 2, maxOccupancy: 4 };
      case "Suite":
        return { base: 5000, weekend: 6000, extraPerson: 1000, baseOccupancy: 2, maxOccupancy: 4 };
      case "Villa":
        return { base: 8000, weekend: 10000, extraPerson: 1500, baseOccupancy: 4, maxOccupancy: 6 };
      default:
        return { base: 2500, weekend: 3000, extraPerson: 500, baseOccupancy: 2, maxOccupancy: 2 };
    }
  };

  const applySuggestedRates = () => {
    if (watchedUnitType) {
      const rates = getSuggestedRates(watchedUnitType);
      form.setValue("base_rate", rates.base, { shouldValidate: true });
      form.setValue("weekend_rate", rates.weekend, { shouldValidate: true });
      form.setValue("extra_person_rate", rates.extraPerson, { shouldValidate: true });
      form.setValue("base_occupancy", rates.baseOccupancy, { shouldValidate: true });
      form.setValue("max_occupancy", rates.maxOccupancy, { shouldValidate: true });
    }
  };

  return (
    <Card className={cn("mx-auto w-full max-w-3xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {isEditing ? "Edit Unit" : "Create New Unit"}
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
                      <FormLabel>Unit Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Ocean View Standard A" {...field} />
                      </FormControl>
                      <FormDescription>Descriptive name for the unit</FormDescription>
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
                        {UNIT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{type.label}</span>
                              <span className="text-muted-foreground text-xs">
                                {type.description}
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
                  name="base_occupancy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Occupancy</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Users className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                          <Input
                            type="number"
                            min="1"
                            max={20}
                            className="pl-10"
                            {...field}
                            onBlur={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                          />
                        </div>
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
                        <div className="relative">
                          <Users className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                          <Input
                            type="number"
                            min="1"
                            max={20}
                            className="pl-10"
                            {...field}
                            onBlur={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                          />
                        </div>
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
                {watchedUnitType && (
                  <Button type="button" variant="outline" size="sm" onClick={applySuggestedRates}>
                    Use Suggested Rates
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="base_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Rate (Weekdays)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                          <Input
                            type="number"
                            step="0.01"
                            min="100"
                            max="1000000"
                            className="pl-10"
                            placeholder="2500.00"
                            {...field}
                            onBlur={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </div>
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

                <FormField
                  control={form.control}
                  name="weekend_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekend Rate</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                          <Input
                            type="number"
                            step="0.01"
                            min="100"
                            max="1000000"
                            className="pl-10"
                            placeholder="3000.00"
                            {...field}
                            onBlur={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Rate per night (Friday - Saturday)
                        {watchedWeekendRate > 0 && (
                          <span className="mt-1 block text-xs">
                            {formatCurrency(watchedWeekendRate)} per night
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
                      <div className="relative">
                        <DollarSign className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="50000"
                          className="pl-10"
                          placeholder="500.00"
                          {...field}
                          onBlur={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </div>
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

              {/* Rate Comparison */}
              {watchedBaseRate > 0 && watchedWeekendRate > 0 && (
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="mb-2 font-medium">Rate Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Weekday:</span>
                      <p className="font-medium">{formatCurrency(watchedBaseRate)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Weekend:</span>
                      <p className="font-medium">{formatCurrency(watchedWeekendRate)}</p>
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
                  {watchedWeekendRate < watchedBaseRate && (
                    <p className="mt-2 text-xs text-yellow-600">
                      ⚠️ Weekend rate is lower than base rate
                    </p>
                  )}
                  {watchedBaseOccupancy > watchedMaxOccupancy && (
                    <p className="mt-2 text-xs text-red-600">
                      ⚠️ Base occupancy cannot exceed maximum occupancy
                    </p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Amenities */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="amenities"
                render={() => (
                  <FormItem>
                    <FormLabel>Amenities</FormLabel>
                    <FormDescription>Select all amenities available in this unit</FormDescription>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {AMENITIES_OPTIONS.map((amenity) => {
                        const Icon = amenity.icon;
                        const isSelected = selectedAmenities.includes(amenity.id);

                        return (
                          <label
                            key={amenity.id}
                            htmlFor={`amenity-${amenity.id}`}
                            className={cn(
                              "flex cursor-pointer items-center space-x-2 rounded-lg border p-3 transition-colors",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-muted-foreground/50"
                            )}
                          >
                            <Checkbox
                              id={`amenity-${amenity.id}`}
                              checked={isSelected}
                              onCheckedChange={() => handleAmenityToggle(amenity.id)}
                            />
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-medium">{amenity.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {selectedAmenities.length === 0 && (
                      <p className="text-destructive mt-2 text-sm">
                        Please select at least one amenity
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>

            {/* Selected Amenities Summary */}
            {selectedAmenities.length > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <h4 className="mb-3 font-medium">Selected Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAmenities.map((amenityId) => {
                      const amenity = AMENITIES_OPTIONS.find((a) => a.id === amenityId);
                      if (!amenity) return null;

                      const Icon = amenity.icon;
                      return (
                        <Badge key={amenityId} variant="secondary" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {amenity.label}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-auto p-0"
                            onClick={() => handleAmenityToggle(amenityId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

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
                disabled={
                  createUnitMutation.isPending ||
                  updateUnitMutation.isPending ||
                  selectedAmenities.length === 0
                }
                className="min-w-[120px]"
              >
                {createUnitMutation.isPending || updateUnitMutation.isPending
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Unit"
                    : "Create Unit"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
