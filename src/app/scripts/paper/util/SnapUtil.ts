import { MathUtil } from 'app/scripts/common';
import { Point } from 'app/scripts/common';
import { PaperUtil } from 'app/scripts/paper/util';
import { Line, SnapGuideInfo } from 'app/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

// TODO: make sure to test things with different stroke width values!
const SNAP_TOLERANCE_PIXELS = 10;

/**
 * A helper function that snaps the given dragged snap points to each of its siblings.
 */
export function computeSnapInfo(
  dragSnapPoints: ReadonlyArray<Point>,
  siblingSnapPointsTable: ReadonlyTable<Point>,
  snapToDimensions = false,
): SnapInfo {
  const dragSnapBounds = new SnapBounds(...dragSnapPoints);
  const siblingSnapResults = siblingSnapPointsTable.map(siblingSnapPoints => {
    // Snap the dragged item to each of its siblings.
    const siblingSnapBounds = new SnapBounds(...siblingSnapPoints);
    return {
      horizontal: {
        dragSnapBounds,
        siblingSnapBounds,
        ...runSnapTest(dragSnapBounds, siblingSnapBounds, true, snapToDimensions),
      },
      vertical: {
        dragSnapBounds,
        siblingSnapBounds,
        ...runSnapTest(dragSnapBounds, siblingSnapBounds, false, snapToDimensions),
      },
    };
  });
  const horizontal = filterByMinDelta(siblingSnapResults.map(result => result.horizontal));
  const vertical = filterByMinDelta(siblingSnapResults.map(result => result.vertical));
  const isHorizontalHit = Math.abs(horizontal.delta) <= SNAP_TOLERANCE_PIXELS;
  const horizontalDelta = isHorizontalHit ? horizontal.delta : Infinity;
  const horizontalValues = isHorizontalHit ? horizontal.values : [];
  const isVerticalHit = Math.abs(vertical.delta) <= SNAP_TOLERANCE_PIXELS;
  const verticalDelta = isVerticalHit ? vertical.delta : Infinity;
  const verticalValues = isVerticalHit ? vertical.values : [];
  return {
    horizontal: { values: horizontalValues, delta: horizontalDelta },
    vertical: { values: verticalValues, delta: verticalDelta },
  };
}

/**
 * Represents a valid snapping of two SnapBounds objects.
 * The properties are indices into the SnapBounds' list of snap points.
 */
interface SnapPair {
  readonly dragIndex?: number;
  readonly siblingIndex?: number;
  readonly isDimensionSnap?: boolean;
}

interface SnapInfoInDirection {
  // The minimum delta value found.
  readonly delta: number;
  // The list of snaps with the above delta value.
  readonly values: ReadonlyArray<{
    // The currently dragged item.
    readonly dragSnapBounds: SnapBounds;
    // The sibling item to snap to.
    readonly siblingSnapBounds: SnapBounds;
    // The list of snap pairs with the above delta value.
    readonly values: ReadonlyArray<SnapPair>;
  }>;
}

// Note that 'horizontal' snaps calculate vertical guides and 'vertical'
// snaps calculate horizontal guides.. This is because 'horizontal'
// snaps depend on differences in horizontal 'x' values (and vice-versa).
export interface SnapInfo {
  readonly horizontal: SnapInfoInDirection;
  readonly vertical: SnapInfoInDirection;
}

/**
 * Builds the snap guides to draw given a snap info object.
 * This function assumes the global project coordinate space.
 */
export function buildSnapGuides(snapInfo: SnapInfo): ReadonlyArray<Line> {
  const guides: Line[] = [];
  ['horizontal', 'vertical'].forEach(direction => {
    const isHorizontal = direction === 'horizontal';
    const start = isHorizontal ? 'top' : 'left';
    const end = isHorizontal ? 'bottom' : 'right';
    const xOrY = isHorizontal ? 'x' : 'y';
    (isHorizontal ? snapInfo.horizontal : snapInfo.vertical).values.forEach(value => {
      const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
      const firstGuideSnap = _.find(values, ({ dragIndex, siblingIndex }) => {
        return dragIndex >= 0 && siblingIndex >= 0;
      });
      if (firstGuideSnap) {
        const startMostBounds = dsb[start] < ssb[start] ? dsb : ssb;
        const endMostBounds = dsb[end] < ssb[end] ? ssb : dsb;
        const guideStart = startMostBounds[start];
        const guideEnd = endMostBounds[end];
        const guideXY = ssb.snapPoints[values[0].siblingIndex][xOrY];
        const from = new paper.Point(
          isHorizontal ? guideXY : guideStart,
          isHorizontal ? guideStart : guideXY,
        );
        const to = new paper.Point(
          isHorizontal ? guideXY : guideEnd,
          isHorizontal ? guideEnd : guideXY,
        );
        guides.push({ from, to });
      }
    });
  });
  return guides;
}

/**
 * Builds the snap rulers to draw given a snap info object.
 * This function assumes the global project coordinate space.
 */
