import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. Used to switch the Calendar between the month
 * grid (with drag-and-drop) on wider screens and a tap-friendly agenda list on
 * small phones, rendering only one so dnd-kit droppables aren't double-mounted.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
