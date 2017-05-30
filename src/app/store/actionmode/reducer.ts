import { CanvasType } from '../..';
import { AutoAwesome } from '../../scripts/algorithms';
import { PathAnimationBlock } from '../../scripts/animations';
import { Path } from '../../scripts/paths';
import { State } from '../reducer';
import { SelectionType } from '../shapeshifter';
import * as actions from './actions';
import { Action, ActionReducer } from '@ngrx/store';
import * as _ from 'lodash';

// Meta-reducer that intercepts action mode actions and modifies any corresponding state.
export function wrapActionMode(reducer: ActionReducer<State>): ActionReducer<State> {
  return (state: State, action: actions.Actions) => {
    switch (action.type) {
      case actions.REVERSE_SELECTED_SUBPATHS: {
        console.info('reverse selected subpaths before', state);
        const selections = getSubPathSelections(state);
        const { source } = selections[0];
        const activePathBlock = getActivePathBlock(state);
        const activePath =
          source === CanvasType.Start
            ? activePathBlock.fromValue : activePathBlock.toValue;
        const pathMutator = activePath.mutate();
        for (const { subIdx } of selections) {
          pathMutator.reverseSubPath(subIdx);
        }
        const newActivePath = pathMutator.build();
        state = updateActivePathBlock(state, source, newActivePath);
        state = clearHover(state);
        console.info('reverse selected subpaths after', state);
        console.info('path', activePath, newActivePath);
        break;
      }
      case actions.SHIFT_BACK_SELECTED_SUBPATHS: {
        // const selections = this.selectionService.getSubPathSelections();
        // const { source } = selections[0];
        // const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
        // for (const { subIdx } of this.selectionService.getSubPathSelections()) {
        //   pathMutator.shiftSubPathBack(subIdx);
        // }
        // this.stateService.updateActivePath(source, pathMutator.build());
        // this.hoverService.resetAndNotify();
        break;
      }
      case actions.SHIFT_FORWARD_SELECTED_SUBPATHS: {
        // const selections = this.selectionService.getSubPathSelections();
        // const { source } = selections[0];
        // const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
        // for (const { subIdx } of this.selectionService.getSubPathSelections()) {
        //   pathMutator.shiftSubPathForward(subIdx);
        // }
        // this.stateService.updateActivePath(source, pathMutator.build());
        // this.hoverService.resetAndNotify();
        break;
      }
      case actions.DELETE_SELECTED_SUBPATHS: {
        // // TODO: support deleting multiple subpaths at a time?
        // const selections = this.selectionService.getSubPathSelections();
        // if (!selections.length) {
        //   return;
        // }
        // // Preconditions: all selections exist in the same canvas.
        // const { source, subIdx } = selections[0];
        // const activePathLayer = this.stateService.getActivePathLayer(source);
        // this.selectionService.resetAndNotify();
        // this.hoverService.resetAndNotify();
        // const mutator = activePathLayer.pathData.mutate();
        // if (activePathLayer.isStroked()) {
        //   mutator.deleteStrokedSubPath(subIdx);
        // } else if (activePathLayer.isFilled()) {
        //   mutator.deleteFilledSubPath(subIdx);
        // }
        // this.stateService.updateActivePath(source, mutator.build());
        break;
      }
      case actions.DELETE_SELECTED_SEGMENTS: {
        // // TODO: support deleting multiple segments at a time?
        // const selections = this.selectionService.getSelections();
        // if (!selections.length) {
        //   return;
        // }
        // // Preconditions: all selections exist in the same canvas.
        // const { source, subIdx, cmdIdx } = selections[0];
        // const activePathLayer = this.stateService.getActivePathLayer(source);
        // this.selectionService.resetAndNotify();
        // this.hoverService.resetAndNotify();
        // const mutator = activePathLayer.pathData.mutate();
        // mutator.deleteFilledSubPathSegment(subIdx, cmdIdx);
        // this.stateService.updateActivePath(source, mutator.build());
        break;
      }
      case actions.DELETE_SELECTED_POINTS: {
        //   const selections = this.selectionService.getPointSelections();
        //   if (!selections.length) {
        //     return;
        //   }
        //   // Preconditions: all selections exist in the same canvas.
        //   const canvasType = selections[0].source;
        //   const activePathLayer = this.stateService.getActivePathLayer(canvasType);
        //   const unsplitOpsMap: Map<number, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
        //   for (const selection of selections) {
        //     const { subIdx, cmdIdx } = selection;
        //     if (!activePathLayer.pathData.getCommand(subIdx, cmdIdx).isSplitPoint()) {
        //       continue;
        //     }
        //     let subIdxOps = unsplitOpsMap.get(subIdx);
        //     if (!subIdxOps) {
        //       subIdxOps = [];
        //     }
        //     subIdxOps.push({ subIdx, cmdIdx });
        //     unsplitOpsMap.set(subIdx, subIdxOps);
        //   }
        //   this.selectionService.resetAndNotify();
        //   this.hoverService.resetAndNotify();
        //   const mutator = activePathLayer.pathData.mutate();
        //   unsplitOpsMap.forEach((ops, idx) => {
        //     PathUtil.sortPathOps(ops);
        //     for (const op of ops) {
        //       mutator.unsplitCommand(op.subIdx, op.cmdIdx);
        //     }
        //   });
        //   this.stateService.updateActivePath(canvasType, mutator.build());
        break;
      }
      case actions.SHIFT_POINT_TO_FRONT: {
        // const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
        // const activePath = this.stateService.getActivePathLayer(source).pathData;
        // this.stateService.updateActivePath(
        //   source,
        //   activePath.mutate()
        //     .shiftSubPathForward(subIdx, cmdIdx)
        //     .build());
        break;
      }
      case actions.SPLIT_COMMAND_IN_HALF_HOVER: {
        // const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
        // if (isHovering) {
        //   this.hoverService.setHoverAndNotify({
        //     source, subIdx, cmdIdx, type: HoverType.Split,
        //   });
        // } else {
        //   this.hoverService.resetAndNotify();
        // }
        break;
      }
      case actions.SPLIT_COMMAND_IN_HALF_CLICK: {
        // const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
        // const activePath = this.stateService.getActivePathLayer(source).pathData;
        // this.stateService.updateActivePath(
        //   source,
        //   activePath.mutate()
        //     .splitCommandInHalf(subIdx, cmdIdx)
        //     .build());
        // this.selectionService.resetAndNotify();
        break;
      }

      // Update a path animation block in shape shifter mode.
      case actions.UPDATE_ACTIVE_PATH_BLOCK: {
        const { source, path } = action.payload;
        state = updateActivePathBlock(state, source, path);
        break;
      }
    }
    return reducer(state, action)
  };
}

