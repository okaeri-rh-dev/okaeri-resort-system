import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { ulid } from "ulid";

import { LINE_ITEM_TYPE_LABELS, UNIT_LABEL_OPTIONS } from "@/components/documents/constants";
import { formatCurrency } from "@/components/tables/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentFormValues } from "@/lib/validation/document-schemas";

interface LineItemsSectionProps {
  form: UseFormReturn<DocumentFormValues>;
}

export function LineItemsSection({ form }: LineItemsSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  const handleAddItem = () => {
    append({
      id: ulid(),
      type: "accommodation",
      description: "",
      quantity: 1,
      unit_label: "night",
      unit_price: 0,
      amount: 0,
    });
  };

  const handleQuantityChange = (index: number, value: string) => {
    const qty = parseFloat(value) || 0;
    form.setValue(`line_items.${index}.quantity`, qty);
    const price = form.getValues(`line_items.${index}.unit_price`);
    form.setValue(`line_items.${index}.amount`, qty * price);
  };

  const handlePriceChange = (index: number, value: string) => {
    const price = parseFloat(value) || 0;
    form.setValue(`line_items.${index}.unit_price`, price);
    const qty = form.getValues(`line_items.${index}.quantity`);
    form.setValue(`line_items.${index}.amount`, qty * price);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide uppercase">Line Items</h3>
        <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
          <Plus className="mr-1 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {form.formState.errors.line_items?.root && (
        <p className="text-destructive text-sm">{form.formState.errors.line_items.root.message}</p>
      )}

      {fields.length === 0 && (
        <div className="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
          No line items yet. Click "Add Item" to start.
        </div>
      )}

      {/* Desktop table header */}
      {fields.length > 0 && (
        <div className="text-muted-foreground hidden grid-cols-[100px_1fr_80px_90px_110px_110px_40px] gap-2 text-xs font-medium lg:grid">
          <span>Type</span>
          <span>Description</span>
          <span>Qty</span>
          <span>Unit</span>
          <span>Unit Price</span>
          <span>Amount</span>
          <span />
        </div>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => {
          const amount = form.watch(`line_items.${index}.amount`);

          return (
            <div key={field.id}>
              {/* Desktop row */}
              <div className="hidden grid-cols-[100px_1fr_80px_90px_110px_110px_40px] items-start gap-2 lg:grid">
                <Select
                  value={form.watch(`line_items.${index}.type`)}
                  onValueChange={(val) => {
                    form.setValue(
                      `line_items.${index}.type`,
                      val as "accommodation" | "service" | "fee" | "custom"
                    );
                    if (val === "accommodation") {
                      form.setValue(`line_items.${index}.unit_label`, "night");
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LINE_ITEM_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  className="h-9 text-sm"
                  placeholder="Description"
                  {...form.register(`line_items.${index}.description`)}
                />

                <Input
                  className="h-9 text-right text-sm"
                  type="number"
                  min="0.01"
                  step="0.01"
                  {...form.register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                />

                <Select
                  value={form.watch(`line_items.${index}.unit_label`)}
                  onValueChange={(val) => form.setValue(`line_items.${index}.unit_label`, val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_LABEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  className="h-9 text-right text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register(`line_items.${index}.unit_price`, { valueAsNumber: true })}
                  onChange={(e) => handlePriceChange(index, e.target.value)}
                />

                <div className="flex h-9 items-center justify-end text-sm font-medium tabular-nums">
                  {formatCurrency(amount || 0)}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive h-9 w-9"
                  onClick={() => remove(index)}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Mobile card */}
              <Card className="lg:hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Select
                      value={form.watch(`line_items.${index}.type`)}
                      onValueChange={(val) =>
                        form.setValue(
                          `line_items.${index}.type`,
                          val as "accommodation" | "service" | "fee" | "custom"
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LINE_ITEM_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive min-h-[44px] min-w-[44px]"
                      onClick={() => remove(index)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <Input
                    placeholder="Description"
                    {...form.register(`line_items.${index}.description`)}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-muted-foreground mb-1 block text-xs">Qty</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="text-right"
                        {...form.register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-xs">Unit</label>
                      <Select
                        value={form.watch(`line_items.${index}.unit_label`)}
                        onValueChange={(val) =>
                          form.setValue(`line_items.${index}.unit_label`, val)
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_LABEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-xs">Price</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-right"
                        {...form.register(`line_items.${index}.unit_price`, {
                          valueAsNumber: true,
                        })}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="text-right text-sm font-semibold tabular-nums">
                    = {formatCurrency(amount || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
