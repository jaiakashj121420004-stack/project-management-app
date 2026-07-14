// Vitest global setup: extend `expect` with jest-dom matchers (toBeInTheDocument,
// etc.) for component tests, and reset the DOM between tests. Pure-logic suites
// don't need this, but the harness is ready for the boundary/toast tests to come.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
