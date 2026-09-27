import { Guide, roundGuideValue } from 'app/modules/editor/model/guides';
import { VectorLayer } from 'app/modules/editor/model/layers';
import { Point } from 'app/modules/editor/scripts/common';
import { uniqueId } from 'lodash-es';

import type { Modifiers } from './SelectTool';
import { getSnapTargets, snapPoint, SnapThresholds } from './snapping';

/** What the guide tool reads and changes. */
export interface GuideToolContext {
  /** The guides as they're saved, which a drag doesn't change until it's released. */
  getGuides(): ReadonlyArray<Guide>;
  /** Saves the guides, as one undo step. */
  setGuides(guides: ReadonlyArray<Guide>): void;
  getVectorLayer(): VectorLayer;
  getHiddenLayerIds(): ReadonlySet<string>;
  /** CSS pixels in viewport units, for tolerances. */
  toViewportLength(length: number): number;
  getSnapThresholds(): SnapThresholds;
  /** Whether a guide dropped at the point goes away: on its ruler, or off of the panel. */
  isRemoving(axis: Guide['axis'], point: Point): boolean;
  redraw(): void;
}

/** What the renderer draws for the guides, in viewport coordinates. */
export interface GuideDrawing {
  readonly guides: ReadonlyArray<Guide>;
  /** The guide under the pointer, or the one being dragged. */
  readonly activeGuideId: string | undefined;
  /** Where the guide being dragged is, to label it, unless it's being dragged away. */
  readonly label: { readonly point: Point; readonly text: string } | undefined;
}

// How close to a guide hits it, in CSS pixels.
const HIT_TOLERANCE = 4;

interface Drag {
  readonly id: string;
  readonly axis: Guide['axis'];
  readonly isNew: boolean;
  readonly value: number;
  readonly point: Point;
  readonly isRemoving: boolean;
}

/**
 * Drags guides, like Figma: out of a ruler to add one, along the canvas to move one, and back onto
 * its ruler to remove it. A guide snaps to the artboard, the paths' edges and middles, and whole
 * units, unless Ctrl is held. The drag is saved as one undo step when it's released.
 */
export class GuideTool {
  private drag: Drag | undefined;
  private hoveredGuideId: string | undefined;

  constructor(private readonly context: GuideToolContext) {}

  isDragging() {
    return !!this.drag;
  }

  /** Returns the closest guide within reach of the point. */
  hitTest(point: Point) {
    const tolerance = this.context.toViewportLength(HIT_TOLERANCE);
    let closest: { guide: Guide; distance: number } | undefined;
    for (const guide of this.context.getGuides()) {
      const distance = Math.abs(point[guide.axis] - guide.value);
      if (distance <= tolerance && (!closest || distance < closest.distance)) {
        closest = { guide, distance };
      }
    }
    return closest?.guide;
  }

  /** Highlights the guide under the pointer, when nothing is pressed. */
  setHoveredGuide(guide: Guide | undefined) {
    if (this.hoveredGuideId !== guide?.id) {
      this.hoveredGuideId = guide?.id;
      this.context.redraw();
    }
  }

  getHoveredGuide() {
    return this.context.getGuides().find(guide => guide.id === this.hoveredGuideId);
  }

  /** Starts dragging a new guide out of a ruler. */
  startNew(axis: Guide['axis'], point: Point, modifiers: Modifiers) {
    this.drag = {
      id: uniqueId(),
      axis,
      isNew: true,
      value: point[axis],
      point,
      isRemoving: true,
    };
    this.onMove(point, modifiers);
  }

  startMove(guide: Guide, point: Point, modifiers: Modifiers) {
    this.drag = {
      id: guide.id,
      axis: guide.axis,
      isNew: false,
      value: guide.value,
      point,
      isRemoving: false,
    };
    this.onMove(point, modifiers);
  }

  onMove(point: Point, modifiers: Modifiers) {
    const { drag } = this;
    if (!drag) {
      return;
    }
    this.drag = {
      ...drag,
      point,
      value: this.snap(drag.axis, point, modifiers),
      isRemoving: this.context.isRemoving(drag.axis, point),
    };
    this.context.redraw();
  }

  onModifiersChange(modifiers: Modifiers) {
    if (this.drag) {
      this.onMove(this.drag.point, modifiers);
    }
  }

  /** Saves where the guide was dragged, or removes it if it was dragged away. */
  onRelease() {
    const { drag } = this;
    this.drag = undefined;
    if (!drag) {
      return;
    }
    const guides = this.context.getGuides();
    const others = guides.filter(guide => guide.id !== drag.id);
    if (drag.isRemoving) {
      if (others.length !== guides.length) {
        this.context.setGuides(others);
      }
    } else {
      const guide = { id: drag.id, axis: drag.axis, value: drag.value };
      const index = guides.findIndex(g => g.id === drag.id);
      const moved =
        index < 0 ? [...guides, guide] : guides.map(g => (g.id === drag.id ? guide : g));
      if (index < 0 || guides[index].value !== guide.value) {
        this.context.setGuides(moved);
      }
    }
    this.context.redraw();
  }

  /** Throws the drag in progress away, e.g. when it's canceled. */
  onLeave() {
    const hadDrag = !!this.drag || !!this.hoveredGuideId;
    this.drag = undefined;
    this.hoveredGuideId = undefined;
    if (hadDrag) {
      this.context.redraw();
    }
  }

  getCursor() {
    const axis = this.drag?.axis ?? this.getHoveredGuide()?.axis;
    return axis === 'x' ? 'col-resize' : axis === 'y' ? 'row-resize' : undefined;
  }

  getDrawing(): GuideDrawing {
    const { drag } = this;
    const saved = this.context.getGuides();
    if (!drag) {
      return { guides: saved, activeGuideId: this.getHoveredGuide()?.id, label: undefined };
    }
    const others = saved.filter(guide => guide.id !== drag.id);
    if (drag.isRemoving) {
      return { guides: others, activeGuideId: undefined, label: undefined };
    }
    const dragged = { id: drag.id, axis: drag.axis, value: drag.value };
    return {
      guides: [...others, dragged],
      activeGuideId: drag.id,
      label: {
        point:
          drag.axis === 'x'
            ? { x: drag.value, y: drag.point.y }
            : { x: drag.point.x, y: drag.value },
        text: formatGuideValue(drag.value),
      },
    };
  }

  private snap(axis: Guide['axis'], point: Point, modifiers: Modifiers) {
    const value = point[axis];
    if (modifiers.ctrl) {
      return roundGuideValue(value);
    }
    const targets = getSnapTargets(
      this.context.getVectorLayer(),
      [],
      this.context.getHiddenLayerIds(),
    );
    const snap = snapPoint(point, targets, this.context.getSnapThresholds(), {
      x: axis === 'x',
      y: axis === 'y',
    });
    return roundGuideValue(value + (axis === 'x' ? snap.dx : snap.dy));
  }
}

/** Formats a length or position for a label, with up to 2 decimals. */
export function formatGuideValue(value: number) {
  return String(Math.round(value * 100) / 100 || 0);
}
