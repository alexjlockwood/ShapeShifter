import * as _ from 'lodash';
import { MathUtil, Point, Matrix, Rect } from '../common';
import { PathHelper, createPathHelper } from './PathHelper';
import { PathCommand, SubPathCommand, Command, SvgChar, Projection } from '../model/commands';
import * as SvgUtil from './SvgUtil';
import * as PathParser from './PathParser';
import { createSubPathCommand } from './SubPathCommandImpl';
import {
  CommandImpl, moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arcTo, closePath
} from './CommandImpl';

export function createPathCommand(path: string): PathCommand {
  return new PathCommandImpl(path);
}

/**
 * Implementation of the PathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
class PathCommandImpl implements PathCommand {

  // TODO: forbid multi-closepath cases
  // TODO: consider reversing M C C L Z
  // TODO: reversing a path with a mix of Ls and Cs doesnt work.
  // TODO: reversing a path with a close path with identical start/end points doesn't work
  // TODO: consider an svg that ends with Z and one that doesn't. how to make these morphable?
  private readonly path_: string;
  private readonly subPathCommands_: ReadonlyArray<SubPathCommand>;
  private readonly commandWrappers_: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  private readonly shiftOffsets_: ReadonlyArray<number>;
  private readonly reversals_: ReadonlyArray<boolean>;

  // TODO: add method to calculate bounds and length
  constructor(obj: string | CommandImpl[] | ClonedPathCommandInfo) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      if (typeof obj === 'string') {
        this.path_ = obj;
        this.subPathCommands_ =
          createSubPathCommands(...PathParser.parseCommands(obj));
      } else {
        this.path_ = PathParser.commandsToString(obj);
        this.subPathCommands_ = createSubPathCommands(...obj);
      }
      this.commandWrappers_ =
        this.subPathCommands_.map(s => createCommandWrappers(s.commands));
      this.shiftOffsets_ = this.subPathCommands_.map(_ => 0);
      this.reversals_ = this.subPathCommands_.map(_ => false);
    } else {
      this.path_ = PathParser.commandsToString(obj.drawCommands_);
      this.subPathCommands_ = createSubPathCommands(...obj.drawCommands_);
      this.commandWrappers_ = obj.commandWrappers_.map(cws => cws.slice());
      this.shiftOffsets_ = obj.shiftOffsets_.slice();
      this.reversals_ = obj.reversals_.slice();
    }
  }

  // Implements the PathCommand interface.
  clone(overrides: ClonedPathCommandInfo = {}) {
    // TODO: only recompute the stuff that we know has changed...
    const newCmdWrappers =
      overrides.commandWrappers_
        ? overrides.commandWrappers_
        : this.commandWrappers_;

    const shouldReverseFn = (subIdx: number) =>
      overrides.reversals_
        ? overrides.reversals_[subIdx]
        : this.reversals_[subIdx];

    const getShiftOffsetFn = (subIdx: number) =>
      overrides.shiftOffsets_
        ? overrides.shiftOffsets_[subIdx]
        : this.shiftOffsets_[subIdx];

    const maybeReverseCommandsFn = (subIdx: number) => {
      const subPathCws = newCmdWrappers[subIdx];
      const hasOneDrawCmd =
        subPathCws.length === 1 && _.first(subPathCws).commands.length === 1;
      if (hasOneDrawCmd || !shouldReverseFn(subIdx)) {
        // Nothing to do in these two cases.
        return _.flatMap(subPathCws, cw => cw.commands as CommandImpl[]);
      }

      // Extract the draw commands from our command wrapper map.
      const drawCmds = _.flatMap(subPathCws, cw => {
        // Consider a segment A ---- B ---- C with AB split and
        // BC non-split. When reversed, we want the user to see
        // C ---- B ---- A w/ CB split and BA non-split.
        const cmds = cw.commands.slice();
        if (cmds[0].svgChar === 'M') {
          return cmds;
        }
        cmds[0] = _.first(cmds).toggleSplit();
        cmds[cmds.length - 1] = _.last(cmds).toggleSplit();
        return cmds;
      });


      // If the last command is a 'Z', replace it with a line before we reverse.
      const lastCmd = _.last(drawCmds);
      if (lastCmd.svgChar === 'Z') {
        drawCmds[drawCmds.length - 1] = lineTo(lastCmd.start, lastCmd.end, lastCmd.isSplit);
      }

      // Reverse the draw commands.
      const newDrawCmds = [];
      for (let i = drawCmds.length - 1; i > 0; i--) {
        newDrawCmds.push(drawCmds[i].reverse());
      }
      newDrawCmds.unshift(moveTo(_.first(drawCmds).start, _.first(newDrawCmds).start));
      return newDrawCmds;
    };

    // TODO: another edge case: closed paths not ending in a Z
    const maybeShiftCommandsFn = (subIdx: number, drawCmds: CommandImpl[]) => {
      let shiftOffset = getShiftOffsetFn(subIdx);
      if (!shiftOffset
        || drawCmds.length === 1
        || !_.first(drawCmds).end.equals(_.last(drawCmds).end)) {
        // If there is no shift offset, the sub path is one command long,
        // or if the sub path is not closed, then do nothing.
        return drawCmds;
      }

      const numCommands = drawCmds.length;
      if (shouldReverseFn(subIdx)) {
        shiftOffset *= -1;
        shiftOffset += numCommands - 1;
      }

      // If the last command is a 'Z', replace it with a line before we shift.
      const lastCmd = _.last(drawCmds);
      if (lastCmd.svgChar === 'Z') {
        drawCmds[numCommands - 1] = lineTo(lastCmd.start, lastCmd.end, lastCmd.isSplit);
      }

      const newDrawCmds = [];

      // Handle these case separately cause they are annoying and I'm sick of edge cases.
      if (shiftOffset === 1) {
        newDrawCmds.push(moveTo(_.first(drawCmds).start, drawCmds[1].end));
        for (let i = 2; i < drawCmds.length; i++) {
          newDrawCmds.push(drawCmds[i]);
        }
        newDrawCmds.push(drawCmds[1]);
        return newDrawCmds;
      } else if (shiftOffset === numCommands - 1) {
        newDrawCmds.push(moveTo(_.first(drawCmds).start, drawCmds[numCommands - 2].end));
        newDrawCmds.push(_.last(drawCmds));
        for (let i = 1; i < drawCmds.length - 1; i++) {
          newDrawCmds.push(drawCmds[i]);
        }
        return newDrawCmds;
      }

      // Shift the sequence of drawing commands. After the shift, the original move
      // command will be at index 'numCommands - shiftOffset'.
      for (let i = 0; i < numCommands; i++) {
        newDrawCmds.push(drawCmds[(i + shiftOffset) % numCommands]);
      }

      // The first start point will either be undefined, or the end point of the previous sub path.
      const prevMoveCmd = newDrawCmds.splice(numCommands - shiftOffset, 1)[0];
      newDrawCmds.push(newDrawCmds.shift());
      newDrawCmds.unshift(moveTo(prevMoveCmd.start, _.last(newDrawCmds).end));
      return newDrawCmds;
    };

    const drawCommands = _.flatMap(newCmdWrappers, (_, subIdx) => {
      return maybeShiftCommandsFn(subIdx, maybeReverseCommandsFn(subIdx));
    });
    return new PathCommandImpl(_.assign({}, {
      drawCommands_: drawCommands,
      commandWrappers_: newCmdWrappers,
      shiftOffsets_: this.shiftOffsets_,
      reversals_: this.reversals_,
    }, overrides));
  }

  get pathString() {
    return this.path_;
  }

  toString() {
    return this.path_;
  }

  // Implements the PathCommand interface.
  get subPathCommands() {
    return this.subPathCommands_;
  }

  // Implements the PathCommand interface.
  get pathLength(): number {
    throw new Error('Path length not yet supported');
  }

  // Implements the PathCommand interface.
  isMorphableWith(pathCommand: PathCommand) {
    // TODO: this starts returning false after auto-fixing multiple times
    const scmds1 = this.subPathCommands;
    const scmds2 = pathCommand.subPathCommands;
    return scmds1.length === scmds2.length
      && scmds1.every((_, i) =>
        scmds1[i].commands.length === scmds2[i].commands.length
        && scmds1[i].commands.every((__, j) =>
          scmds1[i].commands[j].svgChar === scmds2[i].commands[j].svgChar));
  }

  // Implements the PathCommand interface.
  interpolate(start: PathCommand, end: PathCommand, fraction: number): PathCommand {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }

    const drawCommands: CommandImpl[] = [];
    this.subPathCommands.forEach((s, i) => {
      s.commands.forEach((d, j) => {
        if (d.svgChar === 'A') {
          const d1 = start.subPathCommands[i].commands[j];
          const d2 = end.subPathCommands[i].commands[j];
          const args = d.args.slice();
          args.forEach((_, k) => {
            if (k === 5 || k === 6) {
              // Doesn't make sense to interpolate the large arc and sweep flags.
              // TODO: confirm this is how arcs are interpolated in android?
              args[k] = fraction === 0 ? d1.args[k] : d2.args[k];
              return;
            }
            args[k] = MathUtil.lerp(d1.args[k], d2.args[k], fraction);
          });
          const points = [new Point(args[0], args[1]), new Point(args[7], args[8])];
          drawCommands.push(new CommandImpl(d.svgChar, d.isSplit, points, ...args));
        } else {
          const d1 = start.subPathCommands[i].commands[j];
          const d2 = end.subPathCommands[i].commands[j];
          const points = [];
          for (let k = 0; k < d1.points.length; k++) {
            const startPoint = d1.points[k];
            const endPoint = d2.points[k];
            if (startPoint && endPoint) {
              const px = MathUtil.lerp(startPoint.x, endPoint.x, fraction);
              const py = MathUtil.lerp(startPoint.y, endPoint.y, fraction);
              points.push(new Point(px, py));
            }
          }
          drawCommands.push(new CommandImpl(d.svgChar, d.isSplit, points));
        }
      });
    });

    return new PathCommandImpl(drawCommands);
  }

  // Implements the PathCommand interface.
  project(point: Point): { projection: Projection, split: () => PathCommand } | undefined {
    return _.chain(this.commandWrappers_)
      .map((subPathCws: CommandWrapper[], cwsIdx) =>
        subPathCws.map((cw: CommandWrapper, cwIdx) => {
          const projection = cw.project(point);
          return {
            projection,
            split: () => this.splitCommandWrapper(cwsIdx, cwIdx, projection.t),
          };
        }))
      .flatMap(projections => projections)
      .filter(obj => !!obj.projection)
      .reduce((prev, curr) => {
        return prev && prev.projection.d < curr.projection.d ? prev : curr;
      }, undefined)
      .value();
  }

  // Implements the PathCommand interface.
  reverse(subIdx: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    return this.clone({
      reversals_: this.reversals_.map((r, i) => i === subIdx ? !r : r),
    });
  }

  // Implements the PathCommand interface.
  shiftBack(subIdx: number, numShifts = 1) {
    if (this.reversals_[subIdx]) {
      return this.shiftForwardInternal(subIdx, numShifts);
    }
    return this.shiftBackInternal(subIdx, numShifts);
  }

  // Implements the PathCommand interface.
  shiftForward(subIdx: number, numShifts = 1) {
    if (this.reversals_[subIdx]) {
      return this.shiftBackInternal(subIdx, numShifts);
    }
    return this.shiftForwardInternal(subIdx, numShifts);
  }

  private shiftBackInternal(subIdx: number, numShifts = 1) {
    return this.shiftInternal(
      subIdx, (offset, numCommands) => {
        return (offset + numShifts) % (numCommands - 1);
      });
  }

  private shiftForwardInternal(subIdx: number, numShifts = 1) {
    return this.shiftInternal(
      subIdx, (offset, numCommands) => {
        return MathUtil.floorMod(offset - numShifts, numCommands - 1);
      });
  }

  private shiftInternal(
    subIdx: number,
    calcOffsetFn: (offset: number, numCommands: number) => number) {

    // TODO: add a test for cmds with multiple moves but no close paths
    // TODO: add a test for cmds ending with a Z with the same end point as its prev cmd
    const numCommands = this.subPathCommands_[subIdx].commands.length;
    if (numCommands <= 1 || !this.subPathCommands_[subIdx].isClosed) {
      return this;
    }
    return this.clone({
      shiftOffsets_: this.shiftOffsets_.map((offset, i) => {
        return i === subIdx ? calcOffsetFn(offset, numCommands) : offset;
      }),
    });
  }

  // Implements the PathCommand interface.
  getId(subIdx: number, drawIdx: number) {
    const { targetCw, splitIdx } = this.findCommandWrapper(subIdx, drawIdx);
    return targetCw.getIdAtIndex(splitIdx);
  }

  // Implements the PathCommand interface.
  split(subIdx: number, drawIdx: number, ...ts: number[]) {
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, drawIdx);
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cwIdx, ts.length);
    const newCw = targetCw.splitAtIndex(splitIdx, ts);
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
      shiftOffsets_: shiftOffsets,
    });
  }

  // Implements the PathCommand interface.
  splitInHalf(subIdx: number, drawIdx: number) {
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, drawIdx);
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cwIdx, 1);
    const newCw = targetCw.splitInHalfAtIndex(splitIdx);
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
      shiftOffsets_: shiftOffsets,
    });
  }

  // Same as split above, except can be used when the command wrapper indices are known.
  // This method specifically only handles one t value (since multi-spliting involves
  // recalculating shift indices in weird ways).
  private splitCommandWrapper(cwsIdx: number, cwIdx: number, t: number) {
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(cwsIdx, cwIdx, 1);
    const targetCw = this.commandWrappers_[cwsIdx][cwIdx];
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(cwsIdx, cwIdx, targetCw.split([t])),
      shiftOffsets_: shiftOffsets,
    });
  }

  // If 0 <= cwIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same drawIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private maybeUpdateShiftOffsetsAfterSplit(
    cwsIdx: number, cwIdx: number, numSplits: number) {

    const shiftOffsets = this.shiftOffsets_.slice();
    const shiftOffset = shiftOffsets[cwsIdx];
    if (shiftOffset && cwIdx <= shiftOffset) {
      shiftOffsets[cwsIdx] = shiftOffset + numSplits;
    }
    return shiftOffsets;
  }

  // Implements the PathCommand interface.
  unsplit(subIdx: number, drawIdx: number) {
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, drawIdx);
    const newCw =
      targetCw.unsplitAtIndex(this.reversals_[subIdx] ? splitIdx - 1 : splitIdx);
    const shiftOffsets_ = this.shiftOffsets_.slice();
    const shiftOffset = this.shiftOffsets_[subIdx];
    if (shiftOffset && cwIdx <= shiftOffset) {
      shiftOffsets_[subIdx] = shiftOffset - 1;
    }
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
      shiftOffsets_,
    });
  }

  // Implements the PathCommand interface.
  convert(subIdx: number, drawIdx: number, svgChar: SvgChar): PathCommand {
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, drawIdx);
    const newCw = targetCw.convertAtIndex(splitIdx, svgChar);
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
    });
  }

  private findCommandWrapper(subIdx: number, drawIdx: number) {
    const numCommands = this.subPathCommands_[subIdx].commands.length;
    if (drawIdx && this.reversals_[subIdx]) {
      drawIdx = numCommands - drawIdx;
    }
    drawIdx += this.shiftOffsets_[subIdx];
    if (drawIdx >= numCommands) {
      drawIdx -= (numCommands - 1);
    }
    let counter = 0, cwIdx = 0;
    for (const targetCw of this.commandWrappers_[subIdx]) {
      if (counter + targetCw.commands.length > drawIdx) {
        const splitIdx = drawIdx - counter;
        return { targetCw, cwIdx, splitIdx };
      }
      counter += targetCw.commands.length;
      cwIdx++;
    }
    throw new Error('Error retrieving command wrapper');
  }

  private replaceCommandWrapper(cwsIdx: number, cwIdx: number, cw: CommandWrapper) {
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[cwsIdx][cwIdx] = cw;
    return newCws;
  }
}

/**
 * Contains additional information about each individual draw command so that we can
 * remember how they should be projected onto and split/unsplit/converted at runtime.
 * PathCommands are immutable, stateless objects that depend on CommandWrappers to
 * remember their state.
 */
