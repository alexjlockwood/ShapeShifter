import { ActionReducer } from '@ngrx/store';
import { ActionSource, Selection, SelectionType } from 'app/model/actionmode';
import { MorphableLayer } from 'app/model/layers';
import { Path, PathMutator, PathUtil } from 'app/model/paths';
import { PathAnimationBlock } from 'app/model/timeline';
import { AutoAwesome } from 'app/scripts/algorithms';
import { AppState } from 'app/store/reducer';
import * as _ from 'lodash';

import * as actions from './metaactions';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: actions.Actions) => {
    switch (action.type) {
      // Reverse all currently selected subpaths.
      case actions.REVERSE_SELECTED_SUBPATHS: {
        state = mutateSelectedSubPaths(state, (pm, subIdx) => pm.reverseSubPath(subIdx));
        break;
      }

      // Shift back all currently selected subpaths.
      case actions.SHIFT_BACK_SELECTED_SUBPATHS: {
        state = mutateSelectedSubPaths(state, (pm, subIdx) => pm.shiftSubPathBack(subIdx));
        break;
      }

      // Shift forward all currently selected subpaths.
      case actions.SHIFT_FORWARD_SELECTED_SUBPATHS: {
        state = mutateSelectedSubPaths(state, (pm, subIdx) => pm.shiftSubPathForward(subIdx));
        break;
      }

      // Delete all currently selected subpaths/segments/points.
      case actions.DELETE_ACTION_MODE_SELECTIONS: {
        state = deleteSelectedSubPaths(state);
        state = deleteSelectedSegments(state);
        state = deleteSelectedPoints(state);
        break;
      }

      // Shift point to the front of its subpath.
      case actions.SHIFT_POINT_TO_FRONT: {
        const { source, subIdx, cmdIdx } = getPointSelections(state)[0];
        const activePath = getActivePath(state, source);
        const pathMutator = activePath.mutate();
        pathMutator.shiftSubPathForward(subIdx, cmdIdx);
        state = updateActivePathBlock(state, source, pathMutator.build());
        break;
      }

      // Split the currently selected point.
      case actions.SPLIT_COMMAND_IN_HALF_CLICK: {
        const { source, subIdx, cmdIdx } = getPointSelections(state)[0];
        const activePath = getActivePath(state, source);
        const pathMutator = activePath.mutate();
        pathMutator.splitCommandInHalf(subIdx, cmdIdx);
        state = updateActivePathBlock(state, source, pathMutator.build());
        state = clearSelections(state);
        state = clearHover(state);
        break;
      }

      // Auto fix the currently active paths.
      case actions.AUTO_FIX_CLICK: {
        const { from, to } = AutoAwesome.autoFix(
          getActivePath(state, ActionSource.From),
          getActivePath(state, ActionSource.To),
        );
        state = updateActivePathBlock(state, ActionSource.From, from);
        state = updateActivePathBlock(state, ActionSource.To, to);
        break;
      }

      // Update a path animation block in action mode.
      case actions.UPDATE_ACTIVE_PATH_BLOCK: {
        const { source, path } = action.payload;
        state = updateActivePathBlock(state, source, path);
        break;
      }

      // Select a subpath in paired subpath action mode.
      case actions.PAIR_SUBPATH: {
        const { subIdx, source: actionSource } = action.payload;
        const { unpairedSubPath: currUnpair } = state.actionmode;
        if (currUnpair && actionSource !== currUnpair.source) {
          const { source: fromSource, subIdx: fromSubIdx } = currUnpair;
          const toSource = actionSource;
          const toSubIdx = subIdx;
          state = setUnpairedSubPath(state, undefined);
          const selections = state.actionmode.selections;
          const fromSelections = selections.filter(s => s.source === fromSource);
          const toSelections = selections.filter(s => s.source === toSource);
          if (fromSelections.length) {
            state = setSelections(
              state,
              fromSelections.map(s => {
                const { subIdx: sIdx, cmdIdx, source, type } = s;
                return {
                  subIdx: sIdx === fromSubIdx ? 0 : sIdx,
                  cmdIdx,
                  source,
                  type,
                };
              }),
            );
          } else if (toSelections.length) {
            state = setSelections(
              state,
              toSelections.map(s => {
                const { subIdx: sIdx, cmdIdx, source, type } = s;
                return {
                  subIdx: sIdx === toSubIdx ? 0 : sIdx,
                  cmdIdx,
                  source,
                  type,
                };
              }),
            );
          }
          const pairedSubPaths = new Set();
          state.actionmode.pairedSubPaths.forEach(p => pairedSubPaths.add(p));
          if (pairedSubPaths.has(fromSubIdx)) {
            pairedSubPaths.delete(fromSubIdx);
          }
          if (pairedSubPaths.has(toSubIdx)) {
            pairedSubPaths.delete(toSubIdx);
          }
          pairedSubPaths.add(pairedSubPaths.size);
          state = setPairedSubPaths(state, pairedSubPaths);
          state = clearHover(state);
          state = updateActivePathBlock(
            state,
            fromSource,
            getActivePath(state, fromSource).mutate().moveSubPath(fromSubIdx, 0).build(),
          );
          state = updateActivePathBlock(
            state,
            toSource,
            getActivePath(state, toSource).mutate().moveSubPath(toSubIdx, 0).build(),
          );
        } else {
          state = setUnpairedSubPath(state, { source: actionSource, subIdx });
        }
        break;
      }

      // Set the currently unpaired subpath in pair subpaths mode.
      case actions.SET_UNPAIRED_SUBPATH: {
        const { unpairedSubPath } = action.payload;
        state = setUnpairedSubPath(state, unpairedSubPath);
        break;
      }
    }
    return reducer(state, action);
  };
}

