import type {
  CanvasDocument,
  CanvasEditLayerIds,
} from 'app/modules/editor/components/canvas/CanvasPreview';
import { VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Point } from 'app/modules/editor/scripts/common';

import type { Modifiers } from './SelectTool';
import type { SnapGuide, SnapThresholds } from './snapping';

/** What the canvas editor's tools get from it, in viewport coordinates. */
export interface CanvasTool {
  onPress(point: Point, modifiers: Modifiers, clickCount?: number): void;
  onMove(point: Point, modifiers: Modifiers): void;
  onRelease(point: Point): void;
  onModifiersChange(modifiers: Modifiers): void;
  /** Ends the gesture where it is, e.g. when it's canceled or the pointer leaves the canvas. */
  onLeave(): void;
}

/** What a drawing tool shows while it draws, in viewport coordinates. */
export interface ToolOverlay {
  /** Lines and curves to outline, as their start, control points, and end. */
  readonly curves: ReadonlyArray<ReadonlyArray<Point>>;
  readonly anchors: ReadonlyArray<{ readonly point: Point; readonly isHovered: boolean }>;
  readonly handles: ReadonlyArray<{ readonly anchor: Point; readonly handle: Point }>;
  readonly guides: ReadonlyArray<SnapGuide>;
}

export const EMPTY_OVERLAY: ToolOverlay = { curves: [], anchors: [], handles: [], guides: [] };

/** What the drawing tools read and change. */
export interface DrawToolContext {
  /** The vector layer as it's drawn, at the current time and with any edit in progress. */
  getVectorLayer(): VectorLayer;
  getHiddenLayerIds(): ReadonlySet<string>;
  getSelectedLayerIds(): ReadonlySet<string>;
  /** CSS pixels in viewport units, for tolerances. */
  toViewportLength(length: number): number;
  getSnapThresholds(): SnapThresholds;
  /** Whether the layer's path can be changed now, e.g. that no animation block sets it. */
  canEditPath(layerId: string): boolean;
  /** Returns the document's vector layer as it's drawn at the current time. */
  render(document: CanvasDocument): VectorLayer;
  /** The edit that a gesture shows until it's committed (CanvasPreview). */
  readonly preview: {
    begin(onCancel: () => void): void;
    getBase(): CanvasDocument | undefined;
    setDocument(document: CanvasDocument, layerIds?: CanvasEditLayerIds): void;
    setPath(layerId: string, path: Path): void;
    commit(): void;
    cancel(): void;
  };
  redraw(): void;
  /** The tool is done drawing, e.g. so that the editor can go back to the select tool. */
  finish(): void;
}
