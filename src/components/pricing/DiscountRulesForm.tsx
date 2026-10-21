import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Edit2, Percent, Plus, Save, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormField,
  Input,
  ListCard,
  ListCardRow,
  SelectControl,
  SelectItem,
  StatusBadge,
  Switch,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database.types";

// Types
export interface DiscountRule {
  id?: string;
  name: string;
  description?: string | null;
  discount_type: string;
  discount_value: number;
  max_discount?: number | null;
  conditions: NonNullable<Json>;
  priority: number;
  is_active: boolean;
}

// Validation schema
const discountRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed", "per_night"]),
  discount_value: z.number().positive("Must be greater than 0"),
  max_discount: z
    .number()
    .positive()
    .optional()
    .or(z.literal(0))
    .or(z.nan().transform(() => undefined)),
  priority: z.number().min(0).max(100),
  condition_type: z.enum(["min_nights", "advance_booking", "unit_count", "date_range"]),
  condition_value: z.number().min(1, "Must be at least 1"),
  is_active: z.boolean(),
});

type DiscountRuleInput = z.infer<typeof discountRuleSchema>;

// Helpers
const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: "Percentage",
  fixed: "Fixed Amount",
  per_night: "Per Night",
};

function parseCondition(conditions: Json): { type: string; value: number } {
  if (Array.isArray(conditions) && conditions.length > 0) {
    const first = conditions[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return {
        type: ((first as Record<string, Json | undefined>).type as string) || "min_nights",
        value: Number((first as Record<string, Json | undefined>).value) || 1,
      };
    }
  }
  return { type: "min_nights", value: 1 };
}

function formatCondition(conditions: Json): string {
  const { type, value } = parseCondition(conditions);
  switch (type) {
    case "min_nights":
      return `${value}+ nights`;
    case "advance_booking":
      return `${value}+ days ahead`;
    case "unit_count":
      return `${value}+ units`;
    case "date_range":
      return "Date range";
    default:
      return String(value);
  }
}

function formatDiscountValue(type: string, value: number): string {
  switch (type) {
    case "percentage":
      return `${value}%`;
    case "fixed":
      return formatCurrency(value);
    case "per_night":
      return `${formatCurrency(value)}/night`;
    default:
      return String(value);
  }
}

interface DiscountRulesFormProps {
  rules: DiscountRule[];
  onSave: (rules: DiscountRule[]) => Promise<void>;
  isLoading?: boolean;
}