function getActivePathBlock(state: State) {
  const { blockId } = state.shapeshifter;
  const { timeline } = state.aia;
  const animations = timeline.animations.slice();
  const { activeAnimationId } = timeline;
  const activeAnimationIndex = _.findIndex(animations, a => a.id === activeAnimationId);
  const activeAnimation = animations[activeAnimationIndex];
  const activeAnimationBlocks = activeAnimation.blocks.slice();
  const blockIndex = _.findIndex(activeAnimationBlocks, b => b.id === blockId);
  return activeAnimationBlocks[blockIndex] as PathAnimationBlock;
}

function getSubPathSelections(state: State) {
  return state.shapeshifter.selections.filter(s => s.type === SelectionType.SubPath);
}

function updateActivePathBlock(
  state: State,
  source: CanvasType,
  path: Path,
) {
  const { blockId } = state.shapeshifter;
  const { timeline } = state.aia;
  const animations = timeline.animations.slice();
  const { activeAnimationId } = timeline;
  const activeAnimationIndex = _.findIndex(animations, a => a.id === activeAnimationId);
  let activeAnimation = animations[activeAnimationIndex];
  const activeAnimationBlocks = activeAnimation.blocks.slice();
  const blockIndex = _.findIndex(activeAnimationBlocks, b => b.id === blockId);
  let block = activeAnimationBlocks[blockIndex];

  // Remove any existing conversions and collapsing sub paths from the path.
  const pathMutator = path.mutate();
  path.getSubPaths().forEach((_, subIdx) => {
    pathMutator.unconvertSubPath(subIdx);
  });
  path = pathMutator.deleteCollapsingSubPaths().build();

  const getBlockPathFn = (t: CanvasType) => {
    return t === CanvasType.Start ? block.fromValue : block.toValue;
  };
  const setBlockPathFn = (t: CanvasType, p: Path) => {
    block = block.clone();
    if (t === CanvasType.Start) {
      block.fromValue = p;
    } else {
      block.toValue = p;
    }
  };

  const oppSource = source === CanvasType.Start ? CanvasType.End : CanvasType.Start;
  let oppPath = getBlockPathFn(oppSource);
  if (oppPath) {
    oppPath = oppPath.mutate().deleteCollapsingSubPaths().build();
    const numSubPaths = path.getSubPaths().length;
    const numOppSubPaths = oppPath.getSubPaths().length;
    if (numSubPaths !== numOppSubPaths) {
      const pathToChange = numSubPaths < numOppSubPaths ? path : oppPath;
      const oppPathToChange = numSubPaths < numOppSubPaths ? oppPath : path;
      const minIdx = Math.min(numSubPaths, numOppSubPaths);
      const maxIdx = Math.max(numSubPaths, numOppSubPaths);
      const mutator = pathToChange.mutate();
      for (let i = minIdx; i < maxIdx; i++) {
        // TODO: allow the user to specify the location of collapsing paths?
        const pole = oppPathToChange.getPoleOfInaccessibility(i);
        mutator.addCollapsingSubPath(
          pole, oppPathToChange.getSubPaths()[i].getCommands().length);
      }
      if (numSubPaths < numOppSubPaths) {
        path = mutator.build();
      } else {
        oppPath = mutator.build();
      }
    }
    for (let subIdx = 0; subIdx < Math.max(numSubPaths, numOppSubPaths); subIdx++) {
      const numCmds = path.getSubPaths()[subIdx].getCommands().length;
      const numOppCommands = oppPath.getSubPaths()[subIdx].getCommands().length;
      if (numCmds === numOppCommands) {
        // Only auto convert when the number of commands in both canvases
        // are equal. Otherwise we'll wait for the user to add more points.
        const autoConvertResults = AutoAwesome.autoConvert(
          subIdx,
          path,
          oppPath.mutate().unconvertSubPath(subIdx).build(),
        );
        path = autoConvertResults.from;

        // This is the one case where a change in one canvas type's vector layer
        // will cause corresponding changes to be made in the opposite canvas type's
        // vector layer.
        oppPath = autoConvertResults.to;
      }
    }
  }
  setBlockPathFn(source, path);
  setBlockPathFn(oppSource, oppPath);

  activeAnimationBlocks[blockIndex] = block;
  activeAnimation = activeAnimation.clone();
  activeAnimation.blocks = activeAnimationBlocks;
  animations[activeAnimationIndex] = activeAnimation;
  const { aia } = state;
  return { ...state, aia: { ...aia, animations } };
}

function clearHover(state: State) {
  const { shapeshifter } = state;
  return { ...state, shapeshifter: { ...shapeshifter, hover: undefined } };
}
