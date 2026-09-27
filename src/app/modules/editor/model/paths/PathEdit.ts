import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import { clamp, uniqueId } from 'lodash-es';

import { Command } from './Command';
import { Path } from './Path';

/**
 * The canvas editor's operations on a path's points (docs/canvas-editor.md, phase 2).
 *
 * They see each subpath as a list of anchors, the points where its commands end, joined by
 * segments. A closed subpath's last segment goes back to its first anchor, whether the subpath
 * ends with a Z that draws that line or with a curve back to the start and a Z with no length.
 * An anchor's id is the id of the command that ends at it (the move, for the first one), so a
 * selection of anchors survives edits. Every edit returns a new Path built from commands, which
 * keeps the ids of the commands it doesn't replace, but drops action mode's splits and reversals,
 * which only matter while action mode is open.
 */

/** How an anchor's handles relate, as in Sketch, whose shortcuts (1 to 4) pick them. */
export type PointType = 'straight' | 'mirrored' | 'disconnected' | 'asymmetric';

export const POINT_TYPES: ReadonlyArray<PointType> = [
  'straight',
  'mirrored',
  'disconnected',
  'asymmetric',
];

/** The handle before an anchor, on the segment that ends at it, or the one after it. */
export type HandleSide = 'in' | 'out';

export interface Anchor {
  readonly id: string;
  readonly subIdx: number;
  /** The anchor's position in its subpath. */
  readonly index: number;
  readonly point: Point;
  /** The control point before the anchor, if the segment that ends at it is a curve. */
  readonly in: Point | undefined;
  /** The control point after the anchor, if the segment that starts at it is a curve. */
  readonly out: Point | undefined;
  readonly type: PointType;
}

export interface Segment {
  readonly id: string;
  readonly subIdx: number;
  readonly startAnchorId: string;
  readonly endAnchorId: string;
  /** The segment's points: its start, its control points, and its end. */
  readonly points: ReadonlyArray<Point>;
}

/** The closest point on a path's segments to another point. */
export interface SegmentProjection {
  readonly segmentId: string;
  readonly t: number;
  readonly point: Point;
  readonly distance: number;
}

// 'Z' is the straight line that a Z command draws back to the first anchor.
type SegmentType = 'L' | 'Q' | 'C' | 'Z';

interface EditSegment {
  type: SegmentType;
  id: string;
  controls: Point[];
}

interface EditSubPath {
  moveId: string;
  anchors: Point[];
  // Segment i goes from anchor i to the next one. A closed subpath has one per anchor, and an
  // open one has one fewer.
  segments: EditSegment[];
  closed: boolean;
  // The id of the Z with no length that ends a closed subpath whose last segment isn't a Z.
  closeId: string | undefined;
}

/** Returns the path's anchors, in order. */
export function getAnchors(path: Path): Anchor[] {
  return toSubPaths(path).flatMap((subPath, subIdx) =>
    subPath.anchors.map((point, index) => {
      const handles = getHandles(subPath, index);
      return {
        id: getAnchorId(subPath, index),
        subIdx,
        index,
        point,
        in: handles.in,
        out: handles.out,
        type: getType(point, handles.in, handles.out),
      };
    }),
  );
}

/** Returns the path's segments, with the ones that have no length left out. */
export function getSegments(path: Path): Segment[] {
  return toSubPaths(path).flatMap((subPath, subIdx) =>
    subPath.segments
      .map((segment, i) => ({
        id: segment.id,
        subIdx,
        startAnchorId: getAnchorId(subPath, i),
        endAnchorId: getAnchorId(subPath, nextIndex(subPath, i)),
        points: getSegmentPoints(subPath, i),
      }))
      .filter(({ points }) => points.some(p => !MathUtil.arePointsEqual(p, points[0]))),
  );
}

/** Returns the closest point on the path's segments to the point, if it has any. */
export function projectOntoSegments(path: Path, point: Point): SegmentProjection | undefined {
  let best: SegmentProjection | undefined;
  for (const segment of getSegments(path)) {
    if (best && getDistanceToHull(segment.points, point) > best.distance) {
      // A curve is inside of its control points' box, so nothing on it is closer.
      continue;
    }
    const projection = projectOntoCurve(segment.points, point);
    if (!best || projection.distance < best.distance) {
      best = { segmentId: segment.id, ...projection };
    }
  }
  return best;
}

/** Returns the point on the segment at t. */
export function getPointOnSegment(path: Path, segmentId: string, t: number) {
  const segment = getSegments(path).find(s => s.id === segmentId);
  if (!segment) {
    throw new Error(`No segment with the id ${segmentId}`);
  }
  return evaluate(segment.points, t);
}

/**
 * Moves the anchors, with their handles. A quadratic curve's one control point is both of its
 * anchors' handles, so it only moves when both of them do.
 */
export function moveAnchors(path: Path, anchorIds: ReadonlySet<string>, delta: Point) {
  const subPaths = toSubPaths(path);
  for (const subPath of subPaths) {
    const isMoving = subPath.anchors.map((_, i) => anchorIds.has(getAnchorId(subPath, i)));
    subPath.segments.forEach((segment, i) => {
      const isStartMoving = isMoving[i];
      const isEndMoving = isMoving[nextIndex(subPath, i)];
      if (segment.type === 'C') {
        const [c1, c2] = segment.controls;
        segment.controls = [isStartMoving ? add(c1, delta) : c1, isEndMoving ? add(c2, delta) : c2];
      } else if (segment.type === 'Q' && isStartMoving && isEndMoving) {
        segment.controls = [add(segment.controls[0], delta)];
      }
    });
    subPath.anchors = subPath.anchors.map((p, i) => (isMoving[i] ? add(p, delta) : p));
  }
  return toPath(subPaths);
}

