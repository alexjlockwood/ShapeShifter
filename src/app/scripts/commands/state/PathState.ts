import * as _ from 'lodash';
import { SubPath, SvgChar, ProjectionResult, HitOptions, HitResult } from '..';
import { CommandImpl } from '../CommandImpl';
import { CommandState } from './CommandState';
import { PathMutator } from './PathMutator';
import { MathUtil, Matrix, Point, Rect } from '../../common';

export class PathState {
  private readonly subPaths: ReadonlyArray<SubPath>;
  readonly commandMutationsMap: ReadonlyArray<ReadonlyArray<CommandState>>;
  readonly reversals: ReadonlyArray<boolean>;
  readonly shiftOffsets: ReadonlyArray<number>;
  readonly subPathOrdering: ReadonlyArray<number>;

  constructor(obj: ReadonlyArray<SubPath> | MutationState) {
    if (Array.isArray(obj)) {
      this.subPaths = obj as ReadonlyArray<SubPath>;
      this.commandMutationsMap =
        this.subPaths.map(s => s.getCommands().map(c => new CommandState(c as CommandImpl)));
      this.shiftOffsets = this.subPaths.map(_ => 0);
      this.reversals = this.subPaths.map(_ => false);
      this.subPathOrdering = this.subPaths.map((_, i) => i);
    } else {
      const ms = obj as MutationState;
      this.commandMutationsMap = ms.commandMutationsMap.map(cms => cms.slice());
      this.reversals = ms.reversals.slice();
      this.shiftOffsets = ms.shiftOffsets.slice();
      this.subPathOrdering = ms.subPathOrdering.slice();
    }
  }

  getPathLength() {
    // Note that we only return the length of the first sub path due to
    // https://code.google.com/p/android/issues/detail?id=172547
    return _.sum(this.commandMutationsMap[0].map(cm => cm.getPathLength()));
  }

  getId(subIdx: number, cmdIdx: number) {
    // TODO: the IDs should probably just be properties of the path/subpath/command objects...
    // TODO: remove this command mutation logic somewhere else
    const { targetCm, splitIdx } = findCommandMutation(subIdx, cmdIdx, {
      commandMutationsMap: this.commandMutationsMap,
      reversals: this.reversals,
      shiftOffsets: this.shiftOffsets,
      subPathOrdering: this.subPathOrdering,
    });
    return targetCm.getIdAtIndex(splitIdx);
  }

  project(point: Point):
    { projection: ProjectionResult, subIdx: number, cmdIdx: number } | undefined {

    const minProjectionResultInfo =
      _.chain(this.commandMutationsMap as CommandState[][])
        .map((subPathCms, cmsIdx) =>
          subPathCms.map((cm, cmIdx) => {
            const projection = cm.project(point);
            return {
              cmsIdx,
              cmIdx,
              splitIdx: projection ? projection.splitIdx : 0,
              projection: projection ? projection.projectionResult : undefined,
            };
          }))
        .flatMap(projections => projections)
        .filter(obj => !!obj.projection)
        .reduce((prev, curr) => {
          return prev && prev.projection.d < curr.projection.d ? prev : curr;
        }, undefined)
        .value();
    if (!minProjectionResultInfo) {
      return undefined;
    }
    const cmsIdx = minProjectionResultInfo.cmsIdx;
    const cmIdx = minProjectionResultInfo.cmIdx;
    const splitIdx = minProjectionResultInfo.splitIdx;
    const projection = minProjectionResultInfo.projection;
    const subIdx = this.toSubIdx(cmsIdx);
    const cmdIdx = this.toCmdIdx(cmsIdx, cmIdx, splitIdx);
    return { projection, subIdx, cmdIdx };
  }

