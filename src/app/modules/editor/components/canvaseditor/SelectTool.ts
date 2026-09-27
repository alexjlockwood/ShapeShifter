import type {
  CanvasDocument,
  CanvasEditLayerIds,
} from 'app/modules/editor/components/canvas/CanvasPreview';
import {
  getPathLayerBounds,
  hitTestLayer,
} from 'app/modules/editor/components/canvas/LayerGeometry';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { MathUtil, Point, Rect } from 'app/modules/editor/scripts/common';
import { isEqual } from 'lodash-es';

import { duplicateLayers, getTopmostLayerIds, translateLayers } from './transformLayers';

/** What the select tool reads and changes. */
export interface SelectToolContext {
  /** The vector layer as it's drawn, at the current time and with any edit in progress. */
  getVectorLayer(): VectorLayer;
  getHiddenLayerIds(): ReadonlySet<string>;
  getSelectedLayerIds(): ReadonlySet<string>;
  setSelectedLayerIds(layerIds: ReadonlySet<string>): void;
  /** CSS pixels in viewport units, for tolerances. */
  toViewportLength(length: number): number;
  /** Returns the document's vector layer as it's drawn at the current time. */
  render(document: CanvasDocument): VectorLayer;
  /** The edit that a move shows until it's committed (CanvasPreview). */
  readonly preview: {
    begin(onCancel: () => void): void;
    getBase(): CanvasDocument | undefined;
    setDocument(document: CanvasDocument, layerIds?: CanvasEditLayerIds): void;
    commit(): void;
    cancel(): void;
  };
  redraw(): void;
}

/** The keys held with a press or a move. What they mean depends on the gesture. */
export interface Modifiers {
  readonly shift: boolean;
  readonly alt: boolean;
  /** Cmd on Macs, and Ctrl elsewhere. */
  readonly command: boolean;
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
      // Whether the press selected the layer, rather than it being selected already.
      readonly didSelect: boolean;
      readonly modifiers: Modifiers;
    }
  | {
      readonly type: 'marquee';
      readonly start: Point;
      readonly current: Point;
      readonly isContaining: boolean;
      // The selection before the marquee, which it adds to with Shift held.
      readonly initialSelection: ReadonlySet<string>;
      // The paths it can select, which don't change while it's drawn.
      readonly boundsById: ReadonlyMap<string, Rect>;
    }
  | {
      readonly type: 'moving';
      readonly start: Point;
      // The document to move from: the edit's base, or with the duplicates in it.
      readonly document: CanvasDocument;
      readonly rendered: VectorLayer;
      readonly layerIds: ReadonlyArray<string>;
      // The copies to select, and the hidden layers with the copies of hidden ones.
      readonly layerStates: CanvasEditLayerIds | undefined;
    };

/**
 * Selects and moves layers on the canvas, like Figma.
 *
 * - Clicking a path selects it, and with Shift or Cmd held, adds it to the selection or takes it
 *   away. Clicking nothing clears the selection.
 * - Dragging from nothing draws a marquee that selects the paths it touches (or, with Alt held,
 *   the ones it contains), but not clip paths.
 * - Dragging a path moves the selection, and with Alt held when the drag starts, moves copies of
 *   it instead. Shift keeps the move horizontal or vertical.
 * - Hovering outlines the path under the pointer.
 */
export class SelectTool {
  private state: State = { type: 'idle' };
  private hoveredLayerId: string | undefined;

  constructor(private readonly context: SelectToolContext) {}

  getHoveredLayerId() {
    return this.state.type === 'idle' || this.state.type === 'pressed'
      ? this.hoveredLayerId
      : undefined;
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
    let didSelect = false;
    if (hitLayerId && !isAdding(modifiers) && !this.isInSelection(hitLayerId)) {
      // Selects on the press, so that a drag moves what's under the pointer.
      this.context.setSelectedLayerIds(new Set([hitLayerId]));
      didSelect = true;
    }
    this.state = { type: 'pressed', start: point, hitLayerId, didSelect, modifiers };
  }

