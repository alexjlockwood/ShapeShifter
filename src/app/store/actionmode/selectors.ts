import { LayerUtil, MorphableLayer } from '../../scripts/layers';
import { PathAnimationBlock } from '../../scripts/timeline';
import { getVectorLayer } from '../layers/selectors';
import { createDeepEqualSelector, getState } from '../selectors';
import { getAnimations } from '../timeline/selectors';
import * as _ from 'lodash';
import { createSelector, createStructuredSelector } from 'reselect';

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

const getVectorLayerFromValue =
  createSelector(
    getVectorLayer,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const pathLayer = vl.findLayerById(block.layerId).clone() as MorphableLayer;
      pathLayer.pathData = block.fromValue;
      return LayerUtil.replaceLayerInTree(vl, pathLayer);
    });

const getVectorLayerToValue =
  createSelector(
    getVectorLayer,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const pathLayer = vl.findLayerById(block.layerId).clone() as MorphableLayer;
      pathLayer.pathData = block.toValue;
      return LayerUtil.replaceLayerInTree(vl, pathLayer);
    });

const getPathLayerFromValue =
  createSelector(
    getVectorLayerFromValue,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      return vl.findLayerById(block.layerId) as MorphableLayer;
    });

const getPathLayerToValue =
  createSelector(
    getVectorLayerToValue,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      return vl.findLayerById(block.layerId) as MorphableLayer;
    });

export const getActionModeStartState =
  createStructuredSelector({
    vectorLayer: getVectorLayerFromValue,
    blockLayerId: getBlockLayerId,
    isActionMode,
    hover: getActionHover,
    selections: getActionSelections,
    pairedSubPaths: getPairedSubPaths,
    unpairedSubPath: getUnpairedSubPath,
  });

export const getActionModeEndState =
  createStructuredSelector({
    vectorLayer: getVectorLayerToValue,
    blockLayerId: getBlockLayerId,
    isActionMode,
    hover: getActionHover,
    selections: getActionSelections,
    pairedSubPaths: getPairedSubPaths,
    unpairedSubPath: getUnpairedSubPath,
  });

export const getToolbarState =
  createStructuredSelector({
    isActionMode,
    fromPl: getPathLayerFromValue,
    toPl: getPathLayerToValue,
    mode: getActionMode,
    selections: getActionSelections,
    unpairedSubPath: getUnpairedSubPath,
    block: getBlock,
  });
