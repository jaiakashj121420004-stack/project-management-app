// Shared axe-core harness for the a11y suites. We drive axe-core directly
// (rather than a wrapper) so the dependency surface is a single, stable package
// that tracks the installed Vitest/jsdom versions without a peer-range fight.
//
// Two rules are disabled deliberately:
//  - `color-contrast` — jsdom has no layout/canvas, so axe reports it as
//    *incomplete* anyway; real contrast is proven exhaustively in
//    `lib/contrast.test.ts` + `marketing/marketingContrast.test.ts` and by the
//    Lighthouse pass (see PHASE-7-VERIFICATION.md).
//  - `region` — suites render isolated components/subtrees, not whole pages, so
//    the top-level-landmark rule doesn't apply here (it's covered by the
//    AppShell skip-link + <main> landmark, exercised in the manual pass).
import axe, { type RunOptions, type ElementContext } from 'axe-core';

const AXE_OPTIONS: RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
};

/**
 * Run axe over a rendered node and fail the test with a readable summary if any
 * violation is found. Returns the raw results for callers that want to assert
 * on `incomplete`/`passes` too.
 */
export async function expectNoAxeViolations(
  context: ElementContext = document.body,
): Promise<void> {
  const results = await axe.run(context, AXE_OPTIONS);
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => {
        const nodes = v.nodes.map((n) => `      ${n.html}`).join('\n');
        return `  • [${v.impact ?? 'n/a'}] ${v.id}: ${v.help}\n${nodes}`;
      })
      .join('\n');
    throw new Error(`Expected no axe violations but found ${results.violations.length}:\n${summary}`);
  }
}
