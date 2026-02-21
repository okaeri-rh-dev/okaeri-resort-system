import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, NumberInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreatePaymentMethod,
  useDeleteQrCode,
  useUpdatePaymentMethod,
  useUploadQrCode,
} from "@/hooks/usePaymentMethods";
import { sanitizeFormData } from "@/lib/security/sanitize";
import type { PaymentMethodConfig, PaymentMethodType } from "@/types";

const METHOD_TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: "e-wallet", label: "E-Wallet (GCash, Maya)" },
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const ICON_OPTIONS = [
  { value: "Smartphone", label: "Phone (E-Wallet)" },
  { value: "Building2", label: "Bank" },
  { value: "CreditCard", label: "Credit Card" },
  { value: "Wallet", label: "Wallet" },
  { value: "Banknote", label: "Cash/Banknote" },
];

const ICON_COLORS = [
  { value: "text-blue-600", label: "Blue" },
  { value: "text-blue-800", label: "Dark Blue" },
  { value: "text-green-600", label: "Green" },
  { value: "text-purple-600", label: "Purple" },
  { value: "text-amber-600", label: "Amber" },
  { value: "text-gray-600", label: "Gray" },
];

const paymentMethodSchema = z.object({
  method_type: z.enum(["e-wallet", "bank-transfer", "cash", "other"], {
    required_error: "Please select a method type",
  }),
  provider_name: z.string().min(1, "Provider name is required").max(100, "Provider name too long"),
  display_name: z.string().min(1, "Display name is required").max(150, "Display name too long"),
  account_name: z.string().max(150, "Account name too long").optional().or(z.literal("")),
  account_number: z.string().max(100, "Account number too long").optional().or(z.literal("")),
  bank_name: z.string().max(100, "Bank name too long").optional().or(z.literal("")),
  icon_name: z.string().min(1, "Icon is required"),
  icon_color: z.string().min(1, "Icon color is required"),
  display_order: z.number().int().min(0).max(999),
  instructions: z.string().max(500, "Instructions too long").optional().or(z.literal("")),
  is_active: z.boolean(),
});

type PaymentMethodFormData = z.infer<typeof paymentMethodSchema>;

interface PaymentMethodFormProps {
  method?: PaymentMethodConfig;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentMethodForm({ method, onSuccess, onCancel }: PaymentMethodFormProps) {
  const isEditMode = !!method;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(method?.qr_code_url || null);

  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const uploadQr = useUploadQrCode();
  const deleteQr = useDeleteQrCode();

  const form = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      method_type: (method?.method_type as PaymentMethodType) || undefined,
      provider_name: method?.provider_name || "",
      display_name: method?.display_name || "",
      account_name: method?.account_name || "",
      account_number: method?.account_number || "",
      bank_name: method?.bank_name || "",
      icon_name: method?.icon_name || "CreditCard",
      icon_color: method?.icon_color || "text-gray-600",
      display_order: method?.display_order ?? 0,
      instructions: method?.instructions || "",
      is_active: method?.is_active ?? true,
    },
  });

  const methodType = form.watch("method_type");

  const onSubmit = async (data: PaymentMethodFormData) => {
    // Sanitize text fields
    const sanitizedData = sanitizeFormData(data, {
      skipFields: ["method_type", "display_order", "is_active", "icon_name", "icon_color"],
    });

    const payload = {
      method_type: sanitizedData.method_type,
      provider_name: sanitizedData.provider_name.trim(),
      display_name: sanitizedData.display_name.trim(),
      account_name: sanitizedData.account_name?.trim() || null,
      account_number: sanitizedData.account_number?.trim() || null,
      bank_name: sanitizedData.bank_name?.trim() || null,
      icon_name: sanitizedData.icon_name,
      icon_color: sanitizedData.icon_color,
      display_order: sanitizedData.display_order,
      instructions: sanitizedData.instructions?.trim() || null,
      is_active: sanitizedData.is_active,
    };

    if (isEditMode && method) {
      await updateMethod.mutateAsync({ id: method.id, updates: payload });
    } else {
      await createMethod.mutateAsync(payload as PaymentMethodConfig);
    }

    onSuccess?.();
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !method?.id) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setQrPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    try {
      await uploadQr.mutateAsync({ id: method.id, file });
    } catch {
      // Revert preview on failure
      setQrPreview(method?.qr_code_url || null);
    }
  };

  const handleQrDelete = async () => {
    if (!method?.id || !method.qr_code_storage_path) return;
    await deleteQr.mutateAsync({ id: method.id, storagePath: method.qr_code_storage_path });
    setQrPreview(null);
  };

  const isLoading = createMethod.isPending || updateMethod.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Method Type */}
          <FormField
            control={form.control}
            name="method_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Method Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {METHOD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Provider Name */}
          <FormField
            control={form.control}
            name="provider_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., GCash, BDO, Maya" {...field} />
                </FormControl>
                <FormDescription>Short name for internal reference</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Display Name */}
        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., GCash, BDO Bank Transfer" {...field} />
              </FormControl>
              <FormDescription>Shown to guests on the booking page</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Account Name */}
          <FormField
            control={form.control}
            name="account_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Okaeri Resort" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Account Number */}
          <FormField
            control={form.control}
            name="account_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Number</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 0917-123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Bank Name (conditional) */}
        {methodType === "bank-transfer" && (
          <FormField
            control={form.control}
            name="bank_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., BDO Savings" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Icon */}
          <FormField
            control={form.control}
            name="icon_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Icon Color */}
          <FormField
            control={form.control}
            name="icon_color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon Color</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ICON_COLORS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Display Order */}
          <FormField
            control={form.control}
            name="display_order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Order</FormLabel>
                <FormControl>
                  <NumberInput
                    min={0}
                    max={999}
                    allowDecimals={false}
                    placeholder="0"
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    onBlur={(value) => {
                      field.onChange(value || 0);
                      field.onBlur();
                    }}
                  />
                </FormControl>
                <FormDescription>Lower = higher</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Instructions */}
        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional instructions for guests..."
                  className="min-h-[60px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Active Toggle */}
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>
                  When active, this payment method is visible to guests
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* QR Code Upload (only in edit mode - need an ID first) */}
        {isEditMode && (
          <div className="space-y-2">
            <FormLabel>QR Code Image</FormLabel>
            <div className="flex items-center gap-4">
              {qrPreview ? (
                <div className="relative">
                  <img
                    src={qrPreview}
                    alt="QR Code"
                    className="h-32 w-32 rounded-lg border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={handleQrDelete}
                    disabled={deleteQr.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadQr.isPending}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {uploadQr.isPending ? "Uploading..." : "Upload QR Code"}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Upload QR code image"
                onChange={handleQrUpload}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Upload a QR code image for this payment method (PNG, JPG)
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Payment Method"
                : "Create Payment Method"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
