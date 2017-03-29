import * as _ from 'lodash';
import { SvgChar, Command } from '.';
import { newCommand } from './CommandImpl';
import { PathImpl } from './PathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Matrix, Point } from '../common';
import { PathState } from './PathState';
import {
  SubPathState,
  findSubPathState,
  countSubPathStates,
  flattenSubPathStates,
} from './SubPathState';

/**
 * A builder class for creating new mutated Path objects.
 */
export class PathMutator {
  private readonly subPathStateMap: SubPathState[];
  private readonly subPathOrdering: number[];
  private numCollapsingSubPaths: number;

  constructor(ps: PathState) {
    this.subPathStateMap = ps.subPathStateMap.slice();
    this.subPathOrdering = ps.subPathOrdering.slice();
    this.numCollapsingSubPaths = ps.numCollapsingSubPaths;
  }

  private findSubPathState(cmsIdx: number) {
    return findSubPathState(this.subPathStateMap, cmsIdx);
  }

  private setSubPathState(state: SubPathState, cmsIdx: number) {
    let counter = 0;
    const setStateFn = (node: SubPathState) => {
      if (!node.splitSubPaths.length) {
        return (counter++ === cmsIdx) ? state : node;
      }
      return node.mutate()
        .setSplitSubPaths(node.splitSubPaths.map(s => setStateFn(s)))
        .build();
    };
    this.subPathStateMap.forEach((s, i) => {
      this.subPathStateMap[i] = setStateFn(s);
    });
  }

