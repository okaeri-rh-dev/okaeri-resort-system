/**
 * Copy text to clipboard with fallback for older browsers
 * Uses modern Clipboard API with execCommand fallback
 *
 * @param text - Text to copy to clipboard
 * @returns Promise that resolves to true on success, false on failure
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern Clipboard API (requires HTTPS in production)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Clipboard API failed:", error);
      // Fall through to legacy method
    }
  }

  // Legacy fallback using execCommand
  try {
    return legacyCopyToClipboard(text);
  } catch (error) {
    console.error("Legacy copy failed:", error);
    return false;
  }
}

/**
 * Legacy copy method using document.execCommand
 * Works in older browsers and HTTP contexts
 */
function legacyCopyToClipboard(text: string): boolean {
  const textarea = document.createElement("textarea");

  // Style to make textarea invisible
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.setAttribute("readonly", "");

  document.body.appendChild(textarea);

  // Select and copy
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const successful = document.execCommand("copy");

  document.body.removeChild(textarea);

  return successful;
}
