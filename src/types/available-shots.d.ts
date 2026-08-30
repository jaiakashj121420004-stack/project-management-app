// Virtual module supplied by the `availableShotsPlugin` in vite.config.ts —
// the set of public/shots/*.png filenames that actually exist at build time.
// See LandingPage.tsx's <Shot> for why this exists.
declare module 'virtual:available-shots' {
  export const AVAILABLE_SHOTS: Set<string>;
}
