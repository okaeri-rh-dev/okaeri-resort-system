import React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { sanitizeFormData } from "@/lib/security/sanitize";
import { useCreateAccount, useUpdateAccount } from "@/stores/useAccountStore";
import type { Account, AccountType } from "@/types";

// Account type options
const ACCOUNT_TYPES: { value: AccountType; label: string; description: string }[] = [
  { value: "Bank", label: "Bank Account", description: "Traditional bank savings or checking" },
  { value: "E-Wallet", label: "E-Wallet", description: "Digital wallets like GCash, Maya" },
  { value: "Cash", label: "Cash", description: "Physical cash on hand" },
];

// Validation schema
const accountFormSchema = z.object({
  account_name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name too long")
    .refine((val) => val.trim().length > 0, "Account name cannot be empty"),
  account_code: z
    .string()
    .min(1, "Account code is required")
    .max(20, "Account code too long")
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, and hyphens only")
    .transform((val) => val.toUpperCase()),
  account_type: z.enum(["Bank", "E-Wallet", "Cash"], {
    required_error: "Please select an account type",
  }),
  description: z.string().max(500, "Description too long").optional(),
  initial_balance: z
    .number()
    .min(0, "Initial balance cannot be negative")
    .max(999999999.99, "Initial balance too large"),
  display_order: z.number().int().min(0).max(999).optional(),
});

type AccountFormData = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  account?: Account;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AccountForm: React.FC<AccountFormProps> = ({ account, onSuccess, onCancel }) => {
  const isEditMode = !!account;

  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      account_name: account?.account_name || "",
      account_code: account?.account_code || "",
      account_type: (account?.account_type as AccountType) || undefined,
      description: account?.description || "",
      initial_balance: account?.initial_balance ?? 0,
      display_order: account?.display_order ?? 0,
    },
  });

  const onSubmit = async (data: AccountFormData) => {
    try {
      // Sanitize text fields
      const sanitizedData = sanitizeFormData(data, {
        skipFields: ["account_type", "initial_balance", "display_order"],
      });

      const accountData = {
        account_name: sanitizedData.account_name.trim(),
        account_code: sanitizedData.account_code.toUpperCase().trim(),
        account_type: sanitizedData.account_type,
        description: sanitizedData.description?.trim() || null,
        initial_balance: sanitizedData.initial_balance,
        display_order: sanitizedData.display_order ?? 0,
        is_active: true,
      };

      if (isEditMode && account) {
        await updateAccount.mutateAsync({
          accountId: account.account_id,
          updates: accountData,
        });
        toast.success("Account updated successfully");
      } else {
        await createAccount.mutateAsync(accountData);
        toast.success("Account created successfully");
      }

      onSuccess?.();
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save account";
      toast.error(message);
      console.error("Account form error:", error);
    }
  };

  const isLoading = createAccount.isPending || updateAccount.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="account_name"
          label="Account Name *"
          description="A descriptive name for this account"
        >
          {(field) => <Input placeholder="e.g., BDO Savings, GCash Business" {...field} />}
        </FormField>

        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <FormField
              control={form.control}
              name="account_code"
              label="Account Code *"
              description="Short unique identifier (uppercase, no spaces)"
            >
              {(field) => (
                <Input
                  placeholder="e.g., BDO-SAV, GCASH"
                  autoComplete="off"
                  spellCheck={false}
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            </FormField>

            <FormField
              control={form.control}
              name="account_type"
              label="Account Type *"
              description="Category of financial account"
            >
              {(field) => (
                <SelectControl
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select account type"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span>{type.label}</span>
                        <span className="text-muted-foreground text-xs">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectControl>
              )}
            </FormField>

            <FormField
              control={form.control}
              name="initial_balance"
              label="Initial Balance (PHP) *"
              description={
                isEditMode
                  ? "The starting balance when this account was added"
                  : "Current balance before adding to the system"
              }
            >
              {(field) => (
                <NumberInput
                  min={0}
                  allowDecimals={true}
                  placeholder="0.00"
                  startIcon={<span className="text-sm font-medium">₱</span>}
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  onBlur={(value) => {
                    field.onChange(value || 0);
                    field.onBlur();
                  }}
                />
              )}
            </FormField>

            <FormField
              control={form.control}
              name="display_order"
              label="Display Order"
              description="Lower numbers appear first in lists"
            >
              {(field) => (
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
              )}
            </FormField>
          </div>
        </div>

        <FormField
          control={form.control}
          name="description"
          label="Description"
          description="Additional details or notes (optional)"
        >
          {(field) => (
            <Textarea
              placeholder="Optional notes about this account..."
              className="min-h-20"
              {...field}
            />
          )}
        </FormField>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Account"
                : "Create Account"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
