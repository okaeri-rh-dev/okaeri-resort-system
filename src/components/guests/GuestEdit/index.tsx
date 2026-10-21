// src/components/guests/GuestEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { Save, X } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailPageLayout,
  Form,
  FormField,
  Input,
} from "@/components/patterns";
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
      contact_number: guest.phone_number || "",
    },
  });

  // Setup mutation with navigation on success
  const updateGuest = useEntityEdit("guest", guestId, {
    onSuccess: () => {
      navigate({ to: "/admin/guests/$guestId", params: { guestId } });
    },
  });

  // Form submission handler
  const onSubmit = ({ guest_name, email, contact_number }: GuestEditInput) => {
    updateGuest.mutate({ guest_name, email, phone_number: contact_number });
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
              <FormField control={form.control} name="guest_name" label="Guest Name">
                {(field) => <Input placeholder="Enter full name" autoComplete="name" {...field} />}
              </FormField>

              <div className="@container">
                <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                  <FormField control={form.control} name="email" label="Email">
                    {(field) => (
                      <Input
                        type="email"
                        placeholder="guest@example.com"
                        autoComplete="email"
                        spellCheck={false}
                        {...field}
                      />
                    )}
                  </FormField>

                  <FormField control={form.control} name="contact_number" label="Contact Number">
                    {(field) => (
                      <Input
                        type="tel"
                        placeholder="+63 XXX XXX XXXX"
                        autoComplete="tel"
                        {...field}
                      />
                    )}
                  </FormField>
                </div>
              </div>
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
