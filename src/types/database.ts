/**
 * Supabase database types.
 *
 * Hand-maintained to mirror the SQL in supabase/migrations until the schema is
 * regenerated from the live project with the Supabase CLI:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * The data model is specified in plan.md §5.
 */
import type { AccentName } from '@/lib/accents';

/** A member's permission level within a project (plan.md §5–6). */
export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          // Constrained to the six Aurora accent names by a DB check constraint.
          accent: AccentName;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          accent: AccentName;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          accent?: AccentName;
          created_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: ProjectRole;
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role?: ProjectRole;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: ProjectRole;
          created_at?: string;
        };
        Relationships: [];
      };
      columns: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          // Fractional rank; ordered ascending. See features/board/ordering.ts.
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      cards: {
        