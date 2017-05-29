export { Store } from '@ngrx/store';
export { AppMode, Hover, HoverType, Selection, SelectionType } from './aia/reducer';

import { environment } from '../../environments/environment';
import { PathAnimationBlock } from '../scripts/animations';
import { LayerUtil, PathLayer, VectorLayer } from '../scripts/layers';
import { Path } from '../scripts/paths';
import * as fromRoot from './reducer';
import { compose } from '@ngrx/core/compose';
import { combineReducers } from '@ngrx/store';
import { ActionReducer } from '@ngrx/store';
import * as _ from 'lodash';
import { storeFreeze } from 'ngrx-store-freeze';
import {
  createSelector,
  createSelectorCreator,
  createStructuredSelector,
  defaultMemoize,
} from 'reselect';

export interface State {
  root: fromRoot.State,
}

const reducers = { root: fromRoot.reducer };
const developmentReducer: ActionReducer<State> =
  compose(storeFreeze, combineReducers)(reducers);
const productionReducer: ActionReducer<State> = combineReducers(reducers);

export function reducer(state: any, action: any) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}

// Root actions.
export {
  NewWorkspace,
} from './actions';

// Android Icon Animator actions.
export {
  AddAnimations,
  SelectAnimation,
  ActivateAnimation,
  ReplaceAnimations,
  AddBlock,
  SelectBlock,
  ReplaceBlocks,
  UpdatePathBlock,
  ReplaceLayer,
  SelectLayer,
  ClearLayerSelections,
  ToggleLayerExpansion,
  ToggleLayerVisibility,
  AddLayers,
  DeleteSelectedModels,
} from './aia/actions';

// Playback actions.
export {
  SetIsSlowMotion,
  SetIsPlaying,
  SetIsRepeating,
  ToggleIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ResetPlaybackSettings,
} from './playback/actions';

// Shape Shifter actions.
export {
  SetAppMode,
  SetHover,
  SetSelections,
  ToggleSubPathSelection,
  ToggleSegmentSelections,
  TogglePointSelection,
} from './shapeshifter/actions';

// Selectors.
const createDeepEqualSelector =
  createSelectorCreator(defaultMemoize, _.isEqual);

const getRoot = (state: State) => state.root;

const getAiaState = createSelector(getRoot, root => root.aia);

// Timeline state selectors.
const getTimelineState = createSelector(getAiaState, s => s.timeline)
const getAnimations = createSelector(getTimelineState, t => t.animations);
const getSelectedAnimationIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedAnimationIds);
const getActiveAnimationId = createDeepEqualSelector(getTimelineState, t => t.activeAnimationId);
const getActiveAnimation = createSelector(
  getAnimations,
  getActiveAnimationId,
  (anims, id) => _.find(anims, anim => anim.id === id),
);
const getSelectedBlockIds = createDeepEqualSelector(getTimelineState, t => t.selectedBlockIds);
const getSelectedBlocks = createSelector(
  getActiveAnimation,
  getSelectedBlockIds,
  (animation, blockIds) => {
    return Array.from(blockIds)
      .map(blockId => _.find(animation.blocks, b => b.id === blockId));
  },
);

// Layer state selectors.
const getLayerState = createSelector(getAiaState, s => s.layers);
const getVectorLayers = createSelector(getLayerState, l => l.vectorLayers);
const getActiveVectorLayerId = createSelector(getLayerState, l => l.activeVectorLayerId);
export const getActiveVectorLayer = createSelector(
  getVectorLayers,
  getActiveVectorLayerId,
  (vls, id) => _.find(vls, vl => vl.id === id),
);
export const getSelectedLayerIds = createDeepEqualSelector(getLayerState, l => l.selectedLayerIds);
export const getCollapsedLayerIds = createDeepEqualSelector(getLayerState, l => l.collapsedLayerIds);
export const getHiddenLayerIds = createDeepEqualSelector(getLayerState, l => l.hiddenLayerIds);

// Exported playback settings selectors.
export const getPlaybackState = (state: State) => state.root.playback;
export const getIsSlowMotion = createSelector(getPlaybackState, p => p.isSlowMotion);
export const getIsPlaying = createSelector(getPlaybackState, p => p.isPlaying);
export const getIsRepeating = createSelector(getPlaybackState, p => p.isRepeating);

// Exported property input selector.
export const getPropertyInputState = createStructuredSelector({
  animations: getAnimations,
  selectedAnimationIds: getSelectedAnimationIds,
  selectedBlockIds: getSelectedBlockIds,
  vectorLayers: getVectorLayers,
  selectedLayerIds: getSelectedLayerIds,
});

// Exported layer list tree selectors.
export const getLayerListTreeState = createStructuredSelector({
  animations: getAnimations,
  selectedLayerIds: getSelectedLayerIds,
  collapsedLayerIds: getCollapsedLayerIds,
  hiddenLayerIds: getHiddenLayerIds,
});

// Exported timeline animation row selectors.
export const getTimelineAnimationRowState = createStructuredSelector({
  animations: getAnimations,
  collapsedLayerIds: getCollapsedLayerIds,
  selectedBlockIds: getSelectedBlockIds,
});

// Exported layer timeline selectors.
export const getLayerTimelineState = createStructuredSelector({
  animations: getAnimations,
  vectorLayers: getVectorLayers,
  selectedAnimationIds: getSelectedAnimationIds,
  activeAnimationId: getActiveAnimationId,
  selectedBlockIds: getSelectedBlockIds,
});

// Exported animator selectors.
export const getAnimatorState = createStructuredSelector({
  activeAnimation: getActiveAnimation,
  activeVectorLayer: getActiveVectorLayer,
});

// File importer selectors.
export const getImportedVectorLayers = getVectorLayers;

// Exported shape shifter mode selectors.
const getSingleSelectedPathAnimationBlock = createSelector(
  getSelectedBlocks,
  (blocks): PathAnimationBlock => {
    return blocks.length === 1 && blocks[0] instanceof PathAnimationBlock
      ? blocks[0]
      : undefined;
  });

const getShapeShifterPathLayerId = createSelector(
  getSingleSelectedPathAnimationBlock,
  block => block ? block.layerId : undefined,
);

export const isShapeShifterMode = createSelector(
  getSingleSelectedPathAnimationBlock,
  block => !!block,
);

const getShapeShifterState = createSelector(getRoot, s => s.shapeshifter);
export const getShapeShifterAppMode = createSelector(getShapeShifterState, s => s.appMode);
export const getShapeShifterHover = createDeepEqualSelector(getShapeShifterState, s => s.hover);
const getShapeShifterSelections = createSelector(getShapeShifterState, s => s.selections);

function createShapeShifterStateSelector(getBlockValueFn: (block: PathAnimationBlock) => Path) {
  const getShapeShifterVectorLayer = createSelector(
    getActiveVectorLayer,
    getSingleSelectedPathAnimationBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const pathLayer = (vl.findLayerById(block.layerId) as PathLayer).clone();
      pathLayer.pathData = getBlockValueFn(block);
      return LayerUtil.replaceLayerInTree(vl, pathLayer);
    });
  return createStructuredSelector({
    vectorLayer: getShapeShifterVectorLayer,
    pathLayerId: getShapeShifterPathLayerId,
    block: getSingleSelectedPathAnimationBlock,
    hover: getShapeShifterHover,
    selections: getShapeShifterSelections,
  });
}

export const getShapeShifterStartState =
  createShapeShifterStateSelector(block => block.fromValue);
export const getShapeShifterEndState =
  createShapeShifterStateSelector(block => block.toValue);
