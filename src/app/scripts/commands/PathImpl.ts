import * as _ from 'lodash';
import { MathUtil, Point, Matrix, Rect } from '../common';
import {
  Path, SubPath, Command, SvgChar, ProjectionResult, HitResult, HitOptions
} from '.';
import * as PathParser from './PathParser';
import { newSubPath } from './SubPathImpl';
import { CommandImpl, newMove, newLine } from './CommandImpl';
import { PathState, CommandState, PathMutator } from './state';

export function newPath(obj: string | Command[]): Path {
  return new PathImpl(obj);
}

/**
 * Implementation of the Path interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
export class PathImpl implements Path {
  private readonly subPaths: ReadonlyArray<SubPath>;
  private readonly ps: PathState;
  private pathString: string;

  constructor(obj: string | Command[] | { commands: Command[], pathState: PathState }) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      this.subPaths =
        createSubPaths(...(typeof obj === 'string' ? PathParser.parseCommands(obj) : obj));
      this.ps = new PathState(this.subPaths);
    } else {
      this.subPaths = createSubPaths(...obj.commands);
      this.ps = obj.pathState;
    }
  }

  // Implements the Path interface.
  clone() {
    return this.mutate().build();
  }

  // Implements the Path interface.
  getPathString() {
    if (this.pathString === undefined) {
      this.pathString = PathParser.commandsToString(this.getCommands());
    }
    return this.pathString;
  }

  // Implements the Path interface.
  getSubPaths() {
    return this.subPaths;
  }

  // Implements the Path interface.
  getCommands(): ReadonlyArray<Command> {
    return _.flatMap(this.subPaths, subPath => subPath.getCommands() as Command[]);
  }

  // Implements the Path interface.
  getPathLength() {
    return this.ps.getPathLength();
  }

  // Implements the Path interface.
  isMorphableWith(path: Path) {
    const cmds1 = this.getCommands();
    const cmds2 = path.getCommands();
    return cmds1.length === cmds2.length && cmds1.every((cmd1, i) =>
      cmd1.svgChar === cmds2[i].svgChar);
  }

  // Implements the Path interface.
  interpolate(start: Path, end: Path, fraction: number): Path {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }
    // TODO: is this overkill? might be smart to make this more memory efficient.
    return new PathImpl(
      _.zipWith<Command>(
        start.getCommands(),
        this.getCommands(),
        end.getCommands(),
        (startCmd: Command, currCmd: Command, endCmd: Command) => {
          return new CommandImpl(
            currCmd.svgChar,
            _.zipWith<Point>(
              startCmd.points,
              currCmd.points,
              endCmd.points,
              (startPt: Point, currPt: Point, endPt: Point) => {
                if (!startPt || !currPt || !endPt) {
                  // The 'start' point of the first Move command in a path
                  // will be undefined. Skip it.
                  return undefined;
                }
                return new Point(
                  MathUtil.lerp(startPt.x, endPt.x, fraction),
                  MathUtil.lerp(startPt.y, endPt.y, fraction));
              }),
            currCmd.isSplit);
        }));
  }

  // Implements the Path interface.
  // TODO: write tests
  project(point: Point):
    { projection: ProjectionResult, subIdx: number, cmdIdx: number } | undefined {
    return this.ps.project(point);
  }

  // Implements the Path interface.
  reverse(subIdx: number) {
    return this.mutate()
      .reverseSubPath(subIdx)
      .build();
  }

  // Implements the Path interface.
  shiftBack(subIdx: number, numShifts = 1) {
    return this.mutate()
      .shiftSubPathBack(subIdx, numShifts)
      .build();
  }

  // Implements the Path interface.
  shiftForward(subIdx: number, numShifts = 1) {
    return this.mutate()
      .shiftSubPathForward(subIdx, numShifts)
      .build();
  }

  // Implements the Path interface.
  getId(subIdx: number, cmdIdx: number) {
    return this.ps.getId(subIdx, cmdIdx);
  }

  // Implements the Path interface.
  split(subIdx: number, cmdIdx: number, ...ts: number[]) {
    if (!ts.length) {
      console.warn('Attempt to split a path with an empty spread argument');
      return this;
    }
    return this.mutate()
      .splitCommand(subIdx, cmdIdx, ...ts)
      .build();
  }

  // Implements the Path interface.
  splitBatch(ops: Array<{ subIdx: number, cmdIdx: number, ts: number[] }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
    // TODO: should  we need to sort by subIdx or cmsIdx here?
    ops.sort(({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
      // Perform higher index splits first so that we don't alter the
      // indices of the lower index split operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });
    let result: Path = this;
    for (const { subIdx, cmdIdx, ts } of ops) {
      // TODO: do all operations as a single batch instead of individually
      result = result.split(subIdx, cmdIdx, ...ts);
    }
    return result;
  }

  // Implements the Path interface.
  splitInHalf(subIdx: number, cmdIdx: number) {
    return this.mutate()
      .splitCommandInHalf(subIdx, cmdIdx)
      .build();
  }

  // Implements the Path interface.
  unsplit(subIdx: number, cmdIdx: number) {
    return this.mutate()
      .unsplitCommand(subIdx, cmdIdx)
      .build();
  }

  // Implements the Path interface.
  unsplitBatch(ops: Array<{ subIdx: number, cmdIdx: number }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
    // TODO: should  we need to sort by subIdx or cmsIdx here?
    ops.sort(({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
      // Perform higher index unsplits first so that we don't alter the
      // indices of the lower index unsplit operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });
    let result: Path = this;
    for (const { subIdx, cmdIdx } of ops) {
      // TODO: do all operations as a single batch instead of individually
      result = result.unsplit(subIdx, cmdIdx);
    }
    return result;
  }

  // Implements the Path interface.
  convert(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    return this.mutate()
      .convertCommand(subIdx, cmdIdx, svgChar)
      .build();
  }

  // Implements the Path interface.
  unconvertSubPath(subIdx: number) {
    return this.mutate()
      .unconvertSubPath(subIdx)
      .build();
  }

  // Implements the Path interface.
  revert() {
    return this.mutate()
      .revert()
      .build();
  }

  // Implements the Path interface.
  transform(transforms: Matrix[]) {
    return this.mutate()
      .transformPath(transforms)
      .build();
  }

  // Implements the Path interface.
  // TODO: write tests
  hitTest(point: Point, opts: HitOptions) {
    return this.ps.hitTest(point, opts);
  }

  // Implements the Path interface.
  moveSubPath(fromSubIdx: number, toSubIdx: number) {
    return this.mutate()
      .moveSubPath(fromSubIdx, toSubIdx)
      .build();
  }

  mutate() {
    return new PathMutator(this.ps);
  }
}

function createSubPaths(...commands: Command[]) {
  if (!commands.length || commands[0].svgChar !== 'M') {
    // TODO: is this case actually possible? should we insert 'M 0 0' instead?
    return [];
  }
  let lastSeenMove: Command;
  let currentCmdList: Command[] = [];
  const subPathCmds: SubPath[] = [];
  for (const cmd of commands) {
    if (cmd.svgChar === 'M') {
      lastSeenMove = cmd;
      if (currentCmdList.length) {
        subPathCmds.push(newSubPath(currentCmdList));
        currentCmdList = [];
      } else {
        currentCmdList.push(cmd);
      }
      continue;
    }
    if (!currentCmdList.length) {
      currentCmdList.push(lastSeenMove);
    }
    currentCmdList.push(cmd);
    if (cmd.svgChar === 'Z') {
      subPathCmds.push(newSubPath(currentCmdList));
      currentCmdList = [];
    }
  }
  if (currentCmdList.length) {
    subPathCmds.push(newSubPath(currentCmdList));
  }
  return subPathCmds;
}
