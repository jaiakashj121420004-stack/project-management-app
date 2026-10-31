import { useEffect, useRef } from 'react';
import type { Camera } from './constants';
import type { CanvasElement } from './elements';
import { isLineKind, labelBox, labelFontSize } from './shapes';

interface ShapeLabelEditorProps {
  element: CanvasElement | null;
  camera: Camera;
  onCommit: (id: string, label: string) => void;
  onClose: () => void;
}

/**
 * An in-place text field laid over a shape so its label is typed where it will
 * appear. Enter saves (Shift+Enter = new line), Esc cancels, clicking away saves.
 * It sits in the shape's own rotated, zoomed frame so it matches the canvas.
 */
export function ShapeLabelEditor({ element, camera, onCommit, onClose }: ShapeLabelEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [element?.id]);

  if (!element || element.type !== 'shape' || isLineKind(element.kind)) return null;
  const box = labelBox(element);
  const shape = element;

  function finish(save: boolean) {
    if (done.current) return;
    done.current = true;
    if (save) onCommit(shape.id, ref.current?.value ?? '');
    onClose();
  }

  return (
    <div
      className="absolute left-0 top-0 z-20"
      style={{
        width: shape.width,
        height: shape.height,
        transformOrigin: '0 0',
        transform: `translate(${shape.x * camera.scale + camera.x}px, ${shape.y * camera.scale + camera.y}px) rotate(${shape.rotation}deg) scale(${camera.scale})`,
      }}
    >
      <textarea
        ref={ref}
        defaultValue={shape.label}
        aria-label="Shape text"
        spellCheck={false}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            finish(false);
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            finish(true);
          }
          event.stopPropagation();
        }}
        className="absolute resize-none overflow-hidden bg-transparent text-center font-serif outline-none ring-2 ring-[var(--accent-from)]"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          fontSize: labelFontSize(shape),
          lineHeight: 1.25,
          color: shape.kind === 'sticky' ? '#3b2f0a' : shape.stroke,
          paddingTop: Math.max(0, (box.height - labelFontSize(shape) * 1.25) / 2),
        }}
      />
    </div>
  );
}
