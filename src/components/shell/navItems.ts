import {
  CalendarDays,
  Inbox,
  LayoutGrid,
  ListTodo,
  Megaphone,
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
  /** Also show in the mobile bottom bar (kept to the core destinations). */
  bottomNav?: boolean;
  /** Only render for the app administrator (gated by isAdminUser). */
  adminOnly?: boolean;
}

/** Primary navigation. `bottomNav` items also appear in the mobile bottom bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Boards', to: '/boards', icon: LayoutGrid, end: true, bottomNav: true },
  { label: 'To-Do', to: '/todos', icon: ListTodo, bottomNav: true },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays, bottomNav: true },
  { label: 'Notes', to: '/notes', icon: NotebookPen, bottomNav: true },
  { label: 'From the Founder', to: '/from-the-founder', icon: Megaphone },
  { label: 'Feedback', to: '/feedback', icon: Inbox, adminOnly: true },
  { label: 'Style Guide', to: '/style-guide', icon: Sparkles },
];
