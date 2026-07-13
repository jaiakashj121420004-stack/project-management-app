import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/feedback/Spinner';

// The Konva editor is lazy-loaded (imported via dynamic import, exactly like
// CanvasHome) so the heavy canvas chunk never ships in the Library's main bundle.
const CanvasEditor = lazy(() =>
  import('@/features/canvas/CanvasEditor').then((module) => ({ default: module.CanvasEditor })),
);

/**
 * Opens a personal Library canvas (project_id null) in the full canvas editor.
 * `canEdit` follows the viewer's Pro plan — the owner edits only while on Pro
 * (RLS is the real gate). Deleting the canvas returns to the browser.
 */
export function OpenCanvas({
  canvasId,
  canEdit,
  onBack,
}: {
  canvasId: string;
  canEdit: boolean;
  onBack: () => void;
}) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      }
    >
      <CanvasEditor
        key={canvasId}
        noteId={canvasId}
        projectId={null}
        canEdit={canEdit}
        onDeleted={onBack}
      />
    </Suspense>
  );
}
