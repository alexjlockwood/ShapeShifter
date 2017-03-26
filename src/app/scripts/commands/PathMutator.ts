import * as _ from 'lodash';
import { SvgChar, Command } from '.';
import { newCommand } from './CommandImpl';
import { PathImpl } from './PathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Matrix, Point } from '../common';
import { PathState } from './PathState';
import { SubPathState } from './SubPathState';

/**
 * A builder class for creating new mutated Path objects.
 */
export class PathMutator {
  private readonly subPathStateTree: SubPathState[];
  private readonly subPathOrdering: number[];
  private numCollapsingSubPaths: number;

  constructor(ps: PathState) {
    const cloneFn = (nodes: SubPathState[]) => {
      const newNodes: SubPathState[] = [];
      for (let i = 0; i < nodes.length; i++) {
        newNodes.push(
          nodes[i].mutate()
            .setSplitSubPaths(cloneFn(nodes[i].splitSubPaths.slice()))
            .build());
      }
      return newNodes;
    };
    this.subPathStateTree = cloneFn(ps.subPathStateTree.slice());
    this.subPathOrdering = ps.subPathOrdering.slice();
    this.numCollapsingSubPaths = ps.numCollapsingSubPaths;
  }

  private get subPathStates(): ReadonlyArray<SubPathState> {
    const subPathStates: SubPathState[] = [];
    const recurseFn = (states: ReadonlyArray<SubPathState>) => {
      states.forEach(state => {
        if (!state.isSplit()) {
          subPathStates.push(state);
          return;
        }
        recurseFn(state.splitSubPaths);
      });
    };
    recurseFn(this.subPathStateTree);
    return subPathStates;
  }

  private setSubPathState(newState: SubPathState, cmsIdx: number) {
    let counter = 0;
    const findNodeFn = (node: SubPathState) => {
      if (!node.isSplit()) {
        if (counter === cmsIdx) {
          counter++;
          return newState;
        }
        counter++;
        return node;
      }
      for (let i = 0; i < node.splitSubPaths.length; i++) {
        const n = findNodeFn(node.splitSubPaths[i]);
        if (n) {
          const splitSubPaths = node.splitSubPaths.slice();
          splitSubPaths[i] = n;
          return node.mutate().setSplitSubPaths(splitSubPaths).build();
        }
      }
      return node;
    };
    this.subPathStateTree.forEach((state, i) => {
      this.subPathStateTree[i] = findNodeFn(state);
    })
  }

