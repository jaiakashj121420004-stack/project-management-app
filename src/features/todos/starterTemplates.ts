import type { LucideIcon } from 'lucide-react';
import { Dumbbell, Moon, Sunrise, SunMedium } from 'lucide-react';

export interface StarterTemplate {
  id: string;
  name: string;
  icon: LucideIcon;
  items: string[];
}

/**
 * One-tap starter lists for the most common daily/weekly routines. Picking one
 * creates a list pre-filled with its items AND sets it repeating daily (the
 * free recurrence tier — see recurrence.ts) since a routine is, by definition,
 * something you'd want every day; the user can change the schedule afterwards
 * via the list's Repeat button.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'morning-routine',
    name: 'Morning Routine',
    icon: Sunrise,
    items: ['Make the bed', 'Drink a glass of water', '10 min stretch', "Review today's priorities"],
  },
  {
    id: 'evening-wind-down',
    name: 'Evening Wind-down',
    icon: Moon,
    items: ['Tidy the desk', 'Plan tomorrow', 'Read 10 pages', 'Lights out by 11'],
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    icon: SunMedium,
    items: [
      'Clear inbox to zero',
      "Review this week's cards",
      "Plan next week's priorities",
      'Back up important files',
    ],
  },
  {
    id: 'workout',
    name: 'Workout',
    icon: Dumbbell,
    items: ['Warm up', 'Main workout', 'Cool down / stretch', 'Log progress'],
  },
];