  hitTest(point: Point, opts: HitOptions) {
    if (opts.isPointInRangeFn) {
      // First search for in-range path points.
      const pointResult =
        _.chain(this.subPaths as SubPath[])
          .map((subPath, subIdx) => {
            return subPath.getCommands()
              .map((cmd, cmdIdx) => {
                const distance = MathUtil.distance(cmd.end, point);
                const isSplit = cmd.isSplit;
                return { subIdx, cmdIdx, distance, isSplit };
              });
          })
          .flatMap(pathPoints => pathPoints)
          .filter(pathPoint => opts.isPointInRangeFn(pathPoint.distance, pathPoint.isSplit))
          // Reverse so that points drawn with higher z-orders are preferred.
          .reverse()
          .reduce((prev, curr) => {
            if (!prev) {
              return curr;
            }
            if (prev.isSplit !== curr.isSplit) {
              // Always return split points that are in range before
              // returning non-split points. This way we can guarantee that
              // split points will never be obstructed by non-split points.
              return prev.isSplit ? prev : curr;
            }
            return prev.distance < curr.distance ? prev : curr;
          }, undefined)
          .value();

      if (pointResult) {
        // Then the hit occurred on top of a command point.
        return {
          isHit: true,
          subIdx: pointResult.subIdx,
          cmdIdx: pointResult.cmdIdx,
        };
      }
    }

    if (opts.hitTestPointsOnly) {
      return { isHit: false };
    }

    if (opts.isStrokeInRangeFn) {
      // If the shortest distance from the point to the path is less than half
      // the stroke width, then select the path.

      // TODO: also check to see if the hit occurred at a stroke-linejoin vertex
      // TODO: take stroke width scaling into account as well?
      const result = this.project(point);
      const isHit = result && opts.isStrokeInRangeFn(result.projection.d);
      return {
        isHit,
        subIdx: isHit ? result.subIdx : undefined,
      };
    }

    let hitCmsIdx: number = undefined;

    // Search from right to left so that higher z-order subpaths are found first.
    _.chain(this.subPaths as SubPath[])
      .map((subPath, subIdx) => this.commandMutationsMap[this.toCmsIdx(subIdx)])
      .forEachRight((cms, cmsIdx) => {
        const isClosed =
          cms[0].getCommands()[0].end.equals((_.last(_.last(cms).getCommands())).end);
        if (!isClosed) {
          // If this happens, the SVG is probably not going to render properly at all,
          // but we'll check anyway just to be safe.
          return true;
        }
        const bounds = createBoundingBox(...cms);
        if (!bounds.contains(point)) {
          // Nothing to see here. Check the next subpath.
          return true;
        }
        // The point is inside the subpath's bounding box, so next, we will
        // use the 'even-odd rule' to determine if the filled path has been hit.
        // We create a line from the mouse point to a point we know that is not
        // inside the path (in this case, we use a coordinate outside the path's
        // bounded box). A hit has occured if and only if the number of
        // intersections between the line and the path is odd.
        const line = { p1: point, p2: new Point(bounds.r + 1, bounds.b + 1) };
        const numIntersections = _.sum(cms.map(cm => cm.intersects(line).length));
        if (numIntersections % 2 !== 0) {
          hitCmsIdx = cmsIdx;
        }
        return hitCmsIdx === undefined;
      });

    if (hitCmsIdx === undefined) {
      return { isHit: false };
    }

    const hitSubIdx = this.subPathOrdering[hitCmsIdx];
    return {
      isHit: true,
      subIdx: hitSubIdx,
    };
  }

  private toCmsIdx(subIdx: number) {
    return this.subPathOrdering[subIdx];
  }

  private toSubIdx(cmsIdx: number) {
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (this.subPathOrdering[i] === cmsIdx) {
        return i;
      }
    }
    throw new Error('Invalid cmsIdx: ' + cmsIdx);
  }

  private toCmdIdx(cmsIdx: number, cmIdx: number, splitIdx: number) {
    return splitIdx + _.chain(this.commandMutationsMap[cmsIdx])
      .map((cm, i) => i < cmIdx ? cm.getCommands().length : 0)
      .sum()
      .value();
  }
}

/**
 * Finds and returns the command mutation at the specified indices.
 * @param subIdx the client-visible subpath index
 * @param cmdIdx the client-visible command index
 */
export function findCommandMutation(subIdx: number, cmdIdx: number, ms: MutationState) {
  const cmsIdx = ms.subPathOrdering[subIdx];
  const subPathCms = ms.commandMutationsMap[cmsIdx];
  const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
  if (cmdIdx && ms.reversals[cmsIdx]) {
    cmdIdx = numCommandsInSubPath - cmdIdx;
  }
  cmdIdx += ms.shiftOffsets[cmsIdx];
  if (cmdIdx >= numCommandsInSubPath) {
    cmdIdx -= (numCommandsInSubPath - 1);
  }
  let counter = 0;
  let cmIdx = 0;
  for (const targetCm of subPathCms) {
    if (counter + targetCm.getCommands().length > cmdIdx) {
      const splitIdx = cmdIdx - counter;
      return { targetCm, cmsIdx, cmIdx, splitIdx };
    }
    counter += targetCm.getCommands().length;
    cmIdx++;
  }
  throw new Error('Error retrieving command mutation');
}

// TODO: cache this?
function createBoundingBox(...cms: CommandState[]) {
  const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);

  const expandBoundsFn = (x: number, y: number) => {
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  const expandBoundsForCommandMutationFn = (cm: CommandState) => {
    const bbox = cm.getBoundingBox();
    expandBoundsFn(bbox.x.min, bbox.y.min);
    expandBoundsFn(bbox.x.max, bbox.y.min);
    expandBoundsFn(bbox.x.min, bbox.y.max);
    expandBoundsFn(bbox.x.max, bbox.y.max);
  };

  cms.forEach(cm => expandBoundsForCommandMutationFn(cm));
  return bounds;
}

interface MutationState {
  readonly commandMutationsMap?: ReadonlyArray<ReadonlyArray<CommandState>>;
  // Maps internal cmsIdx values to the subpath's current reversal state.
  readonly reversals?: ReadonlyArray<boolean>;
  // Maps internal cmsIdx values to the subpath's current shift offset state.
  readonly shiftOffsets?: ReadonlyArray<number>;
  // Maps client-visible subIdx values to internal cmsIdx values.
  readonly subPathOrdering?: ReadonlyArray<number>;
}