class CommandWrapper {

  private readonly backingCommand: CommandImpl;
  private readonly pathHelper: PathHelper;

  // A command wrapper wraps around the initial SVG draw command and outputs
  // a list of transformed draw commands resulting from splits, unsplits,
  // conversions, etc. If the initial SVG draw command hasn't been modified,
  // then a list containing the initial SVG draw command is returned.
  private readonly drawCommands: ReadonlyArray<CommandImpl>;

  // The list of mutations describes how the initial backing draw command
  // has since been modified. Since the command wrapper always holds a
  // reference to its initial backing draw command, these modifications
  // are always reversible.
  private readonly mutations: ReadonlyArray<Mutation>;

  constructor(obj: CommandImpl | ClonedCommandWrapperInfo) {
    if (obj instanceof CommandImpl) {
      this.backingCommand = obj;
      this.pathHelper = drawCommandToPathHelper(obj);
      this.mutations = [{
        id: _.uniqueId(),
        t: 1,
        svgChar: this.backingCommand.svgChar,
      }];
      this.drawCommands = [obj];
    } else {
      this.backingCommand = obj.backingCommand;
      this.pathHelper = obj.pathHelper;
      this.mutations = obj.mutations;
      this.drawCommands = obj.drawCommands.slice();
    }
  }

