import { useEffect } from 'react';

/**
 * Makes the browser/device Back button leave full screen instead of the page.
 * While `active`, we add one history entry (same URL, router state preserved);
 * Back pops it and `onExit` runs. Leaving full screen any other way pops the
 * entry we added — but only if it is still the current one, so it can never undo
 * a real navigation.
 */
const MARK = 'auroraFocus';

export function useFocusHistory(active: boolean, onExit: () => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const href = window.location.href;
    let pushed = false;
    try {
      window.history.pushState({ ...(window.history.state ?? {}), [MARK]: true }, '', href);
      pushed = true;
    } catch {
      /* history unavailable — the Exit button still works */
    }
    const onPop = () => {
      pushed = false;
      onExit();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      const state = window.history.state as Record<string, unknown> | null;
      if (pushed && state?.[MARK] === true && window.location.href === href) {
        try {
          window.history.back();
        } catch {
          /* ignore */
        }
      }
    };
  }, [active, onExit]);
}
