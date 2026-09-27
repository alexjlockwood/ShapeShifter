import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import { PathLayer } from 'app/modules/editor/model/layers';
import { MathUtil, Matrix, Point } from 'app/modules/editor/scripts/common';

import { CanvasTool, DrawToolContext, EMPTY_OVERLAY, ToolOverlay } from './drawTools';
import {
  addNewLayer,
  createPathLayer,
  ellipseCommands,
  getNewLayerPlace,
  lineCommands,
  NewLayerPlace,
  rectangleCommands,
  toLocalPath,
} from './newLayers';
import type { Modifiers } from './SelectTool';
import { getSnapTargets, snapAlongLineToGrid, SnapGuide, snapPoint, SnapTargets } from './snapping';

export type ShapeKind = 'rectangle' | 'ellipse' | 'line';

// How far a press has to move to draw a shape, in CSS pixels.
const DRAG_SLOP = 4;
// Lines drawn with Shift held turn in steps of this, in degrees.
const LINE_ANGLE_SNAP = 45;

type State =
  | { readonly type: 'idle' }
  | {
      readonly type: 'pressed';
      // Where the pointer was pressed, and where the shape starts, which may have snapped away.
      readonly point: Point;
      readonly start: Point;
    }
  | {
      readonly type: 'drawing';
      readonly start: Point;
      readonly base: CanvasDocument;
      readonly place: NewLayerPlace;
      readonly layer: PathLayer;
      readonly targets: SnapTargets;
      // Whether the shape has no area (or the line no length), which isn't worth keeping.
      readonly isEmpty: boolean;
    };

/**
 * Draws rectangles, ellipses, and lines by dragging, like Figma. Shift makes squares and circles,
 * and turns lines in steps of 45 degrees, and Alt draws from the middle. The dragged corner snaps
 * like a move does, unless Ctrl or Shift is held. The new layer goes into the selected group (see
 * getNewLayerSpot), and is selected.
 */
export class ShapeTool implements CanvasTool {
  private state: State = { type: 'idle' };
  private lastPoint: Point | undefined;
  private guides: ReadonlyArray<SnapGuide> = [];

  constructor(
    readonly kind: ShapeKind,
    private readonly context: DrawToolContext,
  ) {}

  getOverlay(): ToolOverlay {
    return { ...EMPTY_OVERLAY, guides: this.guides };
  }

  onPress(point: Point, modifiers: Modifiers) {
    this.lastPoint = point;
    const targets = this.getTargets(this.context.getVectorLayer());
    this.state = { type: 'pressed', point, start: this.snap(point, targets, modifiers) };
  }

  onMove(point: Point, modifiers: Modifiers) {
    this.lastPoint = point;
    const { state } = this;
    if (state.type === 'pressed') {
      if (
        MathUtil.distance(state.point, point) > this.context.toViewportLength(DRAG_SLOP) &&
        this.startDrawing(state.start)
      ) {
        this.onMove(point, modifiers);
      }
      return;
    }
    if (state.type !== 'drawing') {
      return;
    }
    const end = this.snap(point, state.targets, modifiers);
    const [a, corner] = this.getCorners(state.start, end, modifiers);
    // A line kept at a multiple of 45 degrees still ends on the pixel grid where it can.
    const b =
      this.kind === 'line' && modifiers.shift && !modifiers.alt && !modifiers.ctrl
        ? snapAlongLineToGrid(a, corner, this.context.getSnapThresholds().grid)
        : corner;
    const commands =
      this.kind === 'rectangle'
        ? rectangleCommands(a, b)
        : this.kind === 'ellipse'
          ? ellipseCommands(a, b)
          : lineCommands(a, b);
    const layer = state.layer.clone();
    layer.pathData = toLocalPath(state.place.toLocal, commands);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    const isEmpty = this.kind === 'line' ? !width && !height : !width || !height;
    this.state = { ...state, isEmpty };
    this.context.preview.setDocument(addNewLayer(state.base, state.place, layer), {
      selectedLayerIds: new Set([layer.id]),
    });
  }

  onRelease(_: Point) {
    const { state } = this;
    this.state = { type: 'idle' };
    this.guides = [];
    if (state.type === 'drawing' && state.isEmpty) {
      // E.g. both corners snapped to the same point.
      this.context.preview.cancel();
    } else if (state.type === 'drawing') {
      this.context.preview.commit();
      this.context.finish();
    }
    this.context.redraw();
  }

  onModifiersChange(modifiers: Modifiers) {
    if (this.state.type === 'drawing' && this.lastPoint) {
      this.onMove(this.lastPoint, modifiers);
    }
  }

  onLeave() {
    const wasDrawing = this.state.type === 'drawing';
    this.state = { type: 'idle' };
    this.lastPoint = undefined;
    this.guides = [];
    if (wasDrawing) {
      this.context.preview.cancel();
    }
    this.context.redraw();
  }

  /** Starts an edit with a new layer in it, and returns whether it could. */
  private startDrawing(start: Point) {
    const { preview } = this.context;
    preview.begin(() => {
      this.state = { type: 'idle' };
      this.guides = [];
      this.context.redraw();
    });
    const base = preview.getBase();
    if (!base) {
      preview.cancel();
      this.state = { type: 'idle' };
      return false;
    }
    const place = getNewLayerPlace(
      base,
      this.context.getSelectedLayerIds(),
      this.context.getHiddenLayerIds(),
      document => this.context.render(document),
    );
    const style = this.kind === 'line' ? 'stroked' : 'filled';
    this.state = {
      type: 'drawing',
      start,
      base,
      place,
      layer: createPathLayer(
        base.vectorLayer,
        this.kind,
        toLocalPath(Matrix.identity(), []),
        style,
        place,
      ),
      isEmpty: true,
      targets: this.getTargets(this.context.render(base)),
    };
    return true;
  }

  /** Returns the corners of the shape's box, or the ends of the line. */
  private getCorners(start: Point, end: Point, { shift, alt }: Modifiers): [Point, Point] {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    if (shift) {
      if (this.kind === 'line') {
        ({ x: dx, y: dy } = MathUtil.snapVectorToAngle({ x: dx, y: dy }, LINE_ANGLE_SNAP));
      } else {
        // A square or a circle, as big as the bigger side.
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * size;
        dy = Math.sign(dy || 1) * size;
      }
    }
    const b = { x: start.x + dx, y: start.y + dy };
    return alt ? [{ x: start.x - dx, y: start.y - dy }, b] : [start, b];
  }

  private snap(point: Point, targets: SnapTargets, { ctrl, shift }: Modifiers) {
    this.guides = [];
    if (ctrl || (shift && this.state.type === 'drawing')) {
      return point;
    }
    const snap = snapPoint(point, targets, this.context.getSnapThresholds());
    this.guides = snap.guides;
    return { x: point.x + snap.dx, y: point.y + snap.dy };
  }

  private getTargets(vl: Parameters<typeof getSnapTargets>[0]) {
    return getSnapTargets(vl, [], this.context.getHiddenLayerIds());
  }
}
