/**
 * canvasPages.ts — the page-background vocabulary for the Pro Notes Canvas.
 *
 * Kept React-free (pure data) so it can be the single source of truth shared by
 * the Supabase types (database.ts → canvas_notes.page_type) and the feature UI,
 * exactly like lib/accents.ts (AccentName) and lib/labelColors.ts (LabelColor).
 * Mirrors the CHECK constraint in supabase/migrations/20260622180000_canvas.sql.
 */

/** The four canvas page backgrounds. Matches the DB check constraint. */
export type PageType = 'blank' | 'ruled' | 'grid' | 'dotted';

/** All page types, in display order (for the toolbar switcher). */
export const PAGE_TYPES: readonly PageType[] = ['blank', 'ruled', 'grid', 'dotted'];

/** Human label for each page type (toolbar + accessibility copy). */
export const PAGE_LABELS: Record<PageType, string> = {
  blank: 'Blank',
  ruled: 'Ruled',
  grid: 'Grid',
  dotted: 'Dotted',
};

/**
 * Base spacing (in world pixels, at scale 1) between ruled lines / grid lines /
 * dots. The background layer scales this by the camera zoom so the pattern pans
 * and zooms with the canvas content.
 */
export const PAGE_PATTERN_SPACING = 28;

/** Narrow an unknown value to a PageType, falling back to 'blank'. */
export function toPageType(value: unknown): PageType {
  return typeof value === 'string' && (PAGE_TYPES as readonly string[]).includes(value)
    ? (value as PageType)
    : 'blank';
}
