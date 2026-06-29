/**
 * LayersPanel.tsx — element list panel (P3.6).
 *
 * Shows all canvas elements ordered by z-index (topmost first). Each row lets
 * the user select an element, toggle its visibility, and toggle its lock state.
 * The panel overlays the canvas (position:absolute) and is toggled by the
 * CanvasToolbar layers button. Width is fixed; it does NOT shrink the canvas.
 */
import { Image, Mic, MousePointer, Type, Video } from 'lucide-react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CanvasElement } from './elements';

interface LayersPanelProps {
  /** All elements in the scene (unsorted; panel sorts them by z desc = top first). */
  elements: CanvasElement[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
}

/** Human-readable label + icon for each element type. */
function elementMeta(element: CanvasElement): { icon: React.ReactNode; label: string } {
  switch (element.type) {
    case 'stroke':
      return { icon: <MousePointer size={12} />, label: 'Stroke' };
    case 'text':
      return {
        icon: <Type size={12} />,
        label: element.text.trim() ? element.text.trim().slice(0, 20) : 'Text',
      };
    case 'image':
      return { icon: <Image size={12} />, label: 'Image' };
    case 'media':
      return {
        icon: element.kind === 'video' ? <Video size={12} /> : <Mic size={12} />,
        label: element.kind === 'video' ? 'Video' : 'Audio',
      };
  }
}

/**
 * A glass overlay panel listing canvas elements from top (highest z) to bottom.
 * Clicking a row selects that element; shift-click adds/removes from the
 * selection. The eye and lock buttons toggle visibility and lock per row.
 */
export function LayersPanel({
  elements,
  selectedIds,
  onSelect,
  onToggleVisibility,
  onToggleLock,
}: LayersPanelProps) {
  // Sort descending by z so the topmost element appears first in the list.
  const sorted = [...elements].sort((a, b) => b.z - a.z);

  function handleRowClick(id: string, e: React.MouseEvent) {
    if (e.shiftKey) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((sid) => sid !== id)
        : [...selectedIds, id];
      onSelect(next);
    } else {
      onSelect([id]);
    }
  }

  return (
    <div
      className="glass-menu absolute right-2 top-14 z-40 flex w-52 flex-col rounded-2xl border border-[var(--glass-border)] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.6)]"
      style={{ maxHeight: 'calc(100% - 5rem)' }}
      aria-label="Layers"
    >
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2">
        <span className="text-xs font-semibold text-fg-muted">Layers</span>
        <span className="text-[10px] text-fg-subtle">{elements.length}</span>
      </div>

      <ul
        className="min-h-0 flex-1 overflow-y-auto py-1"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Element layers"
      >
        {sorted.length === 0 && (
          <li className="px-3 py-3 text-xs text-fg-subtle">No elements yet</li>
        )}
        {sorted.map((element) => {
          const { icon, label } = elementMeta(element);
          const isSelected = selectedIds.includes(element.id);
          const isVisible = element.visible !== false;

          return (
            <li
              key={element.id}
              role="option"
              aria-selected={isSelected}
              className={cn(
                'group flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs transition-colors',
                isSelected
                  ? 'bg-[linear-gradient(110deg,rgba(var(--accent-from-rgb),0.15),rgba(var(--accent-to-rgb),0.1))] text-fg'
                  : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
                !isVisible && 'opacity-40',
              )}
              onClick={(e) => handleRowClick(element.id, e)}
            >
              {/* Type icon */}
              <span className="shrink-0 opacity-60">{icon}</span>

              {/* Label — truncated */}
              <span className="min-w-0 flex-1 truncate">{label}</span>

              {/* Visibility toggle */}
              <button
                type="button"
                aria-label={isVisible ? 'Hide element' : 'Show element'}
                title={isVisible ? 'Hide' : 'Show'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(element.id);
                }}
                className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--glass-fill)] group-hover:opacity-100"
              >
                {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>

              {/* Lock toggle */}
              <button
                type="button"
                aria-label={element.locked ? 'Unlock element' : 'Lock element'}
                title={element.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(element.id);
                }}
                className={cn(
                  'shrink-0 rounded p-0.5 transition-opacity hover:bg-[var(--glass-fill)]',
                  element.locked ? 'opacity-70' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                {element.locked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
