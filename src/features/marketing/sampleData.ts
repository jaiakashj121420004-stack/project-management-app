import type { Label } from '@/types/database';
import type { AccentName } from '@/lib/accents';
import type { LabelColor } from '@/lib/labelColors';

/**
 * Static sample content for the faux in-page app previews on the marketing
 * site. Kept here (not in a component) so the previews stay declarative and the
 * same realistic data can back the hero board, the showcase mocks, and any
 * future screenshot. None of this touches Supabase — it's purely presentational.
 */

/** Minimal label factory so faux cards satisfy the real `Label` row shape. */
function label(id: string, name: string, color: LabelColor): Label {
  return { id, project_id: 'demo', name, color, created_at: '2026-01-01' };
}

export interface SampleCard {
  id: string;
  title: string;
  labels?: Label[];
  /** Days from "today"; converted to a real YYYY-MM-DD at render time. */
  dueInDays?: number;
  priority?: number;
  checklist?: { done: number; total: number };
  /** Member shown as a small avatar in the corner of the card. */
  assignee?: string;
}

export interface SampleColumn {
  id: string;
  name: string;
  cards: SampleCard[];
}

/** The three-column Kanban shown in the hero — built to mirror the real board. */
export const HERO_BOARD: SampleColumn[] = [
  {
    id: 'todo',
    name: 'To Do',
    cards: [
      {
        id: 'c1',
        title: 'Design the onboarding flow',
        labels: [label('l1', 'Design', 'violet'), label('l2', 'UX', 'pink')],
        dueInDays: 2,
        checklist: { done: 1, total: 4 },
        assignee: 'Maya Chen',
      },
      {
        id: 'c2',
        title: 'Draft the launch announcement',
        labels: [label('l3', 'Marketing', 'amber')],
        priority: 3,
        assignee: 'Leo Park',
      },
    ],
  },
  {
    id: 'doing',
    name: 'In Progress',
    cards: [
      {
        id: 'c3',
        title: 'Build the calendar sync',
        labels: [label('l4', 'Engineering', 'cyan')],
        dueInDays: 0,
        priority: 1,
        checklist: { done: 3, total: 5 },
        assignee: 'Sam Rivera',
      },
      {
        id: 'c4',
        title: 'Wire up email reminders',
        labels: [label('l5', 'Backend', 'indigo')],
        checklist: { done: 2, total: 3 },
        assignee: 'Maya Chen',
      },
    ],
  },
  {
    id: 'done',
    name: 'Done',
    cards: [
      {
        id: 'c5',
        title: 'Set up real-time presence',
        labels: [label('l6', 'Engineering', 'emerald')],
        checklist: { done: 4, total: 4 },
        assignee: 'Sam Rivera',
      },
      {
        id: 'c6',
        title: 'Ship dark & light themes',
        labels: [label('l7', 'Design', 'violet')],
        dueInDays: -2,
        assignee: 'Leo Park',
      },
    ],
  },
];

/** Per-column accent so the hero board reads vividly, like real projects. */
export const HERO_COLUMN_ACCENT: AccentName[] = ['bloom', 'aurora', 'lagoon'];