  onMove(point: Point, modifiers: Modifiers) {
    const { state } = this;
    switch (state.type) {
      case 'idle':
        this.setHoveredLayerId(this.hitTest(point)?.id);
        return;
      case 'pressed':
        if (MathUtil.distance(state.start, point) > this.context.toViewportLength(DRAG_SLOP)) {
          if (state.hitLayerId) {
            if (!this.isInSelection(state.hitLayerId)) {
              // A press with Shift held only adds on release, but a drag moves it with the rest.
              const selection = new Set(this.context.getSelectedLayerIds()).add(state.hitLayerId);
              this.context.setSelectedLayerIds(selection);
            }
            this.startMove(state.start, state.modifiers);
          } else {
            this.startMarquee(state.start, state.modifiers);
          }
          this.onMove(point, modifiers);
        }
        return;
      case 'marquee':
        this.state = { ...state, current: point };
        this.selectInMarquee();
        this.context.redraw();
        return;
      case 'moving': {
        let dx = point.x - state.start.x;
        let dy = point.y - state.start.y;
        if (modifiers.shift) {
          // Keeps whichever direction moved more.
          [dx, dy] = Math.abs(dx) > Math.abs(dy) ? [dx, 0] : [0, dy];
        }
        this.context.preview.setDocument(
          translateLayers(state.document, state.rendered, state.layerIds, dx, dy),
          state.layerStates,
        );
        return;
      }
    }
  }

  onRelease(point: Point) {
    const { state } = this;
    this.state = { type: 'idle' };
    if (state.type === 'pressed') {
      const { hitLayerId, didSelect, modifiers } = state;
      if (hitLayerId && isAdding(modifiers)) {
        const selection = new Set(this.context.getSelectedLayerIds());
        if (!selection.delete(hitLayerId)) {
          selection.add(hitLayerId);
        }
        this.context.setSelectedLayerIds(selection);
      } else if (hitLayerId && !didSelect) {
        // A click on one of several selected layers, or inside of a selected group, selects just
        // it, but a drag moves the whole selection.
        this.context.setSelectedLayerIds(new Set([hitLayerId]));
      } else if (!hitLayerId && !isAdding(modifiers)) {
        this.context.setSelectedLayerIds(new Set());
      }
    } else if (state.type === 'moving') {
      this.context.preview.commit();
    }
    this.setHoveredLayerId(this.hitTest(point)?.id);
    this.context.redraw();
  }

  /** Ends the gesture where it is, e.g. when it's canceled or the pointer leaves the canvas. */
  onLeave() {
    const { state } = this;
    this.state = { type: 'idle' };
    this.hoveredLayerId = undefined;
    if (state.type === 'moving') {
      this.context.preview.cancel();
    }
    this.context.redraw();
  }

  private startMarquee(start: Point, modifiers: Modifiers) {
    this.state = {
      type: 'marquee',
      start,
      current: start,
      isContaining: modifiers.alt,
      initialSelection: isAdding(modifiers) ? this.context.getSelectedLayerIds() : new Set(),
      boundsById: getPathLayerBounds(
        this.context.getVectorLayer(),
        this.context.getHiddenLayerIds(),
      ),
    };
  }

  private startMove(start: Point, modifiers: Modifiers) {
    const { preview } = this.context;
    preview.begin(() => {
      // E.g. undo during the drag.
      this.state = { type: 'idle' };
      this.context.redraw();
    });
    const base = preview.getBase();
    if (!base) {
      return;
    }
    let document = base;
    let layerIds = getTopmostLayerIds(base.vectorLayer, this.context.getSelectedLayerIds());
    let layerStates: CanvasEditLayerIds | undefined;
    if (modifiers.alt) {
      const duplicated = duplicateLayers(base, layerIds, this.context.getHiddenLayerIds());
      document = duplicated.document;
      layerIds = duplicated.layerIds;
      layerStates = {
        selectedLayerIds: new Set(duplicated.layerIds),
        hiddenLayerIds: duplicated.hiddenLayerIds,
      };
    }
    this.state = {
      type: 'moving',
      start,
      document,
      rendered: this.context.render(document),
      layerIds,
      layerStates,
    };
  }

  /**
   * Whether the layer or a group that it's in is selected. Not the vector layer, which is in the
   * way of selecting what's in it.
   */
  private isInSelection(layerId: string) {
    const selection = this.context.getSelectedLayerIds();
    const vl = this.context.getVectorLayer();
    for (let id = layerId; id !== vl.id;) {
      if (selection.has(id)) {
        return true;
      }
      const parent = LayerUtil.findParent(vl, id);
      if (!parent) {
        return false;
      }
      id = parent.id;
    }
    return false;
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
      if (state.isContaining ? contains(marquee, bounds) : intersects(marquee, bounds)) {
        selection.add(layerId);
      }
    }
    if (!isEqual(selection, this.context.getSelectedLayerIds())) {
      this.context.setSelectedLayerIds(selection);
    }
  }
}

function isAdding(modifiers: Modifiers) {
  return modifiers.shift || modifiers.command;
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
