import { useEffect, useState } from 'react';

/**
 * Debounce a fast-changing value (e.g. a search-box query) by `delayMs`.
 * Returns the latest value once it has been stable for that long — the
 * standard pattern for query-as-you-type so every keystroke doesn't fire a
 * request.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
