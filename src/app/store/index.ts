export { Store } from '@ngrx/store';
import * as _ from 'lodash';
import {
  createSelector,
  createSelectorCreator,
  createStructuredSelector,
  defaultMemoize,
} from 'reselect';
import { ActionReducer } from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';
import { combineReducers } from '@ngrx/store';
import { environment } from '../../environments/environment';
import { compose } from '@ngrx/core/compose';
import * as fromRoot from './RootReducer';
import { PathAnimationBlock } from '../scripts/animations';
import { VectorLayer, PathLayer, LayerUtil } from '../scripts/layers';
import { Path } from '../scripts/paths';

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
} from './RootActions';

// State actions.
export {
  AddAnimations,
  SelectAnimation,
  ActivateAnimation,
  ReplaceAnimations,
  AddBlock,
  SelectBlock,
  ReplaceBlocks,
  ReplaceLayer,
  SelectLayer,
  ClearLayerSelections,
  ToggleLayerExpansion,
  ToggleLayerVisibility,
  AddLayers,
  DeleteSelectedModels,
} from './StateActions';

// Playback actions.
export {
  SetIsSlowMotion,
  SetIsPlaying,
  SetIsRepeating,
  ToggleIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ResetPlaybackSettings,
} from './PlaybackActions';

// Selectors.
const createDeepEqualSelector =
  createSelectorCreator(defaultMemoize, _.isEqual);

// State selectors.
const getState = (state: State) => state.root.state;

// Timeline state selectors.
const getTimelineState = createSelector(getState, s => s.timeline)
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
const getLayerState = createSelector(getState, s => s.layers);
const getVectorLayers = createSelector(getLayerState, l => l.vectorLayers);
const getActiveVectorLayerId = createDeepEqualSelector(getLayerState, l => l.activeVectorLayerId);
const getActiveVectorLayer = createSelector(
  getVectorLayers,
  getActiveVectorLayerId,
  (vls, id) => _.find(vls, vl => vl.id === id),
);
const getSelectedLayerIds = createDeepEqualSelector(getLayerState, l => l.selectedLayerIds);
const getCollapsedLayerIds = createDeepEqualSelector(getLayerState, l => l.collapsedLayerIds);
const getHiddenLayerIds = createDeepEqualSelector(getLayerState, l => l.hiddenLayerIds);

// Exported playback settings selectors.
export const getPlaybackSettings = (state: State) => state.root.playback;
export const getIsSlowMotion = createDeepEqualSelector(getPlaybackSettings, p => p.isSlowMotion);
export const getIsPlaying = createDeepEqualSelector(getPlaybackSettings, p => p.isPlaying);
export const getIsRepeating = createDeepEqualSelector(getPlaybackSettings, p => p.isRepeating);

// Exported property input selector.
export const getPropertyInputState = createStructuredSelector({
  animations: getAnimations,
  selectedAnimationIds: getSelectedAnimationIds,
  selectedBlockIds: getSelectedBlockIds,
  vectorLayers: getVectorLayers,
  selectedLayerIds: getSelectedLayerIds,
});

// Exported canvas selectors.
export const getActiveViewport = createDeepEqualSelector(
  getActiveVectorLayer,
  vl => { return { w: vl.width, h: vl.height } },
);
export const getCanvasState = createStructuredSelector({
  activeVectorLayer: getActiveVectorLayer,
  selectedLayerIds: getSelectedLayerIds,
  hiddenLayerIds: getHiddenLayerIds,
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

export const isShapeShifterMode = createSelector(
  getSingleSelectedPathAnimationBlock,
  block => !!block,
);

function createShapeShifterStateSelector(
  getBlockValueFn: (block: PathAnimationBlock) => Path) {
  return createSelector(
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
}

export const getShapeShifterStartState =
  createShapeShifterStateSelector(block => block.fromValue);
export const getShapeShifterEndState =
  createShapeShifterStateSelector(block => block.toValue);
