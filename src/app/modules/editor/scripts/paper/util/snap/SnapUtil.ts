import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import { Line } from 'app/modules/editor/store/paper/actions';
import * as _ from 'lodash';

import { CONSTANTS, DIRECTIONS, Direction } from './Constants';
import { SnapBounds } from './SnapBounds';

// TODO: make sure to test things with different stroke width values!
const SNAP_TOLERANCE_PIXELS = 10;

/**
 * A helper function that snaps the given dragged snap points to each of its siblings.
 *
 * TODO: make it possible to create rulers optionally only if a flag is passed
 */
export function computeSnapInfo(
  dragSnapPoints: ReadonlyArray<Point>,
  siblingSnapPointsTable: ReadonlyTable<Point>,
  snapToDimensions = false,
): SnapInfo {
  const dsb = new SnapBounds(...dragSnapPoints);
  const ssbs = siblingSnapPointsTable.map(pts => new SnapBounds(...pts));
  const { horizontal, vertical } = snapToSiblings(dsb, ssbs, snapToDimensions);
  const isHorizontalHit = Math.abs(horizontal.delta) <= SNAP_TOLERANCE_PIXELS;
  const horizontalDelta = isHorizontalHit ? horizontal.delta : Infinity;
  const horizontalValues = isHorizontalHit ? horizontal.values : [];
  const isVerticalHit = Math.abs(vertical.delta) <= SNAP_TOLERANCE_PIXELS;
  const verticalDelta = isVerticalHit ? vertical.delta : Infinity;
  const verticalValues = isVerticalHit ? vertical.values : [];
  const snapInfo: SnapInfoInternal = {
    horizontal: { delta: horizontalDelta, values: horizontalValues },
    vertical: { delta: verticalDelta, values: verticalValues },
  };
  const projSnapDelta = {
    x: isFinite(horizontalDelta) ? -horizontalDelta : 0,
    y: isFinite(verticalDelta) ? -verticalDelta : 0,
  };
  return {
    projSnapDelta,
    guides: buildGuides(snapInfo),
    rulers: buildRulers(snapInfo),
  };
}

