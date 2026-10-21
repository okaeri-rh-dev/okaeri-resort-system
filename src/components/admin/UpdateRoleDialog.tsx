// src/components/admin/UpdateRoleDialog.tsx

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Button,
  Callout,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormField,
  Textarea,
} from "@/components/patterns";
import { useDeactivateRole, useUpdateRole } from "@/hooks/useRoleManagement";
import { AuditRole, getRoleDisplayName, type AppRole } from "@/lib/audit-roles";
import { supabaseAuth } from "@/lib/supabase";

import { RoleSelect } from "./RoleSelect";

// ============================================
// UPDATE ROLE DIALOG
// ============================================

const updateRoleSchema = z.object({
  newRole: z.nativeEnum(AuditRole, {
    required_error: "Role is required",
  }),
  notes: z.string().optional(),
});

type UpdateRoleFormData = z.infer<typeof updateRoleSchema>;

interface UpdateRoleDialogProps {
  role: AppRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateRoleDialog({ role, open, onOpenChange }: UpdateRoleDialogProps) {
  const updateRoleMutation = useUpdateRole();

  const form = useForm<UpdateRoleFormData>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      newRole: role?.role as AuditRole,
      notes: "",
    },
  });

  // Reset form when role changes
  useEffect(() => {
    if (role) {
      form.reset({
        newRole: role.role as AuditRole,
        notes: "",
      });
    }
  }, [role, form]);

  const onSubmit = async (data: UpdateRoleFormData) => {
    if (!role) return;

    try {
      await updateRoleMutation.mutateAsync({
        userId: role.user_id,
        newRole: data.newRole,
        notes: data.notes || undefined,
      });

      toast.success("Role updated successfully", {
        description: `${role.email} is now ${getRoleDisplayName(data.newRole)}`,
      });

      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update role", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update User Role</DialogTitle>
          <DialogDescription>
            Change the role for <strong>{role.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current Role Display */}
            <Callout tone="neutral">
              Current role: <strong>{getRoleDisplayName(role.role as AuditRole)}</strong>
            </Callout>

            {/* New Role Selection */}
            <FormField
              control={form.control}
              name="newRole"
              label="New Role"
              description="Choose the new access level for this user"
            >
              {({ value, onChange, onBlur, ref }) => (
                <RoleSelect
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  ref={ref}
                  placeholder="Select a new role"
                />
              )}
            </FormField>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              label="Notes (Optional)"
              description="Optional notes about why this role was changed (for audit trail)"
            >
              {(field) => (
                <Textarea
                  placeholder="Reason for changing this role..."
                  className="resize-none"
                  {...field}
                />
              )}
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={updateRoleMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Role
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// DEACTIVATE ROLE DIALOG
// ============================================

const deactivateRoleSchema = z.object({
  notes: z.string().optional(),
});

type DeactivateRoleFormData = z.infer<typeof deactivateRoleSchema>;

interface DeactivateRoleDialogProps {
  role: AppRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeactivateRoleDialog({ role, open, onOpenChange }: DeactivateRoleDialogProps) {
  const deactivateRoleMutation = useDeactivateRole();

  const form = useForm<DeactivateRoleFormData>({
    resolver: zodResolver(deactivateRoleSchema),
    defaultValues: {
      notes: "",
    },
  });

  // Check if user is trying to deactivate themselves
  const isSelfDeactivation = async () => {
    const {
      data: { user },
    } = await supabaseAuth.getUser();
    return user?.id === role?.user_id;
  };

  const onSubmit = async (data: DeactivateRoleFormData) => {
    if (!role) return;

    // Prevent self-deactivation
    if (await isSelfDeactivation()) {
      toast.error("Cannot deactivate your own role", {
        description: "This would lock you out of the system. Ask another admin.",
      });
      return;
    }

    try {
      await deactivateRoleMutation.mutateAsync({
        userId: role.user_id,
        notes: data.notes || undefined,
      });

      toast.success("Role deactivated", {
        description: `${role.email}'s role has been deactivated`,
      });

      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to deactivate role", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate User Role</DialogTitle>
          <DialogDescription>
            Remove access for <strong>{role.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <Callout tone="danger" title="Warning">
          This will remove all system access for this user. This is a soft delete - the record will
          remain in the database but marked as inactive.
        </Callout>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* User info */}
            <div className="text-sm">
              <div className="mb-1">
                <strong>User:</strong> {role.email}
              </div>
              <div>
                <strong>Current Role:</strong> {getRoleDisplayName(role.role as AuditRole)}
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              label="Reason (Optional)"
              description="Optional notes about why this role was deactivated"
            >
              {(field) => (
                <Textarea
                  placeholder="Reason for deactivating this role..."
                  className="resize-none"
                  {...field}
                />
              )}
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={deactivateRoleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deactivateRoleMutation.isPending}
              >
                {deactivateRoleMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Deactivate Role
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
