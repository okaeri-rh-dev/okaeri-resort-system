import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, DollarSign, Home, Users } from "lucide-react";
import { useForm } from "react-hook-form";

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
import { NumberInput } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePricingConfig, useUpdatePricingConfig } from "@/hooks/usePricingConfig";
import { formatCurrency } from "@/lib/utils";
import { pricingConfigSchema, type PricingConfigInput } from "@/lib/validation/pricing-schema";

export interface PricingConfigFormProps {
  /** Callback after successful update */
  onSuccess?: () => void;

  /** Callback when cancel button clicked */
  onCancel?: () => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * PricingConfigForm Component
 *
 * Professional form for editing resort pricing configuration.
 * Manages rates, capacity settings, and payment terms with real-time preview.
 *
 * Features:
 * - React Hook Form + Zod validation
 * - Currency-formatted number inputs (PHP peso)
 * - Real-time calculation preview
 * - Optimistic updates with TanStack Query
 * - Loading/error states
 * - Organized sections: Rates, Fees, Capacity, Payment
 *
 * Form Sections:
 * 1. Rate Configuration - Base & Weekend rates
 * 2. Additional Fees - Extra person charges
 * 3. Capacity Settings - Occupancy limits
 * 4. Payment Terms - Downpayment percentage
 * 5. Preview Card - Sample booking calculation
 */
export function PricingConfigForm({ onSuccess, onCancel, className }: PricingConfigFormProps) {
  const { data: currentPricing, isLoading: isLoadingPricing } = usePricingConfig();
  const updateMutation = useUpdatePricingConfig({
    onSuccess: () => {
      if (onSuccess) onSuccess();
    },
    navigateOnSuccess: !onSuccess, // Auto-navigate if no custom success handler
  });

  // Initialize form with React Hook Form + Zod
  const form = useForm<PricingConfigInput>({
    resolver: zodResolver(pricingConfigSchema),
    defaultValues: {
      base_rate: 0,
      weekend_rate: 0,
      extra_person_rate: 0,
      base_occupancy: 2,
      max_capacity_per_unit: 10,
      downpayment_percent: 50,
      currency: "PHP",
    },
  });

  // Load current pricing into form when data arrives
  React.useEffect(() => {
    if (currentPricing) {
      form.reset({
        base_rate: currentPricing.base_rate,
        weekend_rate: currentPricing.weekend_rate,
        extra_person_rate: currentPricing.extra_person_rate,
        base_occupancy: currentPricing.base_occupancy,
        max_capacity_per_unit: currentPricing.max_capacity_per_unit,
        downpayment_percent: currentPricing.downpayment_percent,
        currency: currentPricing.currency as "PHP",
      });
    }
  }, [currentPricing, form]);

  // Watch form values for real-time preview
  const watchedValues = form.watch();

  // Submit handler
  const onSubmit = async (data: PricingConfigInput) => {
    await updateMutation.mutateAsync(data);
  };

  // Calculate sample booking preview
  const calculatePreview = () => {
    const nights = 3; // Sample: 3 nights
    const guests = 4; // Sample: 4 guests
    const weekendNights = 2; // Sample: 2 weekend nights

    const baseNights = nights - weekendNights;
    const baseTotal = baseNights * watchedValues.base_rate;
    const weekendTotal = weekendNights * watchedValues.weekend_rate;

    const extraGuests = Math.max(0, guests - watchedValues.base_occupancy);
    const extraPersonTotal = extraGuests * nights * watchedValues.extra_person_rate;

    const subtotal = baseTotal + weekendTotal + extraPersonTotal;
    const downpayment = (subtotal * watchedValues.downpayment_percent) / 100;

    return {
      nights,
      guests,
      baseTotal,
      weekendTotal,
      extraPersonTotal,
      subtotal,
      downpayment,
      remaining: subtotal - downpayment,
    };
  };

  const preview = calculatePreview();

  if (isLoadingPricing) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading pricing configuration...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={className}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Form Fields */}
          <div className="space-y-6 lg:col-span-2">
            {/* Rate Configuration Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="text-muted-foreground h-5 w-5" />
                  Rate Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Base Rate */}
                  <FormField
                    control={form.control}
                    name="base_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Rate (Weekdays)</FormLabel>
                        <FormControl>
                          <NumberInput
                            min={500}
                            max={100000}
                            allowDecimals={true}
                            className="pl-10"
                            placeholder="3000.00"
                            startIcon={<span className="text-sm font-medium">₱</span>}
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            onBlur={(value) => {
                              field.onChange(value || 500);
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Rate per night (Sunday - Thursday)
                          {watchedValues.base_rate > 0 && (
                            <span className="mt-1 block text-xs font-medium text-blue-600">
                              {formatCurrency(watchedValues.base_rate)} per night
                            </span>
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Weekend Rate */}
                  <FormField
                    control={form.control}
                    name="weekend_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weekend Rate (Fri-Sat)</FormLabel>
                        <FormControl>
                          <NumberInput
                            min={500}
                            max={100000}
                            allowDecimals={true}
                            className="pl-10"
                            placeholder="3500.00"
                            startIcon={<span className="text-sm font-medium">₱</span>}
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            onBlur={(value) => {
                              field.onChange(value || 500);
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Rate per night (Friday & Saturday)
                          {watchedValues.weekend_rate > 0 && (
                            <span className="mt-1 block text-xs font-medium text-blue-600">
                              {formatCurrency(watchedValues.weekend_rate)} per night
                            </span>
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Additional Fees Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="text-muted-foreground h-5 w-5" />
                  Additional Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="extra_person_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extra Person Rate</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          max={10000}
                          allowDecimals={true}
                          className="pl-10"
                          placeholder="500.00"
                          startIcon={<span className="text-sm font-medium">₱</span>}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          onBlur={(value) => {
                            field.onChange(value ?? 0);
                            field.onBlur();
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Additional charge per guest per night (beyond base occupancy)
                        {watchedValues.extra_person_rate > 0 && (
                          <span className="mt-1 block text-xs font-medium text-blue-600">
                            {formatCurrency(watchedValues.extra_person_rate)} per guest per night
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Capacity Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="text-muted-foreground h-5 w-5" />
                  Capacity Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Base Occupancy */}
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
                            placeholder="2"
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            onBlur={(value) => {
                              field.onChange(value || 1);
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Standard number of guests included in base rate
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Capacity */}
                  <FormField
                    control={form.control}
                    name="max_capacity_per_unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Capacity Per Unit</FormLabel>
                        <FormControl>
                          <NumberInput
                            min={1}
                            max={50}
                            allowDecimals={false}
                            placeholder="10"
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            onBlur={(value) => {
                              field.onChange(value || 1);
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormDescription>Maximum guests allowed per unit</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Terms Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="text-muted-foreground h-5 w-5" />
                  Payment Terms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="downpayment_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Downpayment Percentage</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <NumberInput
                            min={0}
                            max={100}
                            allowDecimals={false}
                            className="pr-10"
                            placeholder="50"
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            onBlur={(value) => {
                              field.onChange(value ?? 0);
                              field.onBlur();
                            }}
                          />
                          <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                            %
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Percentage of total required as downpayment (0-100%)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sample Calculation</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    {preview.nights} nights, {preview.guests} guests
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Breakdown */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Base ({preview.nights - 2} weekday nights)
                      </span>
                      <span className="font-mono">{formatCurrency(preview.baseTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weekend (2 nights)</span>
                      <span className="font-mono">{formatCurrency(preview.weekendTotal)}</span>
                    </div>
                    {preview.extraPersonTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Extra guests ({preview.guests - watchedValues.base_occupancy})
                        </span>
                        <span className="font-mono">
                          {formatCurrency(preview.extraPersonTotal)}
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between font-semibold">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatCurrency(preview.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span>Downpayment ({watchedValues.downpayment_percent}%)</span>
                      <span className="font-mono">{formatCurrency(preview.downpayment)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remaining Balance</span>
                      <span className="font-mono">{formatCurrency(preview.remaining)}</span>
                    </div>
                  </div>

                  <div className="bg-background/50 rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs">
                      This preview shows how rates are calculated. Actual bookings may vary based on
                      specific dates and guest counts.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="mt-6 flex justify-end gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Pricing Configuration"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
