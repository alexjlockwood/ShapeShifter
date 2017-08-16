import { MathUtil, Point, Rect } from 'app/scripts/common';
import * as _ from 'lodash';
import * as polylabel from 'polylabel';

import { Command, HitOptions, HitResult, Line, Projection, ProjectionOntoPath, SubPath } from '.';
import { CommandState } from './CommandState';
import * as PathParser from './PathParser';
import { createSubPaths } from './SubPath';
import { SubPathState, findSubPathState } from './SubPathState';

/**
 * Container class that encapsulates a Path's underlying state.
 */
export class PathState {
  readonly subPaths: ReadonlyArray<SubPath>;
  readonly commands: ReadonlyArray<Command>;

  constructor(
    obj: string | ReadonlyArray<Command>,
    // Maps internal spsIdx indices to SubPathState objects. The last 'numCollapsingSubPaths'
    // indices hold references to the collapsing sub paths.
    public readonly subPathStateMap?: ReadonlyArray<SubPathState>,
    // Maps client-visible subIdx values to their positions in the subPathStateMap.
    public readonly subPathOrdering?: ReadonlyArray<number>,
    // The number of collapsing subpaths appended to the end of the subPathStateMap.
    public readonly numCollapsingSubPaths = 0,
  ) {
    const commands = typeof obj === 'string' ? PathParser.parseCommands(obj) : obj;
    const subPaths = createSubPaths(commands);
    this.subPathStateMap =
      subPathStateMap ||
      subPaths.map(s => new SubPathState(s.getCommands().map(c => new CommandState(c))));
    this.subPathOrdering = subPathOrdering || subPaths.map((unused, i) => i);
    this.subPaths = subPaths.map((subPath, subIdx) => {
      const cmds = subPath.getCommands().map((cmd, cmdIdx) => {
        const { cs, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
        return cmd.mutate().setId(cs.getIdAtIndex(splitIdx)).build();
      });
      const spsIdx = this.subPathOrdering[subIdx];
      const isCollapsing = this.subPathOrdering.length - this.numCollapsingSubPaths <= spsIdx;
      const sps = this.findSubPathState(subIdx);
      const isSplit = isSubPathSplit(this.subPathStateMap, spsIdx);
      const isUnsplittable = !this.subPathStateMap.includes(sps);
      return subPath
        .mutate()
        .setId(sps.getId())
        .setCommands(cmds)
        .setIsCollapsing(isCollapsing)
        .setIsReversed(sps.isReversed())
        .setShiftOffset(sps.getShiftOffset())
        .setIsSplit(isSplit)
        .setIsUnsplittable(isUnsplittable)
        .build();
    });
    this.commands = _.flatMap(this.subPaths, subPath => subPath.getCommands() as Command[]);
  }

  getPathLength() {
    let length = 0;
    for (let i = 0; i < this.subPathStateMap.length; i++) {
      length += this.getSubPathLength(i);
    }
    return length;
  }

  getSubPathLength(subIdx: number) {
    const sps = this.findSubPathState(subIdx);
    return _.sumBy(sps.getCommandStates(), cs => cs.getPathLength());
  }

  getPointAtLength(distance: number) {
    const spss = this.subPathStateMap.map((unused, i) => this.findSubPathState(i));
    let length = 0;
    for (const sps of spss) {
      for (const cs of sps.getCommandStates()) {
        const len = cs.getPathLength();
        if (length <= distance && distance < length + len) {
          return cs.getPointAtLength(distance - length);
        }
        length += len;
      }
    }
    return undefined;
  }

  project(point: Point, restrictToSubIdx?: number): ProjectionOntoPath | undefined {
    interface ReduceArg {
      readonly spsIdx: number;
      readonly csIdx: number;
      readonly splitIdx: number;
      readonly projection: Projection;
    }
    const minProjectionResultInfo = _(this.subPaths as SubPath[])
      .map((subPath, subIdx) => ({ subPath, subIdx }))
      .filter(
        ({ subPath, subIdx }) =>
          !subPath.isCollapsing() &&
          (restrictToSubIdx === undefined || restrictToSubIdx === subIdx),
      )
      .map(obj => {
        const { subIdx } = obj;
        const sps = this.findSubPathState(subIdx);
        return sps.getCommandStates().map((cs, csIdx) => {
          const csProjection = cs.project(point);
          if (csProjection && sps.isReversed()) {
            const t = csProjection.projection.t;
            csProjection.projection.t = 1 - t;
          }
          return {
            spsIdx: this.subPathOrdering[subIdx],
            csIdx,
            splitIdx: csProjection ? csProjection.splitIdx : 0,
            projection: csProjection ? csProjection.projection : undefined,
          };
        });
      })
      .flatMap(projections => projections)
      .filter(obj => !!obj.projection)
      // Reverse so that commands drawn with higher z-orders are preferred.
      .reverse()
      .reduce((prev: ReduceArg, curr: ReduceArg) => {
        return prev && prev.projection.d < curr.projection.d ? prev : curr;
      }, undefined);
    if (!minProjectionResultInfo) {
      return undefined;
    }
    const { spsIdx, splitIdx, projection } = minProjectionResultInfo;
    const cmdIdx = this.toCmdIdx(spsIdx, minProjectionResultInfo.csIdx, splitIdx);
    return { projection, subIdx: this.subPathOrdering.indexOf(spsIdx), cmdIdx };
  }

  hitTest(point: Point, opts: HitOptions = {}): HitResult {
    const endPointHits: ProjectionOntoPath[] = [];
    const segmentHits: ProjectionOntoPath[] = [];
    const shapeHits: Array<{ readonly subIdx: number }> = [];
    const defaultRestrictToSubIdx = this.subPaths.map((unused, i) => i);
    const restrictToSubIdxSet = new Set<number>(opts.restrictToSubIdx || defaultRestrictToSubIdx);

    if (opts.isPointInRangeFn) {
      endPointHits.push(
        ..._(this.subPaths as SubPath[])
          .map((subPath, subIdx) => ({ subPath, subIdx }))
          .filter(obj => {
            const { subPath, subIdx } = obj;
            return !subPath.isCollapsing() && restrictToSubIdxSet.has(subIdx);
          })
          .map(obj => {
            const { subPath, subIdx } = obj;
            return subPath.getCommands().map((cmd, cmdIdx) => {
              const { x, y } = cmd.getEnd();
              const d = MathUtil.distance(cmd.getEnd(), point);
              const t = 1;
              const projection = { x, y, d, t };
              return { subIdx, cmdIdx, projection, cmd };
            });
          })
          .flatMap(pointInfos => pointInfos)
          .filter(pointInfo => opts.isPointInRangeFn(pointInfo.projection.d, pointInfo.cmd))
          .map(pointInfo => {
            const { subIdx, cmdIdx, projection } = pointInfo;
            return { subIdx, cmdIdx, projection };
          })
          .value(),
      );
    }

    if (opts.isSegmentInRangeFn) {
      // TODO: also check to see if the hit occurred at a stroke-linejoin vertex
      // TODO: take stroke width scaling into account as well?
      segmentHits.push(
        ..._(this.subPaths as SubPath[])
          .map((subPath, subIdx) => ({ subPath, subIdx }))
          .filter(obj => {
            const { subPath, subIdx } = obj;
            return !subPath.isCollapsing() && restrictToSubIdxSet.has(subIdx);
          })
          .flatMap(obj => {
            const { subIdx } = obj;
            const spsIdx = this.subPathOrdering[subIdx];
            const sps = this.findSubPathState(subIdx);
            // We iterate by csIdx here to improve performance (since cmdIdx
            // values can be split points).
            return _.flatMap(sps.getCommandStates(), (cs, csIdx) => {
              const projectionWithSplitIdx = cs.project(point);
              if (!projectionWithSplitIdx) {
                return [] as ProjectionOntoPath[];
              }
              const { projection, splitIdx } = projectionWithSplitIdx;
              if (sps.isReversed()) {
                projection.t = 1 - projection.t;
              }
              const cmdIdx = this.toCmdIdx(spsIdx, csIdx, splitIdx);
              return [{ subIdx, cmdIdx, projection }];
            });
          })
          .filter(obj => {
            const cmd = this.subPaths[obj.subIdx].getCommands()[obj.cmdIdx];
            return opts.isSegmentInRangeFn(obj.projection.d, cmd);
          })
          .value(),
      );
    }

    if (opts.findShapesInRange) {
      shapeHits.push(
        ..._(this.subPaths as SubPath[])
          .map((subPath, subIdx) => ({ subPath, subIdx }))
          .filter(obj => {
            const { subPath, subIdx } = obj;
            return subPath.isClosed() && !subPath.isCollapsing() && restrictToSubIdxSet.has(subIdx);
          })
          .flatMap(obj => {
            const { subIdx } = obj;
            const css = this.findSubPathState(subIdx).getCommandStates();
            const bounds = createBoundingBox(css);
            if (!containsPoint(bounds, point)) {
              // Nothing to see here. Check the next subpath.
              return [] as Array<{ readonly subIdx: number }>;
            }
            // The point is inside the subpath's bounding box, so next, we will
            // use the 'even-odd rule' to determine if the filled path has been hit.
            // We create a line from the mouse point to a point we know that is not
            // inside the path (in this case, we use a coordinate outside the path's
            // bounded box). A hit has occured if and only if the number of
            // intersections between the line and the path is odd.
            const line = { p1: point, p2: { x: bounds.r + 1, y: bounds.b + 1 } };
            const intersectionResults = css.map(cs => cs.intersects(line));
            const numIntersections = _.sumBy(intersectionResults, ts => ts.length);
            if (numIntersections % 2 === 0) {
              // Nothing to see here. Check the next subpath.
              return [] as Array<{ readonly subIdx: number }>;
            }
            return [{ subIdx }];
          })
          .value(),
      );
    }
    const isEndPointHit = !!endPointHits.length;
    const isSegmentHit = !!segmentHits.length;
    const isShapeHit = !!shapeHits.length;
    const isHit = isEndPointHit || isSegmentHit || isShapeHit;
    return {
      isHit,
      isEndPointHit,
      isSegmentHit,
      isShapeHit,
      endPointHits,
      segmentHits,
      shapeHits,
    };
  }

  // TODO: move this math stuff into the calculators module
  // TODO: approximate bezier curves by splitting them up into line segments
  // TODO: write tests for this stuff
  getPoleOfInaccessibility(subIdx: number) {
    const cmds = this.subPaths[subIdx].getCommands().slice(1);
    const polygon = _.flatMap(cmds, cmd => {
      const { x: p1x, y: p1y } = cmd.getStart();
      const { x: p2x, y: p2y } = cmd.getEnd();
      return [[p1x, p1y], [p2x, p2y]];
    });
    if (cmds.length && !this.subPaths[subIdx].isClosed()) {
      const { x: p1x, y: p1y } = cmds[0].getStart();
      const { x: p2x, y: p2y } = _.last(cmds).getEnd();
      polygon.push(...[[p1x, p1y], [p2x, p2y]]);
    }
    const pole = polylabel([polygon]);
    return { x: pole[0], y: pole[1] };
  }

  // TODO: cache this?
  getBoundingBox() {
    const css = _.flatMap(this.subPathStateMap, sps => sps.getCommandStates() as CommandState[]);
    return createBoundingBox(css);
  }

  isClockwise(subIdx: number) {
    const cmds = this.subPaths[subIdx].getCommands();
    let sum = 0;
    for (let i = 0; i < cmds.length; i++) {
      const { x: x0, y: y0 } = cmds[i].getEnd();
      const { x: x1, y: y1 } = cmds[(i + 1) % cmds.length].getEnd();
      sum += (x1 - x0) * (y1 - y0);
    }
    return sum >= 0;
  }

  private findSubPathState(subIdx: number) {
    return findSubPathState(this.subPathStateMap, this.subPathOrdering[subIdx]);
  }

  private findCommandStateInfo(subIdx: number, cmdIdx: number) {
    const sps = this.findSubPathState(subIdx);
    const numCommandsInSubPath = _.sumBy(sps.getCommandStates(), cs => cs.getCommands().length);
    if (cmdIdx && sps.isReversed()) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += sps.getShiftOffset();
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting numCommandsInSubPath is intentional here
      // (as opposed to subtracting numCommandsInSubPath - 1).
      cmdIdx -= numCommandsInSubPath;
    }
    let counter = 0;
    for (const cs of sps.getCommandStates()) {
      if (counter + cs.getCommands().length > cmdIdx) {
        return { sps, cs, splitIdx: cmdIdx - counter };
      }
      counter += cs.getCommands().length;
    }
    throw new Error('Error retrieving command mutation');
  }

