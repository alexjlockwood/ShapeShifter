import { PathAnimationBlock } from '../../scripts/animations';
import { LayerUtil, PathLayer } from '../../scripts/layers';
import { getActiveVectorLayer } from '../layers/selectors';
import { createDeepEqualSelector, getState } from '../selectors';
import { getAnimations } from '../timeline/selectors';
import * as _ from 'lodash';
import { createSelector, createStructuredSelector } from 'reselect';

const getShapeShifterState = createSelector(getState, s => s.shapeshifter);
const getBlockId = createSelector(getShapeShifterState, s => s.blockId);
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

export const isShapeShifterMode = createSelector(getBlockId, id => !!id);
export const getShapeShifterMode = createSelector(getShapeShifterState, s => s.mode);
export const getPathHover = createDeepEqualSelector(getShapeShifterState, s => s.hover);
const getPathSelections = createSelector(getShapeShifterState, s => s.selections);
const getPairedSubPaths =
  createDeepEqualSelector(getShapeShifterState, state => state.pairedSubPaths);
const getUnpairedSubPath =
  createDeepEqualSelector(getShapeShifterState, state => state.unpairedSubPath);

const getVectorLayerFromValue =
  createSelector(
    getActiveVectorLayer,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const pathLayer = (vl.findLayerById(block.layerId) as PathLayer).clone();
      pathLayer.pathData = block.fromValue;
      return LayerUtil.replaceLayerInTree(vl, pathLayer);
    });

const getVectorLayerToValue =
  createSelector(
    getActiveVectorLayer,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const pathLayer = (vl.findLayerById(block.layerId) as PathLayer).clone();
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
      return vl.findLayerById(block.layerId) as PathLayer;
    });

const getPathLayerToValue =
  createSelector(
    getVectorLayerToValue,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      return vl.findLayerById(block.layerId) as PathLayer;
    });

export const getShapeShifterStartState =
  createStructuredSelector({
    vectorLayer: getVectorLayerFromValue,
    blockLayerId: getBlockLayerId,
    hover: getPathHover,
    selections: getPathSelections,
    pairedSubPaths: getPairedSubPaths,
    unpairedSubPath: getUnpairedSubPath,
  });

export const getShapeShifterEndState =
  createStructuredSelector({
    vectorLayer: getVectorLayerToValue,
    blockLayerId: getBlockLayerId,
    hover: getPathHover,
    selections: getPathSelections,
    pairedSubPaths: getPairedSubPaths,
    unpairedSubPath: getUnpairedSubPath,
  });

export const getToolbarState =
  createStructuredSelector({
    fromPl: getPathLayerFromValue,
    toPl: getPathLayerToValue,
    mode: getShapeShifterMode,
    selections: getPathSelections,
    unpairedSubPath: getUnpairedSubPath,
  });
