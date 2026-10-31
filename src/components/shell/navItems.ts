import {
  BarChart3,
  CalendarDays,
  LayoutGrid,
  Library,
  ListTodo,
  Megaphone,
  MessageSquareHeart,
  Settings,
  Sunrise,
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
  /** One of the three equal-weight headline destinations atop the sidebar. */
  primary?: boolean;
}

/** Primary navigation. `bottomNav` items also appear in the mobile bottom bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Today', to: '/today', icon: Sunrise, bottomNav: true },
  { label: 'Notebooks', to: '/library', icon: Library, bottomNav: true, primary: true },
  { label: 'Boards', to: '/boards', icon: LayoutGrid, end: true, bottomNav: true, primary: true },
  { label: 'To-Do List', to: '/todos', icon: ListTodo, bottomNav: true, primary: true },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays, bottomNav: true },
  { label: 'From the Founder', to: '/from-the-founder', icon: Megaphone },
  { label: 'Feedback/Features', to: '/feedback', icon: MessageSquareHeart },
  { label: 'Analytics', to: '/analytics', icon: BarChart3, adminOnly: true },
  { label: 'Settings', to: '/settings', icon: Settings },
];

/** The three headline destinations, in display order: Notebooks · Boards · To-Do List. */
export const PRIMARY_NAV: readonly NavItem[] = ['/library', '/boards', '/todos']
  .map((to) => NAV_ITEMS.find((item) => item.to === to))
  .filter((item): item is NavItem => item !== undefined);
