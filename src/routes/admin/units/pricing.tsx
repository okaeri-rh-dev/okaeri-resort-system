import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PricingConfigForm } from "@/components/pricing/PricingConfigForm";
import { SeasonalRatesForm, type SeasonalRate } from "@/components/pricing/SeasonalRatesForm";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSaveSeasonalRates, useSeasonalRates } from "@/hooks/useSeasonalRates";

/**
 * Pricing Configuration Edit Route
 *
 * Authenticated route for editing resort pricing configuration.
 * Accessible at: /admin/units/pricing
 *
 * Features:
 * - Full-page form layout for comfortable editing
 * - Breadcrumb navigation back to units
 * - Auto-navigation on successful save
 * - Professional enterprise design
 *
 * Access Control:
 * - Requires authentication (under /admin layout)
 * - Should be restricted to admin/manager roles via RLS
 */
export const Route = createFileRoute("/admin/units/pricing")({
  component: PricingConfigPage,
});

function PricingConfigPage() {
  // Fetch seasonal rates from Supabase
  const { data: seasonalRates = [], isLoading: isLoadingRates } = useSeasonalRates();

  // Mutation for saving seasonal rates
  const saveSeasonalRatesMutation = useSaveSeasonalRates();

  const handleSaveSeasonalRates = async (rates: SeasonalRate[]) => {
    await saveSeasonalRatesMutation.mutateAsync(rates);
  };

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb */}
      <div className="space-y-2">
        {/* Back Button */}
        <Link to="/admin/units">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Cabins
          </Button>
        </Link>

        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing Configuration</h1>
          <p className="text-muted-foreground">
            Manage rates, fees, capacity limits, seasonal pricing, and payment terms for your
            resort.
          </p>
        </div>
      </div>

      {/* Tabbed Interface for Base Pricing and Seasonal Rates */}
      <Tabs defaultValue="base" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="base">Base Pricing</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="base" className="mt-6">
          <PricingConfigForm />
        </TabsContent>

        <TabsContent value="seasonal" className="mt-6">
          <SeasonalRatesForm
            rates={(seasonalRates || []).map((rate) => ({
              ...rate,
              is_active: rate.is_active ?? true,
              description: rate.description || undefined,
              color: rate.color || undefined,
            }))}
            onSave={handleSaveSeasonalRates}
            isLoading={isLoadingRates || saveSeasonalRatesMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