/**
 * Moves one of the anchor's handles to the point, on its own, or with the other handle mirroring
 * it: the same length, in the opposite direction. A quadratic curve's control point is shared with
 * the anchor at its other end, so it isn't turned to match.
 */
export function moveHandle(
  path: Path,
  anchorId: string,
  side: HandleSide,
  point: Point,
  mirror = false,
) {
  const subPaths = toSubPaths(path);
  const { subPath, index } = findAnchor(subPaths, anchorId);
  const anchor = subPath.anchors[index];
  const handle = getHandleRef(subPath, index, side);
  if (!handle) {
    throw new Error(`The anchor ${anchorId} has no ${side} handle`);
  }
  handle.segment.controls[handle.controlIdx] = point;
  const opposite = getHandleRef(subPath, index, side === 'in' ? 'out' : 'in');
  if (mirror && opposite && opposite.segment.type === 'C') {
    opposite.segment.controls[opposite.controlIdx] = subtract(scale(anchor, 2), point);
  }
  return toPath(subPaths);
}

/**
 * Adds an anchor on the segment at t, splitting it into two segments that draw the same curve.
 * Returns the new path and the new anchor's id.
 */
export function insertAnchor(path: Path, segmentId: string, t: number) {
  const subPaths = toSubPaths(path);
  const { subPath, index } = findSegment(subPaths, segmentId);
  const segment = subPath.segments[index];
  // Not on top of an end, which would make a segment with no length.
  const [left, right] = splitCurve(getSegmentPoints(subPath, index), clamp(t, 1e-3, 1 - 1e-3));
  const first: EditSegment = {
    type: segment.type === 'Z' ? 'L' : segment.type,
    id: uniqueId(),
    controls: left.slice(1, -1),
  };
  const second: EditSegment = { type: segment.type, id: segment.id, controls: right.slice(1, -1) };
  subPath.anchors.splice(index + 1, 0, left[left.length - 1]);
  subPath.segments.splice(index, 1, first, second);
  return { path: toPath(subPaths), anchorId: first.id };
}

/**
 * Adds a copy of the anchor on top of it, joined to it by a line with no length, so that the copy
 * can be dragged away (Alt-drag). The copy goes right after the anchor and takes its out handle,
 * keeping the id of the segment after it, and the anchor keeps its in handle. At the end of an
 * open subpath, that's the same as appending an anchor. At the start of one, the copy goes before
 * the anchor instead, and becomes the start. The other anchors keep their ids. Returns the new path
 * and the copy's id.
 */
export function duplicateAnchor(path: Path, anchorId: string) {
  const subPaths = toSubPaths(path);
  const { subPath, index } = findAnchor(subPaths, anchorId);
  const { anchors, segments } = subPath;
  const point = anchors[index];
  const id = uniqueId();
  if (!subPath.closed && index === 0 && anchors.length > 1) {
    // The line from the copy ends at the anchor, so it takes the move's id, which was the anchor's.
    segments.unshift({ type: 'L', id: subPath.moveId, controls: [] });
    anchors.unshift(point);
    subPath.moveId = id;
  } else {
    // The segment that was after the anchor now starts at the copy, and ends where it did.
    segments.splice(index, 0, { type: 'L', id, controls: [] });
    anchors.splice(index + 1, 0, point);
  }
  return { path: toPath(subPaths), anchorId: id };
}

/**
 * Deletes the anchors. The segments on either side of each one become one segment, fitted to the
 * shape they drew, and a subpath that it leaves with a single anchor is deleted too. Returns
 * undefined if nothing is left.
 */
export function deleteAnchors(path: Path, anchorIds: ReadonlySet<string>) {
  const subPaths = toSubPaths(path);
  const changed = new Set<EditSubPath>();
  for (const subPath of subPaths) {
    for (let i = subPath.anchors.length - 1; i >= 0; i--) {
      if (anchorIds.has(getAnchorId(subPath, i))) {
        deleteAnchor(subPath, i);
        changed.add(subPath);
      }
    }
  }
  // A subpath that was only ever one point, like a dot with a round cap, stays.
  const remaining = subPaths.filter(subPath => subPath.anchors.length > 1 || !changed.has(subPath));
  return remaining.length ? toPath(remaining) : undefined;
}

/**
 * Changes the anchors' point type. Straight anchors have no handles, and a curve whose handles are
 * both gone becomes a line. The other types give the anchor handles on both sides, turning the
 * lines and quadratic curves next to it into cubic curves that draw the same shape, and then:
 * mirrored handles line up and have the same length, asymmetric ones line up, and disconnected
 * ones are left as they are. Handles that are added point along the line between the anchor's
 * neighbors, a third of the way to each, or across from the anchor's one handle. The ends of an
 * open subpath only change when they're made straight.
 */
