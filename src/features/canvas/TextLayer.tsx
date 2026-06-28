import { type CSSProperties } from 'react';
import type { Camera, ElementBox } from './constants';
import type { CanvasElement, TextBoxElement } from './elements';
import { isEmptyDoc, renderTextHtml } from './richText';
import { RichTextBox } from './RichTextBox';
import type { CanvasPalette } from './useCanvasPalette';

interface TextLayerProps {
  elements: CanvasElement[];
  camera: Camera;
  palette: CanvasPalette;
  /** The text box currently being edited, or null. */
  editingId: string | null;
  /** Live transform of a text box mid drag/resize (follows the Konva node). */
  liveBox: ElementBox | null;
  onCommit: (id: string, body: Record<string, unknown>, text: string) => void;
  onExitEdit: () => void;
}

/**
 * The HTML text overlay. Konva can't render per-range rich text, so text boxes
 * are drawn as HTML divs layered exactly over their Konva background rects via
 * the same camera transform. Non-editing boxes are `pointer-events: none` so
 * clicks fall through to Konva (selection / drag / resize / the Transformer);
 * the one box being edited mounts a live Tiptap editor that opts pointer events
 * back in. The whole layer is non-interactive except that editing box.
 */
export function TextLayer({
  elements,
  camera,
  palette,
  editingId,
  liveBox,
  onCommit,
  onExitEdit,
}: TextLayerProps) {
  const texts = elements.filter((el): el is TextBoxElement => el.type === 'text');
  const scale = camera.scale;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {texts.map((el) => {
        const box: ElementBox =
          liveBox && liveBox.id === el.id
            ? liveBox
            : { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation };

        const screenX = camera.x + box.x * scale;
        const screenY = camera.y + box.y * scale;
        const boxStyle: CSSProperties = {
          position: 'absolute',
          left: 0,
          top: 0,
          width: box.width,
          height: box.height,
          transformOrigin: '0 0',
          transform: `translate(${screenX}px, ${screenY}px) rotate(${box.rotation}deg) scale(${scale})`,
        };

        if (el.id === editingId) {
          const above = screenY - 46;
          const toolbarStyle: CSSProperties = {
            position: 'absolute',
            left: Math.max(4, screenX),
            top: above < 4 ? screenY + box.height * scale + 8 : above,
            zIndex: 2,
          };
          return (
            <RichTextBox
              key={el.id}
              body={el.body}
              boxStyle={boxStyle}
              toolbarStyle={toolbarStyle}
              color={palette.text}
              onCommit={(body, text) => onCommit(el.id, body, text)}
              onExit={onExitEdit}
            />
          );
        }

        const empty = isEmptyDoc(el.body) && el.text.trim().length === 0;
        return (
          <div
            key={el.id}
            style={boxStyle}
            className="pointer-events-none select-none overflow-hidden rounded-2xl"
          >
            {empty ? (
              <div className="canvas-rich canvas-rich-empty" style={{ color: palette.muted }}>
                Double-click to type
              </div>
            ) : (
              <div
                className="canvas-rich"
                style={{ color: palette.text }}
                dangerouslySetInnerHTML={{ __html: renderTextHtml(el.body) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
