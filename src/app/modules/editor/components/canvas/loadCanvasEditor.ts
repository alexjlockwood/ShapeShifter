import type { CanvasEditorModule } from './CanvasEditorApi';

let editorModule: Promise<CanvasEditorModule> | undefined;

/**
 * Downloads the canvas editor's code the first time it's called. A failed download isn't tried
 * again: browsers can remember a module that failed to load for the rest of the page's life, so
 * trying again takes a reload.
 */
export function loadCanvasEditor(): Promise<CanvasEditorModule> {
  editorModule ??= import('app/modules/editor/components/canvaseditor/CanvasEditor');
  return editorModule;
}