export function setPointType(path: Path, anchorIds: ReadonlySet<string>, type: PointType) {
  const subPaths = toSubPaths(path);
  for (const subPath of subPaths) {
    const changed = new Set<number>();
    subPath.anchors.forEach((_, i) => {
      if (anchorIds.has(getAnchorId(subPath, i))) {
        setAnchorType(subPath, i, type).forEach(segmentIdx => changed.add(segmentIdx));
      }
    });
    if (type === 'straight') {
      // Only the curves it changed, since a curve with no handles elsewhere may be there on
      // purpose, e.g. to morph with another curve.
      for (const i of changed) {
        const segment = subPath.segments[i];
        const points = getSegmentPoints(subPath, i);
        const [start, end] = [points[0], points[points.length - 1]];
        if (
          segment.type === 'C' &&
          MathUtil.arePointsEqual(segment.controls[0], start) &&
          MathUtil.arePointsEqual(segment.controls[1], end)
        ) {
          segment.type = 'L';
          segment.controls = [];
        }
      }
    }
  }
  return toPath(subPaths);
}

/**
 * Bends the segment so that its point at t moves by delta, keeping its ends where they are. The
 * control points move as little as they can for that, each in proportion to how much it pulls on
 * the point at t. Lines and quadratic curves become cubic curves.
 */
export function bendSegment(path: Path, segmentId: string, t: number, delta: Point) {
  const subPaths = toSubPaths(path);
  const { subPath, index } = findSegment(subPaths, segmentId);
  toCubic(subPath, index);
  // At the very ends, the control points don't pull on the curve at all.
  t = clamp(t, 0.05, 0.95);
  const b1 = 3 * t * (1 - t) ** 2;
  const b2 = 3 * t ** 2 * (1 - t);
  const sum = b1 * b1 + b2 * b2;
  const [c1, c2] = subPath.segments[index].controls;
  subPath.segments[index].controls = [
    add(c1, scale(delta, b1 / sum)),
    add(c2, scale(delta, b2 / sum)),
  ];
  return toPath(subPaths);
}

/**
 * Returns the anchor after (or before) this one: the next one in its subpath, or the first one in
 * the next subpath, going around at the end of the path.
 */
export function getAdjacentAnchorId(path: Path, anchorId: string, direction: 1 | -1) {
  const ids = getAnchors(path).map(anchor => anchor.id);
  const index = ids.indexOf(anchorId);
  if (index < 0) {
    throw new Error(`No anchor with the id ${anchorId}`);
  }
  return ids[MathUtil.floorMod(index + direction, ids.length)];
}

/** The control points of a new segment, which is a line without them. */
export interface NewSegmentControls {
  /** The control point after the segment's start. */
  readonly c1?: Point;
  /** The control point before the segment's end. */
  readonly c2?: Point;
}

/** An end of an open subpath, which the pen can go on drawing from. */
export interface SubPathEnd {
  readonly subIdx: number;
  readonly anchorId: string;
  readonly point: Point;
  readonly isStart: boolean;
}

/**
 * Adds a subpath with one anchor at the point, to the end of the path or to a new path. Returns
 * the path, the new subpath's index, and the anchor's id.
 */
export function addSubPath(path: Path | undefined, point: Point) {
  const subPaths = path ? toSubPaths(path) : [];
  const moveId = uniqueId();
  subPaths.push({ moveId, anchors: [point], segments: [], closed: false, closeId: undefined });
  return { path: toPath(subPaths), subIdx: subPaths.length - 1, anchorId: moveId };
}

/**
 * Adds an anchor at the end of an open subpath, joined to the last one by a line, or by a cubic
 * curve if a control point is given (the other one defaults to its end of the segment). Returns
 * the path and the anchor's id.
 */
export function appendAnchor(
  path: Path,
  subIdx: number,
  point: Point,
  controls: NewSegmentControls = {},
  // For redoing an append as a drag moves its handles, so that the anchor keeps its id.
  id = uniqueId(),
) {
  const subPaths = toSubPaths(path);
  const subPath = getOpenSubPath(subPaths, subIdx);
  subPath.segments.push(
    newSegment(id, subPath.anchors[subPath.anchors.length - 1], point, controls),
  );
  subPath.anchors.push(point);
  return { path: toPath(subPaths), anchorId: id };
}

/**
 * Closes an open subpath, with a line back to its first anchor or a curve (see appendAnchor). The
 * first anchor's out handle is moved to firstOut, if it's given, turning the segment after it into
 * a cubic curve. Without either, a last anchor on top of the first one is merged into it, which
 * undoes openSubPath.
 */
export function closeSubPath(
  path: Path,
  subIdx: number,
  controls: NewSegmentControls = {},
  firstOut?: Point,
) {
  const subPaths = toSubPaths(path);
  const subPath = getOpenSubPath(subPaths, subIdx);
  const { anchors } = subPath;
  const last = anchors.length - 1;
  if (
    !controls.c1 &&
    !controls.c2 &&
    !firstOut &&
    last > 1 &&
    MathUtil.arePointsEqual(anchors[last], anchors[0])
  ) {
    // The segment to the last anchor goes back to the first one instead, as the Z if it's a line.
    anchors.pop();
    const segment = subPath.segments[subPath.segments.length - 1];
    if (segment.type === 'L') {
      segment.type = 'Z';
    }
    subPath.closed = true;
    return toPath(subPaths);
  }
  if (firstOut && subPath.segments.length) {
    toCubic(subPath, 0);
    subPath.segments[0].controls[0] = firstOut;
  }
  const segment = newSegment(uniqueId(), anchors[anchors.length - 1], anchors[0], controls);
  // A line back is the Z itself, and a curve is followed by a Z with no length.
  subPath.segments.push(segment.type === 'L' ? { ...segment, type: 'Z' } : segment);
  subPath.closed = true;
  return toPath(subPaths);
}

