// The canvas editor (docs/canvas-editor.md) is loaded lazily, and only when its feature is on, so
// that the code users download doesn't grow while it's unfinished. Code outside
// components/canvaseditor/ uses these types to talk to it, and loads it with loadCanvasEditor(),
// but never imports it directly, which would bundle it with the rest of the app
// (src/test/lazyChunks.spec.ts checks this).

import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import type { State, Store } from 'app/modules/editor/store';

import type { CanvasPreview } from './CanvasPreview';

/** What the editor works with. */
export interface CanvasEditorContext {
  readonly store: Store<State>;
  readonly services: EditorServices;
  /** Shows the edits that the editor's gestures make until they're committed. */
  readonly preview: CanvasPreview;
}

/** The editor attached to one canvas. */
export interface CanvasEditor {
  dispose(): void;
}

/** What components/canvaseditor/CanvasEditor.ts exports. */
export interface CanvasEditorModule {
  createCanvasEditor(context: CanvasEditorContext): CanvasEditor;
}