  /**
   * Reverses the order of the points in the sub path at the specified index.
   */
  reverseSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    this.setSubPathState(
      this.findSubPathState(cmsIdx).mutate().reverse().build(), cmsIdx);
    return this;
  }

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   */
  shiftSubPathBack(subIdx: number, numShifts = 1) {
    const cmsIdx = this.subPathOrdering[subIdx];
    return this.findSubPathState(cmsIdx).isReversed
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   */
  shiftSubPathForward(subIdx: number, numShifts = 1) {
    const cmsIdx = this.subPathOrdering[subIdx];
    return this.findSubPathState(cmsIdx).isReversed
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  private shift(subIdx: number, calcOffsetFn: (offset: number, numCommands: number) => number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(cmsIdx);
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
    if (!ts.length) {
      throw new Error('Must specify at least one t value');
    }
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      this.findCommandStateInfo(subIdx, cmdIdx);
    const shiftOffset =
      this.getUpdatedShiftOffsetsAfterSplit(cmsIdx, cmIdx, ts.length);
    const sps = this.findSubPathState(cmsIdx);
    if (sps.isReversed) {
      // TODO: use minT/maxT?
      ts = ts.map(t => 1 - t);
    }
    this.setSubPathState(
      this.findSubPathState(cmsIdx).mutate()
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
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      this.findCommandStateInfo(subIdx, cmdIdx);
    const shiftOffset =
      this.getUpdatedShiftOffsetsAfterSplit(cmsIdx, cmIdx, 1);
    this.setSubPathState(
      this.findSubPathState(cmsIdx).mutate()
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
    const sps = this.findSubPathState(cmsIdx);
    if (sps.shiftOffset && cmIdx <= sps.shiftOffset) {
      return sps.shiftOffset + numSplits;
    }
    return sps.shiftOffset;
  }

  /**
   * Un-splits the path at the specified index. Returns a new path object.
   */
  unsplitCommand(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      this.findCommandStateInfo(subIdx, cmdIdx);
    const isSubPathReversed = this.findSubPathState(cmsIdx).isReversed;
    this.setSubPathState(
      this.findSubPathState(cmsIdx).mutate()
        .setCommandState(targetCm.mutate()
          .unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx)
          .build(), cmIdx)
        .build(),
      cmsIdx);
    const shiftOffset = this.findSubPathState(cmsIdx).shiftOffset;
    if (shiftOffset && cmIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      this.setSubPathState(
        this.findSubPathState(cmsIdx).mutate()
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
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      this.findCommandStateInfo(subIdx, cmdIdx);
    this.setSubPathState(
      this.findSubPathState(cmsIdx).mutate()
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
    const sps = this.findSubPathState(cmsIdx);
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
    const numSubPathStates = countSubPathStates(this.subPathStateMap);
    for (let cmsIdx = 0; cmsIdx < numSubPathStates; cmsIdx++) {
      const sps = this.findSubPathState(cmsIdx);
      this.setSubPathState(
        sps.mutate()
          .setCommandStates(sps.commandStates.map(cm => {
            return cm.mutate().addTransforms(transforms).build();
          }))
          .build(),
        cmsIdx);
    }
    return this;
  }

  /**
   * Sets transforms on the path using the specified transformation matrices.
   */
  setTransforms(transforms: Matrix[]) {
    const numSubPathStates = countSubPathStates(this.subPathStateMap);
    for (let cmsIdx = 0; cmsIdx < numSubPathStates; cmsIdx++) {
      const sps = this.findSubPathState(cmsIdx);
      this.setSubPathState(
        sps.mutate()
          .setCommandStates(sps.commandStates.map(cm => {
            return cm.mutate().setTransforms(transforms).build();
          }))
          .build(),
        cmsIdx);
    }
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
   * A 'moveTo' command will be inserted after the command at 'cmdIdx'.
   */
  // TODO: unsplittable state isn't getting reset after splits properly
  splitStrokedSubPath(subIdx: number, cmdIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(cmsIdx);
    let css = sps.commandStates;
    if (sps.isReversed) {
      const revCss = [
        new CommandState(
          newCommand('M', [
            css[0].getCommands()[0].getStart(),
            _.last(_.last(css).getCommands()).getEnd(),
          ])),
      ];
      for (let i = css.length - 1; i > 0; i--) {
        revCss.push(css[i].mutate().reverse().build());
      }
      css = revCss;
    }
    const startCommandStates: CommandState[] = [];
    const endCommandStates: CommandState[] = [];
    // const numCommandsInSubPath = _.sum(css.map(cs => cs.getCommands().length));
    // if (sps.isReversed) {
    //   cmdIdx = numCommandsInSubPath - cmdIdx;
    // }
    // cmdIdx += sps.shiftOffset;
    // if (cmdIdx >= numCommandsInSubPath) {
    //   // Note that subtracting (numCommandsInSubPath - 1) is intentional here
    //   // (as opposed to subtracting numCommandsInSubPath).
    //   cmdIdx -= numCommandsInSubPath - 1;
    // }
    const { cmIdx, splitIdx } = this.findCommandStateIndices(css, cmdIdx);
    for (let i = 0; i < css.length; i++) {
      if (i < cmIdx) {
        startCommandStates.push(css[i]);
      } else if (cmIdx < i) {
        endCommandStates.push(css[i]);
      } else {
        const splitPoint = css[i].getCommands()[splitIdx].getEnd();
        const { left, right } = css[i].fork(splitIdx);
        startCommandStates.push(left);
        let endMoveCs = new CommandState(newCommand('M', [splitPoint, splitPoint]));
        if (sps.isReversed) {
          endMoveCs = endMoveCs.mutate().reverse().build();
        }
        endCommandStates.push(endMoveCs);
        if (right.getCommands().length) {
          endCommandStates.push(right);
        }
      }
    }
    const splitSubPaths: SubPathState[] = [
      // TODO: should/could one of these sub paths share the same ID as the parent?
      new SubPathState(startCommandStates),
      new SubPathState(endCommandStates),
    ];
    this.setSubPathState(sps.mutate().setSplitSubPaths(splitSubPaths).build(), cmsIdx);
    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
   * Splits a filled sub path using the specified indices.
   */
  splitFilledSubPath(
    subIdx: number,
    start: { cmdIdx: number, t: number },
    end: { cmdIdx: number, t: number }) {

    // TODO: implement this
    return this;
  }

  // TODO: need to distinguish between stroked and filled sub paths here?
  // TODO: delete the initial split cmdIdx as well if one exists
  unsplitSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    let counter = 0;
    let updatedParentNode = undefined;
    for (const parent of this.subPathStateMap) {
      (function recurseFn(p: SubPathState) {
        for (let i = 0; i < p.splitSubPaths.length; i++) {
          const state = p.splitSubPaths[i];
          if (!state.splitSubPaths.length) {
            if (counter++ === cmsIdx) {
              const firstSplitSubPath = p.splitSubPaths[0];
              const splitCmdId =
                _.last(_.last(firstSplitSubPath.commandStates).getCommands()).getId();
              let csIdx = -1;
              let splitIdx = -1;
              for (csIdx = 0; csIdx < p.commandStates.length; csIdx++) {
                const cs = p.commandStates[csIdx];
                const csIds = cs.getCommands().map((_, idx) => cs.getIdAtIndex(idx));
                splitIdx = csIds.indexOf(splitCmdId);
                if (splitIdx >= 0) {
                  break;
                }
              }
              let unsplitCs = p.commandStates[csIdx];
              if (unsplitCs.isSplitAtIndex(splitIdx)) {
                unsplitCs = unsplitCs.mutate().unsplitAtIndex(splitIdx).build();
              }
              updatedParentNode =
                p.mutate()
                  .setSplitSubPaths([])
                  .setCommandState(unsplitCs, csIdx)
                  .build();
              return;
            }
            continue;
          }
          recurseFn(state);
        }
      })(parent);
      if (updatedParentNode) {
        const newSubPathStateMap =
          (function updateParentFn(states: SubPathState[]) {
            if (states.length === 0) {
              return undefined;
            }
            for (let i = 0; i < states.length; i++) {
              const state = states[i];
              if (state.id === updatedParentNode.id) {
                states[i] = updatedParentNode;
                return states;
              }
              const recurseStates = updateParentFn(state.splitSubPaths.slice());
              if (recurseStates) {
                states[i] =
                  states[i].mutate()
                    .setSplitSubPaths(recurseStates)
                    .build();
                return states;
              }
            }
            return undefined;
          })(this.subPathStateMap.slice());
        this.subPathStateMap.forEach((_, i) => this.subPathStateMap[i] = newSubPathStateMap[i]);
        break;
      }
    }
    this.subPathOrdering.splice(subIdx, 1);
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (cmsIdx < this.subPathOrdering[i]) {
        this.subPathOrdering[i]--;
      }
    }
    return this;
  }

  /**
   * Adds a collapsing subpath to the path.
   */
  addCollapsingSubPath(point: Point, numCommands: number) {
    const numSubPathsBeforeAdd = countSubPathStates(this.subPathStateMap);
    const prevSubPathCommands =
      _.last(this.findSubPathState(numSubPathsBeforeAdd - 1).toSubPathCommands());
    const prevCmd = _.last(prevSubPathCommands);
    const cms: CommandState[] =
      [new CommandState(newCommand('M', [prevCmd.getEnd(), point]))];
    for (let i = 1; i < numCommands; i++) {
      cms.push(new CommandState(newCommand('L', [point, point])));
    }
    this.subPathStateMap.push(new SubPathState(cms));
    this.subPathOrdering.push(numSubPathsBeforeAdd);
    this.numCollapsingSubPaths++;
    return this;
  }

  /**
   * Deletes all collapsing subpaths from the path.
   */
  deleteCollapsingSubPaths() {
    const numSubPathsBeforeDelete = countSubPathStates(this.subPathStateMap);
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
    for (let i = 0; i < numCollapsingSubPathsBeforeDelete; i++) {
      this.subPathStateMap.pop();
    }
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
    this.subPathStateMap.forEach((sps, i) => {
      this.subPathStateMap[i] = sps.revert();
    });
    this.subPathOrdering.splice(0, this.subPathOrdering.length);
    this.subPathStateMap.forEach((_, i) => this.subPathOrdering.push(i));
    return this;
  }

  /**
   * Builds a new mutated path.
   */
  build() {
    const subPathStates = flattenSubPathStates(this.subPathStateMap);
    const subPathOrdering = this.subPathOrdering;
    const numCollapsingSubPaths = this.numCollapsingSubPaths;

    const subPathCmds = subPathStates.map(sps => {
      return _.flatMap(sps.toSubPathCommands(), commands => commands);
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
        this.subPathStateMap,
        subPathOrdering,
        numCollapsingSubPaths,
      ));
  }

  private findCommandStateInfo(subIdx: number, cmdIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(cmsIdx);
    const subPathCms = sps.commandStates;
    const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
    if (cmdIdx && sps.isReversed) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += sps.shiftOffset;
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

  private findCommandStateIndices(css: ReadonlyArray<CommandState>, cmdIdx: number) {
    let counter = 0;
    let cmIdx = 0;
    for (const targetCm of css) {
      if (counter + targetCm.getCommands().length > cmdIdx) {
        return { cmIdx, splitIdx: cmdIdx - counter };
      }
      counter += targetCm.getCommands().length;
      cmIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }
}
