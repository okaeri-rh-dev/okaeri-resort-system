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
 * - Mobile responsive grid (1/2/3 columns)
 * - Professional enterprise styling with high information density
 *
 * Source: docs/implementation/guest-booking-multi-unit/chunks/013-unit-assignment-system/
 */

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  unitRequests: UnitRequest[];
  onAssignmentSuccess: () => void;
}

interface AssignmentValidation {
  isValid: boolean;
  message: string;
  variant: "default" | "destructive" | "warning";
  isSuccess: boolean;
}

// ============================================
// Component
// ============================================

export function UnitAssignmentInterface({
  bookingId,
  checkInDate,
  checkOutDate,
  unitRequests,
  onAssignmentSuccess,
}: UnitAssignmentInterfaceProps) {
  const queryClient = useQueryClient();
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // ============================================
  // Data Fetching - Available Units
  // ============================================

  const {
    data: availableUnits,
    isLoading: isLoadingUnits,
    error: fetchError,
  } = useQuery({
    queryKey: ["available-units", checkInDate, checkOutDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/available-units?check_in_date=${encodeURIComponent(checkInDate)}&check_out_date=${encodeURIComponent(checkOutDate)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Failed to fetch units" }))) as { error?: string };
        throw new Error(errorData.error || "Failed to fetch available units");
      }

      const data = (await response.json()) as { units: AvailableUnit[] };
      return data.units || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // ============================================
  // Assignment Mutation
  // ============================================

  const assignMutation = useMutation({
    mutationFn: async (unitIds: string[]) => {
      const response = await fetch("/api/admin/assign-units", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
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
        throw new Error(errorData.error || "Failed to assign units");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["pending-multi-unit-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["available-units"] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });

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
        errorMessage = "Payment verification required before unit assignment";
      } else if (errorMessage.includes("conflict")) {
        errorMessage = "Unit conflict detected. Please refresh and try again";
      } else if (errorMessage.includes("all-or-nothing")) {
        errorMessage = "All units must be assigned together";
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

    if (selectedCount === 0) {
      return {
        isValid: false,
        message: `Select ${requiredCount} unit${requiredCount > 1 ? "s" : ""} to proceed`,
        variant: "destructive",
        isSuccess: false,
      };
    }

    if (selectedCount < requiredCount) {
      return {
        isValid: false,
        message: `Must select ALL ${requiredCount} units (currently selected: ${selectedCount})`,
        variant: "destructive",
        isSuccess: false,
      };
    }

    if (selectedCount > requiredCount) {
      return {
        isValid: false,
        message: `Too many units selected. Need exactly ${requiredCount}, but selected ${selectedCount}`,
        variant: "destructive",
        isSuccess: false,
      };
    }

    return {
      isValid: true,
      message: "All units selected - ready to assign",
      variant: "default",
      isSuccess: true,
    };
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

    // Native confirmation dialog
    const confirmed = window.confirm(
      `Confirm unit assignment?\n\nThis will assign ${selectedUnits.size} unit(s) to booking ${bookingId}.\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      assignMutation.mutate(Array.from(selectedUnits));
    }
  };

  // ============================================
  // Derived State
  // ============================================

  const validation = getValidationStatus();
  const requiredCount = unitRequests.length;
  const totalGuests = unitRequests.reduce((sum, req) => sum + req.guests_per_unit, 0);
  const isAssignmentDisabled = !validation.isValid || assignMutation.isPending;

  // ============================================
  // Render States
  // ============================================

  if (isLoadingUnits) {
    return (
      <Card className="border-neutral-200">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-neutral-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading available units...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card className="border-neutral-200">
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load available units. {fetchError.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!availableUnits || availableUnits.length === 0) {
    return (
      <Card className="border-neutral-200">
        <CardContent className="py-8">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No units available for the selected dates ({checkInDate} to {checkOutDate}). Please
              contact the guest to reschedule.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="space-y-4">
      {/* Unit Requests Summary Card */}
      <Card className="border-neutral-200 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-neutral-600">Total Units Requested</p>
            <p className="font-mono text-2xl font-semibold text-neutral-900">{requiredCount}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-600">Total Guests</p>
            <p className="font-mono text-2xl font-semibold text-neutral-900">{totalGuests}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-600">Date Range</p>
            <p className="text-sm font-medium text-neutral-900">
              {checkInDate} to {checkOutDate}
            </p>
          </div>
        </div>

        {/* Unit Breakdown */}
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="mb-2 text-sm font-medium text-neutral-700">Individual Unit Breakdown:</p>
          <div className="flex flex-wrap gap-2">
            {unitRequests.map((req, index) => (
              <div
                key={req.id}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5"
              >
                <span className="text-xs font-medium text-neutral-700">Unit {index + 1}:</span>
                <span className="font-mono text-xs font-semibold text-neutral-900">
                  {req.guests_per_unit} guest{req.guests_per_unit > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* All-or-Nothing Status Indicator */}
      <Alert
        variant={validation.variant}
        className={validation.isSuccess ? "border-green-200 bg-green-50 text-green-900" : ""}
      >
        {validation.isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <AlertDescription className="flex items-center justify-between">
          <span className="font-medium">{validation.message}</span>
          <span className="font-mono text-sm font-semibold">
            {selectedUnits.size}/{requiredCount} selected
          </span>
        </AlertDescription>
      </Alert>

      {/* Assignment Error Display */}
      {assignmentError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{assignmentError}</AlertDescription>
        </Alert>
      )}

      {/* Available Units Grid */}
      <Card className="overflow-hidden border-neutral-200 p-0">
        <CardHeader className="border-b border-neutral-200 bg-neutral-50 p-4">
          <CardTitle className="text-base font-semibold">
            Available Units ({availableUnits.length})
          </CardTitle>
          <CardDescription className="text-sm">
            Click to select units for assignment. All units must be selected before proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableUnits.map((unit) => {
              const isSelected = selectedUnits.has(unit.unit_id);

              return (
                <div
                  key={unit.unit_id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Unit ${unit.unit_number} - ${unit.unit_type}, ${isSelected ? "selected" : "not selected"}`}
                  onClick={() => handleUnitToggle(unit.unit_id)}
                  onKeyDown={(e) => handleKeyboardToggle(e, unit.unit_id)}
                  className={cn(
                    "relative cursor-pointer rounded-lg border-2 p-4 transition-all",
                    "hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none",
                    isSelected
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  )}
                >
                  {/* Selection Checkbox */}
                  <div className="absolute top-3 right-3">
                    <Checkbox
                      checked={isSelected}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none"
                      onCheckedChange={() => {}}
                    />
                  </div>

                  {/* Unit Information */}
                  <div className="pr-8">
                    <p className="font-mono text-lg font-semibold text-neutral-900">
                      Unit {unit.unit_number}
                    </p>
                    <p className="mt-1 text-sm font-medium text-neutral-700">{unit.unit_type}</p>

                    <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600">Max Capacity</span>
                        <span className="font-mono text-xs font-semibold text-neutral-900">
                          {unit.max_capacity} guests
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600">Rate/Night</span>
                        <span className="font-mono text-xs font-semibold text-neutral-900">
                          ₱{unit.rate_per_night.toLocaleString()}
                        </span>
                      </div>

                      {unit.floor_level !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-600">Floor</span>
                          <span className="font-mono text-xs font-semibold text-neutral-900">
                            {unit.floor_level}
                          </span>
                        </div>
                      )}

                      {unit.view_type && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-600">View</span>
                          <span className="text-xs font-medium text-neutral-900">
                            {unit.view_type}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Assignment Button */}
      <div className="border-t border-neutral-200 bg-neutral-50 p-4">
        <Button
          onClick={handleAssignment}
          disabled={isAssignmentDisabled}
          className="w-full"
          size="lg"
        >
          {assignMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Assigning Units...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Assign {requiredCount} Unit{requiredCount > 1 ? "s" : ""} to Booking
            </>
          )}
        </Button>

        {/* Helper Text */}
        <p className="mt-2 text-center text-xs text-neutral-600">
          This action will immediately assign the selected units and send confirmation to the guest
        </p>
      </div>
    </div>
  );
}
