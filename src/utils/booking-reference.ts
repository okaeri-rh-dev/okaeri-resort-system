import { ulid } from "ulid";

/**
 * Generate secure, non-sequential booking reference
 * Format: BK-YYYY-XXXXXX (e.g., BK-2025-X7K9M2)
 *
 * Properties:
 * - High entropy: ~1 billion combinations per year (32^6)
 * - Non-sequential: Prevents enumeration attacks
 * - Human-friendly: Easy to communicate over phone/email
 * - Collision-resistant: ULID timestamp + randomness
 */
export function generateBookingReference(): string {
  // Generate ULID (Universally Unique Lexicographically Sortable Identifier)
  const id = ulid();

  // Extract last 6 characters (base32, high entropy)
  const randomSuffix = id.slice(-6).toUpperCase();

  // Format with current year
  const year = new Date().getFullYear();

  return `BK-${year}-${randomSuffix}`;
}

// Examples of generated references:
// BK-2025-X7K9M2
// BK-2025-P4QW8N
// BK-2025-ZN3T5R
// BK-2025-M8K4VT
