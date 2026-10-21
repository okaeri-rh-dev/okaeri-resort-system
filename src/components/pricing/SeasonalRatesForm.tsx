import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Calendar, Plus, Save, TrendingDown, TrendingUp } from "lucide-react";
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
  type StatusTone,
} from "@/components/patterns";

import { PricingActiveSwitch, PricingRowActions } from "./PricingRowControls";

// Types
export interface SeasonalRate {
  id?: string;
  season_id: string;
  name: string;
  start_date: string; // MM-DD format
  end_date: string; // MM-DD format
  multiplier: number;
  priority: number;
  is_active: boolean;
  description?: string;
  color?: string;
}

// Validation schema for seasonal rate
const seasonalRateSchema = z.object({
  season_id: z
    .string()
    .min(1, "Season ID is required")
    .regex(/^[a-z_]+$/, "Only lowercase letters and underscores allowed"),
  name: z.string().min(1, "Name is required").max(50),
  start_date: z.string().regex(/^\d{2}-\d{2}$/, "Format must be MM-DD"),
  end_date: z.string().regex(/^\d{2}-\d{2}$/, "Format must be MM-DD"),
  multiplier: z.number().min(0.5, "Minimum 0.5x").max(3.0, "Maximum 3.0x"),
  priority: z.number().min(0).max(100),
  is_active: z.boolean(),
  description: z.string().optional(),
  color: z.string().optional(),
});

type SeasonalRateInput = z.infer<typeof seasonalRateSchema>;

// Badge colours for seasonal rates. The stored value stays as saved; each one shows as a tone.
const COLOR_OPTIONS: Array<{ value: string; label: string; tone: StatusTone }> = [
  { value: "blue", label: "Blue", tone: "info" },
  { value: "green", label: "Green", tone: "success" },
  { value: "orange", label: "Amber", tone: "warning" },
  { value: "red", label: "Red", tone: "danger" },
  { value: "purple", label: "Gray", tone: "neutral" },
];

interface SeasonalRatesFormProps {
  rates: SeasonalRate[];
  onSave: (rates: SeasonalRate[]) => Promise<void>;
  isLoading?: boolean;
}

