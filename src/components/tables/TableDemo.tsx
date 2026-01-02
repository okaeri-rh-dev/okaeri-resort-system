import React, { useState } from "react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import type { Guest, Unit } from "@/types";

// Import our table components
import { BookingsTable, GuestsTable, UnitsTable } from "./index";

/**
 * Demo component to test all table functionality
 * This component demonstrates the enterprise table system
 */
export const TableDemo: React.FC = () => {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  // Demo handlers
  // Note: Edit now uses direct Link navigation in BookingColumns

  const handleViewUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    logger.info("View unit:", { unit });
  };

  const handleEditUnit = (unit: Unit) => {
    logger.info("Edit unit:", { unit });
  };

  const handleViewGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    logger.info("View guest:", { guest });
  };

  const handleEditGuest = (guest: Guest) => {
    logger.info("Edit guest:", { guest });
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-900">
          Okaeri Resort System - Enterprise Tables
        </h1>
        <p className="text-neutral-600">
          Comprehensive TanStack Table components with professional design, mobile responsiveness,
          and Philippine business formatting.
        </p>
      </div>

      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="units">Cabins</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-neutral-900">Bookings Management</h2>
                <p className="text-sm text-neutral-600">
                  Full-featured booking table with sorting, filtering, pagination, status updates,
                  payment management, and CSV export.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-700">Features:</h3>
                <ul className="grid grid-cols-2 gap-1 text-xs text-neutral-600">
                  <li>• Status-based row coloring</li>
                  <li>• Date range filtering</li>
                  <li>• Payment proof upload</li>
                  <li>• Mobile-responsive cards</li>
                  <li>• Booking reference search</li>
                  <li>• Export to CSV</li>
                  <li>• Real-time status updates</li>
                  <li>• Philippine peso formatting</li>
                </ul>
              </div>
            </div>
          </Card>

          <BookingsTable />
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-neutral-900">Cabins Management</h2>
                <p className="text-sm text-neutral-600">
                  Unit management with inline rate editing, bulk operations, status management, and
                  grid/list view toggle.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-700">Features:</h3>
                <ul className="grid grid-cols-2 gap-1 text-xs text-neutral-600">
                  <li>• Inline rate editing</li>
                  <li>• Bulk status updates</li>
                  <li>• Grid and list views</li>
                  <li>• Status badges</li>
                  <li>• Type and status filtering</li>
                  <li>• Availability indicators</li>
                  <li>• Mobile card view</li>
                  <li>• Maintenance tracking</li>
                </ul>
              </div>

              {selectedUnit && (
                <div className="rounded border border-green-200 bg-green-50 p-3 text-sm">
                  <strong>Selected:</strong> {selectedUnit.unit_code} - {selectedUnit.unit_name}
                </div>
              )}
            </div>
          </Card>

          <UnitsTable onViewUnit={handleViewUnit} onEditUnit={handleEditUnit} />
        </TabsContent>

        <TabsContent value="guests" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-neutral-900">Guests Management</h2>
                <p className="text-sm text-neutral-600">
                  Guest directory with booking history, contact actions, revenue tracking, and
                  customer analytics.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-700">Features:</h3>
                <ul className="grid grid-cols-2 gap-1 text-xs text-neutral-600">
                  <li>• Expandable booking history</li>
                  <li>• Contact integration</li>
                  <li>• Revenue tracking</li>
                  <li>• Customer type badges</li>
                  <li>• Search by all fields</li>
                  <li>• Statistics dashboard</li>
                  <li>• Email and phone actions</li>
                  <li>• Export guest data</li>
                </ul>
              </div>

              {selectedGuest && (
                <div className="rounded border border-purple-200 bg-purple-50 p-3 text-sm">
                  <strong>Selected:</strong> {selectedGuest.guest_name} - {selectedGuest.email}
                </div>
              )}
            </div>
          </Card>

          <GuestsTable onViewGuest={handleViewGuest} onEditGuest={handleEditGuest} />
        </TabsContent>
      </Tabs>

      <Card className="bg-neutral-50 p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">Enterprise Design Principles</h3>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium text-neutral-700">Information Density</h4>
              <ul className="space-y-1 text-neutral-600">
                <li>• 40px row heights for maximum data</li>
                <li>• Compact layouts with minimal whitespace</li>
                <li>• Zebra striping for easy scanning</li>
                <li>• Monospace fonts for financial data</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-neutral-700">Professional Styling</h4>
              <ul className="space-y-1 text-neutral-600">
                <li>• Corporate blue primary color</li>
                <li>• Neutral gray-heavy interface</li>
                <li>• High contrast (4.5:1 minimum)</li>
                <li>• Conservative design choices</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-neutral-700">Mobile Responsiveness</h4>
              <ul className="space-y-1 text-neutral-600">
                <li>• Card layouts below 768px</li>
                <li>• Touch-friendly interactions</li>
                <li>• Optimized for business use</li>
                <li>• Maintains functionality</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-neutral-700">Philippine Context</h4>
              <ul className="space-y-1 text-neutral-600">
                <li>• ₱ peso symbol with comma separators</li>
                <li>• Compact date formatting</li>
                <li>• Mobile-first design patterns</li>
                <li>• GCash integration ready</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TableDemo;
