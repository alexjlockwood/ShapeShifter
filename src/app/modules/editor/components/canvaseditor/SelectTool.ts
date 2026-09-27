import {
  getPathLayerBounds,
  hitTestLayer,
} from 'app/modules/editor/components/canvas/LayerGeometry';
import { VectorLayer } from 'app/modules/editor/model/layers';
import { MathUtil, Point, Rect } from 'app/modules/editor/scripts/common';
import { isEqual } from 'lodash-es';

/** What the select tool reads and changes. */
export interface SelectToolContext {
  /** The vector layer as it's drawn, at the current time and with any edit in progress. */
  getVectorLayer(): VectorLayer;
  getHiddenLayerIds(): ReadonlySet<string>;
  getSelectedLayerIds(): ReadonlySet<string>;
  setSelectedLayerIds(layerIds: ReadonlySet<string>): void;
  /** CSS pixels in viewport units, for tolerances. */
  toViewportLength(length: number): number;
  redraw(): void;
}

export interface Modifiers {
  /** Shift, or Cmd on Macs and Ctrl elsewhere: adds to the selection. */
  readonly isAdding: boolean;
  /** Alt: a marquee only selects the layers it fully contains. */
  readonly isContaining: boolean;
}

// How far a press has to move to become a drag, and how close to a path hits it, in CSS pixels.
const DRAG_SLOP = 4;
const HIT_TOLERANCE = 6;

type State =
  | { readonly type: 'idle' }
  | {
      readonly type: 'pressed';
      readonly start: Point;
      readonly hitLayerId: string | undefined;
      readonly modifiers: Modifiers;
    }
  | {
      readonly type: 'marquee';
      readonly start: Point;
      readonly current: Point;
      readonly modifiers: Modifiers;
      // The selection before the marquee, which it adds to with Shift held.
      readonly initialSelection: ReadonlySet<string>;
      // The paths it can select, which don't change while it's drawn.
      readonly boundsById: ReadonlyMap<string, Rect>;
    };

/**
 * Selects layers on the canvas, like Figma. Clicking a path selects it, with Shift adding it or
 * taking it away, clicking nothing clears the selection, and dragging from nothing draws a marquee
 * that selects the paths it touches (or, with Alt held, the ones it contains), but not clip paths.
 * Hovering outlines the path under the pointer.
 */
export class SelectTool {
  private state: State = { type: 'idle' };
  private hoveredLayerId: string | undefined;

  constructor(private readonly context: SelectToolContext) {}

  getHoveredLayerId() {
    return this.state.type === 'marquee' ? undefined : this.hoveredLayerId;
  }

  /** The marquee's corners in viewport coordinates, while one is being drawn. */
  getMarquee(): Rect | undefined {
    if (this.state.type !== 'marquee') {
      return undefined;
    }
    return toRect(this.state.start, this.state.current);
  }

  onPress(point: Point, modifiers: Modifiers) {
    const hitLayerId = this.hitTest(point)?.id;
    if (hitLayerId && !modifiers.isAdding) {
      const selection = this.context.getSelectedLayerIds();
      if (!selection.has(hitLayerId)) {
        // Selects on the press, so that a drag can move what's under the pointer.
        this.context.setSelectedLayerIds(new Set([hitLayerId]));
      }
    }
    this.state = { type: 'pressed', start: point, hitLayerId, modifiers };
  }

  onMove(point: Point) {
    const { state } = this;
    if (state.type === 'idle') {
      this.setHoveredLayerId(this.hitTest(point)?.id);
      return;
    }
    if (state.type === 'pressed') {
      const isDrag =
        MathUtil.distance(state.start, point) > this.context.toViewportLength(DRAG_SLOP);
      if (!isDrag || state.hitLayerId) {
        return;
      }
      this.state = {
        type: 'marquee',
        start: state.start,
        current: point,
        modifiers: state.modifiers,
        initialSelection: state.modifiers.isAdding
          ? this.context.getSelectedLayerIds()
          : new Set<string>(),
        boundsById: getPathLayerBounds(
          this.context.getVectorLayer(),
          this.context.getHiddenLayerIds(),
        ),
      };
    } else {
      this.state = { ...state, current: point };
    }
    this.selectInMarquee();
    this.context.redraw();
  }

  onRelease(point: Point) {
    const { state } = this;
    this.state = { type: 'idle' };
    if (state.type === 'pressed') {
      const { hitLayerId, modifiers } = state;
      if (hitLayerId && modifiers.isAdding) {
        const selection = new Set(this.context.getSelectedLayerIds());
        if (!selection.delete(hitLayerId)) {
          selection.add(hitLayerId);
        }
        this.context.setSelectedLayerIds(selection);
      } else if (!hitLayerId && !modifiers.isAdding) {
        this.context.setSelectedLayerIds(new Set());
      }
    }
    this.setHoveredLayerId(this.hitTest(point)?.id);
    this.context.redraw();
  }

  /** Ends the gesture where it is, e.g. when it's canceled or the pointer leaves the canvas. */
  onLeave() {
    this.state = { type: 'idle' };
    this.hoveredLayerId = undefined;
    this.context.redraw();
  }

  private hitTest(point: Point) {
    return hitTestLayer(this.context.getVectorLayer(), point, {
      hiddenLayerIds: this.context.getHiddenLayerIds(),
      tolerance: this.context.toViewportLength(HIT_TOLERANCE),
    });
  }

  private setHoveredLayerId(layerId: string | undefined) {
    if (this.hoveredLayerId !== layerId) {
      this.hoveredLayerId = layerId;
      this.context.redraw();
    }
  }

  private selectInMarquee() {
    const { state } = this;
    if (state.type !== 'marquee') {
      return;
    }
    const marquee = toRect(state.start, state.current);
    const selection = new Set(state.initialSelection);
    for (const [layerId, bounds] of state.boundsById) {
      if (state.modifiers.isContaining ? contains(marquee, bounds) : intersects(marquee, bounds)) {
        selection.add(layerId);
      }
    }
    if (!isEqual(selection, this.context.getSelectedLayerIds())) {
      this.context.setSelectedLayerIds(selection);
    }
  }
}

function toRect(a: Point, b: Point): Rect {
  return {
    l: Math.min(a.x, b.x),
    t: Math.min(a.y, b.y),
    r: Math.max(a.x, b.x),
    b: Math.max(a.y, b.y),
  };
}

function intersects(a: Rect, b: Rect) {
  return a.l <= b.r && b.l <= a.r && a.t <= b.b && b.t <= a.b;
}

function contains(outer: Rect, inner: Rect) {
  return outer.l <= inner.l && inner.r <= outer.r && outer.t <= inner.t && inner.b <= outer.b;
}
