import React from "react";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { StepProps } from "../types";

export function GuestInformation({ form }: StepProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="guest_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base sm:text-sm font-medium">Full Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Enter guest's full name"
                className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base sm:text-sm font-medium">Email Address</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="guest@example.com"
                className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                autoComplete="email"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-sm">
              Booking confirmation will be sent to this email
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contact_number"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base sm:text-sm font-medium">Phone Number</FormLabel>
            <FormControl>
              <Input
                type="tel"
                placeholder="+639123456789 or 09123456789"
                className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                autoComplete="tel"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-sm">Philippine mobile numbers only</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
