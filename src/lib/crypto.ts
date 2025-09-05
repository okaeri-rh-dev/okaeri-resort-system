/**
 * Simple encryption utilities for localStorage
 * Uses base64 encoding for basic obfuscation (not true encryption)
 * For production, use proper encryption libraries
 */

export const storage = {
  setItem(key: string, value: string): void {
    // Basic obfuscation using base64
    const encoded = btoa(value);
    localStorage.setItem(key, encoded);
  },

  getItem(key: string): string | null {
    const encoded = localStorage.getItem(key);
    if (!encoded) return null;
    try {
      // Decode from base64
      return atob(encoded);
    } catch {
      // Return raw value if decoding fails (backwards compatibility)
      return encoded;
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
  },

  clear(): void {
    localStorage.clear();
  },
};

// For sensitive data, use sessionStorage instead
export const secureStorage = {
  setItem(key: string, value: string): void {
    // Use sessionStorage for sensitive data (cleared on tab close)
    const encoded = btoa(value);
    sessionStorage.setItem(key, encoded);
  },

  getItem(key: string): string | null {
    const encoded = sessionStorage.getItem(key);
    if (!encoded) return null;
    try {
      return atob(encoded);
    } catch {
      return encoded;
    }
  },

  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  },

  clear(): void {
    sessionStorage.clear();
  },
};
