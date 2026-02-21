// src/components/admin/GrantRoleDialog.tsx

import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ChevronDown, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePendingUsers, type PendingUser } from "@/hooks/usePendingUsers";
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
  /** Pre-fill with a specific pending user */
  prefilledUser?: PendingUser;
}

// ============================================
// COMPONENT
// ============================================

export function GrantRoleDialog({ open, onOpenChange, prefilledUser }: GrantRoleDialogProps) {
  const grantRoleMutation = useGrantRole();
  const { data: pendingUsers, isLoading: isLoadingUsers } = usePendingUsers();
  const [userPickerOpen, setUserPickerOpen] = useState(false);
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

  const handleSelectUser = (user: PendingUser) => {
    form.setValue("userId", user.id);
    form.setValue("email", user.email);
    setUserPickerOpen(false);
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
      <DialogContent className="sm:max-w-[500px]">
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
                <FormLabel>Select User</FormLabel>
                <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={userPickerOpen}
                      className="w-full justify-between"
                    >
                      {selectedUserId
                        ? pendingUsers?.find((u) => u.id === selectedUserId)?.email ||
                          form.getValues("email") ||
                          "User selected"
                        : "Select a pending user..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingUsers ? "Loading..." : "No pending users found."}
                        </CommandEmpty>
                        <CommandGroup>
                          {pendingUsers?.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.email} ${user.full_name || ""}`}
                              onSelect={() => handleSelectUser(user)}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium">{user.email}</span>
                                <span className="text-muted-foreground text-xs">
                                  {user.full_name || "No name"} &middot; Joined{" "}
                                  {format(new Date(user.created_at), "MMM d, yyyy")}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                      <FormDescription>UUID from auth.users table</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        className="text-muted-foreground bg-muted text-sm"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

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
