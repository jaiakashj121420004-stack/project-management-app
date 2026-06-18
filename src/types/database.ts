/**
 * Supabase database types.
 *
 * Placeholder for the scaffold. Once tables exist (Phase 2 onward), regenerate
 * this from the live schema with the Supabase CLI:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * The data model these types will mirror is specified in plan.md §5.
 */
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
