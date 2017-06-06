import {
  LayerUtil,
  MorphableLayer,
  VectorLayer,
} from '../../scripts/layers';
import { Path } from '../../scripts/paths';
import { PathAnimationBlock } from '../../scripts/timeline';
import {
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from '../layers/selectors';
import { State } from '../reducer';
import {
  createDeepEqualSelector,
  getState,
} from '../selectors';
import { getAnimations } from '../timeline/selectors';
import * as _ from 'lodash';
import {
  createSelector,
  createStructuredSelector,
} from 'reselect';

const getActionModeState = createSelector(getState, s => s.actionmode);
const getBlockId = createSelector(getActionModeState, s => s.blockId);
const getBlock =
  createSelector(
    getAnimations,
    getBlockId,
    (animations, blockId) => {
      if (!blockId) {
        return undefined;
      }
      for (const anim of animations) {
        const block = _.find(anim.blocks, b => b.id === blockId);
        if (block instanceof PathAnimationBlock) {
          return block;
        }
      }
      return undefined;
    },
  );
const getBlockLayerId = createSelector(getBlock, b => b ? b.layerId : undefined);

export const isActionMode = createSelector(getBlockId, id => !!id);
export const getActionMode = createSelector(getActionModeState, s => s.mode);
export const getActionHover = createDeepEqualSelector(getActionModeState, s => s.hover);
const getActionSelections = createSelector(getActionModeState, s => s.selections);
const getPairedSubPaths =
  createDeepEqualSelector(getActionModeState, state => new Set(state.pairedSubPaths));
const getUnpairedSubPath =
  createDeepEqualSelector(getActionModeState, state => state.unpairedSubPath);

function getVectorLayerValue(getValueFn: (block: PathAnimationBlock) => Path) {
  return createSelector(
    getVectorLayer,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const layer = vl.findLayerById(block.layerId).clone() as MorphableLayer;
      layer.pathData = getValueFn(block);
      return LayerUtil.replaceLayerInTree(vl, layer);
    });
}

const getVectorLayerFromValue = getVectorLayerValue(block => block.fromValue);
const getVectorLayerToValue = getVectorLayerValue(block => block.toValue);

type CombinerFunc = (vl: VectorLayer, block: PathAnimationBlock) => VectorLayer;

function getMorphableLayerValue(selector: Reselect.OutputSelector<State, VectorLayer, CombinerFunc>) {
  return createSelector(
    getVectorLayerFromValue,
    getBlockLayerId,
    (vl, blockLayerId) => {
      if (!vl || !blockLayerId) {
        return undefined;
      }
      return vl.findLayerById(blockLayerId) as MorphableLayer;
    });
}

const getMorphableLayerFromValue = getMorphableLayerValue(getVectorLayerFromValue);
const getMorphableLayerToValue = getMorphableLayerValue(getVectorLayerToValue);

const actionModeBaseSelectors = {
  blockLayerId: getBlockLayerId,
  isActionMode,
  hover: getActionHover,
  selections: getActionSelections,
  pairedSubPaths: getPairedSubPaths,
  unpairedSubPath: getUnpairedSubPath,
  hiddenLayerIds: getHiddenLayerIds,
  selectedLayerIds: getSelectedLayerIds,
};

export const getActionModeStartState =
  createStructuredSelector({
    ...actionModeBaseSelectors,
    vectorLayer: getVectorLayerFromValue,
  });

export const getActionModeEndState =
  createStructuredSelector({
    ...actionModeBaseSelectors,
    vectorLayer: getVectorLayerToValue,
  });

export const getToolbarState =
  createStructuredSelector({
    isActionMode,
    fromMl: getMorphableLayerFromValue,
    toMl: getMorphableLayerToValue,
    mode: getActionMode,
    selections: getActionSelections,
    unpairedSubPath: getUnpairedSubPath,
    block: getBlock,
  });
