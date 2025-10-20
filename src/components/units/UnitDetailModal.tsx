import React from "react";

import { format } from "date-fns";
import { Calendar, DollarSign, Info, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/validations";
import type { Unit } from "@/types";

interface UnitDetailModalProps {
  unit: Unit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const showComponent = false;

export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({ unit, open, onOpenChange }) => {
  if (!unit) return null;

  const getStatusColor = (status: string | undefined) => {
    const colors = {
      Available: "bg-green-100 text-green-800",
      Occupied: "bg-red-100 text-red-800",
      Maintenance: "bg-yellow-100 text-yellow-800",
      Reserved: "bg-blue-100 text-blue-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Cabin Details</span>
            <Badge className={getStatusColor(unit.unit_status ?? undefined)}>
              {unit.unit_status ?? "Unknown"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-muted/30 rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-muted-foreground mb-1 text-sm">Cabin Code</p>
                <p className="font-mono text-lg font-semibold">{unit.unit_code}</p>
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground mb-1 text-sm">Cabin Name</p>
                <p className="text-lg font-medium">{unit.unit_name}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Occupancy & Pricing Card */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Occupancy Information */}
            <div className="rounded-lg border p-4">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Users className="text-muted-foreground h-4 w-4" />
                Occupancy
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Base Occupancy</span>
                  <span className="font-semibold">{unit.base_occupancy} guests</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Maximum Occupancy</span>
                  <span className="font-semibold">{unit.max_occupancy} guests</span>
                </div>
                {unit.base_occupancy < unit.max_occupancy && (
                  <div className="border-t pt-2">
                    <p className="text-muted-foreground text-xs">
                      Can accommodate {unit.max_occupancy - unit.base_occupancy} extra{" "}
                      {unit.max_occupancy - unit.base_occupancy === 1 ? "guest" : "guests"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Information */}
            <div className="rounded-lg border p-4">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <DollarSign className="text-muted-foreground h-4 w-4" />
                Pricing
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Nightly Rate</span>
                  <span className="text-lg font-semibold">{formatCurrency(unit.base_rate)}</span>
                </div>
                {unit.extra_person_rate && unit.extra_person_rate > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Extra Person</span>
                    <span className="font-semibold">+{formatCurrency(unit.extra_person_rate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Features & Amenities */}
          {showComponent && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <Info className="h-4 w-4" />
                  Features & Amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(unit?.amenities ?? []).map((feature, index) => (
                    <Badge key={index} variant="secondary">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Description */}
          {showComponent && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 font-semibold">Description</h3>
                <p className="text-muted-foreground bg-muted rounded-md p-3 text-sm">
                  {unit?.description ?? "No description available"}
                </p>
              </div>
            </>
          )}

          {/* Maintenance Information - field not in current schema */}
          {showComponent && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 font-semibold text-yellow-600">Maintenance Notes</h3>
                <p className="rounded-md bg-yellow-50 p-3 text-sm">
                  {/* maintenance_notes field not in schema */}
                </p>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="text-muted-foreground text-xs">
            {unit.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Created: {format(new Date(unit.created_at), "PPpp")}</span>
              </div>
            )}
            {unit.updated_at && (
              <div className="mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Last Updated: {format(new Date(unit.updated_at), "PPpp")}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
