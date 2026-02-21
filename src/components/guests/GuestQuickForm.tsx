import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle, Clock, Mail, Phone, Search, User, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatPhoneNumber,
  guestQuickFormSchema,
  type GuestQuickFormData,
} from "@/lib/validations";
import { useCreateGuest } from "@/stores/useGuestStore";
import type { Guest } from "@/types";

interface GuestQuickFormProps {
  onSuccess?: (guest: Guest) => void;
  onCancel?: () => void;
  onGuestSelected?: (guest: Guest) => void;
  initialEmail?: string;
  className?: string;
  showExistingGuestOption?: boolean;
}

interface ExistingGuestInfo {
  guest: Guest;
  totalBookings: number;
  lastBookingDate?: string;
}

export function GuestQuickForm({
  onSuccess,
  onCancel,
  onGuestSelected,
  initialEmail = "",
  className,
  showExistingGuestOption = true,
}: GuestQuickFormProps) {
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [existingGuest, setExistingGuest] = useState<ExistingGuestInfo | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(!showExistingGuestOption);

  const createGuestMutation = useCreateGuest();

  const form = useForm<GuestQuickFormData>({
    resolver: zodResolver(guestQuickFormSchema),
    defaultValues: {
      guest_name: "",
      email: initialEmail,
      phone_number: "",
      check_existing: true,
    },
    mode: "onChange",
  });

  const watchedEmail = form.watch("email");
  const debouncedEmail = useDebounce(watchedEmail, 500);

  // Check for existing guest when email changes
  useEffect(() => {
    if (debouncedEmail && debouncedEmail.includes("@") && showExistingGuestOption) {
      checkExistingGuest(debouncedEmail);
    } else {
      setExistingGuest(null);
    }
  }, [debouncedEmail, showExistingGuestOption]);

  const checkExistingGuest = async (email: string) => {
    setIsCheckingExisting(true);
    try {
      // Simulate API call - replace with actual implementation
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Mock existing guest data - replace with actual API call
      const mockExistingGuest =
        Math.random() > 0.7
          ? {
              guest_id: "guest-123",
              guest_name: "John Doe",
              email: email,
              phone_number: "+639123456789",
              total_bookings: 3,
              total_spent: 15000,
              created_at: "2024-01-15T10:00:00Z",
              updated_at: "2024-09-15T10:00:00Z",
            }
          : null;

      if (mockExistingGuest) {
        setExistingGuest({
          guest: mockExistingGuest,
          totalBookings: mockExistingGuest.total_bookings,
          lastBookingDate: "2024-08-15",
        });
        setShowCreateForm(false);
      } else {
        setExistingGuest(null);
        setShowCreateForm(true);
      }
    } catch (error) {
      console.error("Error checking existing guest:", error);
      setExistingGuest(null);
      setShowCreateForm(true);
    } finally {
      setIsCheckingExisting(false);
    }
  };

  const handleSelectExistingGuest = () => {
    if (existingGuest) {
      onGuestSelected?.(existingGuest.guest);
      onSuccess?.(existingGuest.guest);
    }
  };

  const handleCreateNewGuest = () => {
    setExistingGuest(null);
    setShowCreateForm(true);
  };

  const onSubmit = async (data: GuestQuickFormData) => {
    try {
      const guestData = {
        guest_name: data.guest_name,
        email: data.email?.trim() || null,
        phone_number: data.phone_number ? formatPhoneNumber(data.phone_number) : null,
      };

      const newGuest = await createGuestMutation.mutateAsync(guestData);
      toast.success("Guest registered successfully!");
      onSuccess?.(newGuest);
    } catch (error) {
      toast.error("Failed to register guest. Please try again.");
      console.error("Guest registration error:", error);
    }
  };

  const renderExistingGuestCard = () => {
    if (!existingGuest) return null;

    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-800">Guest Found!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium">Guest Information</h4>
              <div className="mt-2 space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {existingGuest.guest.guest_name}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {existingGuest.guest.email || "No email"}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {existingGuest.guest.phone_number || "No phone"}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-medium">Booking History</h4>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {existingGuest.totalBookings} previous booking
                    {existingGuest.totalBookings !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  Total spent: ₱{(existingGuest.guest.total_spent ?? 0).toLocaleString()}
                </div>
                {existingGuest.lastBookingDate && (
                  <div className="text-muted-foreground text-sm">
                    Last booking: {new Date(existingGuest.lastBookingDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-3">
            <Button onClick={handleSelectExistingGuest} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              Use This Guest
            </Button>
            <Button variant="outline" onClick={handleCreateNewGuest} className="flex-1">
              <UserPlus className="mr-2 h-4 w-4" />
              Create New Instead
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCreateForm = () => (
    <Card className={cn("border-blue-200 bg-blue-50", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {existingGuest ? "Create New Guest" : "Guest Registration"}
        </CardTitle>
        {existingGuest && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A guest with this email already exists. You can use the existing guest or create a new
              one.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input placeholder="Enter guest's full name" className="pl-10" {...field} />
                    </div>
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
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        type="email"
                        placeholder="guest@example.com"
                        className="pl-10"
                        {...field}
                      />
                      {isCheckingExisting && (
                        <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
                          <Search className="text-muted-foreground h-4 w-4 animate-spin" />
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>We'll check if this guest already exists</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        placeholder="+639123456789 or 09123456789"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Philippine mobile numbers only</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={createGuestMutation.isPending}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={createGuestMutation.isPending}
                className="min-w-[120px]"
              >
                {createGuestMutation.isPending ? "Registering..." : "Register Guest"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const renderLoadingSkeleton = () => (
    <Card className={cn("mx-auto w-full max-w-lg", className)}>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex justify-between pt-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
      </CardContent>
    </Card>
  );

  // Show loading state while checking existing guest
  if (isCheckingExisting && debouncedEmail && !existingGuest) {
    return (
      <div className={cn("mx-auto w-full max-w-lg", className)}>
        <Alert>
          <Search className="h-4 w-4" />
          <AlertDescription>
            Checking for existing guest with email: {debouncedEmail}
          </AlertDescription>
        </Alert>
        {renderLoadingSkeleton()}
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-lg space-y-4", className)}>
      {existingGuest && showExistingGuestOption && !showCreateForm && renderExistingGuestCard()}
      {(showCreateForm || !showExistingGuestOption) && renderCreateForm()}
    </div>
  );
}

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
