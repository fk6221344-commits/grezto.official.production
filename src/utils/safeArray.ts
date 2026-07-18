/**
 * safeArray -- Bulletproof utility to safely convert ANY value to an Array.
 * Handles: null, undefined, plain objects {}, strings (JSON or plain), numbers, booleans.
 * Prevents runtime crashes like "TypeError: X.some is not a function".
 */
export function safeArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (typeof value === 'string') {
    if (value.trim() === '') return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as T[];
      return [];
    } catch {
      return [];
    }
  }

  // null, undefined, plain object {}, number, boolean, etc.
  return [];
}