/**
 * Opens a closed subpath at its first anchor. The Z becomes a line to a new last anchor on top of
 * the first one, or, when the segment before the Z already goes back to the first anchor, the Z is
 * dropped and that segment ends at the new anchor. The shape stays the same, and closeSubPath
 * closes it again.
 */
export function openSubPath(path: Path, subIdx: number) {
  const subPaths = toSubPaths(path);
  const subPath = subPaths[subIdx];
  if (!subPath?.closed) {
    throw new Error(`No closed subpath at ${subIdx}`);
  }
  const last = subPath.segments[subPath.segments.length - 1];
  if (last.type === 'Z') {
    // It keeps the Z's id, which is the new anchor's.
    last.type = 'L';
  }
  subPath.anchors.push(subPath.anchors[0]);
  subPath.closed = false;
  subPath.closeId = undefined;
  return toPath(subPaths);
}

/**
 * Whether the subpath is closed, which is whether it ends with a Z. One that only ends where it
 * starts is open, and can be closed.
 */
export function isSubPathClosed(path: Path, subIdx: number) {
  const commands = path.getSubPaths()[subIdx]?.getCommands() ?? [];
  return commands.length > 1 && commands[commands.length - 1].type === 'Z';
}

/**
 * Reverses a subpath, keeping its anchors' ids. A closed one keeps its first anchor, and goes
 * around the other way from it.
 */
export function reverseSubPath(path: Path, subIdx: number) {
  const subPaths = toSubPaths(path);
  const subPath = subPaths[subIdx];
  if (!subPath) {
    throw new Error(`No subpath at ${subIdx}`);
  }
  if (subPath.closed) {
    subPaths[subIdx] = reverseClosedSubPath(subPath);
    return toPath(subPaths);
  }
  const ids = subPath.anchors.map((_, i) => getAnchorId(subPath, i)).reverse();
  subPath.anchors.reverse();
  // Each segment keeps the id of the anchor it ends at, which has moved to the other end.
  subPath.segments = subPath.segments.reverse().map((segment, i) => ({
    type: segment.type,
    id: ids[i + 1],
    controls: [...segment.controls].reverse(),
  }));
  subPath.moveId = ids[0];
  return toPath(subPaths);
}

function reverseClosedSubPath(subPath: EditSubPath): EditSubPath {
  const { anchors, segments } = subPath;
  const count = anchors.length;
  const ids = anchors.map((_, i) => getAnchorId(subPath, i));
  // The segment back to the first anchor keeps the id of the one that was.
  const closingId = segments[count - 1].id;
  return {
    ...subPath,
    anchors: [anchors[0], ...anchors.slice(1).reverse()],
    // The new segment k is the old segment count - 1 - k, backwards. It ends at the old anchor
    // count - 1 - k, whose id it takes, except the last one, which goes back to the first.
    segments: segments.map((_, k) => {
      const old = segments[count - 1 - k];
      const isClosing = k === count - 1;
      const type = old.type === 'Z' ? 'L' : old.type;
      return {
        type: isClosing && type === 'L' ? 'Z' : type,
        id: isClosing ? closingId : ids[count - 1 - k],
        controls: [...old.controls].reverse(),
      };
    }),
  };
}

/**
 * Returns why the anchor can't be made its subpath's first, or undefined if it can (see
 * setFirstAnchor).
 */
export function getSetFirstAnchorRefusal(path: Path, anchorId: string) {
  const anchor = getAnchors(path).find(a => a.id === anchorId);
  if (!anchor) {
    return 'The point is gone';
  }
  if (!toSubPaths(path)[anchor.subIdx].closed) {
    // Starting anywhere else would change the shape, and starting at the other end is Reverse.
    return 'An open subpath starts at one of its ends';
  }
  return anchor.index === 0 ? "It's the first point already" : undefined;
}

/**
 * Makes the anchor the first of its closed subpath, which only matters for morphing, keeping the
 * shape, the closed flag, and every anchor's id. Each segment keeps the id of the anchor it ends
 * at, so the old closing segment takes the old move's id, and the new closing segment, which ends
 * at the new first anchor whose id the new move takes, gets a new one. Throws for an open subpath
 * (see getSetFirstAnchorRefusal).
 */
export function setFirstAnchor(path: Path, anchorId: string) {
  const subPaths = toSubPaths(path);
  const { subPath, index } = findAnchor(subPaths, anchorId);
  if (!subPath.closed) {
    throw new Error(`The subpath with the anchor ${anchorId} is open`);
  }
  if (index === 0) {
    return path;
  }
  const count = subPath.anchors.length;
  const rotate = <T>(items: ReadonlyArray<T>) => [...items.slice(index), ...items.slice(0, index)];
  const oldMoveId = subPath.moveId;
  const segments = rotate(subPath.segments).map((segment, k) => {
    const isOldClosing = k === count - 1 - index;
    const isNewClosing = k === count - 1;
    // Only the last segment can be the Z that draws the way back. A subpath that ended with a
    // line back to its start and then a Z with no length keeps that form, so the command count
    // (which a morph needs to match) stays the same.
    const type = segment.type === 'Z' ? 'L' : segment.type;
    const isZ = isNewClosing && type === 'L' && subPath.closeId === undefined;
    return {
      type: isZ ? ('Z' as const) : type,
      id: isNewClosing ? uniqueId() : isOldClosing ? oldMoveId : segment.id,
      controls: [...segment.controls],
    };
  });
  subPaths[subPaths.indexOf(subPath)] = {
    moveId: anchorId,
    anchors: rotate(subPath.anchors),
    segments,
    closed: true,
    // The Z with no length after a closing curve stays, and a closing line is the Z itself.
    closeId: segments[count - 1].type === 'Z' ? undefined : subPath.closeId,
  };
  return toPath(subPaths);
}