  private clone(overrides: ClonedCommandWrapperInfo = {}) {
    return new CommandWrapper(_.assign({}, {
      backingCommand: this.backingCommand,
      pathHelper: this.pathHelper,
      mutations: this.mutations.slice(),
      drawCommands: this.drawCommands,
    }, overrides));
  }

  // Note that the projection is performed in relation to the command wrapper's
  // original backing draw command.
  project(point: Point): Projection | undefined {
    return this.pathHelper ? this.pathHelper.project(point) : undefined;
  }

  // Note that the split is performed in relation to the command wrapper's
  // original backing draw command.
  split(ts: number[]) {
    // TODO: add a test for splitting a command with a path length of 0
    // TODO: add a test for the case when t === 1
    if (!ts.length || !this.pathHelper) {
      return this;
    }
    if (this.backingCommand.svgChar === 'A') {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    const currSplits = this.mutations.map(m => m.t);
    const currSvgChars = this.mutations.map(m => m.svgChar);
    const updatedMutations = this.mutations.slice();
    for (const t of ts) {
      const currIdx = _.sortedIndex(currSplits, t);
      const id = _.uniqueId();
      // TODO: what about if the last command is a Z? then we want the svg char to be L!!
      const svgChar = currSvgChars[currIdx];
      const mutation = { id, t, svgChar };
      const insertionIdx =
        _.sortedIndexBy<Mutation>(updatedMutations, mutation, m => m.t);
      updatedMutations.splice(insertionIdx, 0, { id, t, svgChar });
    }
    return this.rebuildCommands(updatedMutations);
  }

  // Each draw command is given a globally unique ID (to improve performance
  // inside *ngFor loops, etc.).
  getIdAtIndex(splitIdx: number) {
    return this.mutations[splitIdx].id;
  }

  splitAtIndex(splitIdx: number, ts: number[]) {
    const currSplits = this.mutations.map(m => m.t);
    const tempSplits = [0, ...currSplits];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    return this.split(ts.map(t => MathUtil.lerp(startSplit, endSplit, t)));
  }

  splitInHalfAtIndex(splitIdx: number) {
    const currSplits = this.mutations.map(m => m.t);
    const tempSplits = [0, ...currSplits];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    const distance = MathUtil.lerp(startSplit, endSplit, 0.5);
    return this.split([this.pathHelper.findTimeByDistance(distance)]);
  }

  unsplitAtIndex(splitIdx: number) {
    const mutations = this.mutations.slice();
    mutations.splice(splitIdx, 1);
    return this.rebuildCommands(mutations);
  }

  convertAtIndex(splitIdx: number, svgChar: SvgChar) {
    const mutations = this.mutations.slice();
    mutations[splitIdx] = _.assign({}, mutations[splitIdx], { svgChar });
    return this.rebuildCommands(mutations);
  }

  // TODO: this could be more efficient (avoid recreating draw commands unnecessarily)
  private rebuildCommands(mutations: Mutation[]) {
    if (mutations.length === 1) {
      const drawCommands =
        [pointsToDrawCommand(mutations[0].svgChar, this.pathHelper.points, false)];
      return this.clone({ mutations, drawCommands });
    }
    const drawCommands = [];
    let prevT = 0;
    for (let i = 0; i < mutations.length; i++) {
      const currT = mutations[i].t;
      const splitPathHelper = this.pathHelper.split(prevT, currT);
      const isSplit = i !== mutations.length - 1;
      drawCommands.push(
        pointsToDrawCommand(mutations[i].svgChar, splitPathHelper.points, isSplit));
      prevT = currT;
    }
    return this.clone({ mutations, drawCommands });
  }

  get commands() {
    return this.drawCommands;
  }
}

// TODO: create multiple sub path cmds for svgs like 'M ... Z ... Z ... Z'
function createSubPathCommands(...drawCommands: Command[]) {
  if (!drawCommands.length) {
    return [];
  }
  const cmdGroups: Command[][] = [];
  let currentCmdList = [];
  for (let i = drawCommands.length - 1; i >= 0; i--) {
    const cmd = drawCommands[i];
    currentCmdList.push(cmd);
    if (cmd.svgChar === 'M') {
      cmdGroups.push(currentCmdList);
      currentCmdList = [];
    }
  }
  return cmdGroups.reverse().map(cmds => createSubPathCommand(...cmds.reverse()));
}

function createCommandWrappers(commands: ReadonlyArray<Command>) {
  if (commands.length && commands[0].svgChar !== 'M') {
    throw new Error('First command must be a move');
  }
  return commands.map(cmd => new CommandWrapper(cmd));
}

function pointsToDrawCommand(
  svgChar: SvgChar, points: ReadonlyArray<Point>, isSplit: boolean) {

  if (svgChar === 'L') {
    const start = points[0];
    const end = points[1] || start;
    return lineTo(start, end, isSplit);
  } else if (svgChar === 'Z') {
    const start = points[0];
    const end = points[1] || start;
    return closePath(start, end, isSplit);
  } else if (svgChar === 'Q') {
    const start = points[0];
    const cp = points[1] || start;
    const end = points[2] || cp;
    return quadraticCurveTo(start, cp, end, isSplit);
  } else if (svgChar === 'C') {
    const start = points[0];
    const cp1 = points[1] || start;
    const cp2 = points[2] || cp1;
    const end = points[3] || cp2;
    return bezierCurveTo(start, cp1, cp2, end, isSplit);
  } else {
    throw new Error('TODO: implement split for ellpitical arcs');
  }
}

function drawCommandToPathHelper(cmd: CommandImpl): PathHelper {
  if (cmd.svgChar === 'L' || cmd.svgChar === 'Z') {
    return createPathHelper(cmd.start, cmd.end);
  } else if (cmd.svgChar === 'C') {
    return createPathHelper(
      cmd.points[0], cmd.points[1], cmd.points[2], cmd.points[3]);
  } else if (cmd.svgChar === 'Q') {
    return createPathHelper(cmd.points[0], cmd.points[1], cmd.points[2]);
  } else if (cmd.svgChar === 'A') {
    // TODO: create an elliptical arc path helper
    throw new Error('Elliptical arcs not yet supported');

    // const [
    //   currentPointX, currentPointY,
    //   rx, ry, xAxisRotation,
    //   largeArcFlag, sweepFlag,
    //   endX, endY] = cmd.args;

    // if (currentPointX === endX && currentPointY === endY) {
    //   // Degenerate to point.
    //   return createPathHelper({ x: endX, y: endY });
    // }

    // if (rx === 0 || ry === 0) {
    //   // Degenerate to line.
    //   const start = cmd.start;
    //   const cp = new Point(
    //     MathUtil.lerp(cmd.end.x, cmd.start.x, 0.5),
    //     MathUtil.lerp(cmd.end.y, cmd.start.y, 0.5));
    //   const end = cmd.end;
    //   return createPathHelper(start, cp, cp, end);
    // }

    // const bezierCoords = SvgUtil.arcToBeziers({
    //   startX: currentPointX,
    //   startY: currentPointY,
    //   rx, ry, xAxisRotation,
    //   largeArcFlag, sweepFlag,
    //   endX, endY,
    // });

    // const arcBeziers: PathHelper[] = [];
    // for (let i = 0; i < bezierCoords.length; i += 8) {
    //   const bez = createPathHelper(
    //     { x: cmd.start.x, y: cmd.start.y },
    //     { x: bezierCoords[i + 2], y: bezierCoords[i + 3] },
    //     { x: bezierCoords[i + 4], y: bezierCoords[i + 5] },
    //     { x: bezierCoords[i + 6], y: bezierCoords[i + 7] });
    //   arcBeziers.push(bez);
    // }
    // return arcBeziers;
  }

  // throw new Error('Command type not supported: ' + cmd.svgChar);
  return undefined;
}

interface Mutation {
  readonly id: string;
  readonly t: number;
  readonly svgChar: SvgChar;
}

// Path command internals that have been cloned.
interface ClonedPathCommandInfo {
  drawCommands_?: ReadonlyArray<CommandImpl>;
  commandWrappers_?: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  shiftOffsets_?: ReadonlyArray<number>;
  reversals_?: ReadonlyArray<boolean>;
}

// Command wrapper internals that have been cloned.
interface ClonedCommandWrapperInfo {
  backingCommand?: CommandImpl;
  pathHelper?: PathHelper;
  mutations?: ReadonlyArray<Mutation>;
  drawCommands?: ReadonlyArray<CommandImpl>;
}