function getActivePathBlockId(state: AppState) {
  const { selectedBlockIds } = state.timeline;
  return selectedBlockIds.values().next().value;
}

function getActivePathBlock(state: AppState) {
  const blockId = getActivePathBlockId(state);
  const { blocks } = state.timeline.animation;
  return _.find(blocks, b => b.id === blockId) as PathAnimationBlock;
}

function getActivePathBlockLayer(state: AppState) {
  const pathLayerId = getActivePathBlock(state).layerId;
  return state.layers.vectorLayer.findLayerById(pathLayerId) as MorphableLayer;
}

function getActivePath(state: AppState, source: ActionSource) {
  const block = getActivePathBlock(state);
  return source === ActionSource.From ? block.fromValue : block.toValue;
}

function getSubPathSelections(state: AppState) {
  return state.actionmode.selections.filter(s => s.type === SelectionType.SubPath);
}

function getSegmentSelections(state: AppState) {
  return state.actionmode.selections.filter(s => s.type === SelectionType.Segment);
}

function getPointSelections(state: AppState) {
  return state.actionmode.selections.filter(s => s.type === SelectionType.Point);
}

function mutateSelectedSubPaths(
  state: AppState,
  mutatorFn: (pm: PathMutator, subIdx: number) => void,
) {
  const selections = getSubPathSelections(state);
  const { source } = selections[0];
  const pathMutator = getActivePath(state, source).mutate();
  for (const { subIdx } of selections) {
    mutatorFn(pathMutator, subIdx);
  }
  state = updateActivePathBlock(state, source, pathMutator.build());
  state = clearHover(state);
  return state;
}

function updateActivePathBlock(state: AppState, source: ActionSource, path: Path) {
  const blockId = state.timeline.selectedBlockIds.values().next().value;
  const { timeline } = state;
  let { animation } = timeline;
  const blocks = [...animation.blocks];
  const blockIndex = _.findIndex(blocks, b => b.id === blockId);
  let block = blocks[blockIndex];

  // Remove any existing conversions and collapsing sub paths from the path.
  const pm = path.mutate();
  path.getSubPaths().forEach((unused, subIdx) => pm.unconvertSubPath(subIdx));
  path = pm.deleteCollapsingSubPaths().build();

  const getBlockPathFn = (t: ActionSource) => {
    return t === ActionSource.From ? block.fromValue : block.toValue;
  };
  const setBlockPathFn = (t: ActionSource, p: Path) => {
    block = block.clone();
    if (t === ActionSource.From) {
      block.fromValue = p;
    } else {
      block.toValue = p;
    }
  };

  const oppSource = source === ActionSource.From ? ActionSource.To : ActionSource.From;
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
        mutator.addCollapsingSubPath(pole, oppPathToChange.getSubPath(i).getCommands().length);
      }
      if (numSubPaths < numOppSubPaths) {
        path = mutator.build();
      } else {
        oppPath = mutator.build();
      }
    }
    for (let subIdx = 0; subIdx < Math.max(numSubPaths, numOppSubPaths); subIdx++) {
      const numCmds = path.getSubPath(subIdx).getCommands().length;
      const numOppCommands = oppPath.getSubPath(subIdx).getCommands().length;
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

  blocks[blockIndex] = block;
  animation = animation.clone();
  animation.blocks = blocks;
  return { ...state, timeline: { ...timeline, animation } };
}

