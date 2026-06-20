import {
  CalendarDays,
  LayoutGrid,
  ListTodo,
  NotebookPen,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match the path exactly (for the index route). */
  end?: boolean;
}

/** Primary navigation. Most destinations are placeholders until later phases. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Boards', to: '/', icon: LayoutGrid, end: true },
  { label: 'To-Do', to: '/todos', icon: ListTodo },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Notes', to: '/notes', icon: NotebookPen },
  { label: 'Style Guide', to: '/style-guide', icon: Sparkles },
];
