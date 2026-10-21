import * as React from "react";
import { useEffectEvent } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, DollarSign, Home, Users } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormField,
  NumberInput,
  Separator,
} from "@/components/patterns";
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
    mode: "onBlur",
    reValidateMode: "onBlur",
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

  // Extract form.reset into useEffectEvent to remove form from dependencies
  const resetForm = useEffectEvent((pricing: typeof currentPricing) => {
    if (pricing) {
      form.reset({
        base_rate: pricing.base_rate,
        weekend_rate: pricing.weekend_rate,
        extra_person_rate: pricing.extra_person_rate,
        base_occupancy: pricing.base_occupancy,
        max_capacity_per_unit: pricing.max_capacity_per_unit,
        downpayment_percent: pricing.downpayment_percent,
        currency: pricing.currency as "PHP",
      });
    }
  });

  // Load current pricing into form when data arrives
  React.useEffect(() => {
    resetForm(currentPricing);
  }, [currentPricing]);

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
        {/* Global Pricing Notice */}
        <Callout tone="info" title="Global Pricing Configuration" className="mb-6">
          These settings automatically apply to <strong>all cabins</strong> in your resort. When you
          update rates here, all cabin pricing will be synchronized instantly. Individual cabin
          pricing has been centralized for consistent guest experience.
        </Callout>

        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-3">
            {/* Left Column: Form Fields */}
            <div className="space-y-6 @4xl:col-span-2">
              {/* Rate Configuration Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="text-muted-foreground h-5 w-5" aria-hidden="true" />
                    Rate Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="@container space-y-4">
                  <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="base_rate"
                      label="Base Rate (Weekdays)"
                      description={
                        <>
                          Rate per night (Sunday - Thursday)
                          {watchedValues.base_rate > 0 && (
                            <span className="mt-1 block text-xs font-medium tabular-nums">
                              {formatCurrency(watchedValues.base_rate)} per night
                            </span>
                          )}
                        </>
                      }
                    >
                      {(field) => (
                        <NumberInput
                          min={500}
                          max={100000}
                          allowDecimals={true}
                          placeholder="3000.00"
                          startIcon={<span className="text-sm font-medium">₱</span>}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          onBlur={(value) => {
                            field.onChange(value || 500);
                            field.onBlur();
                          }}
                        />
                      )}
                    </FormField>

                    <FormField
                      control={form.control}
                      name="weekend_rate"
                      label="Weekend Rate (Fri-Sat)"
                      description={
                        <>
                          Rate per night (Friday & Saturday)
                          {watchedValues.weekend_rate > 0 && (
                            <span className="mt-1 block text-xs font-medium tabular-nums">
                              {formatCurrency(watchedValues.weekend_rate)} per night
                            </span>
                          )}
                        </>
                      }
                    >
                      {(field) => (
                        <NumberInput
                          min={500}
                          max={100000}
                          allowDecimals={true}
                          placeholder="3500.00"
                          startIcon={<span className="text-sm font-medium">₱</span>}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          onBlur={(value) => {
                            field.onChange(value || 500);
                            field.onBlur();
                          }}
                        />
                      )}
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Fees Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="text-muted-foreground h-5 w-5" aria-hidden="true" />
                    Additional Fees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="extra_person_rate"
                    label="Extra Person Rate"
                    description={
                      <>
                        Additional charge per guest per night (beyond base occupancy)
                        {watchedValues.extra_person_rate > 0 && (
                          <span className="mt-1 block text-xs font-medium tabular-nums">
                            {formatCurrency(watchedValues.extra_person_rate)} per guest per night
                          </span>
                        )}
                      </>
                    }
                  >
                    {(field) => (
                      <NumberInput
                        min={0}
                        max={10000}
                        allowDecimals={true}
                        placeholder="500.00"
                        startIcon={<span className="text-sm font-medium">₱</span>}
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        onBlur={(value) => {
                          field.onChange(value ?? 0);
                          field.onBlur();
                        }}
                      />
                    )}
                  </FormField>
                </CardContent>
              </Card>

              {/* Capacity Settings Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="text-muted-foreground h-5 w-5" aria-hidden="true" />
                    Capacity Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="@container space-y-4">
                  <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="base_occupancy"
                      label="Base Occupancy"
                      description="Standard number of guests included in base rate"
                    >
                      {(field) => (
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
                      )}
                    </FormField>

                    <FormField
                      control={form.control}
                      name="max_capacity_per_unit"
                      label="Max Capacity Per Unit"
                      description="Maximum guests allowed per unit"
                    >
                      {(field) => (
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
                      )}
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Terms Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="text-muted-foreground h-5 w-5" aria-hidden="true" />
                    Payment Terms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="downpayment_percent"
                    label="Downpayment Percentage"
                    description="Percentage of total required as downpayment (0-100%)"
                  >
                    {(field) => (
                      <NumberInput
                        min={0}
                        max={100}
                        allowDecimals={false}
                        placeholder="50"
                        endIcon={<span className="text-sm">%</span>}
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        onBlur={(value) => {
                          field.onChange(value ?? 0);
                          field.onBlur();
                        }}
                      />
                    )}
                  </FormField>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Preview */}
            <div className="@4xl:col-span-1">
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
                        <span className="tabular-nums">{formatCurrency(preview.baseTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weekend (2 nights)</span>
                        <span className="tabular-nums">{formatCurrency(preview.weekendTotal)}</span>
                      </div>
                      {preview.extraPersonTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Extra guests ({preview.guests - watchedValues.base_occupancy})
                          </span>
                          <span className="tabular-nums">
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
                        <span className="tabular-nums">{formatCurrency(preview.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Downpayment ({watchedValues.downpayment_percent}%)</span>
                        <span className="tabular-nums">{formatCurrency(preview.downpayment)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining Balance</span>
                        <span className="tabular-nums">{formatCurrency(preview.remaining)}</span>
                      </div>
                    </div>

                    <div className="bg-muted rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">
                        This preview shows how rates are calculated. Actual bookings may vary based
                        on specific dates and guest counts.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
