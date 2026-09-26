import { ActionMode, ActionSource, SelectionType } from 'app/modules/editor/model/actionmode';
import { LayerUtil, MorphableLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { ActionModeUtil } from 'app/modules/editor/scripts/actionmode';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import {
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/modules/editor/store/layers/selectors';
import { State } from 'app/modules/editor/store/reducer';
import {
  createDeepEqualSelector,
  createSelector,
  createStructuredSelector,
  getEditorState,
} from 'app/modules/editor/store/selectors';
import {
  getAnimation,
  getSingleSelectedBlockLayerId,
  getSingleSelectedPathBlock,
} from 'app/modules/editor/store/timeline/selectors';

const getActionModeState = createSelector(getEditorState, s => s.actionmode);
export const getActionMode = createSelector(getActionModeState, s => s.mode);
export const isActionMode = createSelector(getActionMode, mode => mode !== ActionMode.None);

// Selections and hovers can outlive the subpaths and commands they point at, e.g. when auto fix
// or the property panel changes the block's paths, and the code that reads them assumes they
// exist. Bugsnag reported thousands of "Subpath index out of bounds" and "Command index out of
// bounds" errors from the canvases and the toolbar.
function isInActivePath(
  block: PathAnimationBlock | undefined,
  { source, subIdx, cmdIdx }: { source: ActionSource; subIdx: number; cmdIdx?: number },
) {
  if (source !== ActionSource.From && source !== ActionSource.To) {
    return true;
  }
  const path = source === ActionSource.From ? block?.fromValue : block?.toValue;
  const subPaths = path?.getSubPaths() ?? [];
  if (subIdx < 0 || subIdx >= subPaths.length) {
    return false;
  }
  return cmdIdx === undefined || (cmdIdx >= 0 && cmdIdx < subPaths[subIdx].getCommands().length);
}

export const getActionModeHover = createDeepEqualSelector(
  [getActionModeState, getSingleSelectedPathBlock],
  ({ hover }, block) => (hover && isInActivePath(block, hover) ? hover : undefined),
);

export const getActionModeSelections = createDeepEqualSelector(
  [getActionModeState, getSingleSelectedPathBlock],
  ({ selections }, block) => selections.filter(s => isInActivePath(block, s)),
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
      const renderedVl = renderer.setCurrentTime(timeMillis);
      // TODO: this is hacky! the real solution is to not clear path state after interpolations
      // Replace the interpolated value with the block's to/from value.
      const blockLayer = vl.findLayerById(block.layerId);
      if (!blockLayer) {
        return undefined;
      }
      const layer = blockLayer.clone() as MorphableLayer;
      layer.pathData = timeMillis === block.startTime ? block.fromValue : block.toValue;
      return LayerUtil.updateLayer(renderedVl, layer);
    },
  );
}

const getVectorLayerFromValue = getVectorLayerValue(block => block.startTime);
const getVectorLayerToValue = getVectorLayerValue(block => block.endTime);

function getMorphableLayerValue(selector: (state: State) => VectorLayer | undefined) {
  return createSelector([selector, getSingleSelectedBlockLayerId], (vl, blockLayerId) => {
    if (!vl || !blockLayerId) {
      return undefined;
    }
    return vl.findLayerById(blockLayerId) as MorphableLayer;
  });
}

const getMorphableLayerFromValue = getMorphableLayerValue(getVectorLayerFromValue);
const getMorphableLayerToValue = getMorphableLayerValue(getVectorLayerToValue);

const getPathsCompatibleResult = createSelector(getSingleSelectedPathBlock, block =>
  block ? ActionModeUtil.checkPathsCompatible(block) : undefined,
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
