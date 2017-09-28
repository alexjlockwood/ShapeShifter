import { MathUtil } from 'app/scripts/common';
import { Point } from 'app/scripts/common';
import { PaperUtil } from 'app/scripts/paper/util';
import { Line, SnapGuideInfo } from 'app/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

import { CONSTANTS, DIRECTIONS, Direction, Horiz, Vert } from './Constants';

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
    const runSnapTestInDirectionFn = (dir: Direction) => {
      return {
        dragSnapBounds,
        siblingSnapBounds,
        ...runSnapTest(dragSnapBounds, siblingSnapBounds, snapToDimensions, dir),
      };
    };
    return {
      horizontal: runSnapTestInDirectionFn('horizontal'),
      vertical: runSnapTestInDirectionFn('vertical'),
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
export function buildGuides(snapInfo: SnapInfo): ReadonlyArray<Line> {
  const guides: Line[] = [];
  DIRECTIONS.forEach(d => guides.push(...buildGuidesInDirection(snapInfo, d)));
  return guides;
}

function buildGuidesInDirection<T extends Direction>(
  snapInfo: SnapInfo,
  dir: T,
): ReadonlyArray<Line> {
  const guides: Line[] = [];
  const { coord, opp } = CONSTANTS[dir];
  snapInfo[dir].values.forEach(value => {
    const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
    const firstGuideSnap = _.find(values, ({ dragIndex, siblingIndex }) => {
      return dragIndex >= 0 && siblingIndex >= 0;
    });
    if (firstGuideSnap) {
      const startMostBounds = dsb[opp.start] < ssb[opp.start] ? dsb : ssb;
      const endMostBounds = dsb[opp.end] < ssb[opp.end] ? ssb : dsb;
      const guideStart = startMostBounds[opp.start];
      const guideEnd = endMostBounds[opp.end];
      const guideCoord = ssb.snapPoints[values[0].siblingIndex][coord];
      if (dir === 'horizontal') {
        const from = new paper.Point(guideCoord, guideStart);
        const to = new paper.Point(guideCoord, guideEnd);
        guides.push({ from, to });
      } else {
        const from = new paper.Point(guideStart, guideCoord);
        const to = new paper.Point(guideEnd, guideCoord);
        guides.push({ from, to });
      }
    }
  });
  return guides;
}

/**
 * Builds the snap rulers to draw given a snap info object.
 * This function assumes the global project coordinate space.
 */
export function buildRulers(snapInfo: SnapInfo, snapToDimensions = false): ReadonlyArray<Line> {
  const rulers: Line[] = [];
  DIRECTIONS.forEach(d => rulers.push(...buildRulersInDirection(snapInfo, snapToDimensions, d)));
  return rulers;
}

// TODO: make sure that only one ruler total is made for the drag bounds!
// TODO: make sure that only one ruler total is made for the drag bounds!
// TODO: make sure that only one ruler total is made for the drag bounds!
// TODO: make sure that only one ruler total is made for the drag bounds!
// TODO: make sure that only one ruler total is made for the drag bounds!
function buildRulersInDirection<T extends Direction>(
  snapInfo: SnapInfo,
  snapToDimensions = false,
  dir: T,
): ReadonlyArray<Line> {
  const rulers: Line[] = [];
  snapInfo[dir].values.forEach(value => {
    const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
    const dimensionSnaps = values.filter(({ isDimensionSnap }) => isDimensionSnap);
    if (dimensionSnaps.length) {
      const createRulerFn = (sb: SnapBounds) => {
        const from = new paper.Point(sb.left, sb.top);
        const to = new paper.Point(
          dir === 'horizontal' ? sb.right : sb.left,
          dir === 'horizontal' ? sb.top : sb.bottom,
        );
        return { from, to };
      };
      rulers.push(createRulerFn(dsb));
      rulers.push(createRulerFn(ssb));
    }
    const { start, end, opp } = CONSTANTS[dir];
    const oppStartMostBounds = dsb[opp.start] < ssb[opp.start] ? dsb : ssb;
    const oppEndMostBounds = dsb[opp.end] < ssb[opp.end] ? ssb : dsb;
    const nonStartMostBounds = dsb[start] < ssb[start] ? ssb : dsb;
    const nonEndMostBounds = dsb[end] < ssb[end] ? dsb : ssb;
    const guideSnaps = values.filter(({ isDimensionSnap }) => !isDimensionSnap);
    guideSnaps.forEach(() => {
      const oppStartRuler = oppStartMostBounds[opp.end];
      const oppEndRuler = oppEndMostBounds[opp.start];
      const startRuler = nonStartMostBounds[start];
      const endRuler = nonEndMostBounds[end];
      // TODO: handle the horizontal 'rulerLeft === rulerRight' case like sketch does
      // TODO: handle the vertical 'rulerTop === rulerBottom' case like sketch does
      const coordRuler = startRuler + (endRuler - startRuler) * 0.5;
      const from = new paper.Point(
        dir === 'horizontal' ? coordRuler : oppStartRuler,
        dir === 'horizontal' ? oppStartRuler : coordRuler,
      );
      const to = new paper.Point(
        dir === 'horizontal' ? coordRuler : oppEndRuler,
        dir === 'horizontal' ? oppEndRuler : coordRuler,
      );
      const guideDelta = to[opp.coord] - from[opp.coord];
      if (guideDelta > SNAP_TOLERANCE_PIXELS) {
        // Don't show a ruler if the items have been snapped (we assume that if
        // the delta values is less than the snap tolerance, then it would have
        // previously been snapped in the canvas such that the delta is now 0).
        rulers.push({ from, to });
      }
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

  /** Computes the minimum distance between two snap bounds. */
  distance(sb: SnapBounds) {
    const { left: l1, top: t1, right: r1, bottom: b1 } = this;
    const { left: l2, top: t2, right: r2, bottom: b2 } = sb;
    const left = r2 < l1;
    const top = b1 < t2;
    const right = r1 < l2;
    const bottom = b2 < t1;
    const distFn = (x1: number, y1: number, x2: number, y2: number) => {
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    };
    if (top && left) {
      return distFn(l1, b1, r2, t2);
    } else if (left && bottom) {
      return distFn(l1, t1, r2, b2);
    } else if (bottom && right) {
      return distFn(r1, t1, l2, b2);
    } else if (right && top) {
      return distFn(r1, b1, l2, t2);
    } else if (left) {
      return l1 - r2;
    } else if (right) {
      return l2 - r1;
    } else if (bottom) {
      return t1 - b2;
    } else if (top) {
      return t2 - b1;
    } else {
      return 0;
    }
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
function runSnapTest<T extends Direction>(
  dsb: SnapBounds,
  ssb: SnapBounds,
  snapToDimensions: boolean,
  direction: T,
): Values<SnapPair> & Delta {
  const { coord } = CONSTANTS[direction];
  const snapPairResults: (SnapPair & Delta)[] = [];
  dsb.snapPoints.forEach((dragPoint, dragIndex) => {
    if (snapToDimensions) {
      const getSnapBoundsSize = (sb: SnapBounds) => {
        const min = _.minBy(sb.snapPoints, p => p[coord])[coord];
        const max = _.maxBy(sb.snapPoints, p => p[coord])[coord];
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
        const delta = MathUtil.round(dragPoint[coord] - siblingPoint[coord]);
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
function filterByMinDelta<T>(list: (T & Delta)[]): Values<T> & Delta {
  if (!list.length) {
    return undefined;
  }
  const { min, pos, neg } = list.reduce(
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