/**
 * Joins two ends of open subpaths, like Illustrator's Join: the two ends of one subpath close it,
 * and ends of two subpaths become one subpath, with a line between them, or with the ends merged
 * if they're in the same place. The joined subpath goes where the first end's was. Returns
 * undefined if the anchors aren't ends of open subpaths.
 */
export function joinEnds(path: Path, anchorId1: string, anchorId2: string) {
  const ends = getSubPathEnds(path);
  const a = ends.find(end => end.anchorId === anchorId1);
  const b = ends.find(end => end.anchorId === anchorId2);
  if (!a || !b || anchorId1 === anchorId2) {
    return undefined;
  }
  if (a.subIdx === b.subIdx) {
    return getAnchorCount(path, a.subIdx) > 1 ? closeSubPath(path, a.subIdx) : undefined;
  }
  // The first subpath ends at a, and the second starts at b.
  let oriented = path;
  if (a.isStart) {
    oriented = reverseSubPath(oriented, a.subIdx);
  }
  if (!b.isStart && getAnchorCount(path, b.subIdx) > 1) {
    oriented = reverseSubPath(oriented, b.subIdx);
  }
  const subPaths = toSubPaths(oriented);
  const first = subPaths[a.subIdx];
  const second = subPaths[b.subIdx];
  const isMerged = MathUtil.arePointsEqual(first.anchors[first.anchors.length - 1], b.point);
  const joined: EditSubPath = {
    ...first,
    anchors: [...first.anchors, ...(isMerged ? second.anchors.slice(1) : second.anchors)],
    segments: [
      ...first.segments,
      ...(isMerged ? [] : [{ type: 'L' as const, id: second.moveId, controls: [] }]),
      ...second.segments,
    ],
  };
  subPaths[a.subIdx] = joined;
  subPaths.splice(b.subIdx, 1);
  return toPath(subPaths);
}

/** Returns the ends of the path's open subpaths with more than one anchor. */
export function getSubPathEnds(path: Path): SubPathEnd[] {
  return toSubPaths(path).flatMap((subPath, subIdx) => {
    const { anchors, closed } = subPath;
    if (closed || anchors.length < 2) {
      return anchors.length === 1 && !closed
        ? [{ subIdx, anchorId: subPath.moveId, point: anchors[0], isStart: false }]
        : [];
    }
    const last = anchors.length - 1;
    return [
      { subIdx, anchorId: subPath.moveId, point: anchors[0], isStart: true },
      { subIdx, anchorId: getAnchorId(subPath, last), point: anchors[last], isStart: false },
    ];
  });
}

/** Returns the number of anchors in the subpath. */
export function getAnchorCount(path: Path, subIdx: number) {
  return toSubPaths(path)[subIdx]?.anchors.length ?? 0;
}

function getOpenSubPath(subPaths: ReadonlyArray<EditSubPath>, subIdx: number) {
  const subPath = subPaths[subIdx];
  if (!subPath || subPath.closed) {
    throw new Error(`No open subpath at ${subIdx}`);
  }
  return subPath;
}

function newSegment(id: string, start: Point, end: Point, { c1, c2 }: NewSegmentControls) {
  return c1 || c2
    ? { type: 'C' as const, id, controls: [c1 ?? start, c2 ?? end] }
    : { type: 'L' as const, id, controls: [] };
}

function toSubPaths(path: Path): EditSubPath[] {
  return path.getSubPaths().map(subPath => {
    const [move, ...rest] = subPath.getCommands();
    const last = rest[rest.length - 1];
    const closed = last?.type === 'Z';
    let body = rest;
    let closeId: string | undefined;
    if (closed && rest.length > 1 && last.start && MathUtil.arePointsEqual(last.start, last.end)) {
      // The command before the Z draws the way back.
      body = rest.slice(0, -1);
      closeId = last.id;
    }
    const anchors = [move.end, ...(closed ? body.slice(0, -1) : body).map(cmd => cmd.end)];
    const segments = body.map(cmd => ({
      type: cmd.type as SegmentType,
      id: cmd.id,
      controls: cmd.points.slice(1, -1) as Point[],
    }));
    return { moveId: move.id, anchors, segments, closed, closeId };
  });
}

function toPath(subPaths: ReadonlyArray<EditSubPath>) {
  const commands: Command[] = [];
  let previous: Point | undefined;
  for (const subPath of subPaths) {
    const start = subPath.anchors[0];
    commands.push(new Command('M', [previous, start], false, subPath.moveId));
    previous = start;
    subPath.segments.forEach((segment, i) => {
      const end = subPath.anchors[nextIndex(subPath, i)];
      commands.push(
        new Command(segment.type, [previous, ...segment.controls, end], false, segment.id),
      );
      previous = end;
    });
    const lastSegment = subPath.segments[subPath.segments.length - 1];
    if (subPath.closed && lastSegment?.type !== 'Z') {
      commands.push(new Command('Z', [previous, start], false, subPath.closeId ?? uniqueId()));
    }
  }
  return new Path(commands);
}

function getAnchorId(subPath: EditSubPath, index: number) {
  return index === 0 ? subPath.moveId : subPath.segments[index - 1].id;
}

/** The index of the anchor that segment i ends at. */
function nextIndex(subPath: EditSubPath, i: number) {
  return (i + 1) % subPath.anchors.length;
}

