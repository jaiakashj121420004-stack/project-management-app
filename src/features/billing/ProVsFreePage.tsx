import { useNavigate } from 'react-router-dom';
import { Check, Minus, Sparkles } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Reveal } from '@/components/motion/Reveal';
import { useProfile } from '@/features/auth/useProfile';
import { CANVAS_MEDIA_QUOTA_BYTES, formatBytes, PRO_FEATURES } from '@/lib/proFeatures';
import {
  FREE_PROJECT_LIMIT,
  FREE_MEMBER_LIMIT,
  PRO_MEMBER_LIMIT,
  TEAM_MEMBER_LIMIT,
  PLANS,
  PRO_ANNUAL_DISCOUNT_PCT,
  annualPerMonth,
  isProOrAbove,
  type PlanId,
} from '@/lib/plans';

/** One row of the comparison: what it is, and what Free vs Pro get. `free`/`pro`
 *  are either a short value string ("Up to 3") or a boolean for a plain
 *  included/not-included row (rendered as a check or a dash). */
interface CompareRow {
  label: string;
  detail?: string;
  free: string | boolean;
  pro: string | boolean;
}

interface CompareGroup {
  title: string;
  rows: CompareRow[];
}

/**
 * Pro vs Free, in detail — every capability difference in the app, grouped by
 * area, pulled from the same `lib/plans.ts` / `lib/proFeatures.ts` values that
 * drive the actual gates (ProGate, useIsPro, the DB triggers) so this page can
 * never quietly drift out of sync with what's really gated.
 */
function buildGroups(): CompareGroup[] {
  return [
    {
      title: 'Boards & collaboration',
      rows: [
        {
          label: 'Project boards you own',
          free: `Up to ${FREE_PROJECT_LIMIT}`,
          pro: 'Unlimited',
        },
        {
          label: 'People per board',
          detail: `Team plan goes up to ${TEAM_MEMBER_LIMIT} on one board.`,
          free: `Up to ${FREE_MEMBER_LIMIT}`,
          pro: `Up to ${PRO_MEMBER_LIMIT}`,
        },
        { label: 'Cards, columns & checklists', free: 'Unlimited', pro: 'Unlimited' },
        {
          label: 'Comments & @mentions',
          detail: 'Threaded discussion on any card, in realtime.',
          free: false,
          pro: true,
        },
        { label: 'Emoji reactions on cards', free: false, pro: true },
        {
          label: 'Review & approval workflow',
          detail: 'Request a review, approve, or ask for changes — code-review style.',
          free: false,
          pro: true,
        },
        {
          label: 'Per-project activity feed',
          detail: 'A live history of comments, reviews, and changes on a board.',
          free: false,
          pro: true,
        },
      ],
    },
    {
      title: 'To-dos & reminders',
      rows: [
        { label: 'Daily to-do planner & calendar view', free: true, pro: true },
        { label: 'Repeat a list every day', free: true, pro: true },
        {
          label: 'Repeat on specific weekdays, monthly, or a custom interval',
          free: false,
          pro: true,
        },
        { label: 'Browser due-date reminders', free: true, pro: true },
        {
          label: PRO_FEATURES.customReminders.label,
          detail: PRO_FEATURES.customReminders.description,
          free: false,
          pro: true,
        },
        {
          label: PRO_FEATURES.emailReminders.label,
          detail: PRO_FEATURES.emailReminders.description,
          free: false,
          pro: true,
        },
      ],
    },
    {
      title: 'Notes & canvas',
      rows: [
        { label: 'Rich-text block notes', free: true, pro: true },
        {
          label: PRO_FEATURES.canvas.label,
          detail: PRO_FEATURES.canvas.description,
          free: false,
          pro: true,
        },
        {
          label: PRO_FEATURES.media.label,
          detail: `${PRO_FEATURES.media.description} Up to ${formatBytes(CANVAS_MEDIA_QUOTA_BYTES)} total per account.`,
          free: false,
          pro: true,
        },
        {
          label: 'Embed YouTube, Vimeo, Loom & SoundCloud in notes',
          free: false,
          pro: true,
        },
      ],
    },
    {
      title: 'Personalization',
      rows: [
        { label: 'Light & dark theme', free: true, pro: true },
        { label: '5 font pairings', free: true, pro: true },
        { label: 'Custom background & text color', free: false, pro: true },
        {
          label: 'Calendar sync',
          detail: 'Subscribe from Google Calendar, Apple Calendar, or Outlook.',
          free: false,
          pro: true,
        },
      ],
    },
    {
      title: 'Price & support',
      rows: [
        { label: 'Price', free: '$0', pro: `$${PLANS.pro.priceMonthly}/mo` },
        {
          label: 'Annual price',
          detail: `${PRO_ANNUAL_DISCOUNT_PCT}% cheaper than paying monthly.`,
          free: '—',
          pro: `$${PLANS.pro.priceAnnual}/yr (≈ $${annualPerMonth('pro')}/mo)`,
        },
        { label: 'Support', free: 'Standard', pro: 'Priority' },
      ],
    },
  ];
}

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success">
        <Check size={14} strokeWidth={3} />
      </span>
    ) : (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--glass-fill)] text-fg-subtle">
        <Minus size={14} />
      </span>
    );
  }
  return <span className="text-sm font-semibold text-fg">{value}</span>;
}

