import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2, Percent, Plus, Save, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      return `PHP ${value.toLocaleString()}`;
    case "per_night":
      return `PHP ${value.toLocaleString()}/night`;
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

  const hasChanges = JSON.stringify(localRules) !== JSON.stringify(rules);

  // Shared form fields used in both Add and Edit dialogs
  const renderFormFields = () => (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g., Week Stay Discount" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description (Optional)</FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g., 5% off for 7+ nights" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="discount_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discount Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="per_night">Per Night</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="discount_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discount Value</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                {form.watch("discount_type") === "percentage" ? "% off" : "PHP amount"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="condition_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condition Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="min_nights">Minimum Nights</SelectItem>
                  <SelectItem value="advance_booking">Advance Booking</SelectItem>
                  <SelectItem value="unit_count">Unit Count</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="condition_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condition Value</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                {form.watch("condition_type") === "min_nights"
                  ? "nights"
                  : form.watch("condition_type") === "advance_booking"
                    ? "days ahead"
                    : "units"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="max_discount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Discount (Optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                />
              </FormControl>
              <FormDescription>Cap the discount amount (PHP)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormDescription>Lower number = higher priority</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="is_active"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FormLabel>Active</FormLabel>
              <FormDescription>Enable this discount rule</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="text-muted-foreground h-5 w-5" />
              Discount Rules
            </CardTitle>
            <CardDescription>
              Configure automatic discounts based on stay duration, advance booking, and more
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button onClick={handleSaveAll} disabled={isSaving || isLoading} size="sm">
                <Save className="mr-2 h-4 w-4" />
                Save All Changes
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
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
            <Percent className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No discount rules configured</p>
            <p className="mt-2 text-sm">
              Add discount rules to automatically apply discounts based on conditions
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...localRules]
                .sort((a, b) => a.priority - b.priority)
                .map((rule) => (
                  <TableRow key={rule.id || rule.name}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{rule.name}</span>
                        {rule.description && (
                          <p className="text-muted-foreground text-sm">{rule.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {DISCOUNT_TYPE_LABELS[rule.discount_type] || rule.discount_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDiscountValue(rule.discount_type, rule.discount_value)}
                    </TableCell>
                    <TableCell className="text-sm">{formatCondition(rule.conditions)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rule)}>
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
          <DialogContent className="sm:max-w-[500px]">
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
