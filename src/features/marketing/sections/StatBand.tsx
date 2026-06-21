import { Calendar, CheckCircle2, FileText, Bell } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { GlassPanel } from '@/components/glass/GlassPanel';

const ITEMS = [
  { icon: CheckCircle2, label: 'Boards' },
  { icon: Calendar, label: 'Calendar' },
  { icon: FileText, label: 'Notes' },
  { icon: Bell, label: 'Reminders' },
] as const;

/** One-line capability band: the four pillars of the app, all in one place. */
export function StatBand() {
  return (
    <section className="px-4 pt-16 sm:px-6 sm:pt-20">
      <Reveal className="mx-auto max-w-4xl">
        <GlassPanel className="flex flex-col items-center gap-4 px-6 py-5 sm:flex-row sm:justify-between sm:gap-6">
          {ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 text-fg">
              <item.icon size={18} className="text-[var(--accent-from)]" />
              <span className="font-display text-base font-semibold">{item.label}</span>
            </div>
          ))}
          <span className="text-sm text-fg-muted">— all in one workspace</span>
        </GlassPanel>
      </Reveal>
    </section>
  );
}
