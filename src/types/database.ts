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
import type { LabelColor } from '@/lib/labelColors';
import type { PlanId } from '@/lib/plans';

/** A member's permission level within a project (plan.md §5–6). */
export type ProjectRole = 'owner' | 'editor' | 'viewer';

/** Roles that can be invited / assigned to others (never 'owner'). */
export type InvitationRole = Exclude<ProjectRole, 'owner'>;

/** What a feedback submission is: a general note or a feature request. */
export type FeedbackKind = 'feedback' | 'feature';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          // Phase 9 due-date reminder preferences (own-row RLS).
          reminder_emails_enabled: boolean;
          reminder_lead_days: number;
          // Phase 10 billing — writable only by the Stripe webhook (service role);
          // a trigger blocks users from changing these on their own profile row.
          plan: PlanId;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan_status: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          reminder_emails_enabled?: boolean;
          reminder_lead_days?: number;
          plan?: PlanId;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          reminder_emails_enabled?: boolean;
          reminder_lead_days?: number;
          plan?: PlanId;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan_status?: string | null;
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
        Row: {
          id: string;
          project_id: string;
          column_id: string;
          title: string;
          description: string | null;
          // ISO date (YYYY-MM-DD); checklists/labels/assignment land in Phase 5.
          due_date: string | null;
          assignee_id: string | null;
          // Open-ended priority: 1 = P1 (highest), NULL = unset. See lib/priority.ts.
          priority: number | null;
          // Phase 9: the due_date we last emailed a reminder for (dedupe marker).
          // Written only by the reminders Edge Function (service role).
          reminder_sent_for: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          column_id: string;
          title: string;
          description?: string | null;
          due_date?: string | null;
          assignee_id?: string | null;
          priority?: number | null;
          reminder_sent_for?: string | null;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          column_id?: string;
          title?: string;
          description?: string | null;
          due_date?: string | null;
          assignee_id?: string | null;
          priority?: number | null;
          reminder_sent_for?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      checklist_items: {
        Row: {
          id: string;
          card_id: string;
          text: string;
          is_done: boolean;
          // Fractional rank within a card; ordered ascending (ordering.ts).
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          text: string;
          is_done?: boolean;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          text?: string;
          is_done?: boolean;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      labels: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          // Constrained to the label palette names by a DB check constraint.
          color: LabelColor;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          color: LabelColor;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          color?: LabelColor;
          created_at?: string;
        };
        Relationships: [];
      };
      card_labels: {
        Row: {
          card_id: string;
          label_id: string;
        };
        Insert: {
          card_id: string;
          label_id: string;
        };
        Update: {
          card_id?: string;
          label_id?: string;
        };
        Relationships: [];
      };
      todo_lists: {
        Row: {
          id: string;
          user_id: string;
          // Calendar day this list belongs to (YYYY-MM-DD).
          list_date: string;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          // Defaults to auth.uid() in the DB; clients omit it.
          user_id?: string;
          list_date: string;
          name: string;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          list_date?: string;
          name?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      todo_items: {
        Row: {
          id: string;
          list_id: string;
          text: string;
          is_done: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          text: string;
          is_done?: boolean;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          text?: string;
          is_done?: boolean;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          // Markdown body; rendered to a live preview client-side.
          content: string;
          // Stamped server-side by the notes_set_updated_at trigger on every edit.
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          // Defaults to 'Untitled note' in the DB.
          title?: string;
          content?: string;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          content?: string;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          project_id: string;
          // Stored as entered; matched case-insensitively on redemption.
          email: string;
          // Only 'editor' / 'viewer' are invitable — 'owner' is the creator alone.
          role: InvitationRole;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          role?: InvitationRole;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          email?: string;
          role?: InvitationRole;
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          // 'feedback' = a general note, 'feature' = a feature request.
          kind: FeedbackKind;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          // Defaults to auth.uid() in the DB; clients may omit it.
          user_id?: string;
          kind: FeedbackKind;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: FeedbackKind;
          message?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ceo_messages: {
        Row: {
          id: string;
          message: string;
          // Stamped server-side on every edit by a DB trigger.
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          message: string;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message?: string;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // SECURITY DEFINER membership/ownership helpers used by RLS (plan.md §6).
      is_project_member: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      is_project_owner: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      can_access_card: {
        Args: { p_card_id: string };
        Returns: boolean;
      };
      owns_todo_list: {
        Args: { p_list_id: string };
        Returns: boolean;
      };
      // Role-aware write checks + co-member visibility (Phase 8, plan.md §6).
      can_edit_project: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      can_edit_card: {
        Args: { p_card_id: string };
        Returns: boolean;
      };
      shares_a_project_with: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      // RPC: redeem the calling user's pending invitations; returns the count.
      redeem_my_invitations: {
        Args: Record<string, never>;
        Returns: number;
      };
      // Invitation accept/decline (no auto-join): list my invites + accept one.
      my_pending_invitations: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          project_id: string;
          project_name: string;
          role: string;
          created_at: string;
        }[];
      };
      accept_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      // Phase 9 reminders — SECURITY DEFINER, service_role only (the Edge
      // Function calls these; the browser is denied EXECUTE by RLS grants).
      due_reminder_candidates: {
        Args: { p_lead_days?: number };
        Returns: {
          card_id: string;
          title: string;
          due_date: string;
          project_id: string;
          project_name: string;
          assignee_id: string;
          email: string;
          display_name: string | null;
        }[];
      };
      mark_reminders_sent: {
        Args: { p_card_ids: string[] };
        Returns: undefined;
      };
      // Phase 10 billing: the caller's plan ('free' | 'pro').
      current_plan: {
        Args: Record<string, never>;
        Returns: string;
      };
      // True when the caller is the app administrator (ADMIN_EMAIL). Used by the
      // feedback / ceo_messages RLS policies (lib/admin.ts mirrors it in the UI).
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}

/** Convenience row aliases. */
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectMember = Database['public']['Tables']['project_members']['Row'];
export type Column = Database['public']['Tables']['columns']['Row'];
export type Card = Database['public']['Tables']['cards']['Row'];
export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];
export type Label = Database['public']['Tables']['labels']['Row'];
export type CardLabel = Database['public']['Tables']['card_labels']['Row'];
export type TodoList = Database['public']['Tables']['todo_lists']['Row'];
export type TodoItem = Database['public']['Tables']['todo_items']['Row'];
export type Note = Database['public']['Tables']['notes']['Row'];
export type Invitation = Database['public']['Tables']['invitations']['Row'];
export type Feedback = Database['public']['Tables']['feedback']['Row'];
export type CeoMessage = Database['public']['Tables']['ceo_messages']['Row'];
