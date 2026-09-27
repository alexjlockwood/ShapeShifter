// The canvas editor (docs/canvas-editor.md) is loaded lazily, and only when its feature is on, so
// that the code users download doesn't grow while it's unfinished. Code outside
// components/canvaseditor/ uses these types to talk to it, and loads it with loadCanvasEditor(),
// but never imports it directly, which would bundle it with the rest of the app
// (src/test/lazyChunks.spec.ts checks this).

import type { Point } from 'app/modules/editor/scripts/common';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import type { State, Store } from 'app/modules/editor/store';

import type { CanvasCamera } from './CanvasCamera';
import type { CanvasPreview } from './CanvasPreview';

/** What the editor works with. */
export interface CanvasEditorContext {
  readonly store: Store<State>;
  readonly services: EditorServices;
  /** Shows the edits that the editor's gestures make until they're committed. */
  readonly preview: CanvasPreview;
  /** The panel, which the editor's cursors go on. */
  readonly root: HTMLElement;
  /** A canvas that covers the panel, for the editor's own outlines, handles, and guides. */
  readonly canvas: HTMLCanvasElement;
}

/**
 * The editor attached to one canvas. It gets the canvas's pointer events, except in action mode,
 * with points in viewport coordinates.
 */
export interface CanvasEditor {
  /** The panel was resized, zoomed, or panned. */
  setCamera(camera: CanvasCamera): void;
  onPress(event: PointerEvent, point: Point): void;
  onMove(event: PointerEvent, point: Point): void;
  onRelease(event: PointerEvent, point: Point): void;
  /** The gesture was canceled, or the pointer left the canvas. */
  onLeave(): void;
  dispose(): void;
}

/** What components/canvaseditor/CanvasEditor.ts exports. */
export interface CanvasEditorModule {
  createCanvasEditor(context: CanvasEditorContext): CanvasEditor;
}
