// src/components/admin/GrantRoleDialog.tsx

import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormField,
  Input,
  SelectControl,
  SelectItem,
  Textarea,
} from "@/components/patterns";
import { usePendingUsers, type PendingUser } from "@/hooks/usePendingUsers";
import { useGrantRole } from "@/hooks/useRoleManagement";
import { AuditRole, getRoleDisplayName } from "@/lib/audit-roles";

import { RoleOptions } from "./RoleOptions";

// ============================================
// VALIDATION SCHEMA
// ============================================

const grantRoleSchema = z.object({
  userId: z.string().uuid("Must be a valid UUID from auth.users").min(1, "User ID is required"),
  email: z.string().email("Must be a valid email address").min(1, "Email is required"),
  role: z.nativeEnum(AuditRole, {
    required_error: "Role is required",
  }),
  notes: z.string().optional(),
});

type GrantRoleFormData = z.infer<typeof grantRoleSchema>;

// ============================================
// PROPS
// ============================================

interface GrantRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill with a specific pending user */
  prefilledUser?: PendingUser;
}

// ============================================
// COMPONENT
// ============================================

export function GrantRoleDialog({ open, onOpenChange, prefilledUser }: GrantRoleDialogProps) {
  const grantRoleMutation = useGrantRole();
  const { data: pendingUsers, isLoading: isLoadingUsers } = usePendingUsers();
  const [manualEntry, setManualEntry] = useState(false);

  const form = useForm<GrantRoleFormData>({
    resolver: zodResolver(grantRoleSchema),
    defaultValues: {
      userId: prefilledUser?.id || "",
      email: prefilledUser?.email || "",
      role: AuditRole.STAFF,
      notes: "",
    },
  });

  // Update form when prefilledUser changes
  useEffect(() => {
    if (prefilledUser) {
      form.setValue("userId", prefilledUser.id);
      form.setValue("email", prefilledUser.email);
    }
  }, [prefilledUser, form]);

  const selectedUserId = form.watch("userId");

  const userOptions =
    prefilledUser && !pendingUsers?.some((user) => user.id === prefilledUser.id)
      ? [prefilledUser, ...(pendingUsers ?? [])]
      : (pendingUsers ?? []);

  const userPickerPlaceholder = isLoadingUsers
    ? "Loading users..."
    : userOptions.length === 0
      ? "No pending users"
      : "Select a pending user...";

  const handleSelectUser = (userId: string) => {
    const user = userOptions.find((option) => option.id === userId);
    if (!user) return;
    form.setValue("userId", user.id, { shouldValidate: true });
    form.setValue("email", user.email);
  };

  const onSubmit = async (data: GrantRoleFormData) => {
    try {
      await grantRoleMutation.mutateAsync({
        userId: data.userId,
        email: data.email,
        role: data.role,
        notes: data.notes || undefined,
      });

      toast.success("Role granted successfully", {
        description: `${data.email} is now ${getRoleDisplayName(data.role)}`,
      });

      // Reset form and close dialog
      form.reset();
      setManualEntry(false);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to grant role", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const handleClose = () => {
    form.reset();
    setManualEntry(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant User Role</DialogTitle>
          <DialogDescription>
            Select a pending user or enter details manually to assign a role.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Pending Users Picker */}
            {!manualEntry && (
              <div className="space-y-2">
                <FormField control={form.control} name="userId" label="Select User">
                  {({ value, onBlur, ref }) => (
                    <SelectControl
                      value={value}
                      onValueChange={handleSelectUser}
                      onBlur={onBlur}
                      ref={ref}
                      disabled={isLoadingUsers || userOptions.length === 0}
                      placeholder={userPickerPlaceholder}
                    >
                      {userOptions.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name ? `${user.email} (${user.full_name})` : user.email}
                        </SelectItem>
                      ))}
                    </SelectControl>
                  )}
                </FormField>
                <p className="text-muted-foreground text-xs">
                  Can't find the user?{" "}
                  <button
                    type="button"
                    onClick={() => setManualEntry(true)}
                    className="text-primary hover:underline"
                  >
                    Enter details manually
                  </button>
                </p>
              </div>
            )}

            {/* Manual Entry Fields */}
            {manualEntry && (
              <>
                {/* Email */}
                <FormField control={form.control} name="email" label="Email Address">
                  {(field) => (
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      {...field}
                      autoComplete="email"
                      spellCheck={false}
                      className="text-sm"
                    />
                  )}
                </FormField>

                {/* User ID */}
                <FormField
                  control={form.control}
                  name="userId"
                  label="User ID (UUID)"
                  description="UUID from auth.users table"
                >
                  {(field) => (
                    <Input
                      placeholder="6e7aed61-41df-4949-ba63-47343e977ab8"
                      {...field}
                      spellCheck={false}
                      className="text-sm tabular-nums"
                    />
                  )}
                </FormField>

                <p className="text-muted-foreground text-xs">
                  <button
                    type="button"
                    onClick={() => setManualEntry(false)}
                    className="text-primary hover:underline"
                  >
                    Back to user list
                  </button>
                </p>
              </>
            )}

            {/* Read-only email display when selected from picker */}
            {!manualEntry && selectedUserId && (
              <FormField control={form.control} name="email" label="Email">
                {(field) => (
                  <Input {...field} readOnly className="text-muted-foreground bg-muted text-sm" />
                )}
              </FormField>
            )}

            {/* Role Selection */}
            <FormField
              control={form.control}
              name="role"
              label="Role"
              description="Choose the access level for this user"
            >
              {({ value, onChange, onBlur, ref }) => (
                <SelectControl
                  value={value}
                  onValueChange={onChange}
                  onBlur={onBlur}
                  ref={ref}
                  placeholder="Select a role"
                >
                  <RoleOptions />
                </SelectControl>
              )}
            </FormField>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              label="Notes (Optional)"
              description="Optional notes about why this role was granted (for audit trail)"
            >
              {(field) => (
                <Textarea
                  placeholder="Reason for granting this role..."
                  className="resize-none"
                  {...field}
                />
              )}
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={grantRoleMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={grantRoleMutation.isPending}>
                {grantRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Grant Role
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
