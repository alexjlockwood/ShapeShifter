import { MathUtil } from 'app/scripts/common';
import { Point } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import * as _ from 'lodash';
import * as paper from 'paper';

/**
 * A helper class that processes mouse events before they are dispatched and
 * determines if currently selected items should be snapped to other items
 * in the project as a result.
 */
export class SnapHelper {
  /** Factory method for creating a snap helper in selection mode. */
  static forSelectedItems(layerIds: ReadonlySet<string>) {
    return new SnapHelper(layerIds);
  }

  /** Factory method for creating a snap helper in focused path mode. */
  // static forFocusedPath(pathLayerId: string) {
  //   return new SnapHelper(pathLayerId);
  // }

  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private readonly selectedLayerIds: ReadonlyArray<string>;
  // private readonly isFocusedPathMode: boolean;

  private constructor(arg: string | ReadonlySet<string>) {
    this.selectedLayerIds = typeof arg === 'string' ? [arg] : Array.from(arg);
    // this.isFocusedPathMode = typeof arg === 'string';
  }

  // TODO: return immediately in onMouseEvent() if the command key is pressed?
  // TODO: listen for and react to command key down/up events
  // TODO: figure out how to snap cloned items that were created mid-drag
  // TODO: also add the entire artwork's bounds as a guide as well?
  getSnapInfo(event: paper.ToolEvent) {
    if (event.type !== 'mousedrag') {
      return undefined;
    }
    const dragItems = this.selectedLayerIds.map(id => this.paperLayer.findItemByLayerId(id));
    if (!dragItems.length) {
      return undefined;
    }
    const { parent } = dragItems[0];
    if (!dragItems.every(item => item.parent === parent)) {
      // TODO: determine if there is an alternative to exiting early here?
      console.warn('all snapped items must share the same parent item');
      return undefined;
    }
    const siblingItems = parent.children.filter(i => !dragItems.includes(i));
    if (!siblingItems.length) {
      return undefined;
    }
    const toSnapPointsFn = ({ topLeft, center, bottomRight }: paper.Rectangle) => {
      return [topLeft, center, bottomRight];
    };
    const dragSnapBounds = new SnapBounds(
      ...toSnapPointsFn(PaperUtil.computeGlobalBounds(...dragItems)),
    );
    const siblingSnapResults = siblingItems.map(sibling => {
      // Snap the dragged item to each of its siblings.
      const siblingSnapBounds = new SnapBounds(
        ...toSnapPointsFn(PaperUtil.computeGlobalBounds(sibling)),
      );
      return {
        horizontal: {
          dragSnapBounds,
          siblingSnapBounds,
          ...runSnapTest(dragSnapBounds, siblingSnapBounds, (p, q) => p.x - q.x),
        },
        vertical: {
          dragSnapBounds,
          siblingSnapBounds,
          ...runSnapTest(dragSnapBounds, siblingSnapBounds, (p, q) => p.y - q.y),
        },
      };
    });
    const horizontal = filterByMinDelta(siblingSnapResults.map(result => result.horizontal));
    const vertical = filterByMinDelta(siblingSnapResults.map(result => result.vertical));
    return {
      horizontal: { values: horizontal.values, delta: horizontal.delta },
      vertical: { values: vertical.values, delta: vertical.delta },
    };
  }
}

class SnapBounds {
  readonly snapPoints: ReadonlyArray<Point>;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;

  constructor(...snapPoints: Point[]) {
    this.snapPoints = snapPoints;
    this.left = _.minBy(snapPoints, p => p.x).x;
    this.top = _.minBy(snapPoints, p => p.y).y;
    this.right = _.maxBy(snapPoints, p => p.x).x;
    this.bottom = _.maxBy(snapPoints, p => p.y).y;
    this.width = this.right - this.left;
    this.height = this.bottom - this.top;
  }
}

/**
 * Represents a valid snapping of two SnapBounds objects.
 * The properties are indices into the SnapBounds' list of snap points.
 */
interface SnapPair {
  readonly dragIndex: number;
  readonly siblingIndex: number;
}

type Delta = Readonly<Record<'delta', number>>;

function runSnapTest(
  dsb: SnapBounds,
  ssb: SnapBounds,
  getDeltaFn: (p1: Point, p2: Point) => number,
) {
  const snapPairResults: (SnapPair & Delta)[] = [];
  dsb.snapPoints.forEach((dragPoint, dragIndex) => {
    ssb.snapPoints.forEach((siblingPoint, siblingIndex) => {
      snapPairResults.push({
        dragIndex,
        siblingIndex,
        delta: MathUtil.round(getDeltaFn(dragPoint, siblingPoint)),
      });
    });
  });
  return filterByMinDelta(snapPairResults);
}

/**
 * Filters the array of items, keeping the absolute mininum delta values and
 * discarding the rest.
 */
function filterByMinDelta<T>(
  values: (T & Delta)[],
): Readonly<Record<'values', ReadonlyArray<T>>> & Delta {
  if (!values.length) {
    return undefined;
  }
  const { min, pos, neg } = values.reduce(
    (prev, curr) => {
      const info = {
        min: Math.abs(curr.delta),
        pos: curr.delta >= 0 ? [curr] : [] as (T & Delta)[],
        neg: curr.delta >= 0 ? [] : [curr] as (T & Delta)[],
      };
      if (prev.min === info.min) {
        return {
          min: prev.min,
          pos: [...prev.pos, ...info.pos],
          neg: [...prev.neg, ...info.neg],
        };
      }
      return prev.min < info.min ? prev : info;
    },
    { min: Infinity, pos: [] as (T & Delta)[], neg: [] as (T & Delta)[] },
  );
  return {
    delta: min,
    values: pos.length >= neg.length ? pos : neg,
  };
}