function getSegmentPoints(subPath: EditSubPath, i: number) {
  const segment = subPath.segments[i];
  return [subPath.anchors[i], ...segment.controls, subPath.anchors[nextIndex(subPath, i)]];
}

function findAnchor(subPaths: ReadonlyArray<EditSubPath>, anchorId: string) {
  for (const subPath of subPaths) {
    const index = subPath.anchors.findIndex((_, i) => getAnchorId(subPath, i) === anchorId);
    if (index >= 0) {
      return { subPath, index };
    }
  }
  throw new Error(`No anchor with the id ${anchorId}`);
}

function findSegment(subPaths: ReadonlyArray<EditSubPath>, segmentId: string) {
  for (const subPath of subPaths) {
    const index = subPath.segments.findIndex(segment => segment.id === segmentId);
    if (index >= 0) {
      return { subPath, index };
    }
  }
  throw new Error(`No segment with the id ${segmentId}`);
}

/** The index of the segment on the side of the anchor, if there is one. */
function getSegmentIndex(subPath: EditSubPath, index: number, side: HandleSide) {
  const { segments, closed } = subPath;
  if (side === 'in') {
    return index > 0 ? index - 1 : closed ? segments.length - 1 : undefined;
  }
  return index < segments.length ? index : undefined;
}

/** Where the anchor's handle on the side is kept, if the segment there is a curve. */
function getHandleRef(subPath: EditSubPath, index: number, side: HandleSide) {
  const segmentIdx = getSegmentIndex(subPath, index, side);
  if (segmentIdx === undefined) {
    return undefined;
  }
  const segment = subPath.segments[segmentIdx];
  if (segment.type === 'C') {
    return { segment, controlIdx: side === 'in' ? 1 : 0 };
  }
  if (segment.type === 'Q') {
    return { segment, controlIdx: 0 };
  }
  return undefined;
}

function getHandles(subPath: EditSubPath, index: number) {
  const handleIn = getHandleRef(subPath, index, 'in');
  const handleOut = getHandleRef(subPath, index, 'out');
  return {
    in: handleIn && handleIn.segment.controls[handleIn.controlIdx],
    out: handleOut && handleOut.segment.controls[handleOut.controlIdx],
  };
}

function getType(point: Point, handleIn: Point | undefined, handleOut: Point | undefined) {
  const v1 = handleIn && subtract(handleIn, point);
  const v2 = handleOut && subtract(handleOut, point);
  const l1 = v1 ? length(v1) : 0;
  const l2 = v2 ? length(v2) : 0;
  if (!v1 || !v2 || isZeroLength(l1) || isZeroLength(l2)) {
    return isZeroLength(l1) && isZeroLength(l2) ? 'straight' : 'disconnected';
  }
  // Paths are saved with 3 decimals, which moves a short handle's tip off of the line by up to
  // 7e-4 units, so that counts as lined up too.
  const isOpposite =
    dot(v1, v2) < 0 &&
    (cross(v1, v2) / (l1 * l2) < 1e-3 || cross(v1, v2) / Math.max(l1, l2) < 2e-3);
  if (!isOpposite) {
    return 'disconnected';
  }
  return Math.abs(l1 - l2) <= 1e-2 * Math.max(l1, l2) ? 'mirrored' : 'asymmetric';
}

function isZeroLength(l: number) {
  return l < 1e-6;
}

/** Changes the anchor's type, and returns the indices of the segments it changed. */
function setAnchorType(subPath: EditSubPath, index: number, type: PointType): number[] {
  const anchor = subPath.anchors[index];
  const inIdx = getSegmentIndex(subPath, index, 'in');
  const outIdx = getSegmentIndex(subPath, index, 'out');
  const sides: HandleSide[] = ['in', 'out'];
  if (type === 'straight') {
    const changed: number[] = [];
    for (const side of sides) {
      const segmentIdx = side === 'in' ? inIdx : outIdx;
      if (segmentIdx === undefined || !['Q', 'C'].includes(subPath.segments[segmentIdx].type)) {
        continue;
      }
      toCubic(subPath, segmentIdx);
      const handle = getHandleRef(subPath, index, side);
      if (handle) {
        handle.segment.controls[handle.controlIdx] = anchor;
        changed.push(segmentIdx);
      }
    }
    return changed;
  }
  if (inIdx === undefined || outIdx === undefined) {
    // An end of an open subpath only has one handle, so it can't line up with another.
    return [];
  }
  const count = subPath.anchors.length;
  const previous = subPath.anchors[MathUtil.floorMod(index - 1, count)];
  const next = subPath.anchors[nextIndex(subPath, index)];
  // The direction of the line between the neighbors, for handles that are added.
  const smooth = normalize(subtract(next, previous));
  const isLine = (i: number) => ['L', 'Z'].includes(subPath.segments[i].type);
  const wasLineIn = isLine(inIdx);
  const wasLineOut = isLine(outIdx);
  const before = getHandles(subPath, index);
  const hasIn = !wasLineIn && !!before.in && !isZeroLength(MathUtil.distance(before.in, anchor));
  const hasOut =
    !wasLineOut && !!before.out && !isZeroLength(MathUtil.distance(before.out, anchor));
  if (!hasIn && !hasOut && !smooth) {
    // E.g. both neighbors are the same point, so there's no direction to smooth it along.
    return [];
  }
  toCubic(subPath, inIdx);
  toCubic(subPath, outIdx);
  const handleIn = getHandleRef(subPath, index, 'in');
  const handleOut = getHandleRef(subPath, index, 'out');
  if (!handleIn || !handleOut) {
    return [inIdx, outIdx];
  }
  // A line's handles, after toCubic, are on the line, so they don't count as the anchor's.
  let v1: Point | undefined = hasIn
    ? subtract(handleIn.segment.controls[handleIn.controlIdx], anchor)
    : undefined;
  let v2: Point | undefined = hasOut
    ? subtract(handleOut.segment.controls[handleOut.controlIdx], anchor)
    : undefined;
  const toPrevious = MathUtil.distance(anchor, previous) / 3;
  const toNext = MathUtil.distance(anchor, next) / 3;
  if (!v1 && !v2 && smooth) {
    // The handles go along the line between the neighbors, a third of the way to each.
    v1 = scale(smooth, -toPrevious);
    v2 = scale(smooth, toNext);
  } else if (v1 && !v2) {
    // The missing handle goes across from the other one.
    v2 =
      type === 'disconnected'
        ? undefined
        : scale(unit(v1), type === 'mirrored' ? -length(v1) : -toNext);
  } else if (v2 && !v1) {
    v1 =
      type === 'disconnected'
        ? undefined
        : scale(unit(v2), type === 'mirrored' ? -length(v2) : -toPrevious);
  } else if (v1 && v2 && type !== 'disconnected') {
    // They line up along the average of their directions, or the line between the neighbors if
    // they point the same way.
    const direction = normalize(subtract(unit(v2), unit(v1))) ?? smooth;
    if (direction) {
      v1 = scale(direction, -length(v1));
      v2 = scale(direction, length(v2));
    }
  }
  if (type === 'mirrored' && v1 && v2) {
    const average = (length(v1) + length(v2)) / 2;
    v1 = scale(unit(v1), average);
    v2 = scale(unit(v2), average);
  }
  if (v1) {
    handleIn.segment.controls[handleIn.controlIdx] = add(anchor, v1);
  }
  if (v2) {
    handleOut.segment.controls[handleOut.controlIdx] = add(anchor, v2);
  }
  return [inIdx, outIdx];
}

