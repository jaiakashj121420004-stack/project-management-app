import { useState, type ReactNode } from 'react';
import { Mail, Sparkles } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GlassCard } from '@/components/glass/GlassCard';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Field } from '@/components/forms/Field';
import { Badge } from '@/components/Badge';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/feedback/Spinner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Reveal } from '@/components/motion/Reveal';
import { useTheme } from '@/hooks/useTheme';
import { accentGradient, accentVars, ACCENTS, ACCENT_NAMES, type AccentName } from '@/lib/accents';
import { cn } from '@/lib/cn';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Reveal>
      <GlassPanel className="p-5 sm:p-7">
        <h2 className="mb-5 font-display text-title font-semibold text-fg">{title}</h2>
        {children}
      </GlassPanel>
    </Reveal>
  );
}

export function StyleGuide() {
  const { theme } = useTheme();
  const [accent, setAccent] = useState<AccentName>('aurora');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5" style={accentVars(accent)}>
      {/* Header */}
      <Reveal>
        <GlassPanel gradientBorder className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
          <div>
            <h1 className="gradient-text font-display text-headline font-bold">Aurora Style Guide</h1>
            <p className="mt-1.5 text-fg-muted">
              Every primitive, in <span className="font-semibold text-fg">{theme}</span> mode. Toggle
              the theme to verify both →
            </p>
          </div>
          <ThemeToggle />
        </GlassPanel>
      </Reveal>

      {/* Accent picker */}
      <Section title="Accent gradients">
        <p className="mb-4 text-sm text-fg-muted">
          The six project accents. Pick one to drive the live demos below.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ACCENT_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setAccent(name)}
              className={cn(
                'group relative h-20 overflow-hidden rounded-2xl p-3 text-left ring-2 transition-all duration-200',
                accent === name
                  ? 'ring-white/70 ring-offset-2 ring-offset-transparent'
                  : 'ring-transparent hover:scale-[1.03]',
              )}
              style={{ backgroundImage: accentGradient(name) }}
              aria-pressed={accent === name}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <span className="relative text-sm font-semibold text-[var(--accent-fg)] drop-shadow">
                {ACCENTS[name].label}
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* Buttons */}
      <Section title="3D tactile buttons">
        <div className="flex flex-wrap items-center gap-3">
          <GradientButton accent={accent} leftIcon={<Sparkles size={18} />}>
            Primary
          </GradientButton>
          <GradientButton accent={accent} variant="secondary">
            Secondary
          </GradientButton>
          <GradientButton accent={accent} variant="ghost">
            Ghost
          </GradientButton>
          <GradientButton accent={accent} isLoading>
            Loading
          </GradientButton>
          <GradientButton accent={accent} disabled>
            Disabled
          </GradientButton>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <GradientButton accent={accent} size="sm">
            Small
          </GradientButton>
          <GradientButton accent={accent} size="md">
            Medium
          </GradientButton>
          <GradientButton accent={accent} size="lg">
            Large
          </GradientButton>
        </div>
        <p className="mt-4 text-sm text-fg-subtle">Hover to lift; press to depress. The gradient flows continuously.</p>
      </Section>

      {/* Tilt cards */}
      <Section title="Glass cards · pointer tilt">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(['aurora', 'bloom', 'lagoon'] as AccentName[]).map((name) => (
            <GlassCard key={name} accent={name} className="p-6">
              <h3 className="font-display text-lg font-semibold text-fg">{ACCENTS[name].label}</h3>
              <p className="mt-1 text-sm text-fg-muted">
                Move your cursor across me — I tilt in 3D and my shadow shifts.
              </p>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div className="space-y-2">
          <p className="gradient-text font-display text-display font-bold">Display</p>
          <p className="font-display text-headline font-bold text-fg">Headline</p>
          <p className="font-display text-title font-semibold text-fg">Title</p>
          <p className="text-fg-muted">
            Body copy in Inter — highly legible at small sizes, generous in rhythm and spacing.
          </p>
        </div>
      </Section>

      {/* Fields */}
      <Section title="Inputs">
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Project name" placeholder="e.g. Product Launch" />
          <Field label="Email" type="email" placeholder="you@example.com" leftIcon={<Mail size={17} />} />
          <Field label="With hint" placeholder="Type something" hint="A gentle helper message." />
          <Field label="With error" defaultValue="bad value" error="That doesn’t look right." />
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges">
        <div className="flex flex-wrap gap-2.5">
          <Badge tone="accent">Accent</Badge>
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="success" dot>
            Done
          </Badge>
          <Badge tone="warning" dot>
            Due soon
          </Badge>
          <Badge tone="danger" dot>
            Overdue
          </Badge>
          <Badge tone="info">Info</Badge>
        </div>
      </Section>

      {/* Avatars */}
      <Section title="Avatars">
        <div className="flex flex-wrap items-center gap-4">
          {['Jai Akash', 'Maya Lin', 'Devon Ray', 'Priya N'].map((name) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <Avatar name={name} size={52} />
              <span className="text-xs text-fg-subtle">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Feedback + Modal */}
      <Section title="Feedback & overlays">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Spinner size={28} />
            <span className="text-sm text-fg-muted">Spinner</span>
          </div>
          <div className="w-48 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <GradientButton accent={accent} variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </GradientButton>
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        accent={accent}
        title="A glass modal"
        description="Spring-animated, theme-aware, and dismissible by Esc or backdrop."
      >
        <p className="text-fg-muted">
          This is where rich content lives — card details, the new-project form, confirmations.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <GradientButton accent={accent} variant="ghost" onClick={() => setModalOpen(false)}>
            Cancel
          </GradientButton>
          <GradientButton accent={accent} onClick={() => setModalOpen(false)}>
            Got it
          </GradientButton>
        </div>
      </Modal>
    </div>
  );
}
