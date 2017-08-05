import { ActionMode, ActionSource, SelectionType } from 'app/model/actionmode';
import { LayerUtil, MorphableLayer, VectorLayer } from 'app/model/layers';
import { Animation, PathAnimationBlock } from 'app/model/timeline';
import { ActionModeUtil } from 'app/scripts/actionmode';
import { AnimationRenderer } from 'app/scripts/animator';
import { getHiddenLayerIds, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { State } from 'app/store/reducer';
import { createDeepEqualSelector, getAppState } from 'app/store/selectors';
import {
  getAnimation,
  getSingleSelectedBlockLayerId,
  getSingleSelectedPathBlock,
} from 'app/store/timeline/selectors';
import { createSelector, createStructuredSelector } from 'reselect';

const getActionModeState = createSelector(getAppState, s => s.actionmode);
export const getActionMode = createSelector(getActionModeState, s => s.mode);
export const isActionMode = createSelector(getActionMode, mode => mode !== ActionMode.None);
export const getActionModeHover = createDeepEqualSelector(getActionModeState, s => s.hover);

export const getActionModeSelections = createDeepEqualSelector(
  getActionModeState,
  s => s.selections,
);

export const getActionModeSubPathSelections = createDeepEqualSelector(
  getActionModeSelections,
  selections => selections.filter(s => s.type === SelectionType.SubPath),
);
export const getActionModeSegmentSelections = createDeepEqualSelector(
  getActionModeSelections,
  selections => selections.filter(s => s.type === SelectionType.Segment),
);
export const getActionModePointSelections = createDeepEqualSelector(
  getActionModeSelections,
  selections => selections.filter(s => s.type === SelectionType.Point),
);

export const getPairedSubPaths = createDeepEqualSelector(
  getActionModeState,
  state => state.pairedSubPaths,
);
export const getUnpairedSubPath = createDeepEqualSelector(
  getActionModeState,
  state => state.unpairedSubPath,
);

function getVectorLayerValue(getTimeFn: (block: PathAnimationBlock) => number) {
  return createSelector(
    [getVectorLayer, getAnimation, getSingleSelectedPathBlock],
    (vl, anim, block) => {
      if (!block) {
        return undefined;
      }
      // Note this is a bit dangerous because the renderer interpolates paths
      // and that causes all mutated path state to be lost if we aren't careful.
      // There are currently checks in PathProperty.ts to avoid this by returning
      // the start and end path when the interpolated fraction is 0 and 1 respectively.
      const renderer = new AnimationRenderer(vl, anim);
      const timeMillis = getTimeFn(block);
      // First interpolate the entire vector layer.
      const renderedVl = renderer.setAnimationTime(timeMillis);
      // TODO: this is hacky! the real solution is to not clear path state after interpolations
      // Replace the interpolated value with the block's to/from value.
      const layer = vl.findLayerById(block.layerId).clone() as MorphableLayer;
      layer.pathData = timeMillis === block.startTime ? block.fromValue : block.toValue;
      return LayerUtil.updateLayer(renderedVl, layer);
    },
  );
}

const getVectorLayerFromValue = getVectorLayerValue(block => block.startTime);
const getVectorLayerToValue = getVectorLayerValue(block => block.endTime);

type CombinerFunc = (vl: VectorLayer, anim: Animation, block: PathAnimationBlock) => VectorLayer;

function getMorphableLayerValue(
  selector: Reselect.OutputSelector<State, VectorLayer, CombinerFunc>,
) {
  return createSelector([selector, getSingleSelectedBlockLayerId], (vl, blockLayerId) => {
    if (!vl || !blockLayerId) {
      return undefined;
    }
    return vl.findLayerById(blockLayerId) as MorphableLayer;
  });
}

const getMorphableLayerFromValue = getMorphableLayerValue(getVectorLayerFromValue);
const getMorphableLayerToValue = getMorphableLayerValue(getVectorLayerToValue);

const getPathsCompatibleResult = createSelector(
  getSingleSelectedPathBlock,
  block => (block ? ActionModeUtil.checkPathsCompatible(block) : undefined),
);

function getHighlightedSubIdxWithError(actionSource: ActionSource) {
  return createSelector(
    [getActionMode, getActionModeSelections, getPathsCompatibleResult],
    (mode, selections, result) => {
      if (!result) {
        // Then there is no path animation block currently selected.
        return undefined;
      }
      const { areCompatible, errorPath, errorSubIdx } = result;
      if (mode !== ActionMode.Selection || selections.length) {
        // Don't show any highlights if we're not in selection mode, or
        // if there are any existing selections.
        return undefined;
      }
      if (areCompatible || errorPath !== actionSource || errorSubIdx === undefined) {
        return undefined;
      }
      return errorSubIdx;
    },
  );
}

const actionModeBaseSelectors = {
  blockLayerId: getSingleSelectedBlockLayerId,
  isActionMode,
  hover: getActionModeHover,
  selections: getActionModeSelections,
  pairedSubPaths: getPairedSubPaths,
  unpairedSubPath: getUnpairedSubPath,
  hiddenLayerIds: getHiddenLayerIds,
  selectedLayerIds: getSelectedLayerIds,
};

export const getActionModeStartState = createStructuredSelector({
  ...actionModeBaseSelectors,
  vectorLayer: getVectorLayerFromValue,
  subIdxWithError: getHighlightedSubIdxWithError(ActionSource.From),
});

export const getActionModeEndState = createStructuredSelector({
  ...actionModeBaseSelectors,
  vectorLayer: getVectorLayerToValue,
  subIdxWithError: getHighlightedSubIdxWithError(ActionSource.To),
});

export const getToolbarState = createStructuredSelector({
  mode: getActionMode,
  fromMl: getMorphableLayerFromValue,
  toMl: getMorphableLayerToValue,
  selections: getActionModeSelections,
  unpairedSubPath: getUnpairedSubPath,
  block: getSingleSelectedPathBlock,
});
