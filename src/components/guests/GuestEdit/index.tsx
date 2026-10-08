// src/components/guests/GuestEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { Save, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { DetailPageLayout } from "@/components/entity-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEntityEdit } from "@/hooks/entity";
import { guestEditSchema, type GuestEditInput } from "@/lib/validation/entity-schemas";
import type { Guest } from "@/types/entity-detail.types";

export interface GuestEditPageProps {
  guest?: Guest;
}

export function GuestEditPage() {
  const { guestId } = useParams({ from: "/admin/guests/$guestId/edit" });
  const { guest } = useLoaderData({ from: "/admin/guests/$guestId/edit" });
  const navigate = useNavigate();

  // Initialize form with default values from guest
  const form = useForm<GuestEditInput>({
    resolver: zodResolver(guestEditSchema),
    defaultValues: {
      guest_name: guest.guest_name || "",
      email: guest.email || "",
      contact_number: guest.phone_number || "", // DB uses phone_number
      address: "", // Not in DB schema - will be added in Phase 3
      notes: "", // Not in DB schema - will be added in Phase 3
    },
  });

  // Setup mutation with navigation on success
  const updateGuest = useEntityEdit("guest", guestId, {
    onSuccess: () => {
      navigate({ to: "/admin/guests/$guestId", params: { guestId } });
    },
  });

  // Form submission handler
  const onSubmit = (data: GuestEditInput) => {
    updateGuest.mutate(data);
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/admin/guests/$guestId", params: { guestId } });
  };

  return (
    <DetailPageLayout
      title="Edit Guest"
      subtitle={guest.guest_name}
      breadcrumbs={[
        { label: "Guests", to: "/admin/guests" },
        { label: guest.guest_name, to: "/admin/guests/$guestId", params: { guestId } },
        { label: "Edit" },
      ]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="guest_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guest Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="guest@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+63 XXX XXX XXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter complete address..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any internal notes about this guest..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updateGuest.isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateGuest.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateGuest.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
