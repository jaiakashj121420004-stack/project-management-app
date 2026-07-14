/**
 * noteTemplates.ts — ready-made note structures inserted from the slash menu.
 *
 * Each template is a small array of block nodes (headings, lists, task lists)
 * that `insertContent` drops at the caret. Built with the shared schema only, so
 * a template round-trips like any hand-authored content.
 */
import type { JSONContent } from '@tiptap/core';
import { CalendarDays, ClipboardList, NotebookPen, Rocket, type LucideIcon } from 'lucide-react';

type Block = JSONContent;

const paragraph = (text?: string): Block =>
  text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' };

const heading = (level: 1 | 2 | 3, text: string): Block => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});

const bullets = (items: string[]): Block => ({
  type: 'bulletList',
  content: items.map((text) => ({ type: 'listItem', content: [paragraph(text)] })),
});

const tasks = (items: string[]): Block => ({
  type: 'taskList',
  content: items.map((text) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [paragraph(text)],
  })),
});

const today = (): string =>
  new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

/** A named template exposed to the slash menu. */
export interface NoteTemplate {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  keywords: string[];
  build: () => Block[];
}

export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: 'meeting',
    title: 'Meeting notes',
    subtitle: 'Attendees, agenda, action items',
    icon: ClipboardList,
    keywords: ['template', 'meeting', 'agenda', 'minutes', 'standup', 'sync'],
    build: () => [
      heading(2, 'Meeting notes'),
      paragraph(today()),
      heading(3, 'Attendees'),
      bullets(['']),
      heading(3, 'Agenda'),
      bullets(['']),
      heading(3, 'Discussion'),
      paragraph(),
      heading(3, 'Action items'),
      tasks(['']),
    ],
  },
  {
    id: 'journal',
    title: 'Daily journal',
    subtitle: 'Focus, notes, gratitude',
    icon: NotebookPen,
    keywords: ['template', 'journal', 'daily', 'diary', 'log'],
    build: () => [
      heading(2, `Journal — ${today()}`),
      heading(3, 'Today’s focus'),
      tasks(['', '', '']),
      heading(3, 'Notes'),
      paragraph(),
      heading(3, 'Wins & gratitude'),
      bullets(['']),
    ],
  },
  {
    id: 'brief',
    title: 'Project brief',
    subtitle: 'Overview, goals, milestones',
    icon: Rocket,
    keywords: ['template', 'project', 'brief', 'spec', 'plan', 'proposal'],
    build: () => [
      heading(2, 'Project brief'),
      heading(3, 'Overview'),
      paragraph(),
      heading(3, 'Goals'),
      bullets(['', '']),
      heading(3, 'Scope'),
      paragraph(),
      heading(3, 'Milestones'),
      tasks(['', '']),
      heading(3, 'Risks'),
      bullets(['']),
    ],
  },
  {
    id: 'weekly',
    title: 'Weekly plan',
    subtitle: 'Priorities and a day-by-day list',
    icon: CalendarDays,
    keywords: ['template', 'weekly', 'week', 'plan', 'schedule'],
    build: () => [
      heading(2, 'Weekly plan'),
      heading(3, 'Top priorities'),
      tasks(['', '', '']),
      heading(3, 'By day'),
      bullets(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    ],
  },
];
