import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Search, Calendar, CreditCard, MapPin } from "lucide-react";
import { format } from "date-fns";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { formatCurrency } from "@/lib/validations";
import { validateStatusResponse, type StatusResponse } from "@/lib/schema-transform";

const searchSchema = z.object({
  booking_reference: z.string().min(1, "Booking reference is required"),
  email: z.string().email("Valid email is required"),
});

type SearchFormData = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/check-booking")({
  component: CheckBookingPage,
});

function CheckBookingPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [booking, setBooking] = useState<StatusResponse | null>(null);
  const [notFound, setNotFound] = useState(false);

  const form = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      booking_reference: "",
      email: "",
    },
  });

  const onSubmit = async (data: SearchFormData) => {
    setIsSearching(true);
    setBooking(null);
    setNotFound(false);

    try {
      const response = await fetch("/api/guest-booking/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.status === 404) {
        setNotFound(true);
        return;
      }

      if (!response.ok) {
        const errorData: any = await response.json();
        throw new Error(errorData.message || "Failed to fetch booking details");
      }

      const bookingData = await response.json();
      const validatedData = validateStatusResponse(bookingData);
      setBooking(validatedData);
    } catch (error: unknown) {
      console.error("Search error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to retrieve booking. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "completed":
      case "checkedin":
      case "checkedout":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
      case "refunded":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Check Booking Status</h1>
          <p className="text-muted-foreground">
            Enter your booking reference and email to view details
          </p>
        </div>

        {/* Search Form */}
        <Card className="max-w-md mx-auto mb-8">
          <CardHeader>
            <CardTitle>Find Your Booking</CardTitle>
            <CardDescription>Use the details from your confirmation email</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="booking_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Booking Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="BK-2025-ABCD" {...field} disabled={isSearching} />
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
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                          disabled={isSearching}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSearching}>
                  {isSearching ? (
                    <>Searching...</>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search Booking
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Search Results */}
        {isSearching && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-8">
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        )}

        {notFound && (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                No booking found with the provided details.
              </p>
              <p className="text-sm">Please check your booking reference and email address.</p>
            </CardContent>
          </Card>
        )}

        {booking && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Booking Details</CardTitle>
                  <CardDescription>Reference: {booking.booking_reference}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant={getStatusVariant(booking.booking_status)}>
                    {booking.booking_status}
                  </Badge>
                  <Badge variant={getStatusVariant(booking.payment_status)}>
                    {booking.payment_status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {/* Unit Details */}
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{booking.unit.unit_name}</p>
                    <p className="text-sm text-muted-foreground">{booking.unit.unit_type}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Check-in / Check-out</p>
                    <p className="font-medium">
                      {formatDate(booking.check_in)} - {formatDate(booking.check_out)}
                    </p>
                  </div>
                </div>

                {/* Payment */}
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="font-medium text-lg">{formatCurrency(booking.total_amount)}</p>
                  </div>
                </div>

                {/* Status Messages */}
                {booking.payment_status === "Pending" && (
                  <Alert>
                    <AlertDescription>
                      Your payment is being verified. You will receive a confirmation email once the
                      payment is confirmed.
                    </AlertDescription>
                  </Alert>
                )}

                {booking.booking_status === "Confirmed" && (
                  <Alert>
                    <AlertDescription>
                      Your booking is confirmed! We look forward to welcoming you.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