/** The vector's direction, or the vector itself if it has no length. */
function unit(p: Point) {
  return normalize(p) ?? p;
}

/** Turns the segment into a cubic curve that draws the same shape. */
function toCubic(subPath: EditSubPath, i: number) {
  const segment = subPath.segments[i];
  const [start, ...rest] = getSegmentPoints(subPath, i);
  const end = rest[rest.length - 1];
  if (segment.type === 'C') {
    return;
  }
  if (segment.type === 'Q') {
    const [control] = segment.controls;
    segment.controls = [lerpPoint(start, control, 2 / 3), lerpPoint(end, control, 2 / 3)];
  } else {
    segment.controls = [lerpPoint(start, end, 1 / 3), lerpPoint(start, end, 2 / 3)];
  }
  if (segment.type === 'Z') {
    // A Z can only draw a line, so a Z with no length closes the subpath after the curve.
    subPath.closeId = subPath.closeId ?? uniqueId();
  }
  segment.type = 'C';
}

function deleteAnchor(subPath: EditSubPath, index: number) {
  const { anchors, segments, closed } = subPath;
  const count = anchors.length;
  if (!closed && (index === 0 || index === count - 1)) {
    // An end of an open subpath, and the segment to it.
    if (index === 0 && segments.length) {
      subPath.moveId = segments[0].id;
      segments.shift();
    } else {
      segments.pop();
    }
    anchors.splice(index, 1);
    return;
  }
  const inIdx = MathUtil.floorMod(index - 1, count);
  const outIdx = index;
  const inSegment = segments[inIdx];
  const outSegment = segments[outIdx];
  const merged = mergeSegments(getSegmentPoints(subPath, inIdx), getSegmentPoints(subPath, outIdx));
  if (index === 0) {
    // The next anchor is the new first one, so the merged segment closes the subpath.
    subPath.moveId = outSegment.id;
    const isLine = merged.length === 2;
    segments[inIdx] = {
      type: isLine ? (inSegment.type === 'Z' ? 'Z' : 'L') : 'C',
      id: inSegment.id,
      controls: merged.slice(1, -1),
    };
    if (!isLine && inSegment.type === 'Z') {
      subPath.closeId = subPath.closeId ?? uniqueId();
    }
    segments.splice(outIdx, 1);
    anchors.splice(index, 1);
    return;
  }
  // The merged segment ends where the second one did, so it keeps that one's id, which is the next
  // anchor's.
  const isLine = merged.length === 2;
  const isClosing = closed && outIdx === segments.length - 1;
  let type: SegmentType = isLine ? 'L' : 'C';
  if (isLine && isClosing && outSegment.type === 'Z') {
    type = 'Z';
  }
  if (!isLine && outSegment.type === 'Z') {
    subPath.closeId = subPath.closeId ?? uniqueId();
  }
  segments.splice(inIdx, 2, { type, id: outSegment.id, controls: merged.slice(1, -1) });
  anchors.splice(index, 1);
}

/**
 * Returns one segment that draws about the same shape as two: a line if they're both lines, or
 * curves that draw a line in the same direction, or else a cubic curve with the same tangents at
 * the ends, fitted to points along the two by least squares (Philip Schneider's method, from
 * Graphics Gems).
 */