export function buildSnapRulers(snapInfo: SnapInfo, snapToDimensions = false): ReadonlyArray<Line> {
  const rulers: Line[] = [];
  ['horizontal', 'vertical'].forEach(direction => {
    const isHorizontal = direction === 'horizontal';
    const start = isHorizontal ? 'top' : 'left';
    const oppStart = isHorizontal ? 'left' : 'top';
    const end = isHorizontal ? 'bottom' : 'right';
    const oppEnd = isHorizontal ? 'right' : 'bottom';
    const xOrY = isHorizontal ? 'x' : 'y';
    const snapInfoInDirection = isHorizontal ? snapInfo.horizontal : snapInfo.vertical;
    snapInfoInDirection.values.forEach(value => {
      const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
      const dimensionSnaps = values.filter(({ isDimensionSnap }) => isDimensionSnap);
      if (dimensionSnaps.length) {
        const createRulerFn = (sb: SnapBounds) => {
          const from = new paper.Point(sb.left, sb.top);
          const to = new paper.Point(
            isHorizontal ? sb.right : sb.left,
            isHorizontal ? sb.top : sb.bottom,
          );
          return { from, to };
        };
        // TODO: make sure that only one ruler total is made for the drag bounds!
        // TODO: make sure that only one ruler total is made for the drag bounds!
        // TODO: make sure that only one ruler total is made for the drag bounds!
        // TODO: make sure that only one ruler total is made for the drag bounds!
        // TODO: make sure that only one ruler total is made for the drag bounds!
        rulers.push(createRulerFn(dsb));
        rulers.push(createRulerFn(ssb));
      }

      const guideSnaps = values.filter(({ isDimensionSnap }) => !isDimensionSnap);
      const startMostBounds = dsb[start] < ssb[start] ? dsb : ssb;
      const endMostBounds = dsb[end] < ssb[end] ? ssb : dsb;
      const nonOppStartMostBounds = dsb[oppStart] < ssb[oppStart] ? ssb : dsb;
      const nonOppEndMostBounds = dsb[oppEnd] < ssb[oppEnd] ? dsb : ssb;
      guideSnaps.forEach(() => {
        const rulerStart = startMostBounds[end];
        const rulerEnd = endMostBounds[start];
        const rulerOppStart = nonOppStartMostBounds[oppStart];
        const rulerOppEnd = nonOppEndMostBounds[oppEnd];
        // TODO: handle the horizontal 'rulerLeft === rulerRight' case like sketch does
        // TODO: handle the vertical 'rulerTop === rulerBottom' case like sketch does
        const rulerXY = rulerOppStart + (rulerOppEnd - rulerOppStart) * 0.5;
        const from = new paper.Point(
          isHorizontal ? rulerXY : rulerStart,
          isHorizontal ? rulerStart : rulerXY,
        );
        const to = new paper.Point(
          isHorizontal ? rulerXY : rulerEnd,
          isHorizontal ? rulerEnd : rulerXY,
        );
        const guideDelta = to[xOrY === 'x' ? 'y' : 'x'] - from[xOrY === 'x' ? 'y' : 'x'];
        if (guideDelta > SNAP_TOLERANCE_PIXELS) {
          // Don't show a ruler if the items have been snapped (we assume that if
          // the delta values is less than the snap tolerance, then it would have
          // previously been snapped in the canvas such that the delta is now 0).
          rulers.push({ from, to });
        }
      });
    });
  });
  return rulers;
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

interface Delta {
  readonly delta: number;
}

interface Values<T> {
  readonly values: ReadonlyArray<T>;
}

/**
 * Runs a snap test for two snap bounds. The return result consists of (1) the
 * minimum delta value found, and (2) a list of the values that had the specified
 * delta value.
 */
function runSnapTest(
  dsb: SnapBounds,
  ssb: SnapBounds,
  isHorizontalTest: boolean,
  snapToDimensions: boolean,
): Values<SnapPair> & Delta {
  const xOrY = isHorizontalTest ? 'x' : 'y';
  const snapPairResults: (SnapPair & Delta)[] = [];
  dsb.snapPoints.forEach((dragPoint, dragIndex) => {
    if (snapToDimensions) {
      const getSnapBoundsSize = (sb: SnapBounds) => {
        const min = _.minBy(sb.snapPoints, p => p[xOrY])[xOrY];
        const max = _.maxBy(sb.snapPoints, p => p[xOrY])[xOrY];
        return max - min;
      };
      const dsbSize = getSnapBoundsSize(dsb);
      const ssbSize = getSnapBoundsSize(ssb);
      // TODO: improve this snap pair API stuff?
      snapPairResults.push({
        isDimensionSnap: true,
        delta: MathUtil.round(dsbSize - ssbSize),
      });
    } else {
      ssb.snapPoints.forEach((siblingPoint, siblingIndex) => {
        const delta = MathUtil.round(dragPoint[xOrY] - siblingPoint[xOrY]);
        snapPairResults.push({ dragIndex, siblingIndex, delta });
      });
    }
  });
  return filterByMinDelta(snapPairResults);
}

/**
 * Filters the array of items, keeping the smallest delta values and
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
  const isDeltaPositive = pos.length >= neg.length;
  return {
    delta: min * (isDeltaPositive ? 1 : -1),
    values: isDeltaPositive ? pos : neg,
  };
}
