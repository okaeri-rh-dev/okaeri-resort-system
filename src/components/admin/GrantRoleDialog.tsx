// src/components/admin/GrantRoleDialog.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGrantRole } from "@/hooks/useRoleManagement";
import { AuditRole, getRoleDisplayName } from "@/lib/audit-roles";

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
}

// ============================================
// COMPONENT
// ============================================

export function GrantRoleDialog({ open, onOpenChange }: GrantRoleDialogProps) {
  const grantRoleMutation = useGrantRole();

  const form = useForm<GrantRoleFormData>({
    resolver: zodResolver(grantRoleSchema),
    defaultValues: {
      userId: "",
      email: "",
      role: AuditRole.STAFF,
      notes: "",
    },
  });

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
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to grant role", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Grant User Role</DialogTitle>
          <DialogDescription>
            Assign a role to a user. You must provide their UUID from the auth.users table.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Helper Alert */}
            <Alert>
              <Search className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Find User ID:</strong> Open your{" "}
                <a
                  href={`${import.meta.env.VITE_SUPABASE_URL}/project/default/editor`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Supabase Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and run:{" "}
                <code className="bg-muted rounded px-1 py-0.5 text-xs">
                  SELECT id, email FROM auth.users WHERE email ILIKE '%search%'
                </code>
              </AlertDescription>
            </Alert>

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      {...field}
                      autoComplete="email"
                      className="text-sm"
                    />
                  </FormControl>
                  <FormDescription>
                    User's email address from your authentication system
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* User ID */}
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID (UUID)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="6e7aed61-41df-4949-ba63-47343e977ab8"
                      {...field}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <FormDescription>
                    Paste the UUID from auth.users table (must match the email above)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role Selection */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
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
                  <FormDescription>Choose the access level for this user</FormDescription>
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
                      placeholder="Reason for granting this role..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes about why this role was granted (for audit trail)
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
