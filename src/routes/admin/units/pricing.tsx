import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns";
import { DiscountRulesForm, type DiscountRule } from "@/components/pricing/DiscountRulesForm";
import { PricingConfigForm } from "@/components/pricing/PricingConfigForm";
import { SeasonalRatesForm, type SeasonalRate } from "@/components/pricing/SeasonalRatesForm";
import { useDiscountRules, useSaveDiscountRules } from "@/hooks/useDiscountRules";
import { useSaveSeasonalRates, useSeasonalRates } from "@/hooks/useSeasonalRates";
import { requireManager } from "@/lib/route-guards";

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
 * - Restricted to manager/owner/admin roles via route guard
 */
export const Route = createFileRoute("/admin/units/pricing")({
  beforeLoad: async () => {
    await requireManager();
  },
  component: PricingConfigPage,
});

function PricingConfigPage() {
  // Fetch seasonal rates from Supabase
  const { data: seasonalRates = [], isLoading: isLoadingRates } = useSeasonalRates();

  // Mutation for saving seasonal rates
  const saveSeasonalRatesMutation = useSaveSeasonalRates();

  // Fetch discount rules from Supabase
  const { data: discountRules = [], isLoading: isLoadingDiscountRules } = useDiscountRules();

  // Mutation for saving discount rules
  const saveDiscountRulesMutation = useSaveDiscountRules();

  const handleSaveSeasonalRates = async (rates: SeasonalRate[]) => {
    await saveSeasonalRatesMutation.mutateAsync(rates);
  };

  const handleSaveDiscountRules = async (rules: DiscountRule[]) => {
    await saveDiscountRulesMutation.mutateAsync(rules);
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
            Manage rates, fees, capacity limits, seasonal pricing, discount rules, and payment terms
            for your resort.
          </p>
        </div>
      </div>

      {/* Tabbed Interface for Base Pricing, Seasonal Rates, and Discount Rules */}
      <Tabs defaultValue="base" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="base">Base Pricing</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal Rates</TabsTrigger>
          <TabsTrigger value="discounts">Discount Rules</TabsTrigger>
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

        <TabsContent value="discounts" className="mt-6">
          <DiscountRulesForm
            rules={(discountRules || []).map((rule) => ({
              ...rule,
              is_active: rule.is_active ?? true,
              priority: rule.priority ?? 0,
            }))}
            onSave={handleSaveDiscountRules}
            isLoading={isLoadingDiscountRules || saveDiscountRulesMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
