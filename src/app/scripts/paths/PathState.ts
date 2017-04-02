import * as _ from 'lodash';
import {
  SubPath,
  Command,
  ProjectionResult,
  ProjectionOntoPath,
  HitOptions,
  HitResult
} from '.';
import { createSubPaths } from './SubPathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Point, Rect } from '../common';
import * as PathParser from './PathParser';
import * as polylabel from 'polylabel';
import {
  SubPathState,
  findSubPathState,
} from './SubPathState';

/**
 * Container class that encapsulates a Path's underlying state.
 */
export class PathState {
  readonly subPaths: ReadonlyArray<SubPath>;
  readonly commands: ReadonlyArray<Command>;

  constructor(
    private readonly obj: string | Command[],
    // Maps internal spsIdx indices to SubPathState objects. The last 'numCollapsingSubPaths'
    // indices hold references to the collapsing sub paths.
    public readonly subPathStateMap?: ReadonlyArray<SubPathState>,
    // Maps client-visible subIdx values to their positions in the subPathStateMap.
    public readonly subPathOrdering?: ReadonlyArray<number>,
    // The number of collapsing subpaths appended to the end of the subPathStateMap.
    public readonly numCollapsingSubPaths = 0,
  ) {
    const commands = (typeof obj === 'string' ? PathParser.parseCommands(obj) : obj);
    const subPaths = createSubPaths(commands);
    this.subPathStateMap =
      subPathStateMap || subPaths.map(s => {
        return new SubPathState(s.getCommands().map(c => new CommandState(c)));
      });
    this.subPathOrdering = subPathOrdering || subPaths.map((_, i) => i);
    this.subPaths = subPaths.map((subPath, subIdx) => {
      const cmds = subPath.getCommands().map((cmd, cmdIdx) => {
        return cmd.mutate()
          .setId(this.findCommandStateId(subIdx, cmdIdx))
          .build();
      });
      const spsIdx = this.subPathOrdering[subIdx];
      const isCollapsing =
        this.subPathOrdering.length - this.numCollapsingSubPaths <= spsIdx;
      const sps = findSubPathState(this.subPathStateMap, spsIdx);
      const isSplit = isSubPathSplit(this.subPathStateMap, spsIdx);
      const isUnsplittable = isSubPathUnsplittable(this.subPathStateMap, spsIdx);
      return subPath.mutate()
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

  private findSubPathState(spsIdx: number) {
    return findSubPathState(this.subPathStateMap, spsIdx);
  }

  private findCommandStateId(subIdx: number, cmdIdx: number) {
    const sps = this.findSubPathState(this.subPathOrdering[subIdx]);
    const numCommandsInSubPath =
      _.sum(sps.getCommandStates().map(cs => cs.getCommands().length));
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
        return cs.getIdAtIndex(cmdIdx - counter);
      }
      counter += cs.getCommands().length;
    }
    throw new Error('Error retrieving command mutation');
  }

  getPathLength() {
    // Note that we only return the length of the first sub path due to
    // https://code.google.com/p/android/issues/detail?id=172547
    const sps = this.findSubPathState(this.subPathOrdering[0]);
    return _.sum(sps.getCommandStates().map(cs => cs.getPathLength()));
  }

  project(point: Point, restrictToSubIdx?: number): ProjectionOntoPath | undefined {
    const minProjectionResultInfo =
      _.chain(this.subPaths as SubPath[])
        .map((subPath, subIdx) => { return { subPath, subIdx }; })
        .filter(obj => {
          const { subPath, subIdx } = obj;
          return !subPath.isCollapsing()
            && (restrictToSubIdx === undefined || restrictToSubIdx === subIdx);
        })
        .map(obj => {
          const { subIdx } = obj;
          const spsIdx = this.subPathOrdering[subIdx];
          const sps = this.findSubPathState(spsIdx);
          return sps.getCommandStates()
            .map((cs, csIdx) => {
              const projection = cs.project(point);
              if (projection && sps.isReversed()) {
                const t = projection.projectionResult.t;
                projection.projectionResult.t = 1 - t;
              }
              return {
                spsIdx,
                csIdx,
                splitIdx: projection ? projection.splitIdx : 0,
                projection: projection ? projection.projectionResult : undefined,
              };
            });
        })
        .flatMap(projections => projections)
        .filter(obj => !!obj.projection)
        // Reverse so that commands drawn with higher z-orders are preferred.
        .reverse()
        .reduce((prev, curr) => {
          return prev && prev.projection.d < curr.projection.d ? prev : curr;
        }, undefined)
        .value();
    if (!minProjectionResultInfo) {
      return undefined;
    }
    const { spsIdx, csIdx, splitIdx, projection } = minProjectionResultInfo;
    const subIdx = this.toSubIdx(spsIdx);
    const cmdIdx = this.toCmdIdx(spsIdx, csIdx, splitIdx);
    return { projection, subIdx, cmdIdx };
  }

  hitTest(point: Point, opts: HitOptions = {}): HitResult {
    const endPointHits: ProjectionOntoPath[] = [];
    const segmentHits: ProjectionOntoPath[] = [];
    const shapeHits: Array<{ subIdx: number }> = [];

    const restrictToSubIdx = opts.restrictToSubIdx;
    if (opts.isPointInRangeFn) {
      endPointHits.push(...
        _.chain(this.subPaths as SubPath[])
          .map((subPath, subIdx) => { return { subPath, subIdx }; })
          .filter(obj => {
            const { subPath, subIdx } = obj;
            return !subPath.isCollapsing()
              && (restrictToSubIdx === undefined || restrictToSubIdx === subIdx);
          })
          .map(obj => {
            const { subPath, subIdx } = obj;
            return subPath.getCommands()
              .map((cmd, cmdIdx) => {
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
          .value()
      );
    }

    if (opts.isSegmentInRangeFn) {
      // TODO: also check to see if the hit occurred at a stroke-linejoin vertex
      // TODO: take stroke width scaling into account as well?
      segmentHits.push(...
        _.chain(this.subPaths as SubPath[])
          .map((subPath, subIdx) => { return { subPath, subIdx }; })
          .filter(obj => {
            const { subPath, subIdx } = obj;
            return !subPath.isCollapsing()
              && (restrictToSubIdx === undefined || restrictToSubIdx === subIdx);
          })
          .map(obj => {
            const { subIdx } = obj;
            const spsIdx = this.subPathOrdering[subIdx];
            const sps = this.findSubPathState(spsIdx);
            // We iterate by csIdx here to improve performance (since cmdIdx
            // values can correspond to split points).
            return sps.getCommandStates()
              .map((cs, csIdx) => {
                const projectionResultWithSplitIdx = cs.project(point);
                if (!projectionResultWithSplitIdx) {
                  return {} as {
                    subIdx: number,
                    cmdIdx: number,
                    projection: ProjectionResult,
                    splitIdx: number,
                  };
                }
                const { projectionResult, splitIdx } = projectionResultWithSplitIdx;
                if (sps.isReversed()) {
                  projectionResult.t = 1 - projectionResult.t;
                }
                const cmdIdx = this.toCmdIdx(spsIdx, csIdx, splitIdx);
                return { subIdx, cmdIdx, projection: projectionResult };
              });
          })
          .flatMap(projectionInfos => projectionInfos)
          .filter(obj => {
            if (!obj.projection) {
              return false;
            }
            const cmd = this.subPaths[obj.subIdx].getCommands()[obj.cmdIdx];
            return opts.isSegmentInRangeFn(obj.projection.d, cmd);
          })
          .value()
      );
    }

    if (opts.findShapesInRange) {
      shapeHits.push(...
        _.chain(this.subPaths as SubPath[])
          .map((subPath, subIdx) => { return { subPath, subIdx }; })
          .filter(obj => {
            const { subPath, subIdx } = obj;
            return subPath.isClosed()
              && !subPath.isCollapsing()
              && (restrictToSubIdx === undefined || restrictToSubIdx === subIdx);
          })
          .flatMap(obj => {
            const { subIdx } = obj;
            const css = this.findSubPathState(this.toSpsIdx(subIdx)).getCommandStates();
            const bounds = createBoundingBox(...css);
            if (!bounds.contains(point)) {
              // Nothing to see here. Check the next subpath.
              return [] as Array<{ subIdx: number }>;
            }
            // The point is inside the subpath's bounding box, so next, we will
            // use the 'even-odd rule' to determine if the filled path has been hit.
            // We create a line from the mouse point to a point we know that is not
            // inside the path (in this case, we use a coordinate outside the path's
            // bounded box). A hit has occured if and only if the number of
            // intersections between the line and the path is odd.
            const line = { p1: point, p2: new Point(bounds.r + 1, bounds.b + 1) };
            const intersectionResults = css.map(cs => cs.intersects(line));
            const numIntersections = _.sum(intersectionResults.map(ts => ts.length));
            if (numIntersections % 2 === 0) {
              // Nothing to see here. Check the next subpath.
              return [] as Array<{ subIdx: number }>;
            }
            return [{ subIdx }];
          })
          .value()
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
    return new Point(pole[0], pole[1]);
  }

  private toSpsIdx(subIdx: number) {
    return this.subPathOrdering[subIdx];
  }

  private toSubIdx(spsIdx: number) {
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (this.subPathOrdering[i] === spsIdx) {
        return i;
      }
    }
    throw new Error('Invalid spsIdx: ' + spsIdx);
  }

  private toCmdIdx(spsIdx: number, csIdx: number, splitIdx: number) {
    const sps = this.findSubPathState(spsIdx);
    const commandStates = sps.getCommandStates();
    const numCmds = _.sum(commandStates.map(cs => cs.getCommands().length));
    let cmdIdx =
      splitIdx + _.sum(commandStates.map((cs, i) => i < csIdx ? cs.getCommands().length : 0));
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
function createBoundingBox(...css: CommandState[]) {
  const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);

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

function isSubPathUnsplittable(map: ReadonlyArray<SubPathState>, spsIdx: number) {
  // Construct an array of parent nodes (one per leaf... meaning there will be duplicates).
  const subPathStatesParents: SubPathState[] = [];
  (function recurseFn(currentLevel: ReadonlyArray<SubPathState>, parent?: SubPathState) {
    currentLevel.forEach(state => {
      if (!state.getSplitSubPaths().length) {
        subPathStatesParents.push(parent);
        return;
      }
      recurseFn(state.getSplitSubPaths(), state);
    });
  })(map);
  const parent = subPathStatesParents[spsIdx];
  return parent
    && parent.getSplitSubPaths().length
    && parent.getSplitSubPaths().every(s => !s.getSplitSubPaths().length);
}