  private toCmdIdx(spsIdx: number, csIdx: number, splitIdx: number) {
    const sps = this.findSubPathState(this.subPathOrdering.indexOf(spsIdx));
    const commandStates = sps.getCommandStates();
    const numCmds = _.sumBy(commandStates, cs => cs.getCommands().length);
    let cmdIdx =
      splitIdx + _.sum(commandStates.map((cs, i) => (i < csIdx ? cs.getCommands().length : 0)));
    let shiftOffset = sps.getShiftOffset();
    if (sps.isReversed()) {
      cmdIdx = numCmds - cmdIdx;
      shiftOffset *= -1;
      shiftOffset += numCmds - 1;
    }
    if (shiftOffset) {
      cmdIdx += numCmds - shiftOffset - 1;
      if (cmdIdx >= numCmds) {
        cmdIdx = cmdIdx - numCmds + 1;
      }
    }
    return cmdIdx;
  }
}

// TODO: cache this?
function createBoundingBox(css: ReadonlyArray<CommandState>) {
  const bounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };

  const expandBoundsFn = (x: number, y: number) => {
    if (isNaN(x) || isNaN(y)) {
      return;
    }
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  const expandBoundsForCommandMutationFn = (cs: CommandState) => {
    const bbox = cs.getBoundingBox();
    expandBoundsFn(bbox.x.min, bbox.y.min);
    expandBoundsFn(bbox.x.max, bbox.y.min);
    expandBoundsFn(bbox.x.min, bbox.y.max);
    expandBoundsFn(bbox.x.max, bbox.y.max);
  };

  css.forEach(cs => expandBoundsForCommandMutationFn(cs));
  return bounds;
}

function isSubPathSplit(map: ReadonlyArray<SubPathState>, spsIdx: number) {
  return !!findSubPathState(map, spsIdx).getSplitSubPaths().length;
}

function containsPoint(rect: Rect, p: Point) {
  return rect.l <= p.x && p.x < rect.r && rect.t <= p.y && p.y < rect.b;
}
