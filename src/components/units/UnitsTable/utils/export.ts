import { logger } from "@/lib/logger";
import { toManilaDateString } from "@/lib/timezone";
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
  link.setAttribute("download", `${filename}_${toManilaDateString(new Date())}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
