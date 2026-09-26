import type { CanvasEditorModule } from './CanvasEditorApi';

let editorModule: Promise<CanvasEditorModule> | undefined;

/**
 * Downloads the canvas editor's code the first time it's called. If that fails (e.g. offline, or
 * after a deploy removed the old file), the next call tries again.
 */
export function loadCanvasEditor(): Promise<CanvasEditorModule> {
  editorModule ??= import('app/modules/editor/components/canvaseditor/CanvasEditor').catch(
    (error: unknown) => {
      editorModule = undefined;
      throw error;
    },
  );
  return editorModule;
}