export function DiscountRulesForm({ rules = [], onSave, isLoading }: DiscountRulesFormProps) {
  const [localRules, setLocalRules] = React.useState<DiscountRule[]>(rules);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<DiscountRule | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<DiscountRuleInput>({
    resolver: zodResolver(discountRuleSchema),
    defaultValues: {
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 5,
      max_discount: undefined,
      priority: 0,
      condition_type: "min_nights",
      condition_value: 7,
      is_active: true,
    },
  });

  // Sync rules from props
  React.useEffect(() => {
    setLocalRules(rules);
  }, [rules]);

  // Build conditions JSONB from form values
  const buildConditions = (type: string, value: number): NonNullable<Json> => {
    return [{ type, value }];
  };

  // Handle adding a new rule
  const handleAdd = (data: DiscountRuleInput) => {
    const newRule: DiscountRule = {
      id: `temp_${Date.now()}`,
      name: data.name,
      description: data.description || null,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      max_discount: data.max_discount && !isNaN(data.max_discount) ? data.max_discount : null,
      conditions: buildConditions(data.condition_type, data.condition_value),
      priority: data.priority,
      is_active: data.is_active,
    };

    setLocalRules([...localRules, newRule]);
    setIsAddDialogOpen(false);
    form.reset();

    toast.success("Discount rule added", {
      description: `${data.name} has been added. Click "Save All Changes" to persist.`,
    });
  };

  // Handle editing a rule
  const handleEdit = (data: DiscountRuleInput) => {
    if (!editingRule) return;

    const updatedRules = localRules.map((rule) =>
      rule.id === editingRule.id
        ? {
            ...rule,
            name: data.name,
            description: data.description || null,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            max_discount: data.max_discount && !isNaN(data.max_discount) ? data.max_discount : null,
            conditions: buildConditions(data.condition_type, data.condition_value),
            priority: data.priority,
            is_active: data.is_active,
          }
        : rule
    );

    setLocalRules(updatedRules);
    setEditingRule(null);
    form.reset();

    toast.success("Discount rule updated", {
      description: `${data.name} has been updated. Click "Save All Changes" to persist.`,
    });
  };

  // Handle deleting a rule
  const handleDelete = (ruleToDelete: DiscountRule) => {
    setLocalRules(localRules.filter((rule) => rule.id !== ruleToDelete.id));

    toast.success("Discount rule removed", {
      description: `${ruleToDelete.name} has been removed. Click "Save All Changes" to persist.`,
    });
  };

  // Handle toggling active state
  const handleToggleActive = (ruleToToggle: DiscountRule) => {
    const updatedRules = localRules.map((rule) =>
      rule.id === ruleToToggle.id ? { ...rule, is_active: !rule.is_active } : rule
    );
    setLocalRules(updatedRules);
  };

  // Save all changes
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await onSave(localRules);
    } catch (_error) {
      toast.error("Error saving changes", {
        description: "Failed to save discount rules. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (rule: DiscountRule) => {
    const condition = parseCondition(rule.conditions);
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      description: rule.description || "",
      discount_type: rule.discount_type as "percentage" | "fixed" | "per_night",
      discount_value: rule.discount_value,
      max_discount: rule.max_discount ?? undefined,
      priority: rule.priority,
      condition_type: condition.type as DiscountRuleInput["condition_type"],
      condition_value: condition.value,
      is_active: rule.is_active,
    });
  };

  const renderActiveSwitch = (rule: DiscountRule) => (
    <Switch
      checked={rule.is_active}
      onCheckedChange={() => handleToggleActive(rule)}
      aria-label={`${rule.name} active`}
    />
  );

  const renderRowActions = (rule: DiscountRule) => (
    <div className="flex justify-end gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openEditDialog(rule)}
        aria-label={`Edit ${rule.name}`}
      >
        <Edit2 className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDelete(rule)}
        aria-label={`Delete ${rule.name}`}
      >
        <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );

  const columns: ColumnDef<DiscountRule>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <RuleName rule={row.original} className="min-w-36" />,
    },
    {
      accessorKey: "discount_type",
      header: "Type",
      cell: ({ row }) => (
        <StatusBadge tone="neutral">
          {DISCOUNT_TYPE_LABELS[row.original.discount_type] || row.original.discount_type}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "discount_value",
      header: "Value",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDiscountValue(row.original.discount_type, row.original.discount_value)}
        </span>
      ),
      meta: { align: "right" },
    },
    {
      id: "condition",
      header: "Condition",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatCondition(row.original.conditions)}</span>
      ),
    },
    { accessorKey: "priority", header: "Priority", meta: { align: "right" } },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => renderActiveSwitch(row.original),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => renderRowActions(row.original),
      meta: { align: "right", pinned: true },
    },
  ];

  const rulesByPriority = React.useMemo(
    () => [...localRules].sort((a, b) => a.priority - b.priority),
    [localRules]
  );

  const table = useReactTable({
    data: rulesByPriority,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (rule) => rule.id || rule.name,
  });

  const hasChanges = JSON.stringify(localRules) !== JSON.stringify(rules);

  // Shared form fields used in both Add and Edit dialogs
  const renderFormFields = () => (
    <>
      <FormField control={form.control} name="name" label="Name">
        {(field) => <Input {...field} placeholder="e.g., Week Stay Discount" />}
      </FormField>

      <FormField control={form.control} name="description" label="Description (Optional)">
        {(field) => <Input {...field} placeholder="e.g., 5% off for 7+ nights" />}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="discount_type" label="Discount Type">
          {(field) => (
            <SelectControl value={field.value} onValueChange={field.onChange}>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
              <SelectItem value="per_night">Per Night</SelectItem>
            </SelectControl>
          )}
        </FormField>

        <FormField
          control={form.control}
          name="discount_value"
          label="Discount Value"
          description={form.watch("discount_type") === "percentage" ? "% off" : "Amount in ₱"}
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              step="0.01"
              onChange={(e) => field.onChange(parseFloat(e.target.value))}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="condition_type" label="Condition Type">
          {(field) => (
            <SelectControl value={field.value} onValueChange={field.onChange}>
              <SelectItem value="min_nights">Minimum Nights</SelectItem>
              <SelectItem value="advance_booking">Advance Booking</SelectItem>
              <SelectItem value="unit_count">Unit Count</SelectItem>
            </SelectControl>
          )}
        </FormField>

        <FormField
          control={form.control}
          name="condition_value"
          label="Condition Value"
          description={
            form.watch("condition_type") === "min_nights"
              ? "nights"
              : form.watch("condition_type") === "advance_booking"
                ? "days ahead"
                : "units"
          }
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              onChange={(e) => field.onChange(parseInt(e.target.value))}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="max_discount"
          label="Max Discount (Optional)"
          description="Cap the discount amount (₱)"
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              step="0.01"
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
          )}
        </FormField>

        <FormField
          control={form.control}
          name="priority"
          label="Priority"
          description="Lower number = higher priority"
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              onChange={(e) => field.onChange(parseInt(e.target.value))}
            />
          )}
        </FormField>
      </div>

      <FormField
        control={form.control}
        name="is_active"
        label="Active"
        description="Enable this discount rule"
      >
        {(field) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
      </FormField>
    </>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="text-muted-foreground h-5 w-5" aria-hidden="true" />
              Discount Rules
            </CardTitle>
            <CardDescription>
              Configure automatic discounts based on stay duration, advance booking, and more
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button onClick={handleSaveAll} disabled={isSaving || isLoading} size="sm">
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                Save All Changes
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Discount Rule</DialogTitle>
                  <DialogDescription>
                    Create a new automatic discount with conditions
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAdd)} className="space-y-4">
                    {renderFormFields()}
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Add Rule</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {localRules.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Percent className="mx-auto mb-4 h-12 w-12 opacity-50" aria-hidden="true" />
            <p>No discount rules configured</p>
            <p className="mt-2 text-sm">
              Add discount rules to automatically apply discounts based on conditions
            </p>
          </div>
        ) : (
          <DataTable
            table={table}
            label="Discount rules"
            renderCard={(row) => (
              <ListCard>
                <div className="flex items-start justify-between gap-2">
                  <RuleName rule={row.original} />
                  {renderRowActions(row.original)}
                </div>
                <ListCardRow
                  label="Type"
                  value={
                    <StatusBadge tone="neutral">
                      {DISCOUNT_TYPE_LABELS[row.original.discount_type] ||
                        row.original.discount_type}
                    </StatusBadge>
                  }
                />
                <ListCardRow
                  label="Value"
                  value={formatDiscountValue(
                    row.original.discount_type,
                    row.original.discount_value
                  )}
                />
                <ListCardRow label="Condition" value={formatCondition(row.original.conditions)} />
                <ListCardRow label="Priority" value={row.original.priority} />
                <ListCardRow label="Active" value={renderActiveSwitch(row.original)} />
              </ListCard>
            )}
          />
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Discount Rule</DialogTitle>
              <DialogDescription>Modify the discount rule settings</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
                {renderFormFields()}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditingRule(null)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function RuleName({ rule, className }: { rule: DiscountRule; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <span className="font-medium break-words">{rule.name}</span>
      {rule.description && (
        <p className="text-muted-foreground text-sm break-words">{rule.description}</p>
      )}
    </div>
  );
}
