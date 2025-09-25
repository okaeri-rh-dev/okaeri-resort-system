import React from "react";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard } from "lucide-react";

import type { StepProps } from "../types";

export function PaymentDetails({ form }: StepProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="payment_method"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base sm:text-sm font-medium">Payment Method</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              defaultValue={field.value || ""}
            >
              <FormControl>
                <SelectTrigger className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation">
                  <div className="flex items-center">
                    <CreditCard className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
                    <SelectValue placeholder="Select payment method" />
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="GCash">GCash</SelectItem>
                <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                <SelectItem value="Card">Credit/Debit Card</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription className="text-sm">
              Payment will be collected upon arrival or as agreed
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="special_requests"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base sm:text-sm font-medium">
              Special Requests (Optional)
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Any special requests or notes for your stay..."
                className="min-h-[120px] text-base sm:text-sm touch-manipulation resize-none"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-sm">
              We'll do our best to accommodate your requests
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
