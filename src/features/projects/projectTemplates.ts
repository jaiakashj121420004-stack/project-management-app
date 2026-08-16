import type { LucideIcon } from 'lucide-react';
import { Briefcase, Newspaper, PartyPopper, Rocket, Search, Target } from 'lucide-react';
import type { ProjectTemplatePayload } from './templateSchemas';

export interface SystemTemplate {
  id: string;
  name: string;
  /** One-line description shown under the name in the template grid. */
  description: string;
  icon: LucideIcon;
  payload: ProjectTemplatePayload;
}

/**
 * Aurora's curated starter templates — the zero-config alternative to a blank
 * board (Simplicity Guardrail #3: "starter templates over blank canvases").
 * Kept small and genuinely curated, not a long catalog (guardrail #7): six
 * distinct, common project shapes, each a handful of realistic columns and
 * starter cards. No assignees, due dates, or comments — those are per-project,
 * not part of a reusable shape (see memory.md's "explicitly out of scope"
 * note for why this list stays this short).
 *
 * This is the same shape (`ProjectTemplatePayload`) that a user's own "save
 * as template" snapshot is stored as (project_templates.payload,
 * 20260816170000_project_templates.sql) — one payload format, two sources.
 */
export const PROJECT_TEMPLATES: SystemTemplate[] = [
  {
    id: 'freelance-client',
    name: 'Freelance client project',
    description: 'Kickoff to final delivery, with a client-review stage built in.',
    icon: Briefcase,
    payload: {
      columns: [
        {
          name: 'Backlog',
          cards: [
            {
              title: 'Kickoff call',
              checklist: ['Confirm scope', 'Set timeline', 'Share kickoff doc'],
            },
            { title: 'Draft proposal' },
          ],
        },
        {
          name: 'In Progress',
          cards: [
            { title: 'First draft', labels: [{ name: 'Billable', color: 'amber' }] },
          ],
        },
        {
          name: 'Client Review',
          cards: [
            {
              title: 'Send for feedback',
              checklist: ['Share preview link', 'Log revision rounds used'],
            },
          ],
        },
        {
          name: 'Delivered',
          cards: [
            { title: 'Final files delivered', checklist: ['Invoice sent', 'Files archived'] },
          ],
        },
      ],
    },
  },
  {
    id: 'content-calendar',
    name: 'Content calendar',
    description: 'Plan, write, and publish posts through one simple pipeline.',
    icon: Newspaper,
    payload: {
      columns: [
        { name: 'Ideas', cards: [{ title: 'Brainstorm topics' }] },
        {
          name: 'Writing',
          cards: [
            { title: 'Draft: blog post', checklist: ['Outline', 'First draft', 'Add images'] },
          ],
        },
        { name: 'Editing', cards: [{ title: 'Proofread & fact-check' }] },
        {
          name: 'Scheduled',
          cards: [{ title: 'Queue for publish', labels: [{ name: 'This week', color: 'emerald' }] }],
        },
        { name: 'Published', cards: [{ title: 'Share on socials' }] },
      ],
    },
  },
  {
    id: 'simple-sprint',
    name: 'Simple sprint board',
    description: 'A lightweight two-week sprint flow — no story points required.',
    icon: Rocket,
    payload: {
      columns: [
        { name: 'Backlog', cards: [{ title: 'Backlog item' }] },
        { name: 'To Do', cards: [{ title: 'Set sprint goal' }] },
        { name: 'In Progress', cards: [{ title: 'Build the thing' }] },
        {
          name: 'In Review',
          cards: [{ title: 'Code review', labels: [{ name: 'Blocked', color: 'rose' }] }],
        },
        { name: 'Done', cards: [{ title: 'Shipped' }] },
      ],
    },
  },
  {
    id: 'personal-goals',
    name: 'Personal goals tracker',
    description: 'Turn someday-goals into this quarter, this month, and done.',
    icon: Target,
    payload: {
      columns: [
        { name: 'Someday', cards: [{ title: 'Learn a new skill' }] },
        {
          name: 'This Quarter',
          cards: [{ title: 'Pick your top 3 goals', checklist: ['Goal 1', 'Goal 2', 'Goal 3'] }],
        },
        { name: 'This Month', cards: [{ title: "This month's focus" }] },
        { name: 'Achieved', cards: [{ title: 'First win logged' }] },
      ],
    },
  },
  {
    id: 'event-planning',
    name: 'Event planning',
    description: 'From venue booking to a day-of run sheet.',
    icon: PartyPopper,
    payload: {
      columns: [
        {
          name: 'Planning',
          cards: [
            {
              title: 'Set date & budget',
              checklist: ['Pick date', 'Set budget', 'Draft guest list'],
            },
          ],
        },
        {
          name: 'Booking',
          cards: [{ title: 'Book venue' }, { title: 'Book catering' }],
        },
        { name: 'Promotion', cards: [{ title: 'Send invites' }] },
        {
          name: 'Day-of',
          cards: [{ title: 'Run sheet', checklist: ['Setup', 'Doors open', 'Wrap-up'] }],
        },
      ],
    },
  },
  {
    id: 'job-search',
    name: 'Job search tracker',
    description: 'Track applications from wishlist to offer.',
    icon: Search,
    payload: {
      columns: [
        { name: 'Wishlist', cards: [{ title: 'Company to research' }] },
        {
          name: 'Applied',
          cards: [
            {
              title: 'Application submitted',
              checklist: ['Tailor resume', 'Write cover letter', 'Submit'],
            },
          ],
        },
        {
          name: 'Interviewing',
          cards: [{ title: 'Interview scheduled', labels: [{ name: 'Priority', color: 'rose' }] }],
        },
        { name: 'Offer', cards: [{ title: 'Offer received' }] },
      ],
    },
  },
];
