/**
 * ProjectSettingsPage Component
 * Comprehensive project/resort configuration page with Resort Information, Business Configuration,
 * Booking Policies, Payment Methods, and Room & Amenities sections
 */

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Building2,
  FileText,
  MapPin,
  Phone,
  Mail,
  Globe,
  CreditCard,
  Clock,
  Bed,
  Users,
  Save,
  Plus,
  Minus,
  Loader2,
  DollarSign,
  Receipt,
  Banknote,
  Smartphone,
  Building,
  Shield,
  Calendar,
  Timer,
  Percent,
  Info,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/stores/uiStore";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAsyncSubmit } from "@/hooks/useAsyncSubmit";
import { retryWithBackoff, simulateApiDelay } from "@/lib/api-utils";
import { mockProjectData } from "@/mocks/settings-data";

// Validation schemas
const resortInfoSchema = z.object({
  name: z.string().min(2, "Resort name must be at least 2 characters"),
  description: z.string().max(500, "Description must be less than 500 characters"),
  address: z.object({
    street: z.string().min(5, "Street address is required"),
    barangay: z.string().min(2, "Barangay is required"),
    city: z.string().min(2, "City is required"),
    province: z.string().min(2, "Province is required"),
    zipCode: z.string().min(4, "ZIP code must be at least 4 digits"),
  }),
  contactNumbers: z
    .array(z.string().regex(/^\+63\d{10}$/, "Invalid Philippine phone number"))
    .min(1, "At least one contact number is required"),
  email: z.string().email("Invalid email address"),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  socialMedia: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    youtube: z.string().optional(),
  }),
});

const businessConfigSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  tin: z.string().regex(/^\d{3}-\d{3}-\d{3}-\d{3}$/, "Invalid TIN format (XXX-XXX-XXX-XXX)"),
  businessPermitNumber: z.string().min(5, "Business permit number is required"),
  vatRegistered: z.boolean(),
  currency: z.string().default("PHP"),
});

const bookingPoliciesSchema = z.object({
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  advanceBookingDays: z
    .number()
    .min(1, "Must be at least 1 day")
    .max(365, "Cannot exceed 365 days"),
  minimumStayNights: z.number().min(1, "Must be at least 1 night"),
  cancellationPolicyHours: z
    .number()
    .min(1, "Must be at least 1 hour")
    .max(168, "Cannot exceed 168 hours (7 days)"),
  depositPercentage: z.number().min(0, "Cannot be negative").max(100, "Cannot exceed 100%"),
  lateCheckoutFee: z.number().min(0, "Cannot be negative"),
});

const paymentMethodsSchema = z.object({
  cash: z.boolean(),
  gcash: z.object({
    enabled: z.boolean(),
    merchantNumber: z.string().optional(),
  }),
  bankTransfer: z.object({
    enabled: z.boolean(),
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
  }),
  creditCard: z.object({
    enabled: z.boolean().default(false),
  }),
  defaultPaymentMethod: z.enum(["cash", "gcash", "bank_transfer"]),
});

const roomAmenitiesSchema = z.object({
  roomTypes: z
    .array(
      z.object({
        name: z.string().min(2, "Room type name is required"),
        baseRate: z.number().min(1, "Base rate must be greater than 0"),
        maxGuests: z.number().min(1, "Must accommodate at least 1 guest"),
        description: z.string().optional(),
      })
    )
    .min(1, "At least one room type is required"),
  amenities: z.object({
    wifi: z.boolean(),
    parking: z.boolean(),
    pool: z.boolean(),
    restaurant: z.boolean(),
    spa: z.boolean(),
    gym: z.boolean(),
    beachAccess: z.boolean(),
    laundry: z.boolean(),
    conferenceRoom: z.boolean(),
    petFriendly: z.boolean(),
  }),
});

type ResortInfoFormData = z.infer<typeof resortInfoSchema>;
type BusinessConfigFormData = z.infer<typeof businessConfigSchema>;
type BookingPoliciesFormData = z.infer<typeof bookingPoliciesSchema>;
type PaymentMethodsFormData = z.infer<typeof paymentMethodsSchema>;
type RoomAmenitiesFormData = z.infer<typeof roomAmenitiesSchema>;

