import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import DOMPurify from "dompurify";
import { Calendar, CreditCard, Mail, Phone, Upload, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { adaptUnitFromDB } from "@/lib/database-adapters";
import { transformToAPIFormat, validateAPIResponse } from "@/lib/schema-transform";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/validations";
import { compressAndValidateFile } from "@/utils/file-compression";
import { calculatePricing } from "@/utils/pricing";

import { FileUploadField } from "./FileUploadField";

// Form validation schema
const guestBookingSchema = z
  .object({
    // Guest Information
    guest_name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name too long")
      .transform((val) => DOMPurify.sanitize(val)),

    email: z.string().email("Invalid email address").toLowerCase(),

    phone_number: z
      .string()
      .regex(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/,
        "Invalid phone number format"
      ),

    // Booking Details
    unit_id: z.string().uuid("Please select a unit"),
    check_in: z.date().min(new Date(), "Check-in must be in the future"),
    check_out: z.date(),
    num_guests: z.number().min(1, "At least 1 guest required").max(20, "Maximum 20 guests"),

    // Optional
    special_requests: z
      .string()
      .max(500, "Maximum 500 characters")
      .optional()
      .transform((val) => (val ? DOMPurify.sanitize(val) : undefined)),

    // File (reduced for free tier bandwidth optimization)
    payment_proof: z
      .instanceof(File)
      .refine((file) => file.size <= 2 * 1024 * 1024, "File must be less than 2MB")
      .refine(
        (file) => ["image/jpeg", "image/png", "image/jpg", "application/pdf"].includes(file.type),
        "Only JPG, PNG, and PDF files are allowed"
      ),
  })
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

type GuestBookingFormData = z.infer<typeof guestBookingSchema>;

interface GuestBookingFormProps {
  onSuccess?: (bookingReference: string) => void;
}

export function GuestBookingForm({ onSuccess }: GuestBookingFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bookingReference, setBookingReference] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Fetch units using TanStack Query
  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("unit_name");
      if (error) throw error;
      return data || [];
    },
  });

  const form = useForm<GuestBookingFormData>({
    resolver: zodResolver(guestBookingSchema),
    defaultValues: {
      guest_name: "",
      email: "",
      phone_number: "",
      unit_id: "",
      check_in: new Date(),
      check_out: new Date(Date.now() + 86400000), // Tomorrow
      num_guests: 2,
      special_requests: "",
    },
  });

  const selectedUnit = units.find((u) => u.unit_id === form.watch("unit_id"));

  // Calculate total amount using existing pricing utility
  const calculateTotal = () => {
    if (!selectedUnit) return 0;

    const checkIn = form.watch("check_in");
    const checkOut = form.watch("check_out");
    const numGuests = form.watch("num_guests");

    if (!checkIn || !checkOut) return 0;

    // Adapt database unit type before pricing calculation
    const adaptedUnit = adaptUnitFromDB(selectedUnit);
    const pricing = calculatePricing(adaptedUnit, {
      checkIn,
      checkOut,
      guestCount: numGuests,
    });

    return pricing.totalAmount;
  };

  const onSubmit = async (data: GuestBookingFormData) => {
    if (!turnstileToken) {
      toast.error("Please complete the CAPTCHA verification.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Step 1: Compress and validate file
      setUploadProgress(5);
      const processedFile = await compressAndValidateFile(data.payment_proof);

      // Step 2: Transform data to API format
      setUploadProgress(10);
      const apiData = transformToAPIFormat({ ...data, payment_proof: processedFile });

      // Step 3: Submit booking data to API
      setUploadProgress(20);
      const response = await fetch("/api/guest-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...apiData,
          turnstile_token: turnstileToken,
        }),
      });

      if (!response.ok) {
        const error: unknown = await response.json();
        const errorMsg =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to create booking";
        throw new Error(errorMsg);
      }

      const result = await response.json();
      const validatedResult = validateAPIResponse(result);

      setUploadProgress(30);
      setBookingReference(validatedResult.booking.booking_reference);

      // Step 4: Upload file using token-based signed URL (Supabase SDK method)
      setUploadProgress(40);
      const { data: _uploadData, error: uploadError } = await supabase.storage
        .from(validatedResult.upload.bucket)
        .uploadToSignedUrl(
          validatedResult.upload.path,
          validatedResult.upload.token,
          processedFile,
          {
            contentType: processedFile.type,
          }
        );

      if (uploadError) {
        throw new Error("Failed to upload payment proof: " + uploadError.message);
      }

      // Step 5: Confirm upload completion
      setUploadProgress(90);
      const confirmResponse = await fetch("/api/guest-booking/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id: validatedResult.booking.booking_id,
          file_path: validatedResult.upload.path,
          file_size: processedFile.size,
        }),
      });

      if (!confirmResponse.ok) {
        console.error("Failed to confirm upload, but booking was created");
      }

      setUploadProgress(100);

      // Success!
      toast.success(
        `Booking created successfully! Reference: ${validatedResult.booking.booking_reference}`
      );

      if (onSuccess) {
        onSuccess(validatedResult.booking.booking_reference);
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create booking");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (bookingReference) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-green-600">Booking Confirmed!</CardTitle>
          <CardDescription>Your booking has been successfully created</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Booking Reference:</strong> {bookingReference}
              </AlertDescription>
            </Alert>

            <p className="text-muted-foreground text-sm">
              We've sent a confirmation email to {form.getValues("email")}. Please check your inbox
              for booking details and next steps.
            </p>

            <div className="flex gap-4">
              <Button
                onClick={() =>
                  navigate({
                    to: "/check-booking",
                    search: { ref: bookingReference || "" },
                  })
                }
              >
                Check Booking Status
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setBookingReference(null);
                  form.reset();
                  turnstileRef.current?.reset();
                  setTurnstileToken(null);
                }}
              >
                Make Another Booking
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Guest Information Section */}
        <Card>
          <CardHeader>
            <CardTitle>Guest Information</CardTitle>
            <CardDescription>Please provide your contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} disabled={isSubmitting} />
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
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          className="pl-10"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </div>
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                        <Input
                          type="tel"
                          placeholder="+63 912 345 6789"
                          className="pl-10"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Booking Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Select your unit and dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Unit</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units
                        .filter((u) => u.unit_status === "Available")
                        .map((unit) => (
                          <SelectItem key={unit.unit_id} value={unit.unit_id}>
                            <div className="flex w-full items-center justify-between">
                              <span>{unit.unit_name}</span>
                              <span className="text-muted-foreground ml-2 text-sm">
                                {formatCurrency(unit.base_rate)}/night
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedUnit && (
                    <FormDescription>
                      {selectedUnit.unit_type} • Capacity: {selectedUnit.base_occupancy}-
                      {selectedUnit.max_occupancy} guests
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="check_in"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-in Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                        <Input
                          type="date"
                          className="pl-10"
                          {...field}
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                          min={format(new Date(), "yyyy-MM-dd")}
                          disabled={isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="check_out"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-out Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                        <Input
                          type="date"
                          className="pl-10"
                          {...field}
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                          min={format(
                            new Date(form.watch("check_in").getTime() + 86400000),
                            "yyyy-MM-dd"
                          )}
                          disabled={isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="num_guests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Guests</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Users className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                      <Input
                        type="number"
                        min={1}
                        max={selectedUnit?.max_occupancy || 20}
                        className="pl-10"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        disabled={isSubmitting}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="special_requests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requests (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special requirements or requests..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>Maximum 500 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Payment Proof Section */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Proof</CardTitle>
            <CardDescription>Upload your payment receipt or proof of transfer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedUnit && (
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  <strong>Total Amount Due: </strong>
                  {formatCurrency(calculateTotal())}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="payment_proof"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Upload Payment Proof</FormLabel>
                  <FormControl>
                    <FileUploadField
                      onChange={onChange}
                      value={value}
                      disabled={isSubmitting}
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                      maxSize={2 * 1024 * 1024}
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>JPG, PNG or PDF files up to 2MB</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit Section */}
        <Card>
          <CardContent className="pt-6">
            {isSubmitting && (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing booking...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* Cloudflare Turnstile Widget */}
            <div className="mb-4 flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ""}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
                options={{
                  theme: "light",
                  size: "normal",
                }}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !turnstileToken}
            >
              {isSubmitting ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Booking
                </>
              )}
            </Button>

            <p className="text-muted-foreground mt-2 text-center text-xs">
              By submitting, you agree to our{" "}
              <Link
                to="/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline transition-colors"
              >
                terms and conditions
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