/** Snaps the dragged item to each of its sibling snap items. */
function snapToSiblings(
  dsb: SnapBounds,
  ssbs: ReadonlyArray<SnapBounds>,
  snapToDimensions: boolean,
) {
  // Compute a list of sibling snap results, where each entry represents a snapping
  // between two snap bounds in both directions.
  const ssrs = ssbs.map(ssb => {
    // For each direction, return an entry consisting of:
    // - dsb: the drag snap bounds
    // - ssb: the sibling snap bounds
    // - delta: the minimum delta value that would snap the two bounds
    // - values: a list of snap pairs that computed the above delta value
    return {
      horizontal: { dsb, ssb, ...runSnapTest(dsb, ssb, snapToDimensions, 'horizontal') },
      vertical: { dsb, ssb, ...runSnapTest(dsb, ssb, snapToDimensions, 'vertical') },
    };
  });
  interface SnapResultInDirection {
    readonly dsb: SnapBounds;
    readonly ssb: SnapBounds;
    readonly values: ReadonlyArray<SnapPair>;
  }
  return {
    horizontal: filterByMinDelta<SnapResultInDirection>(ssrs.map(r => r.horizontal)),
    vertical: filterByMinDelta<SnapResultInDirection>(ssrs.map(r => r.vertical)),
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

interface SnapInfoInDirectionInternal {
  // The minimum delta value found.
  readonly delta: number;
  // The list of snaps with the above delta value.
  readonly values: ReadonlyArray<{
    // The currently dragged item.
    readonly dsb: SnapBounds;
    // The sibling item to snap to.
    readonly ssb: SnapBounds;
    // The list of snap pairs with the above delta value.
    readonly values: ReadonlyArray<SnapPair>;
  }>;
}

// Note that 'horizontal' snaps calculate vertical guides and 'vertical'
// snaps calculate horizontal guides.. This is because 'horizontal'
// snaps depend on differences in horizontal 'x' values (and vice-versa).
interface SnapInfoInternal {
  readonly horizontal: SnapInfoInDirectionInternal;
  readonly vertical: SnapInfoInDirectionInternal;
}

export interface SnapInfo {
  readonly projSnapDelta: Point;
  readonly guides: ReadonlyArray<Line>;
  readonly rulers: ReadonlyArray<Line>;
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
  dir: T,
): Values<SnapPair> & Delta {
  const { coord } = CONSTANTS[dir];
  const snapPairResults: (SnapPair & Delta)[] = [];
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
    dsb.snapPoints.forEach((dragPoint, dragIndex) => {
      ssb.snapPoints.forEach((siblingPoint, siblingIndex) => {
        const delta = MathUtil.round(dragPoint[coord] - siblingPoint[coord]);
        snapPairResults.push({ dragIndex, siblingIndex, delta });
      });
    });
  }

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
        pos: curr.delta >= 0 ? [curr] : ([] as (T & Delta)[]),
        neg: curr.delta >= 0 ? [] : ([curr] as (T & Delta)[]),
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

/**
 * Builds the snap guides to draw given a snap info object.
 * This function assumes the global project coordinate space.
 */
function buildGuides(snapInfo: SnapInfoInternal): ReadonlyArray<Line> {
  const guides: Line[] = [];
  DIRECTIONS.forEach(d => guides.push(...buildGuidesInDirection(snapInfo, d)));
  return guides;
}

function buildGuidesInDirection<T extends Direction>(
  snapInfo: SnapInfoInternal,
  dir: T,
): ReadonlyArray<Line> {
  const guides: Line[] = [];
  const { coord, opp } = CONSTANTS[dir];
  snapInfo[dir].values.forEach(({ dsb, ssb, values }) => {
    const firstGuideSnap = _.find(values, ({ dragIndex, siblingIndex }) => {
      return dragIndex >= 0 && siblingIndex >= 0;
    });
    if (firstGuideSnap) {
      const startMostBounds = dsb[opp.start] < ssb[opp.start] ? dsb : ssb;
      const endMostBounds = dsb[opp.end] < ssb[opp.end] ? ssb : dsb;
      const startGuide = startMostBounds[opp.start];
      const endGuide = endMostBounds[opp.end];
      const coordGuide = ssb.snapPoints[firstGuideSnap.siblingIndex][coord];
      if (dir === 'horizontal') {
        const from = { x: coordGuide, y: startGuide };
        const to = { x: coordGuide, y: endGuide };
        guides.push({ from, to });
      } else {
        const from = { x: startGuide, y: coordGuide };
        const to = { x: endGuide, y: coordGuide };
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
function buildRulers(snapInfo: SnapInfoInternal, snapToDimensions = false): ReadonlyArray<Line> {
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
  snapInfo: SnapInfoInternal,
  snapToDimensions = false,
  dir: T,
): ReadonlyArray<Line> {
  const rulers: Line[] = [];
  snapInfo[dir].values.forEach(({ dsb, ssb, values }) => {
    const dimensionSnaps = values.filter(({ isDimensionSnap }) => isDimensionSnap);
    if (dimensionSnaps.length) {
      const createRulerFn = (sb: SnapBounds) => {
        const from = { x: sb.left, y: sb.top };
        const to = {
          x: dir === 'horizontal' ? sb.right : sb.left,
          y: dir === 'horizontal' ? sb.top : sb.bottom,
        };
        return { from, to };
      };
      rulers.push(createRulerFn(dsb));
      rulers.push(createRulerFn(ssb));
    }
  });
  for (const { dsb, ssb, values } of snapInfo[dir].values) {
    const { start, end, opp } = CONSTANTS[dir];
    const oppStartMostBounds = dsb[opp.start] < ssb[opp.start] ? dsb : ssb;
    const oppEndMostBounds = dsb[opp.end] < ssb[opp.end] ? ssb : dsb;
    const nonStartMostBounds = dsb[start] < ssb[start] ? ssb : dsb;
    const nonEndMostBounds = dsb[end] < ssb[end] ? dsb : ssb;
    const guideSnaps = values.filter(({ isDimensionSnap }) => !isDimensionSnap);
    if (guideSnaps.length) {
      const oppStartRuler = oppStartMostBounds[opp.end];
      const oppEndRuler = oppEndMostBounds[opp.start];
      const startRuler = nonStartMostBounds[start];
      const endRuler = nonEndMostBounds[end];
      // TODO: handle the horizontal 'rulerLeft === rulerRight' case like sketch does
      // TODO: handle the vertical 'rulerTop === rulerBottom' case like sketch does
      const coordRuler = startRuler + (endRuler - startRuler) * 0.5;
      const from = {
        x: dir === 'horizontal' ? coordRuler : oppStartRuler,
        y: dir === 'horizontal' ? oppStartRuler : coordRuler,
      };
      const to = {
        x: dir === 'horizontal' ? coordRuler : oppEndRuler,
        y: dir === 'horizontal' ? oppEndRuler : coordRuler,
      };
      const guideDelta = to[opp.coord] - from[opp.coord];
      if (guideDelta > SNAP_TOLERANCE_PIXELS) {
        // Don't show a ruler if the items have been snapped (we assume that if
        // the delta values is less than the snap tolerance, then it would have
        // previously been snapped in the canvas such that the delta is now 0).
        rulers.push({ from, to });
      }
      break;
    }
  }
  type Distance = Readonly<{ sb1: SnapBounds; sb2: SnapBounds; line: Line; dist: number }>;
  const minDistsDragToSibling: Distance[] = [];
  const minDistsSiblingToSibling: Distance[] = [];
  // TODO: make it clear that there should only be one dsb in the snap info object?
  const dsbs = snapInfo[dir].values.map(({ dsb }) => dsb);
  const ssbs = snapInfo[dir].values.map(({ ssb }) => ssb);
  const numValues = snapInfo[dir].values.length;
  for (let i = 0; i < numValues; i++) {
    minDistsDragToSibling.push({ sb1: dsbs[i], sb2: ssbs[i], ...dsbs[i].distance(ssbs[i]) });
  }
  for (let i = 0; i < numValues - 1; i++) {
    let minSsb: SnapBounds;
    let minLine: Line;
    let minDist = Infinity;
    for (let j = i + 1; j < numValues; j++) {
      const { line, dist } = ssbs[i].distance(ssbs[j]);
      const absDist = Math.abs(dist);
      if (absDist < minDist) {
        minSsb = ssbs[j];
        minLine = line;
        minDist = absDist;
      }
    }
    minDistsSiblingToSibling.push({ sb1: ssbs[i], sb2: minSsb, line: minLine, dist: minDist });
  }
  const minDistDragToSibling = _.minBy(minDistsDragToSibling, d => d.dist);
  const matchingMinDistsSiblingToSibling = minDistsSiblingToSibling.filter(d => {
    return Math.abs(minDistDragToSibling.dist - d.dist) <= SNAP_TOLERANCE_PIXELS;
  });
  if (matchingMinDistsSiblingToSibling.length) {
    rulers.push(minDistDragToSibling.line);
    rulers.push(...matchingMinDistsSiblingToSibling.map(d => d.line));
  }
  return rulers;
}
