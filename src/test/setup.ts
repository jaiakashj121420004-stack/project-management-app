// Vitest global setup: extend `expect` with jest-dom matchers (toBeInTheDocument,
// etc.) for component tests, and reset the DOM between tests. Pure-logic suites
// don't need this, but the harness is ready for the boundary/toast tests to come.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement these layout/media APIs. Components that call them
// (e.g. GlassSelect scrolls the active option into view on open) would throw
// under test, so stub them globally. No-ops are fine — the suites assert on
// structure/roles/state, not scroll position.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  cleanup();
});
