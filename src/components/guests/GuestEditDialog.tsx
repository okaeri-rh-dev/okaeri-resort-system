import React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUpdateGuest } from "@/stores/useGuestStore";
import type { Guest } from "@/types";

// Validation schema
const guestFormSchema = z.object({
  guest_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone_number: z.string().optional(),
});

type GuestFormData = z.infer<typeof guestFormSchema>;

interface GuestEditDialogProps {
  guest: Guest;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const GuestEditDialog: React.FC<GuestEditDialogProps> = ({
  guest,
  open,
  onClose,
  onSuccess,
}) => {
  const updateGuest = useUpdateGuest();

  const form = useForm<GuestFormData>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      guest_name: guest.guest_name,
      email: guest.email || "",
      phone_number: guest.phone_number || "",
    },
  });

  const onSubmit = async (data: GuestFormData) => {
    try {
      await updateGuest.mutateAsync({
        guestId: guest.guest_id,
        updates: {
          ...data,
          email: data.email?.trim() || null,
          phone_number: data.phone_number?.trim() || null,
        },
      });
      toast.success("Guest information updated successfully");
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update guest");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Guest Information</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="John Doe" />
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
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="john@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" placeholder="+63 912 345 6789" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateGuest.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateGuest.isPending}>
                {updateGuest.isPending ? "Updating..." : "Update Guest"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
