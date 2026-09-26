import type { CanvasEditor } from 'app/modules/editor/components/canvas/CanvasEditorApi';

// The entry point of the canvas editor's lazily loaded code. It doesn't do anything yet: the tools
// come later (see docs/canvas-editor.md).

export function createCanvasEditor(): CanvasEditor {
  return { dispose() {} };
}