function setSelections(state: AppState, selections: ReadonlyArray<Selection>) {
  const { actionmode } = state;
  return { ...state, actionmode: { ...actionmode, selections } };
}

function clearSelections(state: AppState) {
  return setSelections(state, []);
}

function clearHover(state: AppState) {
  const { actionmode } = state;
  return { ...state, actionmode: { ...actionmode, hover: undefined } };
}

function setPairedSubPaths(state: AppState, pairedSubPaths: Set<number>) {
  const { actionmode } = state;
  return { ...state, actionmode: { ...actionmode, pairedSubPaths } };
}

function setUnpairedSubPath(
  state: AppState,
  unpairedSubPath: { source: ActionSource; subIdx: number },
) {
  const { actionmode } = state;
  return { ...state, actionmode: { ...actionmode, unpairedSubPath } };
}

function deleteSelectedSubPaths(state: AppState) {
  // TODO: support deleting multiple segments at a time?
  const selections = getSubPathSelections(state);
  if (!selections.length) {
    return state;
  }
  // Precondition: all selections exist in the same canvas.
  const { source, subIdx } = selections[0];
  const pathMutator = getActivePath(state, source).mutate();
  const activePathLayer = getActivePathBlockLayer(state);
  if (activePathLayer.isStroked()) {
    pathMutator.deleteStrokedSubPath(subIdx);
  } else if (activePathLayer.isFilled()) {
    pathMutator.deleteFilledSubPath(subIdx);
  }
  state = updateActivePathBlock(state, source, pathMutator.build());
  state = clearSelections(state);
  state = clearHover(state);
  return state;
}

function deleteSelectedSegments(state: AppState) {
  // TODO: support deleting multiple segments at a time?
  const selections = getSegmentSelections(state);
  if (!selections.length) {
    return state;
  }
  // Precondition: all selections exist in the same canvas.
  const { source, subIdx, cmdIdx } = selections[0];
  const mutator = getActivePath(state, source).mutate();
  mutator.deleteFilledSubPathSegment(subIdx, cmdIdx);
  state = updateActivePathBlock(state, source, mutator.build());
  state = clearSelections(state);
  state = clearHover(state);
  return state;
}

function deleteSelectedPoints(state: AppState) {
  const selections = getPointSelections(state);
  if (!selections.length) {
    return state;
  }
  // Precondition: all selections exist in the same canvas.
  const source = selections[0].source;
  const activePath = getActivePath(state, source);
  const unsplitOpsMap: Map<number, Array<{ subIdx: number; cmdIdx: number }>> = new Map();
  for (const selection of selections) {
    const { subIdx, cmdIdx } = selection;
    if (!activePath.getCommand(subIdx, cmdIdx).isSplitPoint()) {
      continue;
    }
    let subIdxOps = unsplitOpsMap.get(subIdx);
    if (!subIdxOps) {
      subIdxOps = [];
    }
    subIdxOps.push({ subIdx, cmdIdx });
    unsplitOpsMap.set(subIdx, subIdxOps);
  }
  const mutator = activePath.mutate();
  unsplitOpsMap.forEach((ops, idx) => {
    PathUtil.sortPathOps(ops);
    for (const op of ops) {
      mutator.unsplitCommand(op.subIdx, op.cmdIdx);
    }
  });
  state = updateActivePathBlock(state, source, mutator.build());
  state = clearSelections(state);
  state = clearHover(state);
  return state;
}