export function SeasonalRatesForm({
  rates = [],
  onSave,
  isLoading: _isLoading,
}: SeasonalRatesFormProps) {
  const [localRates, setLocalRates] = React.useState<SeasonalRate[]>(rates);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingRate, setEditingRate] = React.useState<SeasonalRate | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form for add/edit dialog
  const form = useForm<SeasonalRateInput>({
    resolver: zodResolver(seasonalRateSchema),
    defaultValues: {
      season_id: "",
      name: "",
      start_date: "",
      end_date: "",
      multiplier: 1.0,
      priority: 10,
      is_active: true,
      description: "",
      color: "blue",
    },
  });

  // Sync rates from props
  React.useEffect(() => {
    setLocalRates(rates);
  }, [rates]);

  // Handle adding a new rate
  const handleAdd = (data: SeasonalRateInput) => {
    const newRate: SeasonalRate = {
      ...data,
      id: `temp_${Date.now()}`, // Temporary ID for new rates
    };

    setLocalRates([...localRates, newRate]);
    setIsAddDialogOpen(false);
    form.reset();

    toast.success("Seasonal rate added", {
      description: `${data.name} has been added to the list. Click "Save All Changes" to persist.`,
    });
  };

  // Handle editing a rate
  const handleEdit = (data: SeasonalRateInput) => {
    if (!editingRate) return;

    const updatedRates = localRates.map((rate) =>
      rate.id === editingRate.id || rate.season_id === editingRate.season_id
        ? { ...rate, ...data }
        : rate
    );

    setLocalRates(updatedRates);
    setEditingRate(null);
    form.reset();

    toast.success("Seasonal rate updated", {
      description: `${data.name} has been updated. Click "Save All Changes" to persist.`,
    });
  };

  // Handle deleting a rate
  const handleDelete = (rateToDelete: SeasonalRate) => {
    setLocalRates(
      localRates.filter(
        (rate) => rate.id !== rateToDelete.id && rate.season_id !== rateToDelete.season_id
      )
    );

    toast.success("Seasonal rate removed", {
      description: `${rateToDelete.name} has been removed. Click "Save All Changes" to persist.`,
    });
  };

  // Handle toggling active state
  const handleToggleActive = (rateToToggle: SeasonalRate) => {
    const updatedRates = localRates.map((rate) =>
      rate.id === rateToToggle.id || rate.season_id === rateToToggle.season_id
        ? { ...rate, is_active: !rate.is_active }
        : rate
    );

    setLocalRates(updatedRates);
  };

  // Save all changes
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await onSave(localRates);
      toast.success("Changes saved", {
        description: "All seasonal rate changes have been saved successfully.",
      });
    } catch (_error) {
      toast.error("Error saving changes", {
        description: "Failed to save seasonal rates. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (rate: SeasonalRate) => {
    setEditingRate(rate);
    form.reset({
      season_id: rate.season_id,
      name: rate.name,
      start_date: rate.start_date,
      end_date: rate.end_date,
      multiplier: rate.multiplier,
      priority: rate.priority,
      is_active: rate.is_active,
      description: rate.description || "",
      color: rate.color || "blue",
    });
  };

  const getBadgeTone = (color?: string) =>
    COLOR_OPTIONS.find((opt) => opt.value === color)?.tone ?? COLOR_OPTIONS[0].tone;

  // Format date for display
  const formatDateRange = (start: string, end: string) => {
    // Convert MM-DD to readable format
    const startParts = start.split("-");
    const endParts = end.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const startMonth = months[parseInt(startParts[0]) - 1];
    const startDay = parseInt(startParts[1]);
    const endMonth = months[parseInt(endParts[0]) - 1];
    const endDay = parseInt(endParts[1]);

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  const renderActiveSwitch = (rate: SeasonalRate) => (
    <PricingActiveSwitch
      name={rate.name}
      isActive={rate.is_active}
      onToggle={() => handleToggleActive(rate)}
    />
  );

  const renderRowActions = (rate: SeasonalRate) => (
    <PricingRowActions
      name={rate.name}
      onEdit={() => openEditDialog(rate)}
      onDelete={() => handleDelete(rate)}
    />
  );

  const columns: ColumnDef<SeasonalRate>[] = [
    {
      accessorKey: "name",
      header: "Season",
      cell: ({ row }) => (
        <StatusBadge tone={getBadgeTone(row.original.color)}>{row.original.name}</StatusBadge>
      ),
    },
    {
      id: "date_range",
      header: "Date Range",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDateRange(row.original.start_date, row.original.end_date)}
        </span>
      ),
    },
    {
      accessorKey: "multiplier",
      header: "Multiplier",
      cell: ({ row }) => <MultiplierFigure multiplier={row.original.multiplier} />,
      meta: { align: "right" },
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

  const ratesByPriority = React.useMemo(
    () => [...localRates].sort((a, b) => b.priority - a.priority),
    [localRates]
  );

  const table = useReactTable({
    data: ratesByPriority,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (rate) => rate.season_id,
  });

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(localRates) !== JSON.stringify(rates);

  // Shared form fields used in both Add and Edit dialogs
  const renderFormFields = (isEditing: boolean) => (
    <>
      <FormField
        control={form.control}
        name="season_id"
        label="Season ID"
        description={
          isEditing
            ? "Season ID cannot be changed"
            : "Unique identifier (lowercase, underscores only)"
        }
      >
        {(field) => (
          <Input
            {...field}
            disabled={isEditing}
            placeholder="e.g., peak_summer"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>

      <FormField control={form.control} name="name" label="Display Name">
        {(field) => <Input {...field} placeholder="e.g., Peak Summer Season" />}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="start_date" label="Start Date (MM-DD)">
          {(field) => <Input {...field} placeholder="03-01" inputMode="numeric" />}
        </FormField>

        <FormField control={form.control} name="end_date" label="End Date (MM-DD)">
          {(field) => <Input {...field} placeholder="05-31" inputMode="numeric" />}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="multiplier"
          label="Price Multiplier"
          description={
            form.watch("multiplier") > 1
              ? `+${((form.watch("multiplier") - 1) * 100).toFixed(0)}% increase`
              : form.watch("multiplier") < 1
                ? `-${((1 - form.watch("multiplier")) * 100).toFixed(0)}% discount`
                : "No change"
          }
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              step="0.1"
              onChange={(e) => field.onChange(parseFloat(e.target.value))}
            />
          )}
        </FormField>

        <FormField
          control={form.control}
          name="priority"
          label="Priority"
          description="Higher priority wins if dates overlap"
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

      <FormField control={form.control} name="color" label="Badge Color">
        {(field) => (
          <SelectControl value={field.value} onValueChange={field.onChange}>
            {COLOR_OPTIONS.map((color) => (
              <SelectItem key={color.value} value={color.value}>
                <StatusBadge tone={color.tone}>{color.label}</StatusBadge>
              </SelectItem>
            ))}
          </SelectControl>
        )}
      </FormField>

      <FormField control={form.control} name="description" label="Description (Optional)">
        {(field) => <Input {...field} placeholder="e.g., Philippine summer vacation period" />}
      </FormField>

      <FormField
        control={form.control}
        name="is_active"
        label="Active"
        description="Enable this seasonal rate"
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
              <Calendar className="text-muted-foreground h-5 w-5" aria-hidden="true" />
              Seasonal Rates
            </CardTitle>
            <CardDescription>
              Configure seasonal pricing multipliers that automatically adjust rates based on dates
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button onClick={handleSaveAll} disabled={isSaving} size="sm">
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                Save All Changes
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add Season
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Seasonal Rate</DialogTitle>
                  <DialogDescription>
                    Create a new seasonal pricing period with custom rates
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAdd)} className="space-y-4">
                    {renderFormFields(false)}
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Add Season</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {localRates.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" aria-hidden="true" />
            <p>No seasonal rates configured</p>
            <p className="mt-2 text-sm">
              Add seasonal rates to automatically adjust pricing throughout the year
            </p>
          </div>
        ) : (
          <DataTable
            table={table}
            label="Seasonal rates"
            renderCard={(row) => (
              <ListCard>
                <div className="flex items-start justify-between gap-2">
                  <StatusBadge tone={getBadgeTone(row.original.color)}>
                    {row.original.name}
                  </StatusBadge>
                  {renderRowActions(row.original)}
                </div>
                <ListCardRow
                  label="Dates"
                  value={formatDateRange(row.original.start_date, row.original.end_date)}
                />
                <ListCardRow
                  label="Multiplier"
                  value={<MultiplierFigure multiplier={row.original.multiplier} />}
                />
                <ListCardRow label="Priority" value={row.original.priority} />
                <ListCardRow label="Active" value={renderActiveSwitch(row.original)} />
              </ListCard>
            )}
          />
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingRate} onOpenChange={(open) => !open && setEditingRate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Seasonal Rate</DialogTitle>
              <DialogDescription>Modify the seasonal pricing period settings</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
                {renderFormFields(true)}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditingRate(null)}>
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

function MultiplierFigure({ multiplier }: { multiplier: number }) {
  const percentChange =
    multiplier > 1
      ? `+${Math.round((multiplier - 1) * 100)}%`
      : multiplier < 1
        ? `-${Math.round((1 - multiplier) * 100)}%`
        : "0%";

  return (
    <div className="flex items-center justify-end gap-1 tabular-nums">
      {multiplier > 1 ? (
        <TrendingUp className="text-success-foreground h-4 w-4" aria-hidden="true" />
      ) : multiplier < 1 ? (
        <TrendingDown className="text-danger-foreground h-4 w-4" aria-hidden="true" />
      ) : null}
      <span>{multiplier}x</span>
      <span className="text-muted-foreground text-sm">({percentChange})</span>
    </div>
  );
}