export function ProVsFreePage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const plan: PlanId = profile?.plan ?? 'free';
  const alreadyPro = isProOrAbove(plan);
  const groups = buildGroups();

  return (
    <Reveal className="mx-auto w-full max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6 pt-2">
        <div>
          <p className="text-sm font-medium text-fg-muted">Make an informed choice</p>
          <h1 className="gradient-text font-display text-headline font-bold">Pro vs Free</h1>
          <p className="mt-2 max-w-prose text-fg-muted">
            Everything Aurora offers, side by side — free forever, or unlocked with Pro.
          </p>
        </div>
        {!alreadyPro && (
          <GradientButton
            leftIcon={<Sparkles size={17} />}
            onClick={() => void navigate('/billing')}
          >
            Upgrade to Pro
          </GradientButton>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <GlassPanel key={group.title} className="overflow-hidden p-0">
            <div className="border-b border-[var(--glass-border)] px-5 py-3.5 sm:px-6">
              <h2 className="font-display text-base font-semibold text-fg">{group.title}</h2>
            </div>

            {/* Column header row */}
            <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-3 px-5 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle sm:grid-cols-[1fr_6.5rem_6.5rem] sm:px-6">
              <span />
              <span className="text-center">Free</span>
              <span className="text-center text-[var(--accent-from)]">Pro</span>
            </div>

            <div className="flex flex-col">
              {group.rows.map((row, index) => (
                <div
                  key={row.label}
                  className={
                    'grid grid-cols-[1fr_5rem_5rem] items-start gap-3 px-5 py-3 sm:grid-cols-[1fr_6.5rem_6.5rem] sm:px-6' +
                    (index !== group.rows.length - 1 ? ' border-b border-[var(--hairline)]' : '')
                  }
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{row.label}</p>
                    {row.detail && <p className="mt-0.5 text-xs text-fg-subtle">{row.detail}</p>}
                  </div>
                  <div className="flex justify-center">
                    <Cell value={row.free} />
                  </div>
                  <div className="flex justify-center">
                    <Cell value={row.pro} />
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Need more than {PRO_MEMBER_LIMIT} people on one board?{' '}
        <button
          type="button"
          onClick={() => void navigate('/billing')}
          className="font-semibold text-[var(--accent-from)] hover:underline"
        >
          Team
        </button>{' '}
        covers up to {TEAM_MEMBER_LIMIT}.
      </p>
    </Reveal>
  );
}
