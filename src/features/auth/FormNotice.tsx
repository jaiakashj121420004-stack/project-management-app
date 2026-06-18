import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'error' | 'success' | 'info';

const STYLES: Record<Tone, string> = {
  error: 'border-danger/30 bg-danger/10 text-danger',
  success: 'border-success/30 bg-success/10 text-success',
  info: 'border-info/30 bg-info/10 text-info',
};

const ICONS: Record<Tone, LucideIcon> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

/** Inline banner for form-level feedback (auth errors, "check your inbox", …). */
export function FormNotice({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-4 flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm',
        STYLES[tone],
      )}
    >
      <Icon size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  );
}
