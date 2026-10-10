// src/components/admin/UpdateRoleDialog.tsx

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDeactivateRole, useUpdateRole } from "@/hooks/useRoleManagement";
import { AuditRole, getRoleDisplayName, type AppRole } from "@/lib/audit-roles";
import { supabaseAuth } from "@/lib/supabase";

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update User Role</DialogTitle>
          <DialogDescription>
            Change the role for <strong>{role.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current Role Display */}
            <Alert>
              <AlertDescription>
                Current role: <strong>{getRoleDisplayName(role.role as AuditRole)}</strong>
              </AlertDescription>
            </Alert>

            {/* New Role Selection */}
            <FormField
              control={form.control}
              name="newRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a new role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={AuditRole.ADMIN}>
                        {getRoleDisplayName(AuditRole.ADMIN)} - Full system access
                      </SelectItem>
                      <SelectItem value={AuditRole.OWNER}>
                        {getRoleDisplayName(AuditRole.OWNER)} - Business owner privileges
                      </SelectItem>
                      <SelectItem value={AuditRole.MANAGER}>
                        {getRoleDisplayName(AuditRole.MANAGER)} - Operations management
                      </SelectItem>
                      <SelectItem value={AuditRole.STAFF}>
                        {getRoleDisplayName(AuditRole.STAFF)} - Basic access
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose the new access level for this user</FormDescription>
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
                      placeholder="Reason for changing this role..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes about why this role was changed (for audit trail)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Deactivate User Role</DialogTitle>
          <DialogDescription>
            Remove access for <strong>{role.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            This will remove all system access for this user. This is a soft delete - the record
            will remain in the database but marked as inactive.
          </AlertDescription>
        </Alert>

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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Reason for deactivating this role..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes about why this role was deactivated
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