function mergeSegments(first: ReadonlyArray<Point>, second: ReadonlyArray<Point>): Point[] {
  const start = first[0];
  const end = second[second.length - 1];
  if (first.length === 2 && second.length === 2) {
    return [start, end];
  }
  const samples = [...sampleCurve(first, 16), ...sampleCurve(second, 16).slice(1)];
  if (samples.every(p => isOnLine(p, start, end))) {
    // E.g. two curves with their handles along the same line.
    return [start, end];
  }
  // Chord lengths, as the samples' times on the new curve.
  const distances = [0];
  for (let i = 1; i < samples.length; i++) {
    distances.push(distances[i - 1] + MathUtil.distance(samples[i - 1], samples[i]));
  }
  const total = distances[distances.length - 1];
  const tangentStart = getTangent(first, 'start');
  const tangentEnd = getTangent(second, 'end');
  const fallback = total / 3;
  if (!total || !tangentStart || !tangentEnd) {
    return [start, lerpPoint(start, end, 1 / 3), lerpPoint(start, end, 2 / 3), end];
  }
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  samples.forEach((sample, i) => {
    const u = distances[i] / total;
    const b0 = (1 - u) ** 3;
    const b1 = 3 * u * (1 - u) ** 2;
    const b2 = 3 * u ** 2 * (1 - u);
    const b3 = u ** 3;
    const a1 = scale(tangentStart, b1);
    const a2 = scale(tangentEnd, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const rest = subtract(sample, add(scale(start, b0 + b1), scale(end, b2 + b3)));
    x0 += dot(a1, rest);
    x1 += dot(a2, rest);
  });
  const det = c00 * c11 - c01 * c01;
  let alpha1 = det ? (x0 * c11 - x1 * c01) / det : fallback;
  let alpha2 = det ? (c00 * x1 - c01 * x0) / det : fallback;
  if (!(alpha1 > 1e-6 && alpha2 > 1e-6)) {
    alpha1 = fallback;
    alpha2 = fallback;
  }
  return [start, add(start, scale(tangentStart, alpha1)), add(end, scale(tangentEnd, alpha2)), end];
}

/** Whether the point is on the line between start and end, to the precision paths are saved at. */
function isOnLine(point: Point, start: Point, end: Point) {
  const direction = normalize(subtract(end, start));
  if (!direction) {
    return MathUtil.distance(point, start) < 1e-3;
  }
  const offset = subtract(point, start);
  const along = dot(offset, direction);
  const lineLength = MathUtil.distance(start, end);
  return cross(offset, direction) < 1e-3 && -1e-3 <= along && along <= lineLength + 1e-3;
}

/** The unit tangent at an end of a curve, pointing into it. */
function getTangent(points: ReadonlyArray<Point>, end: 'start' | 'end') {
  const ordered = end === 'start' ? points : [...points].reverse();
  for (let i = 1; i < ordered.length; i++) {
    const direction = normalize(subtract(ordered[i], ordered[0]));
    if (direction) {
      return direction;
    }
  }
  return undefined;
}

/** Evaluates a line, or a quadratic or cubic curve, at t. */
function evaluate(points: ReadonlyArray<Point>, t: number): Point {
  let level = [...points];
  while (level.length > 1) {
    level = level.slice(1).map((p, i) => lerpPoint(level[i], p, t));
  }
  return level[0];
}

/** Splits a line or a curve at t with de Casteljau's algorithm. */
function splitCurve(points: ReadonlyArray<Point>, t: number): [Point[], Point[]] {
  const left: Point[] = [points[0]];
  const right: Point[] = [points[points.length - 1]];
  let level = [...points];
  while (level.length > 1) {
    level = level.slice(1).map((p, i) => lerpPoint(level[i], p, t));
    left.push(level[0]);
    right.unshift(level[level.length - 1]);
  }
  return [left, right];
}

function sampleCurve(points: ReadonlyArray<Point>, count: number) {
  return Array.from({ length: count + 1 }, (_, i) => evaluate(points, i / count));
}

/**
 * Returns how far the point is from the box around a curve's points, which is never farther than
 * any point on the curve.
 */
export function getDistanceToHull(points: ReadonlyArray<Point>, point: Point) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const dx = Math.max(Math.min(...xs) - point.x, 0, point.x - Math.max(...xs));
  const dy = Math.max(Math.min(...ys) - point.y, 0, point.y - Math.max(...ys));
  return Math.hypot(dx, dy);
}

/**
 * Finds the closest point on a line or a quadratic or cubic curve, given as its start, control
 * points, and end, by sampling it and then narrowing in on the best.
 */
export function projectOntoCurve(points: ReadonlyArray<Point>, point: Point) {
  const count = 64;
  let bestT = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const distance = MathUtil.distance(evaluate(points, t), point);
    if (distance < bestDistance) {
      bestT = t;
      bestDistance = distance;
    }
  }
  for (let step = 1 / count; step > 1e-7; step /= 2) {
    for (const t of [bestT - step, bestT + step]) {
      if (0 <= t && t <= 1) {
        const distance = MathUtil.distance(evaluate(points, t), point);
        if (distance < bestDistance) {
          bestT = t;
          bestDistance = distance;
        }
      }
    }
  }
  return { t: bestT, point: evaluate(points, bestT), distance: bestDistance };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function cross(a: Point, b: Point) {
  return Math.abs(a.x * b.y - a.y * b.x);
}

function length(p: Point) {
  return Math.hypot(p.x, p.y);
}

function normalize(p: Point) {
  const l = length(p);
  return isZeroLength(l) ? undefined : scale(p, 1 / l);
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: MathUtil.lerp(a.x, b.x, t), y: MathUtil.lerp(a.y, b.y, t) };
}