  /**
   * Reverses the order of the points in the sub path at the specified index.
   */
  reverseSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    this.setSubPathState(this.subPathStates[cmsIdx].mutate().reverse().build(), cmsIdx);
    return this;
  }

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   */
  shiftSubPathBack(subIdx: number, numShifts = 1) {
    return this.subPathStates[this.subPathOrdering[subIdx]].isReversed
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   */
  shiftSubPathForward(subIdx: number, numShifts = 1) {
    const sps = this.subPathStates[this.subPathOrdering[subIdx]];
    return sps.isReversed
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  private shift(subIdx: number, calcOffsetFn: (offset: number, numCommands: number) => number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const sps = this.subPathStates[cmsIdx];
    const numCommandsInSubPath =
      _.sum(sps.commandStates.map(cm => cm.getCommands().length));
    if (numCommandsInSubPath <= 1) {
      // TODO: also return here if the sub path is closed just to be safe?
      return this;
    }
    this.setSubPathState(
      sps.mutate()
        .setShiftOffset(calcOffsetFn(sps.shiftOffset, numCommandsInSubPath))
        .build(),
      cmsIdx);
    return this;
  }

  /**
   * Splits the command using the specified t values.
   */
  splitCommand(subIdx: number, cmdIdx: number, ...ts: number[]) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      this.findCommandStateInfo(subIdx, cmdIdx);
    const shiftOffset = this.getUpdatedShiftOffsetsAfterSplit(cmsIdx, cmIdx, ts.length);
    this.setSubPathState(
      this.subPathStates[cmsIdx].mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(targetCm.mutate().splitAtIndex(splitIdx, ts).build(), cmIdx)
        .build(),
      cmsIdx);
    return this;
  }

  /**
   * Splits the command into two approximately equal parts.
   */
  splitCommandInHalf(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
    const shiftOffset = this.getUpdatedShiftOffsetsAfterSplit(cmsIdx, cmIdx, 1);
    this.setSubPathState(
      this.subPathStates[cmsIdx].mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(targetCm.mutate().splitInHalfAtIndex(splitIdx).build(), cmIdx)
        .build(),
      cmsIdx);
    return this;
  }

  // If 0 <= cmIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private getUpdatedShiftOffsetsAfterSplit(cmsIdx: number, cmIdx: number, numSplits: number) {
    const sps = this.subPathStates[cmsIdx];
    if (sps.shiftOffset && cmIdx <= sps.shiftOffset) {
      return sps.shiftOffset + numSplits;
    }
    return sps.shiftOffset;
  }

  /**
   * Un-splits the path at the specified index. Returns a new path object.
   */
  unsplitCommand(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
    const isSubPathReversed = this.subPathStates[cmsIdx].isReversed;
    this.setSubPathState(
      this.subPathStates[cmsIdx].mutate()
        .setCommandState(targetCm.mutate()
          .unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx)
          .build(), cmIdx)
        .build(),
      cmsIdx);
    const shiftOffset = this.subPathStates[cmsIdx].shiftOffset;
    if (shiftOffset && cmIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      this.setSubPathState(
        this.subPathStates[cmsIdx].mutate()
          .setShiftOffset(shiftOffset - 1)
          .build(),
        cmsIdx);
    }
    return this;
  }

  /**
   * Convert the path at the specified index. Returns a new path object.
   */
  convertCommand(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
    this.setSubPathState(
      this.subPathStates[cmsIdx].mutate()
        .setCommandState(targetCm.mutate()
          .convertAtIndex(splitIdx, svgChar)
          .build(), cmIdx)
        .build(),
      cmsIdx);
    return this;
  }

  /**
   * Reverts any conversions previously performed in the specified sub path.
   */
  unconvertSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const sps = this.subPathStates[cmsIdx];
    const commandStates =
      sps.commandStates.map((cm, cmIdx) => {
        return cmIdx === 0 ? cm : cm.mutate().unconvertSubpath().build();
      });
    this.setSubPathState(sps.mutate().setCommandStates(commandStates).build(), cmsIdx);
    return this;
  }

  /**
   * Adds transforms on the path using the specified transformation matrices.
   */
  addTransforms(transforms: Matrix[]) {
    this.subPathStates.forEach((sps, cmsIdx) => {
      const commandStates = sps.commandStates.map(cm => {
        return cm.mutate().addTransforms(transforms).build();
      });
      this.setSubPathState(sps.mutate().setCommandStates(commandStates).build(), cmsIdx);
    });
    return this;
  }

  /**
   * Sets transforms on the path using the specified transformation matrices.
   */
  setTransforms(transforms: Matrix[]) {
    this.subPathStates.forEach((sps, cmsIdx) => {
      const commandStates = sps.commandStates.map(cm => {
        return cm.mutate().setTransforms(transforms).build();
      });
      this.setSubPathState(sps.mutate().setCommandStates(commandStates).build(), cmsIdx);
    });
    return this;
  }

  /**
   * Moves a subpath from one index to another. Returns a new path object.
   */
  moveSubPath(fromSubIdx: number, toSubIdx: number) {
    this.subPathOrdering.splice(toSubIdx, 0, this.subPathOrdering.splice(fromSubIdx, 1)[0]);
    return this;
  }

  /**
   * Splits a stroked sub path using the specified indices.
   */
  splitStrokedSubPath(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
    const startCmds: CommandState[] = [];
    const endCmds: CommandState[] = [];
    const commandStates = this.subPathStates[cmsIdx].commandStates;
    for (let i = 0; i < commandStates.length; i++) {
      const commands = commandStates[i].getCommands();
      if (i < cmIdx) {
        startCmds.push(commandStates[i]);
      } else if (i > cmIdx) {
        endCmds.push(commandStates[i]);
      } else {
        for (let j = 0; j < commands.length; j++) {
          // TODO: preserve the old command state so that command splits are remembered?
          if (j < splitIdx) {
            startCmds.push(new CommandState(commands[j]));
          } else if (j > splitIdx) {
            endCmds.push(new CommandState(commands[j]));
          } else {
            startCmds.push(new CommandState(commands[j]));
            endCmds.push(
              new CommandState(newCommand('M', [commands[j].getEnd(), commands[j].getEnd()])));
          }
        }
      }
    }
    const splitSubPaths = [new SubPathState(startCmds), new SubPathState(endCmds)];
    console.info(this.subPathStateTree);
    console.info(this.subPathStates);
    this.setSubPathState(
      this.subPathStates[cmsIdx].mutate()
        .setSplitSubPaths(splitSubPaths)
        .build(),
      cmsIdx);
    // TODO: figure out what to do with this...
    this.subPathOrdering.push(this.subPathOrdering.length);
    console.info(this.subPathStateTree);
    console.info(this.subPathStates);
    return this;
  }

  /**
   * Splits a filled sub path using the specified indices.
   */
  splitFilledSubPath(
    subIdx: number,
    start: { cmdIdx: number, t: number },
    end: { cmdIdx: number, t: number }) {

    return this;
  }

  unsplitSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    let counter = 0;
    const recurseFn = (grandParent: SubPathState, splitState: SubPathState) => {
      if (!splitState.splitSubPaths.length) {
        if (counter === cmsIdx) {
          counter++;
          return;
        }
        counter++;
        return;
      }
      for (let i = 0; i < grandParent.splitSubPaths.length; i++) {
        for (let j = 0; j < grandParent.splitSubPaths[i].splitSubPaths.length; j++) {
          recurseFn(
            grandParent.splitSubPaths[i],
            grandParent.splitSubPaths[i].splitSubPaths[j]);
        }
      }
    };
    this.subPathStateTree.forEach(state => {
      state.splitSubPaths.forEach(s => {
        recurseFn(state, s);
      });
    })
    return this;
  }

  /**
   * Adds a collapsing subpath to the path.
   */
  addCollapsingSubPath(point: Point, numCommands: number) {
    const numSubPathsBeforeAdd = this.subPathStates.length;
    const prevSubPath = _.last(this.subPathStates[numSubPathsBeforeAdd - 1].toSubPaths());
    const prevCmd = _.last(prevSubPath.getCommands());
    const cms: CommandState[] =
      [new CommandState(newCommand('M', [prevCmd.getEnd(), point]))];
    for (let i = 1; i < numCommands; i++) {
      cms.push(new CommandState(newCommand('L', [point, point])));
    }
    this.subPathStateTree.push(new SubPathState(cms));
    this.subPathOrdering.push(numSubPathsBeforeAdd);
    this.numCollapsingSubPaths++;
    return this;
  }

  /**
   * Deletes all collapsing subpaths from the path.
   */
  deleteCollapsingSubPaths() {
    const numSubPathsBeforeDelete = this.subPathStates.length;
    const cmsIdxToSubIdxMap: number[] = [];
    const toSubIdxFn = (cmsIdx: number) => {
      for (let subIdx = 0; subIdx < this.subPathOrdering.length; subIdx++) {
        if (this.subPathOrdering[subIdx] === cmsIdx) {
          return subIdx;
        }
      }
      throw new Error('Invalid cmsIdx: ' + cmsIdx);
    };
    for (let cmsIdx = 0; cmsIdx < numSubPathsBeforeDelete; cmsIdx++) {
      cmsIdxToSubIdxMap.push(toSubIdxFn(cmsIdx));
    }
    const numCollapsingSubPathsBeforeDelete = this.numCollapsingSubPaths;
    const numSubPathsAfterDelete =
      numSubPathsBeforeDelete - numCollapsingSubPathsBeforeDelete;
    function deleteCollapsingSubPathInfoFn<T>(arr: T[]) {
      arr.splice(numSubPathsAfterDelete, numCollapsingSubPathsBeforeDelete);
    }
    deleteCollapsingSubPathInfoFn(this.subPathStateTree);
    deleteCollapsingSubPathInfoFn(cmsIdxToSubIdxMap);
    this.subPathOrdering.splice(0, this.subPathOrdering.length);
    for (let subIdx = 0; subIdx < numSubPathsBeforeDelete; subIdx++) {
      for (let i = 0; i < cmsIdxToSubIdxMap.length; i++) {
        if (cmsIdxToSubIdxMap[i] === subIdx) {
          this.subPathOrdering.push(i);
          break;
        }
      }
    }
    this.numCollapsingSubPaths = 0;
    return this;
  }

  /**
   * Returns the initial starting state of this path.
   */
  revert() {
    this.deleteCollapsingSubPaths();
    this.subPathStateTree.forEach((sps, i) => {
      this.subPathStateTree[i] = sps.mutate().revert().build();
    });
    this.subPathOrdering.forEach((_, i) => this.subPathOrdering[i] = i);
    return this;
  }

  /**
   * Builds a new mutated path.
   */
  build() {
    const subPathStates = this.subPathStates;
    const subPathOrdering = this.subPathOrdering;
    const numCollapsingSubPaths = this.numCollapsingSubPaths;

    const subPathCmds = subPathStates.map(sps => {
      return _.flatMap(sps.toSubPaths(), subPath => subPath.getCommands() as Command[]);
    });
    const reorderedSubPathCmds: Command[][] = [];
    for (let i = 0; i < subPathOrdering.length; i++) {
      reorderedSubPathCmds.push(subPathCmds[subPathOrdering[i]]);
    }
    const reorderedCommands: Command[] = _.flatMap(reorderedSubPathCmds, cmds => cmds);
    reorderedCommands.forEach((cmd, i) => {
      if (i === 0) {
        if (cmd.getStart()) {
          reorderedCommands[i] =
            cmd.mutate().setPoints(undefined, cmd.getEnd()).build();
        }
      } else {
        const pts = cmd.getPoints().slice();
        pts[0] = reorderedCommands[i - 1].getEnd();
        reorderedCommands[i] = cmd.mutate().setPoints(...pts).build();
      }
    });
    return new PathImpl(
      new PathState(
        reorderedCommands,
        subPathStates,
        subPathOrdering,
        numCollapsingSubPaths,
      ));
  }

  private findCommandStateInfo(subIdx: number, cmdIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const subPathCms = this.subPathStates[cmsIdx].commandStates;
    const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
    if (cmdIdx && this.subPathStates[cmsIdx].isReversed) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += this.subPathStates[cmsIdx].shiftOffset;
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting (numCommandsInSubPath - 1) is intentional here
      // (as opposed to subtracting numCommandsInSubPath).
      cmdIdx -= numCommandsInSubPath - 1;
    }
    let counter = 0;
    let cmIdx = 0;
    for (const targetCm of subPathCms) {
      if (counter + targetCm.getCommands().length > cmdIdx) {
        return { targetCm, cmsIdx, cmIdx, splitIdx: cmdIdx - counter };
      }
      counter += targetCm.getCommands().length;
      cmIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }
}
