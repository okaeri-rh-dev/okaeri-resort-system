# Frontend Implementation Guide

## Overview

This guide covers the client-side implementation of the guest booking system, including the booking form, file upload handling, and guest portal.

## Component Architecture

```mermaid
graph TD
    A[GuestBookingPage] --> B[GuestBookingForm]
    B --> C[FileUploadField]
    B --> D[GuestDetailsSection]
    B --> E[BookingDetailsSection]
    B --> F[PaymentProofSection]

    G[StatusCheckPage] --> H[BookingStatusForm]
    G --> I[BookingDetailsDisplay]

    C --> J[UploadProgressBar]
    C --> K[FilePreview]
```

## Core Components Implementation

### 1. Guest Booking Form Component

**File**: `src/components/bookings/GuestBookingForm.tsx`

```typescript
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { Upload, Calendar, Users, Mail, Phone, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

import { FileUploadField } from './FileUploadField';
import { useUnits } from '@/stores/useUnitStore';
import { formatCurrency } from '@/lib/validations';

// Form validation schema
const guestBookingSchema = z.object({
  // Guest Information
  guest_name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .transform(val => DOMPurify.sanitize(val)),

  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),

  phone_number: z.string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/,
      'Invalid phone number format'),

  // Booking Details
  unit_id: z.string().uuid('Please select a unit'),
  check_in: z.date().min(new Date(), 'Check-in must be in the future'),
  check_out: z.date(),
  num_guests: z.number()
    .min(1, 'At least 1 guest required')
    .max(20, 'Maximum 20 guests'),

  // Optional
  special_requests: z.string()
    .max(500, 'Maximum 500 characters')
    .optional()
    .transform(val => val ? DOMPurify.sanitize(val) : undefined),

  // File
  payment_proof: z.instanceof(File)
    .refine(file => file.size <= 5 * 1024 * 1024, 'File must be less than 5MB')
    .refine(
      file => ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type),
      'Only JPG, PNG, and PDF files are allowed'
    ),
}).refine(
  data => data.check_out > data.check_in,
  {
    message: 'Check-out must be after check-in',
    path: ['check_out'],
  }
);

type GuestBookingFormData = z.infer<typeof guestBookingSchema>;

interface GuestBookingFormProps {
  onSuccess?: (bookingReference: string) => void;
}

export function GuestBookingForm({ onSuccess }: GuestBookingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bookingReference, setBookingReference] = useState<string | null>(null);

  const { executeRecaptcha } = useGoogleReCaptcha();
  const { data: units = [] } = useUnits();

  const form = useForm<GuestBookingFormData>({
    resolver: zodResolver(guestBookingSchema),
    defaultValues: {
      guest_name: '',
      email: '',
      phone_number: '',
      unit_id: '',
      check_in: new Date(),
      check_out: new Date(Date.now() + 86400000), // Tomorrow
      num_guests: 2,
      special_requests: '',
    },
  });

  const selectedUnit = units.find(u => u.unit_id === form.watch('unit_id'));

  // Calculate total amount
  const calculateTotal = () => {
    if (!selectedUnit) return 0;

    const checkIn = form.watch('check_in');
    const checkOut = form.watch('check_out');
    const numGuests = form.watch('num_guests');

    if (!checkIn || !checkOut) return 0;

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    const baseTotal = nights * selectedUnit.base_rate;
    const extraPersonCharges = Math.max(0, numGuests - selectedUnit.base_occupancy)
      * selectedUnit.extra_person_rate * nights;

    return baseTotal + extraPersonCharges;
  };

  const onSubmit = async (data: GuestBookingFormData) => {
    if (!executeRecaptcha) {
      toast.error('CAPTCHA not loaded. Please refresh the page.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Step 1: Get CAPTCHA token
      const captchaToken = await executeRecaptcha('guest_booking');

      // Step 2: Submit booking data to API
      setUploadProgress(10);

      const formData = {
        ...data,
        captcha_token: captchaToken,
        file_name: data.payment_proof.name,
        file_type: data.payment_proof.type,
        file_size: data.payment_proof.size,
      };

      const response = await fetch('/api/guest-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create booking');
      }

      const result = await response.json();

      setUploadProgress(30);
      setBookingReference(result.booking.booking_reference);

      // Step 3: Upload file to Supabase using signed URL
      const uploadResponse = await uploadFileWithProgress(
        data.payment_proof,
        result.upload.url,
        (progress) => setUploadProgress(30 + progress * 0.6) // 30-90%
      );

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload payment proof');
      }

      // Step 4: Confirm upload completion
      setUploadProgress(90);

      const confirmResponse = await fetch('/api/guest-booking/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: result.booking.booking_id,
          file_path: result.upload.path,
          file_size: data.payment_proof.size,
        }),
      });

      if (!confirmResponse.ok) {
        console.error('Failed to confirm upload, but booking was created');
      }

      setUploadProgress(100);

      // Success!
      toast.success(
        `Booking created successfully! Reference: ${result.booking.booking_reference}`
      );

      if (onSuccess) {
        onSuccess(result.booking.booking_reference);
      }

    } catch (error) {
      console.error('Booking error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create booking'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to upload file with progress tracking
  async function uploadFileWithProgress(
    file: File,
    url: string,
    onProgress: (progress: number) => void
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = event.loaded / event.total;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        resolve(new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
        }));
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('Cache-Control', 'max-age=3600');
      xhr.send(file);
    });
  }

  if (bookingReference) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-green-600">Booking Confirmed!</CardTitle>
          <CardDescription>
            Your booking has been successfully created
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Booking Reference:</strong> {bookingReference}
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground">
              We've sent a confirmation email to {form.getValues('email')}.
              Please check your inbox for booking details and next steps.
            </p>

            <div className="flex gap-4">
              <Button
                onClick={() => window.location.href = `/check-booking?ref=${bookingReference}`}
              >
                Check Booking Status
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setBookingReference(null);
                  form.reset();
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
            <CardDescription>
              Please provide your contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
            <CardDescription>
              Select your unit and dates
            </CardDescription>
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
                      {units.filter(u => u.unit_status === 'Available').map((unit) => (
                        <SelectItem key={unit.unit_id} value={unit.unit_id}>
                          <div className="flex justify-between items-center w-full">
                            <span>{unit.unit_name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {formatCurrency(unit.base_rate)}/night
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUnit && (
                    <FormDescription>
                      {selectedUnit.unit_type} •
                      Capacity: {selectedUnit.base_occupancy}-{selectedUnit.max_occupancy} guests
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="check_in"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-in Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          className="pl-10"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                          min={format(new Date(), 'yyyy-MM-dd')}
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
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          className="pl-10"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                          min={format(
                            new Date(form.watch('check_in').getTime() + 86400000),
                            'yyyy-MM-dd'
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
                      <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                  <FormDescription>
                    Maximum 500 characters
                  </FormDescription>
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
            <CardDescription>
              Upload your payment receipt or proof of transfer
            </CardDescription>
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
                      maxSize={5 * 1024 * 1024}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    JPG, PNG or PDF files up to 5MB
                  </FormDescription>
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

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
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

            <p className="text-xs text-center text-muted-foreground mt-4">
              By submitting, you agree to our terms and conditions.
              This site is protected by reCAPTCHA.
            </p>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
```

