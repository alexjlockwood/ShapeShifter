// The canvas editor (docs/canvas-editor.md) is loaded lazily, and only when its feature is on, so
// that the code users download doesn't grow while it's unfinished. Code outside
// components/canvaseditor/ uses these types to talk to it, and loads it with loadCanvasEditor(),
// but never imports it directly, which would bundle it with the rest of the app
// (src/test/lazyChunks.spec.ts checks this).

/** The editor attached to one canvas. */
export interface CanvasEditor {
  dispose(): void;
}

/** What components/canvaseditor/CanvasEditor.ts exports. */
export interface CanvasEditorModule {
  createCanvasEditor(): CanvasEditor;
}
