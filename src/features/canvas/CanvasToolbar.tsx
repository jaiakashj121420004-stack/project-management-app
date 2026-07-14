import type { ReactNode } from 'react';
import {
  Clapperboard,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Eraser,
  Files,
  FileText,
  Frame,
  ImagePlus,
  Layers,
  Lock,
  MousePointer,
  Pen,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassSelect } from '@/components/forms/GlassSelect';
import { PAGE_LABELS, PAGE_TYPES, type PageType } from '@/lib/canvasPages';
import type { CanvasTool } from './constants';

interface CanvasToolbarProps {
  canEdit: boolean;
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  pageType: PageType;
  onPageType: (pageType: PageType) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAdd: () => void;
  /** Add a document-width page-writing column (Google-Docs-style). */
  onAddPage: () => void;
  /** Add a named frame region — a labeled box drawn behind content. */
  onAddFrame: () => void;
  /** Called when the user wants to add an image. `undefined` on personal canvases
   *  (no projectId → Storage RLS would reject the upload). */
  onAddImage: (() => void) | undefined;
  /** Called when the user wants to add audio/video (record / upload / embed).
   *  `undefined` on personal canvases (Storage RLS is keyed by projectId). */
  onAddMedia: (() => void) | undefined;
  hasSelection: boolean;
  selectedLocked: boolean;
  onToggleLock: () => void;
  onDeleteSelected: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
  showLayers: boolean;
  onToggleLayers: () => void;
  className?: string;
}

/**
 * The floating glass toolbar over the canvas: undo/redo, add element, the
 * page-type switcher, and zoom controls — plus lock/delete affordances for the
 * current selection. Edit affordances are hidden for viewers, who keep zoom +
 * page-type-readout only. It wraps (never scroll-clips) so the GlassSelect
 * dropdown is never cut off.
 */
export function CanvasToolbar({
  canEdit,
  tool,
  onTool,
  pageType,
  onPageType,
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAdd,
  onAddPage,
  onAddFrame,
  onAddImage,
  onAddMedia,
  hasSelection,
  selectedLocked,
  onToggleLock,
  onDeleteSelected,
  onDuplicate,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  showLayers,
  onToggleLayers,
  className,
}: CanvasToolbarProps) {
  return (
    <div
      className={cn(
        'glass-menu flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-[var(--glass-border)] px-1.5 py-1 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]',
        className,
      )}
    >
      {canEdit && (
        <>
          <ToolButton
            label="Select / move"
            onClick={() => onTool('select')}
            active={tool === 'select'}
          >
            <MousePointer size={16} />
          </ToolButton>
          <ToolButton label="Draw" onClick={() => onTool('draw')} active={tool === 'draw'}>
            <Pen size={16} />
          </ToolButton>
          <ToolButton
            label="Text — click anywhere to type"
            onClick={() => onTool('text')}
            active={tool === 'text'}
          >
            <Type size={16} />
          </ToolButton>
          <ToolButton label="Eraser" onClick={() => onTool('erase')} active={tool === 'erase'}>
            <Eraser size={16} />
          </ToolButton>
          <Divider />
          <ToolButton label="Undo" onClick={onUndo} disabled={!canUndo}>
            <Undo2 size={17} />
          </ToolButton>
          <ToolButton label="Redo" onClick={onRedo} disabled={!canRedo}>
            <Redo2 size={17} />
          </ToolButton>
          <Divider />
          <ToolButton label="Add text" onClick={onAdd}>
            <Plus size={18} />
          </ToolButton>
          <ToolButton label="Add a page to write on (long-form)" onClick={onAddPage}>
            <FileText size={17} />
          </ToolButton>
          <ToolButton label="Add frame — a named region" onClick={onAddFrame}>
            <Frame size={17} />
          </ToolButton>
          {onAddImage && (
            <ToolButton label="Add image — or paste / drag-drop" onClick={onAddImage}>
              <ImagePlus size={17} />
            </ToolButton>
          )}
          {onAddMedia && (
            <ToolButton label="Add audio / video — record, upload or embed" onClick={onAddMedia}>
              <Clapperboard size={17} />
            </ToolButton>
          )}
          <Divider />
        </>
      )}

      <GlassSelect
        size="sm"
        label="Page type"
        value={pageType}
        onChange={onPageType}
        disabled={!canEdit}
        className="w-28"
        options={PAGE_TYPES.map((type) => ({ value: type, label: PAGE_LABELS[type] }))}
      />

      <Divider />
      <ToolButton label="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={17} />
      </ToolButton>
      <button
        type="button"
        onClick={onZoomReset}
        aria-label="Reset zoom to 100%"
        className="min-w-[3rem] rounded-lg px-1 text-xs font-semibold tabular-nums text-fg-muted transition-colors hover:text-fg"
      >
        {Math.round(scale * 100)}%
      </button>
      <ToolButton label="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={17} />
      </ToolButton>

      {canEdit && hasSelection && (
        <>
          <Divider />
          {/* Z-order group */}
          <ToolButton label="Bring to front (Ctrl+Shift+])" onClick={onBringToFront}>
            <ChevronsUp size={16} />
          </ToolButton>
          <ToolButton label="Bring forward (Ctrl+])" onClick={onBringForward}>
            <ChevronUp size={16} />
          </ToolButton>
          <ToolButton label="Send backward (Ctrl+[)" onClick={onSendBackward}>
            <ChevronDown size={16} />
          </ToolButton>
          <ToolButton label="Send to back (Ctrl+Shift+[)" onClick={onSendToBack}>
            <ChevronsDown size={16} />
          </ToolButton>
          <Divider />
          <ToolButton label="Duplicate (Ctrl+D)" onClick={onDuplicate}>
            <Files size={16} />
          </ToolButton>
          <ToolButton
            label={selectedLocked ? 'Unlock element' : 'Lock element'}
            onClick={onToggleLock}
            active={selectedLocked}
          >
            {selectedLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </ToolButton>
          <ToolButton label="Delete (Backspace)" onClick={onDeleteSelected}>
            <Trash2 size={16} />
          </ToolButton>
        </>
      )}

      {canEdit && (
        <>
          <Divider />
          <ToolButton label="Toggle layers panel" onClick={onToggleLayers} active={showLayers}>
            <Layers size={16} />
          </ToolButton>
        </>
      )}
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--glass-border)]" aria-hidden />;
}

function ToolButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors',
        'hover:bg-[var(--glass-fill)] hover:text-fg disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
          : 'text-fg-muted',
      )}
    >
      {children}
    </button>
  );
}
