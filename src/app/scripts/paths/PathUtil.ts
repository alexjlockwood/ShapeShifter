import * as _ from 'lodash';
import {
  SelectionService,
  Selection,
  StateService,
} from '../../services';
import { newCommand } from './CommandImpl';
import { newPath } from './PathImpl';
import { Command, Path } from '.';
import { MathUtil, Point } from '../common';

/**
 * Interpolates between a start and end path using the specified fraction.
 *
 * TODO: make it possible to create 'stateless' paths (to save memory on animation frames).
 */
export function interpolate(start: Path, end: Path, fraction: number) {
  if (!start.isMorphableWith(end)) {
    throw new Error('Attempt to interpolate two unmorphable paths');
  }
  const newCommands: Command[] = [];
  start.getCommands().forEach((startCmd, i) => {
    const endCmd = end.getCommands()[i];
    const points: Point[] = [];
    for (let j = 0; j < startCmd.getPoints().length; j++) {
      const p1 = startCmd.getPoints()[j];
      const p2 = endCmd.getPoints()[j];
      if (p1 && p2) {
        // The 'start' point of the first Move command in a path
        // will be undefined. Skip it.
        const px = MathUtil.lerp(p1.x, p2.x, fraction);
        const py = MathUtil.lerp(p1.y, p2.y, fraction);
        points.push(new Point(px, py));
      } else {
        points.push(undefined);
      }
    }
    // TODO: avoid re-generating unique ids on each animation frame.
    newCommands.push(newCommand(startCmd.getSvgChar(), points));
  });
  return newPath(newCommands);
}

/**
 * Sorts a list of path ops in descending order.
 */
export function sortPathOps(ops: Array<{ subIdx: number, cmdIdx: number }>) {
  return ops.sort(
    ({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
      // Perform higher index splits first so that we don't alter the
      // indices of the lower index split operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });
}

/**
 * Deletes any currently selected split points.
 */
export function deleteSelectedSplitPoints(
  lss: StateService,
  sss: SelectionService) {

  const selections = sss.getSelections();
  if (!selections.length) {
    return;
  }
  // Preconditions: all selections exist in the same editor and
  // all selections correspond to the currently active path id.
  const canvasType = selections[0].source;
  const activePathLayer = lss.getActivePathLayer(canvasType);
  const unsplitOpsMap: Map<number, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
  for (const selection of selections) {
    const { subIdx, cmdIdx } = selection.index;
    if (!activePathLayer.pathData.getSubPaths()[subIdx].getCommands()[cmdIdx].isSplit()) {
      continue;
    }
    let subIdxOps = unsplitOpsMap.get(subIdx);
    if (!subIdxOps) {
      subIdxOps = [];
    }
    subIdxOps.push({ subIdx, cmdIdx });
    unsplitOpsMap.set(subIdx, subIdxOps);
  }
  sss.reset();
  const mutator = activePathLayer.pathData.mutate();
  unsplitOpsMap.forEach((ops, idx) => {
    // TODO: perform these as a single batch instead of inside a loop? (to reduce # of broadcasts)
    sortPathOps(ops);
    for (const op of ops) {
      mutator.unsplitCommand(op.subIdx, op.cmdIdx);
    }
  });
  lss.updateActivePath(canvasType, mutator.build());
}

/**
 * Calculates the number of selected points.
 */
export function getNumSelectedPoints(
  lss: StateService,
  selections: ReadonlyArray<Selection>,
  predicateFn = (cmd: Command) => true) {

  if (!selections.length) {
    return 0;
  }

  // Preconditions: all selections exist in the same editor and
  // all selections correspond to the currently active path id.
  const canvasType = selections[0].source;
  const activePath = lss.getActivePathLayer(canvasType).pathData;
  return _.sum(selections.map(s => {
    const { subIdx, cmdIdx } = s.index;
    const cmd = activePath.getSubPaths()[subIdx].getCommands()[cmdIdx];
    return predicateFn(cmd) ? 1 : 0;
  }));
}