### 2. File Upload Component

**File**: `src/components/bookings/FileUploadField.tsx`

```typescript
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploadFieldProps {
  onChange: (file: File | null) => void;
  value?: File | null;
  disabled?: boolean;
  accept?: string;
  maxSize?: number;
  name?: string;
}

export function FileUploadField({
  onChange,
  value,
  disabled = false,
  accept = 'image/*,application/pdf',
  maxSize = 5 * 1024 * 1024, // 5MB
  name,
}: FileUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError(`File is too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Invalid file type. Please upload a JPG, PNG, or PDF file.');
        } else {
          setError('Failed to upload file. Please try again.');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        onChange(file);

        // Generate preview for images
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          setPreview(null);
        }
      }
    },
    [onChange, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(',').reduce((acc, type) => {
      if (type === 'image/*') {
        acc['image/jpeg'] = [];
        acc['image/png'] = [];
        acc['image/jpg'] = [];
      } else if (type === 'application/pdf') {
        acc['application/pdf'] = [];
      } else {
        acc[type] = [];
      }
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    maxFiles: 1,
    disabled,
  });

  const removeFile = () => {
    onChange(null);
    setPreview(null);
    setError(null);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-8 w-8" />;
    }
    return <FileText className="h-8 w-8" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="border rounded-lg p-4">
          <div className="flex items-start gap-4">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded"
              />
            ) : (
              <div className="w-20 h-20 flex items-center justify-center bg-muted rounded">
                {getFileIcon(value)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(value.size)}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removeFile}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive && 'border-primary bg-primary/5',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-destructive'
          )}
        >
          <input {...getInputProps()} name={name} />

          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />

          <p className="text-sm font-medium mb-1">
            {isDragActive
              ? 'Drop the file here'
              : 'Drag & drop your file here, or click to browse'}
          </p>

          <p className="text-xs text-muted-foreground">
            JPG, PNG or PDF up to {maxSize / 1024 / 1024}MB
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### 3. Guest Booking Page

