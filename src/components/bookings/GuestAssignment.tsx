/**
 * GuestAssignment Component
 *
 * Modal/Dialog for assigning guests to specific units:
 * - Guest count validation (within unit capacity)
 * - Optional special requests per unit
 * - Save/Cancel actions
 * - Mobile-responsive design
 *
 * @module GuestAssignment
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BookingUnit } from "@/types/multi-unit-booking";

// ============================================
// TYPES
// ============================================

export interface GuestAssignmentProps {
  unit: BookingUnit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (unitId: string, numGuests: number, specialRequests?: string) => void;
}

interface FormState {
  numGuests: number;
  specialRequests: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function GuestAssignment({ unit, open, onOpenChange, onSave }: GuestAssignmentProps) {
  const [formState, setFormState] = useState<FormState>({
    numGuests: unit?.guest_assignment?.num_guests || unit?.base_occupancy || 1,
    specialRequests: unit?.guest_assignment?.special_requests || "",
  });
  const [tempGuestCount, setTempGuestCount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Update form state when unit changes
  useEffect(() => {
    if (unit) {
      const numGuests = unit.guest_assignment?.num_guests || unit.base_occupancy;
      setFormState({
        numGuests,
        specialRequests: unit.guest_assignment?.special_requests || "",
      });
      setTempGuestCount(String(numGuests));
      setError(null);
    }
  }, [unit]);

  const handleSave = () => {
    if (!unit) return;

    // Validation
    if (formState.numGuests < 1) {
      setError("At least 1 guest is required");
      return;
    }

    if (formState.numGuests > unit.max_occupancy) {
      setError(`Maximum ${unit.max_occupancy} guests allowed for this unit`);
      return;
    }

    // Save and close
    onSave(unit.unit_id, formState.numGuests, formState.specialRequests);
    onOpenChange(false);
    setError(null);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setError(null);
    // Reset form to current unit values
    if (unit) {
      const numGuests = unit.guest_assignment?.num_guests || unit.base_occupancy;
      setFormState({
        numGuests,
        specialRequests: unit.guest_assignment?.special_requests || "",
      });
      setTempGuestCount(String(numGuests));
    }
  };

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="guest-assignment-description">
        <DialogHeader>
          <DialogTitle>Assign Guests to {unit.unit_name}</DialogTitle>
          <DialogDescription id="guest-assignment-description">
            Assign the number of guests and add any special requests for this unit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Guest Count Input */}
          <div className="space-y-2">
            <Label htmlFor="num-guests">
              Number of Guests <span className="text-destructive">*</span>
            </Label>
            <Input
              id="num-guests"
              type="number"
              min={1}
              max={unit.max_occupancy}
              value={tempGuestCount}
              onChange={(e) => {
                const inputValue = e.target.value;
                setTempGuestCount(inputValue);

                // Update formState only if valid number
                const numValue = e.target.valueAsNumber;
                if (!isNaN(numValue)) {
                  setFormState((prev) => ({ ...prev, numGuests: numValue }));
                  setError(null);
                }
              }}
              onBlur={() => {
                // On blur, if empty or invalid, reset to base occupancy
                if (tempGuestCount === "" || isNaN(Number(tempGuestCount))) {
                  const defaultVal = unit.base_occupancy;
                  setTempGuestCount(String(defaultVal));
                  setFormState((prev) => ({ ...prev, numGuests: defaultVal }));
                }
              }}
              className="h-11"
              aria-describedby="num-guests-hint"
              aria-invalid={!!error}
              aria-required="true"
            />
            <p id="num-guests-hint" className="text-sm text-muted-foreground">
              Maximum {unit.max_occupancy} guests for this unit
            </p>
          </div>

          {/* Special Requests Textarea */}
          <div className="space-y-2">
            <Label htmlFor="special-requests">Special Requests (Optional)</Label>
            <Textarea
              id="special-requests"
              value={formState.specialRequests}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, specialRequests: e.target.value }))
              }
              placeholder="E.g., Early check-in, extra towels, specific room preferences..."
              rows={4}
              className="resize-none"
              maxLength={500}
              aria-describedby="special-requests-hint"
            />
            <p id="special-requests-hint" className="text-sm text-muted-foreground">
              {formState.specialRequests.length}/500 characters
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="h-11"
            aria-label="Cancel guest assignment"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} className="h-11" aria-label="Save guest assignment">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
