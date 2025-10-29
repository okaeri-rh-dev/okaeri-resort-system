import React, { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
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
import { NumberInput } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, paymentUploadSchema, type PaymentUploadData } from "@/lib/validations";
import { useUploadPaymentProof } from "@/stores/useBookingStore";

interface PaymentUploadFormProps {
  bookingId: string;
  bookingAmount: number;
  onSuccess?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
  className?: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export function PaymentUploadForm({
  bookingId,
  bookingAmount,
  onSuccess,
  onCancel,
  className,
}: PaymentUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadPaymentProof();

  const form = useForm<PaymentUploadData>({
    resolver: zodResolver(paymentUploadSchema),
    defaultValues: {
      booking_id: bookingId,
      payment_amount: bookingAmount,
      payment_method: "GCash",
      notes: "",
    },
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const validateFile = (file: File): string | null => {
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return "File size must be less than 5MB";
    }

    // Check file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      return "Only PNG, JPG, and JPEG files are allowed";
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setSelectedFile(file);
    form.setValue("payment_proof", file, { shouldValidate: true });

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setValue("payment_proof", undefined as any, { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const simulateProgress = (onComplete: () => void) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploadProgress({ loaded: 100, total: 100, percentage: 100 });
        setTimeout(onComplete, 500);
      } else {
        setUploadProgress({
          loaded: progress,
          total: 100,
          percentage: Math.round(progress),
        });
      }
    }, 200);
  };

  const onSubmit = async (data: PaymentUploadData) => {
    if (!selectedFile) {
      toast.error("Please select a payment proof file");
      return;
    }

    try {
      // Start upload progress simulation
      setUploadProgress({ loaded: 0, total: 100, percentage: 0 });

      simulateProgress(async () => {
        try {
          await uploadMutation.mutateAsync({
            bookingId: data.booking_id,
            file: selectedFile,
          });

          toast.success("Payment proof uploaded successfully!");
          onSuccess?.(data);
        } catch (error) {
          toast.error("Failed to upload payment proof. Please try again.");
          setUploadProgress(null);
        }
      });
    } catch (error) {
      toast.error("Failed to upload payment proof. Please try again.");
      setUploadProgress(null);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="h-8 w-8 text-blue-500" />;
    }
    return <FileText className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card className={cn("mx-auto w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Upload Payment Proof
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Booking Information */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Booking ID:</span>
                    <p className="text-muted-foreground">{bookingId}</p>
                  </div>
                  <div>
                    <span className="font-medium">Amount:</span>
                    <p className="text-muted-foreground">{formatCurrency(bookingAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Selection */}
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Credit/Debit Card</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Amount */}
            <FormField
              control={form.control}
              name="payment_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount</FormLabel>
                  <FormControl>
                    <NumberInput
                      min={100}
                      max={1000000}
                      allowDecimals={true}
                      placeholder="0.00"
                      startIcon={<span className="text-sm font-medium">₱</span>}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      onBlur={(value) => {
                        field.onChange(value || 100); // Set minimum on blur
                        field.onBlur();
                      }}
                    />
                  </FormControl>
                  <FormDescription>Amount in Philippine Pesos (₱)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload Area */}
            <FormField
              control={form.control}
              name="payment_proof"
              render={() => (
                <FormItem>
                  <FormLabel>Payment Proof</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {/* Upload Area */}
                      <div
                        className={cn(
                          "relative rounded-lg border-2 border-dashed p-6 transition-colors",
                          isDragOver
                            ? "border-primary bg-primary/5"
                            : selectedFile
                              ? "border-green-500 bg-green-50"
                              : "border-muted-foreground/25 hover:border-muted-foreground/50"
                        )}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleFileInputChange}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />

                        {!selectedFile ? (
                          <div className="text-center">
                            <Upload className="text-muted-foreground mx-auto h-12 w-12" />
                            <div className="mt-4">
                              <p className="text-sm font-medium">
                                Drop your payment proof here, or{" "}
                                <span className="text-primary">browse</span>
                              </p>
                              <p className="text-muted-foreground mt-2 text-xs">
                                PNG, JPG, JPEG up to 5MB
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center">
                            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                            <p className="mt-2 text-sm font-medium">File ready for upload</p>
                          </div>
                        )}
                      </div>

                      {/* File Preview */}
                      {selectedFile && (
                        <div className="rounded-lg border p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              {filePreview ? (
                                <img
                                  src={filePreview}
                                  alt="Payment proof preview"
                                  className="h-20 w-20 rounded-md border object-cover"
                                />
                              ) : (
                                getFileIcon(selectedFile)
                              )}
                            </div>

                            <div className="min-w-0 flex-grow">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {formatFileSize(selectedFile.size)}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {selectedFile.type}
                              </p>

                              {/* Upload Progress */}
                              {uploadProgress && (
                                <div className="mt-2">
                                  <div className="mb-1 flex justify-between text-xs">
                                    <span>Uploading...</span>
                                    <span>{uploadProgress.percentage}%</span>
                                  </div>
                                  <Progress value={uploadProgress.percentage} className="h-2" />
                                </div>
                              )}
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeFile}
                              disabled={!!uploadProgress}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Upload a screenshot or photo of your payment transaction
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes about the payment..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Any additional information about the payment</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Important Notice */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please ensure your payment proof clearly shows the transaction amount, date, and
                recipient information. This helps us process your payment faster.
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={!!uploadProgress}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={!selectedFile || !!uploadProgress || uploadMutation.isPending}
                className="min-w-[120px]"
              >
                {uploadProgress
                  ? `Uploading... ${uploadProgress.percentage}%`
                  : uploadMutation.isPending
                    ? "Processing..."
                    : "Upload Payment Proof"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
