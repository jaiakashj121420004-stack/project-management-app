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

/** Delivery channel for a Pro custom reminder (P1). */
export type ReminderChannel = 'email' | 'push';

/** A card's code-review state (Pro collaboration). */
export type ReviewStatus = 'none' | 'in_review' | 'approved' | 'changes_requested';

/** What an emoji reaction is attached to (Pro collaboration). */
export type ReactionTarget = 'comment' | 'card';

/** A notification's kind — drives its icon + copy in the bell dropdown. */
export type NotificationKind =
  | 'mention'
  | 'reply'
  | 'review_request'
  | 'review_approved'
  | 'review_changes';

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
          // Billing — writable only by the Dodo webhook (service role); a trigger
          // blocks users from changing these on their own profile row.
          plan: PlanId;
          dodo_customer_id: string | null;
          dodo_subscription_id: string | null;
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
          dodo_customer_id?: string | null;
          dodo_subscription_id?: string | null;
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
          dodo_customer_id?: string | null;
          dodo_subscription_id?: string | null;
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
          // ISO date (YYYY-MM-DD); what the board/calendar group by.
          due_date: string | null;
          // Full deadline timestamp (timestamptz). Source of truth when present;
          // backfilled from due_date at 09:00 UTC, written from the user's local
          // date+time. Drives Pro timed reminders (P1, card_reminders).
          due_at: string | null;
          assignee_id: string | null;
          // Open-ended priority: 1 = P1 (highest), NULL = unset. See lib/priority.ts.
          priority: number | null;
          // Phase 9: the due_date we last emailed a reminder for (dedupe marker).
          // Written only by the reminders Edge Function (service role).
          reminder_sent_for: string | null;
          // Pro collaboration: a request-review / approve / request-changes flow.
          review_status: ReviewStatus;
          review_assignee_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
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
          due_at?: string | null;
          assignee_id?: string | null;
          priority?: number | null;
          reminder_sent_for?: string | null;
          review_status?: ReviewStatus;
          review_assignee_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
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
          due_at?: string | null;
          assignee_id?: string | null;
          priority?: number | null;
          reminder_sent_for?: string | null;
          review_status?: ReviewStatus;
          review_assignee_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
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
      card_reminders: {
        Row: {
          id: string;
          card_id: string;
          // Minutes before the card's due_at to fire (0 = at due_at).
          offset_minutes: number;
          // 'email' → sent by the Edge Function; 'push' → in-app browser notification.
          channel: ReminderChannel;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          offset_minutes: number;
          channel?: ReminderChannel;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          offset_minutes?: number;
          channel?: ReminderChannel;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      card_reminder_dispatches: {
        Row: {
          card_reminder_id: string;
          due_at: string;
          sent_at: string;
        };
        Insert: {
          card_reminder_id: string;
          due_at: string;
          sent_at?: string;
        };
        Update: {
          card_reminder_id?: string;
          due_at?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          // Denormalised from the card; a BEFORE INSERT trigger keeps it correct.
          project_id: string;
          // Exactly one of card_id / canvas_note_id is set (DB check).
          card_id: string | null;
          canvas_note_id: string | null;
          author_id: string;
          body: string;
          // Self-FK for threads; null for a top-level comment.
          parent_id: string | null;
          created_at: string;
          edited_at: string | null;
        };
        Insert: {
          id?: string;
          // Forced from the card by the trigger; send the card's project_id anyway.
          project_id: string;
          card_id?: string | null;
          canvas_note_id?: string | null;
          author_id: string;
          body: string;
          parent_id?: string | null;
          created_at?: string;
          edited_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          card_id?: string | null;
          canvas_note_id?: string | null;
          author_id?: string;
          body?: string;
          parent_id?: string | null;
          created_at?: string;
          edited_at?: string | null;
        };
        Relationships: [];
      };
      comment_mentions: {
        Row: {
          comment_id: string;
          mentioned_user_id: string;
        };
        Insert: {
          comment_id: string;
          mentioned_user_id: string;
        };
        Update: {
          comment_id?: string;
          mentioned_user_id?: string;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          target_type: ReactionTarget;
          target_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: ReactionTarget;
          target_id: string;
          // Defaults to auth.uid() server-side is NOT set — send it explicitly.
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          target_type?: ReactionTarget;
          target_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          project_id: string;
          actor_id: string | null;
          verb: string;
          target_type: string;
          target_id: string | null;
          // card_id, actor_name, card_title, snippet, … for the feed UI.
          meta: Record<string, unknown>;
          created_at: string;
        };
        // Insert/Update are trigger-only (no client write policy); kept for typing.
        Insert: {
          id?: string;
          project_id: string;
          actor_id?: string | null;
          verb: string;
          target_type: string;
          target_id?: string | null;
          meta?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          actor_id?: string | null;
          verb?: string;
          target_type?: string;
          target_id?: string | null;
          meta?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: NotificationKind;
          // actor_name, card_title, project_name, snippet, card_id, project_id, …
          payload: Record<string, unknown>;
          read_at: string | null;
          // Set by the reminders Edge Function once an email has gone out.
          emailed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: NotificationKind;
          payload?: Record<string, unknown>;
          read_at?: string | null;
          emailed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: NotificationKind;
          payload?: Record<string, unknown>;
          read_at?: string | null;
          emailed_at?: string | null;
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
      // Pro P1 custom timed reminders — SECURITY DEFINER, service_role only (the
      // Edge Function calls these; the browser is denied EXECUTE).
      due_time_reminder_candidates: {
        Args: { p_window_minutes?: number };
        Returns: {
          card_reminder_id: string;
          card_id: string;
          title: string;
          due_at: string;
          offset_minutes: number;
          project_id: string;
          project_name: string;
          assignee_id: string;
          email: string;
          display_name: string | null;
        }[];
      };
      mark_time_reminders_sent: {
        Args: { p_reminder_ids: string[] };
        Returns: undefined;
      };
      // Is the board owning this card on Pro? Gates card_reminders INSERT (P1).
      card_project_is_pro: {
        Args: { p_card_id: string };
        Returns: boolean;
      };
      // Phase 10 billing: the caller's plan ('free' | 'pro').
      current_plan: {
        Args: Record<string, never>;
        Returns: string;
      };
      // Pro foundation (P0): is the OWNER of this project on Pro? The real gate
      // for Pro tables + the canvas-media Storage policies (prompts.md P0).
      project_is_pro: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      // True when the caller is the app administrator (ADMIN_EMAIL). Used by the
      // feedback / ceo_messages RLS policies (lib/admin.ts mirrors it in the UI).
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      // Pro collaboration helpers — SECURITY DEFINER, used by RLS (plan.md §6).
      comment_project_id: {
        Args: { p_comment_id: string };
        Returns: string;
      };
      comment_author_id: {
        Args: { p_comment_id: string };
        Returns: string;
      };
      target_project_id: {
        Args: { p_target_type: string; p_target_id: string };
        Returns: string;
      };
      // Notification emails — SECURITY DEFINER, service_role only (the reminders
      // Edge Function calls these; the browser is denied EXECUTE).
      notification_email_candidates: {
        Args: { p_max_age_minutes?: number };
        Returns: {
          id: string;
          user_id: string;
          kind: string;
          payload: Record<string, unknown>;
          email: string;
          display_name: string | null;
        }[];
      };
      mark_notifications_emailed: {
        Args: { p_ids: string[] };
        Returns: undefined;
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
export type CardReminder = Database['public']['Tables']['card_reminders']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type CommentMention = Database['public']['Tables']['comment_mentions']['Row'];
export type Reaction = Database['public']['Tables']['reactions']['Row'];
export type ActivityEntry = Database['public']['Tables']['activity_log']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
