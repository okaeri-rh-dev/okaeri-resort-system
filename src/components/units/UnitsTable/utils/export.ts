import { logger } from "@/lib/logger";
import type { Unit } from "@/types";

/**
 * Export units data to CSV format
 */
export async function exportUnitsToCSV(units: Unit[]) {
  try {
    // Try to use enhanced export if available (currently not implemented)
    const utilsModule = await import("@/components/tables/utils").catch(() => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exportEnhanced = utilsModule ? (utilsModule as any).exportEnhanced : null;

    if (exportEnhanced && typeof exportEnhanced === "function") {
      const exportData = units.map((unit) => ({
        unit_code: unit.unit_code,
        unit_name: unit.unit_name,
        unit_type: unit.unit_type,
        base_occupancy: unit.base_occupancy,
        max_occupancy: unit.max_occupancy,
        base_rate: unit.base_rate,
        extra_person_rate: unit.extra_person_rate,
        unit_status: unit.unit_status,
        created_date: unit.created_at,
        updated_date: unit.updated_at,
      }));

      await exportEnhanced(
        exportData,
        "units",
        [
          "Unit Code",
          "Unit Name",
          "Unit Type",
          "Base Occupancy",
          "Max Occupancy",
          "Base Rate",
          "Extra Person Rate",
          "Unit Status",
          "Created Date",
          "Updated Date",
        ],
        {
          philippineFormat: true,
          includeTimestamp: true,
          onSuccess: (filename: string) => {
            logger.info(`Successfully exported units to ${filename}`);
          },
          onError: (error: Error) => {
            logger.error("Export failed", error);
            throw error;
          },
        }
      );
    } else {
      // Fallback to basic CSV export
      basicCSVExport(units);
    }
  } catch (error) {
    logger.error("Enhanced export failed, using fallback", error);
    basicCSVExport(units);
  }
}

/**
 * Basic CSV export fallback
 */
function basicCSVExport(units: Unit[]) {
  const headers = [
    "Unit Code",
    "Unit Name",
    "Type",
    "Base Occupancy",
    "Max Occupancy",
    "Base Rate",
    "Weekend Rate",
    "Extra Person Rate",
    "Status",
  ];

  const rows = units.map((unit) => [
    unit.unit_code,
    unit.unit_name,
    unit.unit_type,
    unit.base_occupancy,
    unit.max_occupancy,
    formatCurrency(unit.base_rate),
    formatCurrency(unit.weekend_rate || 0),
    formatCurrency(unit.extra_person_rate || 0),
    unit.unit_status,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(csvContent, "units");
}

/**
 * Format number as Philippine Peso currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

/**
 * Trigger CSV download
 */
function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export selected units to CSV
 */
export function exportSelectedUnits(units: Unit[], selectedIndices: number[]) {
  const selectedUnits = selectedIndices.map((index) => units[index]).filter(Boolean);

  if (selectedUnits.length === 0) {
    logger.warn("No units selected for export");
    return;
  }

  void exportUnitsToCSV(selectedUnits);
}

/**
 * Get export statistics
 */
export function getExportStats(units: Unit[]) {
  const stats = {
    totalUnits: units.length,
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    averageRate: 0,
    totalCapacity: 0,
  };

  let totalRate = 0;

  units.forEach((unit) => {
    // Count by type
    stats.byType[unit.unit_type] = (stats.byType[unit.unit_type] || 0) + 1;

    // Count by status (null-safe)
    const status = unit.unit_status ?? "Unknown";
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // Sum rates and capacity
    totalRate += unit.base_rate;
    stats.totalCapacity += unit.max_occupancy;
  });

  stats.averageRate = units.length > 0 ? totalRate / units.length : 0;

  return stats;
}
