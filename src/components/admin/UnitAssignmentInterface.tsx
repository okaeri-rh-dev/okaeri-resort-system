/**
 * Unit Assignment Interface Component
 *
 * Professional enterprise interface for assigning units to multi-unit bookings
 * with all-or-nothing enforcement.
 *
 * Features:
 * - Information-dense layout optimized for rapid unit selection
 * - Real-time all-or-nothing validation feedback
 * - Keyboard navigation and WCAG accessibility compliance
 * - Responsive grid (1/2/3 columns)
 *
 * Source: vault note [[013-unit-assignment-system README]]
 */

import { useCallback, useState } from "react";

import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
} from "@/components/patterns";
import { getAccessToken, useAuthToken } from "@/hooks/useAuthToken";
import { afterBookingUpdate } from "@/lib/query-invalidation";
import { availabilityKeys } from "@/lib/query-keys";
import { cn, formatCurrency } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface UnitRequest {
  id: string;
  guests_per_unit: number;
}

interface AvailableUnit {
  unit_id: string;
  unit_number: string;
  unit_type: string;
  max_capacity: number;
  rate_per_night: number;
  floor_level?: number | null;
  view_type?: string | null;
}

interface UnitAssignmentInterfaceProps {
  bookingId: string;
  bookingReference: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  unitRequests: UnitRequest[];
  onAssignmentSuccess: () => void;
}

interface AssignmentValidation {
  isValid: boolean;
  message: string;
}

