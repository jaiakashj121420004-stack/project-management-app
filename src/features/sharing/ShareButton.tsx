import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SharePanel } from './SharePanel';
import type { ShareKind } from './api';

/** A compact "Share" button that opens the collaborator dialog for a canvas/note. */
export function ShareButton({
  kind,
  targetId,
  title,
  className,
}: {
  kind: ShareKind;
  targetId: string;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border border-[var(--glass-border)] px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg',
          className,
        )}
      >
        <Share2 size={15} /> Share
      </button>
      <SharePanel open={open} onClose={() => setOpen(false)} kind={kind} targetId={targetId} title={title} />
    </>
  );
}