**File**: `src/routes/guest-booking.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { GuestBookingForm } from '@/components/bookings/GuestBookingForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

export const Route = createFileRoute('/guest-booking')({
  component: GuestBookingPage,
});

function GuestBookingPage() {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (!recaptchaSiteKey) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            CAPTCHA configuration is missing. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={recaptchaSiteKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
        nonce: undefined,
      }}
    >
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto py-8 px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Book Your Stay</h1>
            <p className="text-muted-foreground">
              Complete the form below to make a reservation
            </p>
          </div>

          {/* Info Banner */}
          <Card className="max-w-2xl mx-auto mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <InfoIcon className="h-5 w-5" />
                Booking Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>• No account required - book as a guest</li>
                <li>• Upload your payment proof securely</li>
                <li>• Receive instant booking confirmation via email</li>
                <li>• Track your booking status with the reference number</li>
                <li>• Payment verification usually within 24 hours</li>
              </ul>
            </CardContent>
          </Card>

          {/* Booking Form */}
          <GuestBookingForm
            onSuccess={(bookingReference) => {
              // Optionally redirect to success page
              console.log('Booking created:', bookingReference);
            }}
          />
        </div>
      </div>
    </GoogleReCaptchaProvider>
  );
}
```

### 4. Booking Status Check Page

**File**: `src/routes/check-booking.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Search, Calendar, CreditCard, MapPin } from 'lucide-react';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCurrency, formatTableDate } from '@/lib/validations';

const searchSchema = z.object({
  booking_reference: z.string().min(1, 'Booking reference is required'),
  email: z.string().email('Valid email is required'),
});

type SearchFormData = z.infer<typeof searchSchema>;

interface BookingDetails {
  booking_id: string;
  booking_reference: string;
  booking_status: string;
  payment_status: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  unit: {
    unit_name: string;
    unit_type: string;
  };
}

export const Route = createFileRoute('/check-booking')({
  component: CheckBookingPage,
});

function CheckBookingPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [notFound, setNotFound] = useState(false);

  const form = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      booking_reference: '',
      email: '',
    },
  });

  const onSubmit = async (data: SearchFormData) => {
    setIsSearching(true);
    setBooking(null);
    setNotFound(false);

    try {
      const response = await fetch(`/api/guest-booking/status?${new URLSearchParams(data)}`);

      if (response.status === 404) {
        setNotFound(true);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch booking details');
      }

      const bookingData = await response.json();
      setBooking(bookingData);

    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to retrieve booking. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Confirmed':
      case 'Completed':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Cancelled':
      case 'Refunded':
        return 'destructive';
      default:
        return 'outline';
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
            <CardDescription>
              Use the details from your confirmation email
            </CardDescription>
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
                        <Input
                          placeholder="BK-20250101-ABCD"
                          {...field}
                          disabled={isSearching}
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSearching}
                >
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
              <p className="text-sm">
                Please check your booking reference and email address.
              </p>
            </CardContent>
          </Card>
        )}

        {booking && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Booking Details</CardTitle>
                  <CardDescription>
                    Reference: {booking.booking_reference}
                  </CardDescription>
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
                    <p className="text-sm text-muted-foreground">
                      {booking.unit.unit_type}
                    </p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Check-in / Check-out</p>
                    <p className="font-medium">
                      {formatTableDate(booking.check_in)} - {formatTableDate(booking.check_out)}
                    </p>
                  </div>
                </div>

                {/* Payment */}
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="font-medium text-lg">
                      {formatCurrency(booking.total_amount)}
                    </p>
                  </div>
                </div>

                {/* Status Messages */}
                {booking.payment_status === 'Pending' && (
                  <Alert>
                    <AlertDescription>
                      Your payment is being verified. You will receive a confirmation
                      email once the payment is confirmed.
                    </AlertDescription>
                  </Alert>
                )}

                {booking.booking_status === 'Confirmed' && (
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
```

## Mobile Responsiveness

All components use Tailwind's responsive utilities:

- `sm:` - Small screens (640px+)
- `md:` - Medium screens (768px+)
- `lg:` - Large screens (1024px+)
- `xl:` - Extra large screens (1280px+)

Key responsive patterns:

- Grid columns stack on mobile
- Cards have appropriate padding
- Forms are single column on mobile
- Buttons are full width on small screens

## Error Handling

### Network Errors

```typescript
try {
  const response = await fetch("/api/guest-booking");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Request failed");
  }
} catch (error) {
  if (error instanceof TypeError) {
    // Network error
    toast.error("Network error. Please check your connection.");
  } else {
    toast.error(error.message);
  }
}
```

### Validation Errors

```typescript
form.setError("email", {
  type: "manual",
  message: "This email is already in use",
});
```

### Upload Errors

```typescript
xhr.addEventListener("error", () => {
  toast.error("Upload failed. Please try again.");
});

xhr.addEventListener("timeout", () => {
  toast.error("Upload timed out. Please try a smaller file.");
});
```

## Testing

### Component Testing

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuestBookingForm } from './GuestBookingForm';

describe('GuestBookingForm', () => {
  it('should validate required fields', async () => {
    render(<GuestBookingForm />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('should handle file upload', async () => {
    render(<GuestBookingForm />);

    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload payment proof/i);

    await userEvent.upload(input, file);

    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
  });
});
```

---

_Document Version: 1.0.0_
_Last Updated: January 2025_