// Use mock data from fixtures

export function ProjectSettingsPage() {
  const toast = useToast();

  // Resort Information Form
  const resortInfoForm = useForm<ResortInfoFormData>({
    resolver: zodResolver(resortInfoSchema),
    defaultValues: mockProjectData.resortInfo,
  });

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({
    control: resortInfoForm.control,
    name: "contactNumbers",
  });

  // Business Configuration Form
  const businessConfigForm = useForm<BusinessConfigFormData>({
    resolver: zodResolver(businessConfigSchema),
    defaultValues: mockProjectData.businessConfig,
  });

  // Booking Policies Form
  const bookingPoliciesForm = useForm<BookingPoliciesFormData>({
    resolver: zodResolver(bookingPoliciesSchema),
    defaultValues: mockProjectData.bookingPolicies,
  });

  // Payment Methods Form
  const paymentMethodsForm = useForm<PaymentMethodsFormData>({
    resolver: zodResolver(paymentMethodsSchema),
    defaultValues: mockProjectData.paymentMethods,
  });

  // Room & Amenities Form
  const roomAmenitiesForm = useForm<RoomAmenitiesFormData>({
    resolver: zodResolver(roomAmenitiesSchema),
    defaultValues: mockProjectData.roomAmenities,
  });

  const {
    fields: roomTypeFields,
    append: appendRoomType,
    remove: removeRoomType,
  } = useFieldArray({
    control: roomAmenitiesForm.control,
    name: "roomTypes",
  });

  // Form submission handlers using useAsyncSubmit
  const resortInfoSubmit = useAsyncSubmit<ResortInfoFormData>(
    async (data) => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Resort information updated successfully",
      errorMessage: "Failed to update resort information",
    }
  );

  const businessConfigSubmit = useAsyncSubmit<BusinessConfigFormData>(
    async (data) => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Business configuration updated successfully",
      errorMessage: "Failed to update business configuration",
    }
  );

  const bookingPoliciesSubmit = useAsyncSubmit<BookingPoliciesFormData>(
    async (data) => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Booking policies updated successfully",
      errorMessage: "Failed to update booking policies",
    }
  );

  const paymentMethodsSubmit = useAsyncSubmit<PaymentMethodsFormData>(
    async (data) => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Payment methods updated successfully",
      errorMessage: "Failed to update payment methods",
    }
  );

  const roomAmenitiesSubmit = useAsyncSubmit<RoomAmenitiesFormData>(
    async (data) => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Room types and amenities updated successfully",
      errorMessage: "Failed to update room types and amenities",
    }
  );

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-foreground text-3xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your resort properties and business settings
        </p>
      </div>

      <Tabs defaultValue="resort" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="resort" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Resort</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
          <TabsTrigger value="booking" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Booking</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Payment</span>
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <Bed className="h-4 w-4" />
            <span className="hidden sm:inline">Rooms</span>
          </TabsTrigger>
        </TabsList>

        {/* Resort Information Tab */}
        <TabsContent value="resort">
          <ErrorBoundary level="section" name="ResortInformation">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Resort Information
                </CardTitle>
                <CardDescription>Basic information about your resort property</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={resortInfoForm.handleSubmit(resortInfoSubmit.handleSubmit)}
                  className="space-y-6"
                >
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Resort/Property Name</Label>
                      <Input
                        id="name"
                        {...resortInfoForm.register("name")}
                        placeholder="Enter your resort name"
                      />
                      {resortInfoForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {resortInfoForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...resortInfoForm.register("description")}
                        placeholder="Describe your resort..."
                        className="min-h-[100px]"
                      />
                      {resortInfoForm.formState.errors.description && (
                        <p className="text-sm text-red-500">
                          {resortInfoForm.formState.errors.description.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <MapPin className="h-5 w-5" />
                      Address
                    </h3>

                    <div className="space-y-2">
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        {...resortInfoForm.register("address.street")}
                        placeholder="Street address, building name, unit number"
                      />
                      {resortInfoForm.formState.errors.address?.street && (
                        <p className="text-sm text-red-500">
                          {resortInfoForm.formState.errors.address.street.message}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="barangay">Barangay</Label>
                        <Input
                          id="barangay"
                          {...resortInfoForm.register("address.barangay")}
                          placeholder="Barangay name"
                        />
                        {resortInfoForm.formState.errors.address?.barangay && (
                          <p className="text-sm text-red-500">
                            {resortInfoForm.formState.errors.address.barangay.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">City/Municipality</Label>
                        <Input
                          id="city"
                          {...resortInfoForm.register("address.city")}
                          placeholder="City or municipality"
                        />
                        {resortInfoForm.formState.errors.address?.city && (
                          <p className="text-sm text-red-500">
                            {resortInfoForm.formState.errors.address.city.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="province">Province</Label>
                        <Input
                          id="province"
                          {...resortInfoForm.register("address.province")}
                          placeholder="Province"
                        />
                        {resortInfoForm.formState.errors.address?.province && (
                          <p className="text-sm text-red-500">
                            {resortInfoForm.formState.errors.address.province.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zipCode">ZIP Code</Label>
                        <Input
                          id="zipCode"
                          {...resortInfoForm.register("address.zipCode")}
                          placeholder="ZIP code"
                        />
                        {resortInfoForm.formState.errors.address?.zipCode && (
                          <p className="text-sm text-red-500">
                            {resortInfoForm.formState.errors.address.zipCode.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Phone className="h-5 w-5" />
                      Contact Information
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label>Contact Numbers</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendContact("+63")}
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Add Number
                          </Button>
                        </div>

                        {contactFields.map((field, index) => (
                          <div key={field.id} className="mb-2 flex items-center gap-2">
                            <Input
                              {...resortInfoForm.register(`contactNumbers.${index}`)}
                              placeholder="+639XXXXXXXXX"
                              className="flex-1"
                            />
                            {contactFields.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeContact(index)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {resortInfoForm.formState.errors.contactNumbers && (
                          <p className="text-sm text-red-500">
                            {resortInfoForm.formState.errors.contactNumbers.message}
                          </p>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            {...resortInfoForm.register("email")}
                            placeholder="info@yourresort.com"
                          />
                          {resortInfoForm.formState.errors.email && (
                            <p className="text-sm text-red-500">
                              {resortInfoForm.formState.errors.email.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="website">Website (optional)</Label>
                          <Input
                            id="website"
                            {...resortInfoForm.register("website")}
                            placeholder="https://yourresort.com"
                          />
                          {resortInfoForm.formState.errors.website && (
                            <p className="text-sm text-red-500">
                              {resortInfoForm.formState.errors.website.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Social Media */}
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-medium">Social Media</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Facebook className="h-4 w-4 text-blue-600" />
                            Facebook
                          </Label>
                          <Input
                            {...resortInfoForm.register("socialMedia.facebook")}
                            placeholder="@yourresort or facebook.com/yourresort"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Instagram className="h-4 w-4 text-pink-600" />
                            Instagram
                          </Label>
                          <Input
                            {...resortInfoForm.register("socialMedia.instagram")}
                            placeholder="@yourresort"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Twitter className="h-4 w-4 text-blue-500" />
                            Twitter
                          </Label>
                          <Input
                            {...resortInfoForm.register("socialMedia.twitter")}
                            placeholder="@yourresort"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Youtube className="h-4 w-4 text-red-600" />
                            YouTube
                          </Label>
                          <Input
                            {...resortInfoForm.register("socialMedia.youtube")}
                            placeholder="Your YouTube channel"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={resortInfoSubmit.isLoading}>
                      {resortInfoSubmit.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Resort Information
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        {/* Business Configuration Tab */}
        <TabsContent value="business">
          <ErrorBoundary level="section" name="BusinessConfiguration">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Business Configuration
                </CardTitle>
                <CardDescription>Legal business information and tax settings</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={businessConfigForm.handleSubmit(businessConfigSubmit.handleSubmit)}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Legal Business Name</Label>
                      <Input
                        id="businessName"
                        {...businessConfigForm.register("businessName")}
                        placeholder="Your registered business name"
                      />
                      {businessConfigForm.formState.errors.businessName && (
                        <p className="text-sm text-red-500">
                          {businessConfigForm.formState.errors.businessName.message}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tin">Tax Identification Number (TIN)</Label>
                        <Input
                          id="tin"
                          {...businessConfigForm.register("tin")}
                          placeholder="XXX-XXX-XXX-XXX"
                        />
                        {businessConfigForm.formState.errors.tin && (
                          <p className="text-sm text-red-500">
                            {businessConfigForm.formState.errors.tin.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessPermitNumber">Business Permit Number</Label>
                        <Input
                          id="businessPermitNumber"
                          {...businessConfigForm.register("businessPermitNumber")}
                          placeholder="Business permit number"
                        />
                        {businessConfigForm.formState.errors.businessPermitNumber && (
                          <p className="text-sm text-red-500">
                            {businessConfigForm.formState.errors.businessPermitNumber.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          VAT Registered
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          Is your business registered for Value Added Tax?
                        </p>
                      </div>
                      <Switch {...businessConfigForm.register("vatRegistered")} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">Default Currency</Label>
                      <Select
                        value={businessConfigForm.watch("currency")}
                        onValueChange={(value) => businessConfigForm.setValue("currency", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PHP">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Philippine Peso (�)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={businessConfigSubmit.isLoading}>
                      {businessConfigSubmit.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Business Configuration
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        {/* Booking Policies Tab */}
        <TabsContent value="booking">
          <ErrorBoundary level="section" name="BookingPolicies">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Booking Policies
                </CardTitle>
                <CardDescription>
                  Configure your resort's booking rules and policies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={bookingPoliciesForm.handleSubmit(bookingPoliciesSubmit.handleSubmit)}
                  className="space-y-6"
                >
                  {/* Check-in/Check-out Times */}
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Clock className="h-5 w-5" />
                      Check-in & Check-out Times
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="checkInTime">Check-in Time</Label>
                        <Input
                          id="checkInTime"
                          type="time"
                          {...bookingPoliciesForm.register("checkInTime")}
                        />
                        {bookingPoliciesForm.formState.errors.checkInTime && (
                          <p className="text-sm text-red-500">
                            {bookingPoliciesForm.formState.errors.checkInTime.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="checkOutTime">Check-out Time</Label>
                        <Input
                          id="checkOutTime"
                          type="time"
                          {...bookingPoliciesForm.register("checkOutTime")}
                        />
                        {bookingPoliciesForm.formState.errors.checkOutTime && (
                          <p className="text-sm text-red-500">
                            {bookingPoliciesForm.formState.errors.checkOutTime.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Booking Restrictions */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Timer className="h-5 w-5" />
                      Booking Restrictions
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="advanceBookingDays">Advance Booking Limit (days)</Label>
                        <Input
                          id="advanceBookingDays"
                          type="number"
                          min="1"
                          max="365"
                          {...bookingPoliciesForm.register("advanceBookingDays", {
                            valueAsNumber: true,
                          })}
                        />
                        {bookingPoliciesForm.formState.errors.advanceBookingDays && (
                          <p className="text-sm text-red-500">
                            {bookingPoliciesForm.formState.errors.advanceBookingDays.message}
                          </p>
                        )}
                        <p className="text-muted-foreground text-sm">
                          How far in advance guests can book
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="minimumStayNights">Minimum Stay (nights)</Label>
                        <Input
                          id="minimumStayNights"
                          type="number"
                          min="1"
                          {...bookingPoliciesForm.register("minimumStayNights", {
                            valueAsNumber: true,
                          })}
                        />
                        {bookingPoliciesForm.formState.errors.minimumStayNights && (
                          <p className="text-sm text-red-500">
                            {bookingPoliciesForm.formState.errors.minimumStayNights.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Policies */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Banknote className="h-5 w-5" />
                      Financial Policies
                    </h3>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="cancellationPolicyHours">Cancellation Policy (hours)</Label>
                        <Input
                          id="cancellationPolicyHours"
                          type="number"
                          min="1"
                          max="168"
                          {...bookingPoliciesForm.register("cancellationPolicyHours", {
                            valueAsNumber: true,
                          })}
                        />
                        {bookingPoliciesForm.formState.errors.cancellationPolicyHours && (
                          <p className="text-sm text-red-500">
                            {bookingPoliciesForm.formState.errors.cancellationPolicyHours.message}
                          </p>
                        )}
                        <p className="text-muted-foreground text-sm">
                          Hours before check-in for free cancellation
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="depositPercentage">Deposit Percentage (%)</Label>
                        <Input
                          id="depositPercentage"
                          type="number"
                          min="0"
                          max="100"
                          {...bookingPoliciesForm.register("depositPercentage", {
                            valueAsNumber: true,
                          })}
                        />
                        {bookingPoliciesForm.formState.errors.depositPercentage && (
                          <p className="text-sm text-red-500">
                            {bookingPoliciesForm.formState.errors.depositPercentage.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lateCheckoutFee">Late Checkout Fee (�)</Label>
                        <Input
                          id="lateCheckoutFee"
                          type="number"
                          min="0"
                          step="0.01"
                          {...bookingPoliciesForm.register("lateCheckoutFee", {
                            valueAsNumber: true,
                          })}
                        />
                        {bookingPoliciesForm.formState.errors.lateCheckoutFee && (
                          <p className="text-sm text-red-500">
                            {bookingPoliciesForm.formState.errors.lateCheckoutFee.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={bookingPoliciesSubmit.isLoading}>
                      {bookingPoliciesSubmit.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Booking Policies
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment">
          <ErrorBoundary level="section" name="PaymentMethods">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
                <CardDescription>
                  Configure accepted payment methods for your resort
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={paymentMethodsForm.handleSubmit(paymentMethodsSubmit.handleSubmit)}
                  className="space-y-6"
                >
                  {/* Available Payment Methods */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Available Payment Methods</h3>

                    {/* Cash */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="font-medium">Cash</p>
                          <p className="text-muted-foreground text-sm">Accept cash payments</p>
                        </div>
                      </div>
                      <Switch {...paymentMethodsForm.register("cash")} />
                    </div>

                    {/* GCash */}
                    <div className="rounded-lg border">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-8 w-8 text-blue-600" />
                          <div>
                            <p className="font-medium">GCash</p>
                            <p className="text-muted-foreground text-sm">Digital wallet payments</p>
                          </div>
                        </div>
                        <Switch {...paymentMethodsForm.register("gcash.enabled")} />
                      </div>

                      {paymentMethodsForm.watch("gcash.enabled") && (
                        <div className="bg-muted/50 border-t px-4 pb-4">
                          <div className="mt-4 space-y-2">
                            <Label htmlFor="gcashMerchant">GCash Merchant Number</Label>
                            <Input
                              id="gcashMerchant"
                              {...paymentMethodsForm.register("gcash.merchantNumber")}
                              placeholder="09XXXXXXXXX"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bank Transfer */}
                    <div className="rounded-lg border">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <Building className="h-8 w-8 text-purple-600" />
                          <div>
                            <p className="font-medium">Bank Transfer</p>
                            <p className="text-muted-foreground text-sm">Direct bank transfers</p>
                          </div>
                        </div>
                        <Switch {...paymentMethodsForm.register("bankTransfer.enabled")} />
                      </div>

                      {paymentMethodsForm.watch("bankTransfer.enabled") && (
                        <div className="bg-muted/50 border-t px-4 pb-4">
                          <div className="mt-4 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="bankName">Bank Name</Label>
                              <Input
                                id="bankName"
                                {...paymentMethodsForm.register("bankTransfer.bankName")}
                                placeholder="e.g., BDO Unibank"
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="accountName">Account Name</Label>
                                <Input
                                  id="accountName"
                                  {...paymentMethodsForm.register("bankTransfer.accountName")}
                                  placeholder="Account holder name"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="accountNumber">Account Number</Label>
                                <Input
                                  id="accountNumber"
                                  {...paymentMethodsForm.register("bankTransfer.accountNumber")}
                                  placeholder="Account number"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Credit Card (Coming Soon) */}
                    <div className="bg-muted/50 flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-8 w-8 text-gray-400" />
                        <div>
                          <p className="text-muted-foreground font-medium">Credit Card</p>
                          <p className="text-muted-foreground text-sm">
                            Visa, MasterCard, etc. (Coming Soon)
                          </p>
                        </div>
                      </div>
                      <Switch disabled checked={false} />
                    </div>
                  </div>

                  {/* Default Payment Method */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">Default Payment Method</h3>
                    <div className="space-y-2">
                      <Label>Preferred Payment Method</Label>
                      <Select
                        value={paymentMethodsForm.watch("defaultPaymentMethod")}
                        onValueChange={(value: "cash" | "gcash" | "bank_transfer") =>
                          paymentMethodsForm.setValue("defaultPaymentMethod", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="gcash">GCash</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-sm">
                        This will be pre-selected when creating new bookings
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={paymentMethodsSubmit.isLoading}>
                      {paymentMethodsSubmit.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Payment Methods
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        {/* Room Types & Amenities Tab */}
        <TabsContent value="rooms">
          <ErrorBoundary level="section" name="RoomTypesAmenities">
            <div className="space-y-4">
              {/* Room Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bed className="h-5 w-5" />
                    Room Types
                  </CardTitle>
                  <CardDescription>Configure your available room types and rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={roomAmenitiesForm.handleSubmit(roomAmenitiesSubmit.handleSubmit)}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Room Types</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            appendRoomType({ name: "", baseRate: 0, maxGuests: 1, description: "" })
                          }
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add Room Type
                        </Button>
                      </div>

                      {roomTypeFields.map((field, index) => (
                        <div key={field.id} className="space-y-4 rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Room Type #{index + 1}</h4>
                            {roomTypeFields.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeRoomType(index)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor={`roomName${index}`}>Room Name</Label>
                              <Input
                                id={`roomName${index}`}
                                {...roomAmenitiesForm.register(`roomTypes.${index}.name`)}
                                placeholder="e.g., Standard Room"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`baseRate${index}`}>Base Rate (�/night)</Label>
                              <Input
                                id={`baseRate${index}`}
                                type="number"
                                min="1"
                                step="0.01"
                                {...roomAmenitiesForm.register(`roomTypes.${index}.baseRate`, {
                                  valueAsNumber: true,
                                })}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`maxGuests${index}`}>Max Guests</Label>
                              <Input
                                id={`maxGuests${index}`}
                                type="number"
                                min="1"
                                {...roomAmenitiesForm.register(`roomTypes.${index}.maxGuests`, {
                                  valueAsNumber: true,
                                })}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`description${index}`}>Description (optional)</Label>
                            <Input
                              id={`description${index}`}
                              {...roomAmenitiesForm.register(`roomTypes.${index}.description`)}
                              placeholder="Brief description of the room"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={roomAmenitiesSubmit.isLoading}>
                        {roomAmenitiesSubmit.isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Room Types & Amenities
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Amenities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Resort Amenities
                  </CardTitle>
                  <CardDescription>Select the amenities available at your resort</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Free WiFi
                      </Label>
                      <Switch {...roomAmenitiesForm.register("amenities.wifi")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Free Parking
                      </Label>
                      <Switch {...roomAmenitiesForm.register("amenities.parking")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Swimming Pool</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.pool")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Restaurant</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.restaurant")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Spa Services</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.spa")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Fitness Center</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.gym")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Beach Access</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.beachAccess")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Laundry Service</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.laundry")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Conference Room</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.conferenceRoom")} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Pet Friendly</Label>
                      <Switch {...roomAmenitiesForm.register("amenities.petFriendly")} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
