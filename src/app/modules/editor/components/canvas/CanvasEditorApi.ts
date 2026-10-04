// The canvas editor (docs/canvas-editor.md) is loaded lazily, and only when its feature is on, so
// that it doesn't delay the app's first render, and browsers that turn it off never download it.
// Code outside components/canvaseditor/ uses these types to talk to it, and loads it with
// loadCanvasEditor(), but never imports it directly, which would bundle it with the rest of the
// app (src/test/lazyChunks.spec.ts checks this).

import type { Path, PointType } from 'app/modules/editor/model/paths';
import type { Point } from 'app/modules/editor/scripts/common';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import type { State, Store } from 'app/modules/editor/store';
import type { ComponentType } from 'react';

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

/** The commands that only the editor runs, which the context menu offers while it's loaded. */
export type CanvasEditorCommand =
  'duplicate' | 'union' | 'subtract' | 'intersect' | 'exclude' | 'outline';

/** What the context menu needs to know about the editor when it opens. */
export interface CanvasEditorMenuState {
  /** Why the editor can't run its commands right now, e.g. while the pen is drawing a path. */
  readonly busyReason?: string;
  /** The path whose points are being edited, if any. */
  readonly editingLayerId?: string;
  /** What the point commands can do, while points are edited and some are selected. */
  readonly points?: PointMenuState;
}

/**
 * The point commands for the selected points, while a path's points are edited. A reason is set,
 * even to '', when the command can't run.
 */
export interface PointMenuState {
  readonly selectedCount: number;
  /** The selected points' type, if they all have the same one. */
  readonly pointType: PointType | undefined;
  /** Whether the subpath with the selected points is closed, if they're all in one. */
  readonly isSubPathClosed: boolean | undefined;
  readonly toggleClosedReason?: string;
  readonly setFirstReason?: string;
}

/** What the context menu and the inspector can do to the selected points. */
export type PointCommand =
  | { readonly type: 'delete' }
  | { readonly type: 'setPointType'; readonly pointType: PointType }
  /** Opens the selected points' subpath if it's closed, and closes it if it's open. */
  | { readonly type: 'toggleClosed' }
  | { readonly type: 'setFirstPoint' };

/**
 * The path whose points are being edited, as the editor reports it to the property inspector
 * (services/canvaseditorbridge.service.ts).
 */
export interface PointEditState {
  readonly layerId: string;
  /**
   * The path the editor draws and edits, which is a path block's value at one of its keyframes,
   * rather than the layer's own path.
   */
  readonly path: Path;
  readonly selectedAnchorIds: ReadonlySet<string>;
}

/**
 * What the rest of the app reaches the editor through, while it's loaded
 * (services/canvaseditorbridge.service.ts).
 */
export interface CanvasEditorCommands {
  /**
   * Returns the layer a right-click at the point is on, the way the select tool finds what a press
   * selects, or undefined if there's none, or if the editor's in the middle of something that a
   * new selection would interrupt.
   */
  getLayerAt(point: Point): string | undefined;
  getMenuState(): CanvasEditorMenuState;
  /**
   * Runs the command on the selection. Editing points stops first. Commands that need PathKit
   * run once it's loaded.
   */
  runCommand(command: CanvasEditorCommand): void;
  /** Starts editing the layer's points, if it can be edited now, and returns whether it did. */
  startPointEdit(layerId: string): boolean;
  /** Stops editing points, like Enter. */
  stopPointEdit(): void;
  /** Selects the points of the path being edited, if it's still the layer's. */
  setSelectedAnchorIds(layerId: string, anchorIds: ReadonlySet<string>): void;
  /**
   * Changes the path being edited, if it's still the layer's, as one undo step, where the editor
   * saves its own edits (see PointEditState.path). The edit gets the path as it's saved, and it
   * can pick the points to select afterward.
   */
  editPoints(
    layerId: string,
    edit: (path: Path) => { readonly path: Path; readonly selectedAnchorIds?: ReadonlySet<string> },
  ): void;
  runPointCommand(command: PointCommand): void;
  /**
   * Selects the point under a right-click, if points are being edited and it isn't selected, so
   * that the menu acts on it.
   */
  selectPointAt(point: Point): void;
}

/**
 * The editor attached to one canvas. It gets the canvas's pointer events, except in action mode,
 * with points in viewport coordinates.
 */
export interface CanvasEditor extends CanvasEditorCommands {
  /** The panel was resized, zoomed, or panned. */
  setCamera(camera: CanvasCamera): void;
  onPress(event: PointerEvent, point: Point): void;
  onMove(event: PointerEvent, point: Point): void;
  onRelease(event: PointerEvent, point: Point): void;
  /** The gesture was canceled, or the pointer left the canvas. */
  onLeave(): void;
  dispose(): void;
}

/**
 * What the property inspector gives the editor's path inspector, which shows the points of the path
 * being edited.
 */
export interface PathInspectorProps {
  readonly layerId: string;
  readonly state: PointEditState;
  /** Changes the path, as one undo step (CanvasEditorCommands.editPoints). */
  readonly onEdit: CanvasEditorCommands['editPoints'];
  readonly onSelect: (anchorIds: ReadonlySet<string>) => void;
  readonly onCommand: (command: PointCommand) => void;
}

/** What components/canvaseditor/CanvasEditor.ts exports. */
export interface CanvasEditorModule {
  createCanvasEditor(context: CanvasEditorContext): CanvasEditor;
  /** Shows the selected points and lists the subpaths while points are edited. */
  PathInspector: ComponentType<PathInspectorProps>;
}
