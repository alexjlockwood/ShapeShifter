import type {
  CanvasEditor,
  CanvasEditorContext,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { Path } from 'app/modules/editor/model/paths';
import { environment } from 'environments/environment';

// The entry point of the canvas editor's lazily loaded code. It doesn't have any tools yet (see
// docs/canvas-editor.md), so dev builds let the end-to-end tests drive its preview instead, as
// window.shapeshifter.canvasEditor.

export function createCanvasEditor({ preview }: CanvasEditorContext): CanvasEditor {
  const removeTestHooks = environment.production ? undefined : addTestHooks(preview);
  return {
    dispose() {
      removeTestHooks?.();
    },
  };
}

function addTestHooks(preview: CanvasPreview) {
  const devGlobal = (window as { shapeshifter?: { canvasEditor?: unknown } }).shapeshifter;
  if (!devGlobal) {
    return undefined;
  }
  devGlobal.canvasEditor = {
    /** Shows the layer with the path, starting an edit if there isn't one. */
    previewPath(layerId: string, pathData: string) {
      if (!preview.isEditing()) {
        preview.begin();
      }
      preview.setPath(layerId, new Path(pathData));
    },
    commit: () => preview.commit(),
    cancel: () => preview.cancel(),
    isEditing: () => preview.isEditing(),
  };
  return () => {
    delete devGlobal.canvasEditor;
  };
}
