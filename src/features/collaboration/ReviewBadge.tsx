import { CheckCircle2, Eye, RotateCcw, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/Badge';
import type { ReviewStatus } from '@/types/database';

type ActiveStatus = Exclude<ReviewStatus, 'none'>;

const CONFIG: Record<ActiveStatus, { label: string; tone: 'info' | 'success' | 'warning'; icon: LucideIcon }> = {
  in_review: { label: 'In review', tone: 'info', icon: Eye },
  approved: { label: 'Approved', tone: 'success', icon: CheckCircle2 },
  changes_requested: { label: 'Changes requested', tone: 'warning', icon: RotateCcw },
};

/** Colored pill for a card's review state. Renders nothing when there's no review. */
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  if (status === 'none') return null;
  const { label, tone, icon: Icon } = CONFIG[status];
  return (
    <Badge tone={tone}>
      <Icon size={12} aria-hidden /> {label}
    </Badge>
  );
}
