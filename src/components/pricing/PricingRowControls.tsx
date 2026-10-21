import { Edit2, Trash2 } from "lucide-react";

import { Button, Switch } from "@/components/patterns";

interface PricingActiveSwitchProps {
  name: string;
  isActive: boolean;
  onToggle: () => void;
}

/** The on/off switch for one seasonal rate or discount rule row. */
export function PricingActiveSwitch({ name, isActive, onToggle }: PricingActiveSwitchProps) {
  return <Switch checked={isActive} onCheckedChange={onToggle} aria-label={`${name} active`} />;
}

interface PricingRowActionsProps {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** The edit and delete buttons for one seasonal rate or discount rule row. */
export function PricingRowActions({ name, onEdit, onDelete }: PricingRowActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${name}`}>
        <Edit2 className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${name}`}>
        <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