const availableUnitsQuery = (checkInDate: string, checkOutDate: string) =>
  queryOptions({
    queryKey: availabilityKeys.availableUnits.range(checkInDate, checkOutDate),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch(
        `/api/admin/available-units?check_in_date=${encodeURIComponent(checkInDate)}&check_out_date=${encodeURIComponent(checkOutDate)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Failed to fetch cabins" }))) as { error?: string };
        throw new Error(errorData.error || "Failed to fetch available cabins");
      }

      const data = (await response.json()) as { units: AvailableUnit[] };
      return data.units || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

// ============================================
// Component
// ============================================

export function UnitAssignmentInterface({
  bookingId,
  bookingReference,
  checkInDate,
  checkOutDate,
  unitRequests,
  onAssignmentSuccess,
}: UnitAssignmentInterfaceProps) {
  const { token: authToken, isLoading: isAuthLoading, error: authError } = useAuthToken();
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  // ============================================
  // Data Fetching - Available Units
  // ============================================

  const {
    data: availableUnits,
    isLoading: isLoadingUnits,
    error: fetchError,
  } = useQuery(availableUnitsQuery(checkInDate, checkOutDate));

  // ============================================
  // Assignment Mutation
  // ============================================

  const { mutate: assignUnits, isPending: isAssigning } = useMutation({
    mutationFn: async (unitIds: string[]) => {
      if (!authToken) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      const response = await fetch("/api/admin/assign-units", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id: bookingId,
          unit_ids: unitIds,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: "Assignment failed" }))) as {
          error?: string;
        };
        throw new Error(errorData.error || "Failed to assign cabins");
      }

      return response.json();
    },
    onSuccess: () => {
      afterBookingUpdate();

      // Clear selection and errors
      setSelectedUnits(new Set());
      setAssignmentError(null);

      // Notify parent component
      onAssignmentSuccess();
    },
    onError: (error: Error) => {
      // Parse specific error messages
      let errorMessage = error.message;

      if (errorMessage.includes("payment")) {
        errorMessage = "Payment verification required before cabin assignment";
      } else if (errorMessage.includes("conflict")) {
        errorMessage = "Cabin conflict detected. Please refresh and try again";
      } else if (errorMessage.includes("all-or-nothing")) {
        errorMessage = "All cabins must be assigned together";
      }

      setAssignmentError(errorMessage);
    },
  });

  // ============================================
  // Selection Handlers
  // ============================================

  const handleUnitToggle = (unitId: string) => {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
    // Clear error when user interacts
    setAssignmentError(null);
  };

  const handleKeyboardToggle = (event: React.KeyboardEvent, unitId: string) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleUnitToggle(unitId);
    }
  };

  // ============================================
  // Validation Logic
  // ============================================

  const getValidationStatus = (): AssignmentValidation => {
    const requiredCount = unitRequests.length;
    const selectedCount = selectedUnits.size;
    const cabins = (count: number, qualifier = "") =>
      `${count} ${qualifier}cabin${count === 1 ? "" : "s"}`;

    if (selectedCount === 0) {
      return { isValid: false, message: `Select ${cabins(requiredCount)} to proceed` };
    }

    if (selectedCount < requiredCount) {
      return {
        isValid: false,
        message: `Select ${cabins(requiredCount - selectedCount, "more ")}`,
      };
    }

    if (selectedCount > requiredCount) {
      return {
        isValid: false,
        message: `Too many cabins selected. Deselect ${cabins(selectedCount - requiredCount)}`,
      };
    }

    return { isValid: true, message: "All cabins selected, ready to assign" };
  };

  // ============================================
  // Assignment Handler
  // ============================================

  const handleAssignment = () => {
    const validation = getValidationStatus();

    if (!validation.isValid) {
      setAssignmentError(validation.message);
      return;
    }

    setShowAssignDialog(true);
  };

  const confirmAssignment = useCallback(() => {
    assignUnits(Array.from(selectedUnits));
    setShowAssignDialog(false);
  }, [assignUnits, selectedUnits]);

  // ============================================
  // Derived State
  // ============================================

  const validation = getValidationStatus();
  const requiredCount = unitRequests.length;
  const isAssignmentDisabled = !validation.isValid || isAssigning;

  // ============================================
  // Render States
  // ============================================

  if (isAuthLoading) {
    return <LoadingCard label="Authenticating..." />;
  }

  if (authError) {
    return (
      <Callout tone="danger">
        {authError.message || "Authentication failed. Please sign in again."}
      </Callout>
    );
  }

  if (isLoadingUnits) {
    return <LoadingCard label="Loading available cabins..." />;
  }

  if (fetchError) {
    return <Callout tone="danger">Failed to load available cabins. {fetchError.message}</Callout>;
  }

  if (!availableUnits || availableUnits.length === 0) {
    return (
      <Callout tone="warning">
        No cabins available for the selected dates ({checkInDate} to {checkOutDate}). Please contact
        the guest to reschedule.
      </Callout>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="space-y-4">
      <Callout tone={validation.isValid ? "success" : "warning"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{validation.message}</span>
          <span className="font-semibold tabular-nums">
            {selectedUnits.size}/{requiredCount} selected
          </span>
        </div>
      </Callout>

      {assignmentError && <Callout tone="danger">{assignmentError}</Callout>}

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="border-b p-4">
          <CardTitle className="text-base font-semibold">
            Available Cabins (<span className="tabular-nums">{availableUnits.length}</span>)
          </CardTitle>
          <CardDescription>
            Click to select cabins for assignment. All cabins must be selected before proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="medium:grid-cols-2 large:grid-cols-3 grid grid-cols-1 gap-3">
            {availableUnits.map((unit) => {
              const isSelected = selectedUnits.has(unit.unit_id);

              return (
                <div
                  key={unit.unit_id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Cabin ${unit.unit_number} - ${unit.unit_type}, ${isSelected ? "selected" : "not selected"}`}
                  onClick={() => handleUnitToggle(unit.unit_id)}
                  onKeyDown={(e) => handleKeyboardToggle(e, unit.unit_id)}
                  className={cn(
                    "bg-card text-card-foreground relative cursor-pointer rounded-lg border-2 p-4 transition-colors duration-150",
                    "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    isSelected ? "border-primary bg-accent" : "hover:border-input border-border"
                  )}
                >
                  <div className="absolute top-3 right-3">
                    <Checkbox
                      checked={isSelected}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none"
                      onCheckedChange={() => {}}
                    />
                  </div>

                  <div className="pr-8">
                    <p className="text-lg font-semibold">Cabin {unit.unit_number}</p>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                      {unit.unit_type}
                    </p>

                    <dl className="mt-3 space-y-1 border-t pt-3 text-xs">
                      <UnitFact label="Max Capacity">
                        <span className="tabular-nums">{unit.max_capacity}</span> guests
                      </UnitFact>
                      <UnitFact label="Rate/Night">
                        <span className="tabular-nums">{formatCurrency(unit.rate_per_night)}</span>
                      </UnitFact>
                      {unit.floor_level !== null && unit.floor_level !== undefined && (
                        <UnitFact label="Floor">
                          <span className="tabular-nums">{unit.floor_level}</span>
                        </UnitFact>
                      )}
                      {unit.view_type && <UnitFact label="View">{unit.view_type}</UnitFact>}
                    </dl>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted rounded-lg border p-4">
        <Button
          onClick={handleAssignment}
          disabled={isAssignmentDisabled}
          className="w-full"
          size="lg"
        >
          {isAssigning ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Assigning Cabins...
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Assign {requiredCount} Cabin{requiredCount > 1 ? "s" : ""} to Booking
            </>
          )}
        </Button>

        <p className="text-muted-foreground mt-2 text-center text-xs">
          This action will immediately assign the selected cabins and send confirmation to the guest
        </p>
      </div>

      <AlertDialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Cabin Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will assign {selectedUnits.size} cabin(s) to booking {bookingReference}. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAssignment}>Assign Cabins</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground flex items-center justify-center gap-3 py-12">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </CardContent>
    </Card>
  );
}

function UnitFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
