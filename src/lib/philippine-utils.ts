/**
 * Philippine-specific utility functions for resort management
 * Includes currency, phone, date, and address formatting
 */

// Philippine Peso Currency Formatting
export const formatPHP = (amount: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
};

// Compact currency formatting for dashboards
export const formatPHPCompact = (amount: number) => {
  if (amount >= 1_000_000) {
    return `${formatPHP(amount / 1_000_000)}M`;
  }
  if (amount >= 1_000) {
    return `${formatPHP(amount / 1_000)}K`;
  }
  return formatPHP(amount);
};

// Philippine Phone Number Formatting
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Handle different phone number formats
  if (digits.startsWith("63")) {
    // International format: +63 XXX XXX XXXX
    const match = digits.match(/^63(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+63 ${match[1]} ${match[2]} ${match[3]}`;
    }
  } else if (digits.startsWith("09")) {
    // Mobile format: 09XX XXX XXXX
    const match = digits.match(/^(09\d{2})(\d{3})(\d{4})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]}`;
    }
  } else if (digits.startsWith("02")) {
    // Manila landline: (02) XXXX XXXX
    const match = digits.match(/^(02)(\d{4})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]} ${match[3]}`;
    }
  }

  return phone; // Return original if no match
};

// Validate Philippine phone number
export const isValidPhoneNumber = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");

  // Check for valid Philippine phone patterns
  return (
    /^63\d{10}$/.test(digits) || // +63 international format
    /^09\d{9}$/.test(digits) || // 09XX mobile format
    /^02\d{8}$/.test(digits) // 02 Manila landline
  );
};

// Philippine Date Formatting
export const formatPhilippineDate = (
  date: Date | string,
  options?: {
    includeTime?: boolean;
    timeZone?: string;
    format?: "short" | "medium" | "long";
  }
) => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const timeZone = options?.timeZone || "Asia/Manila";
  const format = options?.format || "medium";

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    year: "numeric",
    month: format === "short" ? "numeric" : format === "medium" ? "short" : "long",
    day: "numeric",
  };

  if (options?.includeTime) {
    formatOptions.hour = "2-digit";
    formatOptions.minute = "2-digit";
    formatOptions.hour12 = true;
  }

  return new Intl.DateTimeFormat("en-PH", formatOptions).format(dateObj);
};

// Philippine Holiday Checker
export const philippineHolidays = {
  2024: [
    { date: "2024-01-01", name: "New Year's Day", type: "regular" },
    { date: "2024-02-25", name: "EDSA People Power Revolution Anniversary", type: "special" },
    { date: "2024-04-09", name: "Araw ng Kagitingan", type: "regular" },
    { date: "2024-05-01", name: "Labor Day", type: "regular" },
    { date: "2024-06-12", name: "Independence Day", type: "regular" },
    { date: "2024-08-19", name: "Quezon City Day", type: "special" },
    { date: "2024-08-26", name: "National Heroes Day", type: "regular" },
    { date: "2024-11-01", name: "All Saints' Day", type: "special" },
    { date: "2024-11-30", name: "Bonifacio Day", type: "regular" },
    { date: "2024-12-25", name: "Christmas Day", type: "regular" },
    { date: "2024-12-30", name: "Rizal Day", type: "regular" },
    { date: "2024-12-31", name: "Last Day of the Year", type: "special" },
  ],
  2025: [
    { date: "2025-01-01", name: "New Year's Day", type: "regular" },
    { date: "2025-02-25", name: "EDSA People Power Revolution Anniversary", type: "special" },
    { date: "2025-04-09", name: "Araw ng Kagitingan", type: "regular" },
    { date: "2025-05-01", name: "Labor Day", type: "regular" },
    { date: "2025-06-12", name: "Independence Day", type: "regular" },
    { date: "2025-08-25", name: "National Heroes Day", type: "regular" },
    { date: "2025-11-01", name: "All Saints' Day", type: "special" },
    { date: "2025-11-30", name: "Bonifacio Day", type: "regular" },
    { date: "2025-12-25", name: "Christmas Day", type: "regular" },
    { date: "2025-12-30", name: "Rizal Day", type: "regular" },
    { date: "2025-12-31", name: "Last Day of the Year", type: "special" },
  ],
};

export const isPhilippineHoliday = (date: Date | string): boolean => {
  const dateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];
  const year = new Date(dateStr).getFullYear();

  const yearHolidays = philippineHolidays[year as keyof typeof philippineHolidays];
  if (!yearHolidays) return false;

  return yearHolidays.some((holiday) => holiday.date === dateStr);
};

export const getPhilippineHoliday = (date: Date | string) => {
  const dateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];
  const year = new Date(dateStr).getFullYear();

  const yearHolidays = philippineHolidays[year as keyof typeof philippineHolidays];
  if (!yearHolidays) return null;

  return yearHolidays.find((holiday) => holiday.date === dateStr) || null;
};

// Philippine Address Formatting
export const formatPhilippineAddress = (address: {
  street?: string;
  barangay?: string;
  city: string;
  province: string;
  zipCode?: string;
}): string => {
  const parts = [];

  if (address.street) parts.push(address.street);
  if (address.barangay) parts.push(`Brgy. ${address.barangay}`);
  parts.push(address.city);
  parts.push(address.province);
  if (address.zipCode) parts.push(address.zipCode);

  return parts.join(", ");
};

// Common Philippine provinces for resort locations
export const philippineProvinces = [
  "Aklan",
  "Albay",
  "Antique",
  "Aurora",
  "Bataan",
  "Batanes",
  "Batangas",
  "Benguet",
  "Bohol",
  "Bukidnon",
  "Bulacan",
  "Cagayan",
  "Camarines Norte",
  "Camarines Sur",
  "Camiguin",
  "Capiz",
  "Cavite",
  "Cebu",
  "Davao del Norte",
  "Davao del Sur",
  "Davao Oriental",
  "Eastern Samar",
  "Guimaras",
  "Ifugao",
  "Ilocos Norte",
  "Ilocos Sur",
  "Iloilo",
  "La Union",
  "Laguna",
  "Leyte",
  "Marinduque",
  "Masbate",
  "Metro Manila",
  "Mindoro Occidental",
  "Mindoro Oriental",
  "Misamis Occidental",
  "Misamis Oriental",
  "Mountain Province",
  "Negros Occidental",
  "Negros Oriental",
  "Northern Samar",
  "Nueva Ecija",
  "Nueva Vizcaya",
  "Palawan",
  "Pampanga",
  "Pangasinan",
  "Quezon",
  "Rizal",
  "Romblon",
  "Samar",
  "Siquijor",
  "Sorsogon",
  "Southern Leyte",
  "Sultan Kudarat",
  "Sulu",
  "Surigao del Norte",
  "Surigao del Sur",
  "Tarlac",
  "Tawi-Tawi",
  "Zambales",
  "Zamboanga del Norte",
  "Zamboanga del Sur",
  "Zamboanga Sibugay",
];

// Resort-specific utilities
export const getSeasonType = (date: Date): "dry" | "wet" | "transition" => {
  const month = date.getMonth() + 1; // 1-12

  // Dry season: November to April
  if (month >= 11 || month <= 4) return "dry";

  // Wet season: June to October
  if (month >= 6 && month <= 10) return "wet";

  // Transition months: May
  return "transition";
};

export const getPeakSeasonMultiplier = (date: Date): number => {
  const month = date.getMonth() + 1;
  const isHoliday = isPhilippineHoliday(date);

  // Higher rates during peak season (Dec-Jan, March-May)
  if (month >= 12 || month <= 1 || (month >= 3 && month <= 5)) {
    return isHoliday ? 1.5 : 1.3;
  }

  // Holiday premium
  if (isHoliday) return 1.4;

  // Regular rates
  return 1.0;
};

// Validation utilities
export const validateTIN = (tin: string): boolean => {
  // Philippine TIN format: XXX-XXX-XXX-XXX or XXXXXXXXXXXX
  const cleanTIN = tin.replace(/\D/g, "");
  return /^\d{12}$/.test(cleanTIN) || /^\d{9}$/.test(cleanTIN);
};

export const formatTIN = (tin: string): string => {
  const digits = tin.replace(/\D/g, "");

  if (digits.length === 12) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, "$1-$2-$3-$4");
  }

  if (digits.length === 9) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
  }

  return tin;
};

// Business hour utilities for Philippine context
export const isBusinessHours = (date: Date, timezone = "Asia/Manila"): boolean => {
  const phTime = new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = phTime.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value;

  // Weekend check
  if (weekday === "Sat" || weekday === "Sun") return false;

  // Business hours: 8 AM to 6 PM
  return hour >= 8 && hour < 18;
};
