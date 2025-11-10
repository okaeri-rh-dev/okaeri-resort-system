import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Calendar, Edit2, Plus, Save, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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

// Color options for seasonal rates
const COLOR_OPTIONS = [
  {
    value: "blue",
    label: "Blue",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    value: "green",
    label: "Green",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    value: "orange",
    label: "Orange",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    value: "red",
    label: "Red",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  {
    value: "purple",
    label: "Purple",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
];

interface SeasonalRatesFormProps {
  rates: SeasonalRate[];
  onSave: (rates: SeasonalRate[]) => Promise<void>;
  isLoading?: boolean;
}

export function SeasonalRatesForm({ rates = [], onSave, isLoading }: SeasonalRatesFormProps) {
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
    } catch (error) {
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

  // Get badge color class
  const getBadgeColorClass = (color?: string) => {
    return (
      COLOR_OPTIONS.find((opt) => opt.value === color)?.className || COLOR_OPTIONS[0].className
    );
  };

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

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(localRates) !== JSON.stringify(rates);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="text-muted-foreground h-5 w-5" />
              Seasonal Rates
            </CardTitle>
            <CardDescription>
              Configure seasonal pricing multipliers that automatically adjust rates based on dates
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button onClick={handleSaveAll} disabled={isSaving} size="sm">
                <Save className="mr-2 h-4 w-4" />
                Save All Changes
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Season
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Seasonal Rate</DialogTitle>
                  <DialogDescription>
                    Create a new seasonal pricing period with custom rates
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAdd)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="season_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Season ID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., peak_summer" />
                          </FormControl>
                          <FormDescription>
                            Unique identifier (lowercase, underscores only)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Peak Summer Season" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date (MM-DD)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="03-01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date (MM-DD)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="05-31" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="multiplier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price Multiplier</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.1"
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              {field.value > 1
                                ? `+${((field.value - 1) * 100).toFixed(0)}% increase`
                                : field.value < 1
                                  ? `-${((1 - field.value) * 100).toFixed(0)}% discount`
                                  : "No change"}
                            </FormDescription>
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
                            <FormDescription>Higher priority wins if dates overlap</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Badge Color</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {COLOR_OPTIONS.map((color) => (
                                <SelectItem key={color.value} value={color.value}>
                                  <div className="flex items-center gap-2">
                                    <Badge className={color.className} variant="secondary">
                                      {color.label}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                            <Input
                              {...field}
                              placeholder="e.g., Philippine summer vacation period"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="is_active"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Active</FormLabel>
                            <FormDescription>Enable this seasonal rate</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

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
            <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No seasonal rates configured</p>
            <p className="mt-2 text-sm">
              Add seasonal rates to automatically adjust pricing throughout the year
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localRates
                .sort((a, b) => b.priority - a.priority)
                .map((rate) => (
                  <TableRow key={rate.season_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getBadgeColorClass(rate.color)} variant="secondary">
                          {rate.name}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDateRange(rate.start_date, rate.end_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {rate.multiplier > 1 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : rate.multiplier < 1 ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : null}
                        <span className="font-mono">{rate.multiplier}x</span>
                        <span className="text-muted-foreground text-sm">
                          (
                          {rate.multiplier > 1
                            ? `+${Math.round((rate.multiplier - 1) * 100)}%`
                            : rate.multiplier < 1
                              ? `-${Math.round((1 - rate.multiplier) * 100)}%`
                              : "0%"}
                          )
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rate.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rate.is_active}
                        onCheckedChange={() => handleToggleActive(rate)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(rate)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rate)}>
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
        <Dialog open={!!editingRate} onOpenChange={(open) => !open && setEditingRate(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Seasonal Rate</DialogTitle>
              <DialogDescription>Modify the seasonal pricing period settings</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="season_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season ID</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormDescription>Season ID cannot be changed</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date (MM-DD)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (MM-DD)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="multiplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Multiplier</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value > 1
                            ? `+${((field.value - 1) * 100).toFixed(0)}% increase`
                            : field.value < 1
                              ? `-${((1 - field.value) * 100).toFixed(0)}% discount`
                              : "No change"}
                        </FormDescription>
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
                        <FormDescription>Higher priority wins if dates overlap</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge Color</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COLOR_OPTIONS.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <Badge className={color.className} variant="secondary">
                                  {color.label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>Enable this seasonal rate</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

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
