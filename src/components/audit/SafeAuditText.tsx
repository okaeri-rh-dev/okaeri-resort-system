// src/components/audit/SafeAuditText.tsx

/**
 * SafeAuditText - XSS-protected text display for audit logs
 *
 * This component provides a security layer for displaying user-generated content
 * in audit logs by sanitizing all HTML tags using DOMPurify.
 *
 * Security Pattern:
 * - Sanitization happens at UI rendering layer (not during logging)
 * - Maintains data integrity (raw text stored in database)
 * - Prevents XSS attacks by stripping ALL HTML tags
 * - Leverages existing DOMPurify infrastructure from src/lib/security/sanitize.ts
 *
 * Implementation Details:
 * - Uses centralized `sanitizeText()` from @/lib/security/sanitize
 * - Aggressive sanitization: decodes encoded attacks, strips all HTML, removes dangerous protocols
 * - Double empty-state check: before and after sanitization
 * - Preserves newlines and special characters for plain text without HTML
 *
 * @see src/lib/security/sanitize.ts for sanitization implementation
 * @see Phase 3E documentation: docs/implementation/audit-trail/03-audit-viewer-ui/03e-safe-components.md
 */

/**
 * SafeAuditTextMemo - Memoized version for performance in large lists
 *
 * Use this in tables with 50+ rows to prevent unnecessary re-sanitization
 *
 * @example
 * ```tsx
 * {logs.map(log => (
 *   <TableRow key={log.audit_id}>
 *     <TableCell>
 *       <SafeAuditTextMemo text={log.description} />
 *     </TableCell>
 *   </TableRow>
 * ))}
 * ```
 */
import { memo } from "react";

import { sanitizeText } from "@/lib/security/sanitize";

// ============================================
// TYPES
// ============================================

interface SafeAuditTextProps {
  /**
   * Text content to display safely
   * Will be sanitized to remove all HTML tags
   */
  text: string | null | undefined;

  /**
   * Message to display when text is null/undefined/empty
   * @default "No description"
   */
  emptyMessage?: string;

  /**
   * Additional CSS classes to apply to the rendered span
   */
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

/**
 * Safely renders audit log text content with XSS protection
 *
 * This component strips ALL HTML tags to prevent injection attacks.
 * Use this for displaying any user-generated content in audit logs:
 * - log.description
 * - log.metadata fields
 * - Any text that could contain user input
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SafeAuditText text={log.description} />
 *
 * // With custom empty message
 * <SafeAuditText
 *   text={log.description}
 *   emptyMessage="No description provided"
 * />
 *
 * // With custom styling
 * <SafeAuditText
 *   text={log.description}
 *   className="text-sm text-muted-foreground"
 * />
 * ```
 */
export function SafeAuditText({
  text,
  emptyMessage = "No description",
  className = "",
}: SafeAuditTextProps) {
  // Handle null, undefined, or empty string
  if (!text || text.trim() === "") {
    return <span className={`text-muted-foreground italic ${className}`}>{emptyMessage}</span>;
  }

  // Sanitize with existing sanitizeText utility from src/lib/security/sanitize.ts
  // This removes ALL HTML tags, scripts, and dangerous content
  const sanitized = sanitizeText(text);

  // If sanitization resulted in empty string, show empty message
  if (!sanitized || sanitized.trim() === "") {
    return (
      <span className={`text-muted-foreground italic ${className}`}>
        {emptyMessage} (content was removed by security filter)
      </span>
    );
  }

  return <span className={className}>{sanitized}</span>;
}

export const SafeAuditTextMemo = memo(SafeAuditText);
