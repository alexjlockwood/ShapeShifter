import { MathUtil } from 'app/scripts/common';
import { Point } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { Line, Ruler, SnapGuideInfo } from 'app/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

const SNAP_TOLERANCE_PIXELS = 10;

/**
 * A helper function that snaps the given dragged snap points to each of its siblings.
 */
export function getSnapInfo(
  dragSnapPoints: ReadonlyArray<Point>,
  siblingSnapPointsTable: ReadonlyTable<Point>,
  snapTolerancePixels = SNAP_TOLERANCE_PIXELS,
): SnapInfo {
  const dragSnapBounds = new SnapBounds(...dragSnapPoints);
  const siblingSnapResults = siblingSnapPointsTable.map(siblingSnapPoints => {
    // Snap the dragged item to each of its siblings.
    const siblingSnapBounds = new SnapBounds(...siblingSnapPoints);
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
  const horizontalDelta = horizontal.delta <= snapTolerancePixels ? horizontal.delta : Infinity;
  const horizontalValues = horizontal.delta <= snapTolerancePixels ? horizontal.values : [];
  const verticalDelta = vertical.delta <= snapTolerancePixels ? vertical.delta : Infinity;
  const verticalValues = vertical.delta <= snapTolerancePixels ? vertical.values : [];
  return {
    horizontal: { values: horizontalValues, delta: horizontalDelta },
    vertical: { values: verticalValues, delta: verticalDelta },
  };
}

/**
 * Builds the snap guides to draw given a snap info object.
 * This function assumes the global project coordinate space.
 */
export function buildSnapGuides(snapInfo: SnapInfo) {
  const guides: Line[] = [];
  snapInfo.horizontal.values.forEach(value => {
    const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
    if (values.length) {
      const { siblingIndex } = values[0];
      const guideTop = Math.min(dsb.top, ssb.top);
      const guideBottom = Math.max(dsb.bottom, ssb.bottom);
      const guideX = ssb.snapPoints[siblingIndex].x;
      guides.push({
        from: new paper.Point(guideX, guideTop),
        to: new paper.Point(guideX, guideBottom),
      });
    }
  });
  snapInfo.vertical.values.forEach(value => {
    const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
    const leftMostBounds = dsb.left < ssb.left ? dsb : ssb;
    const rightMostBounds = dsb.right < ssb.right ? ssb : dsb;
    const topMostBounds = dsb.top < ssb.top ? dsb : ssb;
    const nonTopMostBounds = dsb.top < ssb.top ? ssb : dsb;
    const bottomMostBounds = dsb.bottom < ssb.bottom ? ssb : dsb;
    const nonBottomMostBounds = dsb.bottom < ssb.bottom ? dsb : ssb;
    const shortestBounds = dsb.height < ssb.height ? dsb : ssb;
    const tallestBounds = dsb.height < ssb.height ? ssb : dsb;
    if (values.length) {
      const { siblingIndex } = values[0];
      const guideLeft = leftMostBounds.left;
      const guideRight = rightMostBounds.right;
      const guideY = ssb.snapPoints[siblingIndex].y;
      guides.push({
        from: new paper.Point(guideLeft, guideY),
        to: new paper.Point(guideRight, guideY),
      });
    }
  });
  return guides;
}

/**
 * Builds the snap rulers to draw given a snap info object.
 * This function assumes the global project coordinate space.
 */
export function buildSnapRulers(snapInfo: SnapInfo) {
  const rulers: Ruler[] = [];
  snapInfo.vertical.values.forEach(value => {
    const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
    const leftMostBounds = dsb.left < ssb.left ? dsb : ssb;
    const rightMostBounds = dsb.right < ssb.right ? ssb : dsb;
    const topMostBounds = dsb.top < ssb.top ? dsb : ssb;
    const nonTopMostBounds = dsb.top < ssb.top ? ssb : dsb;
    const bottomMostBounds = dsb.bottom < ssb.bottom ? ssb : dsb;
    const nonBottomMostBounds = dsb.bottom < ssb.bottom ? dsb : ssb;
    const shortestBounds = dsb.height < ssb.height ? dsb : ssb;
    const tallestBounds = dsb.height < ssb.height ? ssb : dsb;
    values.forEach(() => {
      const rulerLeft = leftMostBounds.right;
      const rulerRight = rightMostBounds.left;
      const rulerTop = nonTopMostBounds.top;
      const rulerBottom = nonBottomMostBounds.bottom;
      // TODO: handle the 'rulerTop === rulerBottom' case like sketch does
      const rulerY = rulerTop + (rulerBottom - rulerTop) * 0.5;
      const rulerFrom = new paper.Point(rulerLeft, rulerY);
      const rulerTo = new paper.Point(rulerRight, rulerY);
      rulers.push({
        line: { from: rulerFrom, to: rulerTo },
        delta: rulerTo.x - rulerFrom.x,
      });
    });
  });
  return rulers;
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
type Values<T> = Readonly<Record<'values', ReadonlyArray<T>>>;

export type SnapInfo = Readonly<
  Record<
    'horizontal' | 'vertical',
    Delta &
      Values<
        Values<SnapPair> & {
          dragSnapBounds: SnapBounds;
          siblingSnapBounds: SnapBounds;
        }
      >
  >
>;

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
function filterByMinDelta<T>(values: (T & Delta)[]): Values<T> & Delta {
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
