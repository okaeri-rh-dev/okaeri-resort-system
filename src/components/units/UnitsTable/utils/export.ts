import { toManilaDateString } from "@/lib/timezone";
import type { Unit } from "@/types";

/**
 * Export units data to CSV format
 */
export async function exportUnitsToCSV(units: Unit[]) {
  basicCSVExport(units);
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
