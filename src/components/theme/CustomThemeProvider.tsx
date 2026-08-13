// UNUSED — superseded before it was ever wired in. The custom-theme boot
// application (font pairing + custom colors) is done inline in main.tsx
// (mirrors the existing applyTheme(getInitialTheme()) call) instead of a
// separate provider component, so it runs before first paint like the
// Night/Day theme does, rather than after mount via a useEffect.
// The sandbox that authored this can't delete files on the mounted Windows
// folder — please remove this file by hand as part of the build/commit step
// (`git rm src/components/theme/CustomThemeProvider.tsx`).
export {};
