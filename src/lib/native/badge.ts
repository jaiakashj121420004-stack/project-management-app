/** App-icon badge (installed PWA / native shell). Silent no-op where unsupported. */
type BadgeNav = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function setBadge(count: number): void {
  const nav = navigator as BadgeNav;
  try {
    if (count > 0) void nav.setAppBadge?.(count)?.catch(() => undefined);
    else void nav.clearAppBadge?.()?.catch(() => undefined);
  } catch {
    /* unsupported */
  }
}
