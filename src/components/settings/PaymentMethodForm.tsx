import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Form,
  FormField,
  Input,
  NumberInput,
  SelectControl,
  SelectItem,
  Textarea,
} from "@/components/patterns";
import {
  useCreatePaymentMethod,
  useDeleteQrCode,
  useUpdatePaymentMethod,
  useUploadQrCode,
} from "@/hooks/usePaymentMethods";
import { sanitizeFormData } from "@/lib/security/sanitize";
import type { PaymentMethodConfig, PaymentMethodType } from "@/types";

import { ActiveSwitchField } from "./ActiveSwitchField";

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="@container space-y-6">
        <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
          <FormField control={form.control} name="method_type" label="Method Type *">
            {({ value, onChange, ...field }) => (
              <SelectControl
                {...field}
                value={value}
                onValueChange={onChange}
                placeholder="Select type"
              >
                {METHOD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectControl>
            )}
          </FormField>

          <FormField
            control={form.control}
            name="provider_name"
            label="Provider Name *"
            description="Short name for internal reference"
          >
            {(field) => <Input placeholder="e.g., GCash, BDO, Maya" {...field} />}
          </FormField>
        </div>

        <FormField
          control={form.control}
          name="display_name"
          label="Display Name *"
          description="Shown to guests on the booking page"
        >
          {(field) => <Input placeholder="e.g., GCash, BDO Bank Transfer" {...field} />}
        </FormField>

        <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
          <FormField control={form.control} name="account_name" label="Account Name">
            {(field) => <Input placeholder="e.g., Okaeri Resort" {...field} />}
          </FormField>

          <FormField control={form.control} name="account_number" label="Account Number">
            {(field) => <Input placeholder="e.g., 0917-123-4567" {...field} />}
          </FormField>
        </div>

        {methodType === "bank-transfer" && (
          <FormField control={form.control} name="bank_name" label="Bank Name">
            {(field) => <Input placeholder="e.g., BDO Savings" {...field} />}
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-6 @lg:grid-cols-3">
          <FormField control={form.control} name="icon_name" label="Icon">
            {({ value, onChange, ...field }) => (
              <SelectControl {...field} value={value} onValueChange={onChange}>
                {ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectControl>
            )}
          </FormField>

          <FormField control={form.control} name="icon_color" label="Icon Color">
            {({ value, onChange, ...field }) => (
              <SelectControl {...field} value={value} onValueChange={onChange}>
                {ICON_COLORS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectControl>
            )}
          </FormField>

          <FormField
            control={form.control}
            name="display_order"
            label="Display Order"
            description="Lower = higher"
          >
            {({ value, onChange, onBlur, ...field }) => (
              <NumberInput
                {...field}
                min={0}
                max={999}
                allowDecimals={false}
                placeholder="0"
                value={value}
                onChange={(next) => onChange(next)}
                onBlur={(next) => {
                  onChange(next || 0);
                  onBlur();
                }}
              />
            )}
          </FormField>
        </div>

        <FormField control={form.control} name="instructions" label="Instructions">
          {(field) => (
            <Textarea
              placeholder="Optional instructions for guests..."
              className="min-h-16"
              {...field}
            />
          )}
        </FormField>

        <ActiveSwitchField
          control={form.control}
          name="is_active"
          description="When active, this payment method is visible to guests"
        />

        {/* QR Code Upload (only in edit mode - need an ID first) */}
        {isEditMode && (
          <div className="space-y-2">
            <p className="text-sm font-medium">QR Code Image</p>
            <div className="flex items-center gap-4">
              {qrPreview ? (
                <div className="relative">
                  <img
                    src={qrPreview}
                    alt="QR Code"
                    width={128}
                    height={128}
                    className="size-32 rounded-lg border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={handleQrDelete}
                    disabled={deleteQr.isPending}
                    aria-label="Remove QR code"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
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
        <div className="flex flex-col-reverse gap-2 @md:flex-row @md:justify-end">
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
