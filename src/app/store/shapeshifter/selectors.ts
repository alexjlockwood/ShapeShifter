import { State } from '..';
import { PathAnimationBlock } from '../../scripts/animations';
import {
  LayerUtil,
  PathLayer,
  VectorLayer,
} from '../../scripts/layers';
import { Path } from '../../scripts/paths';
import {
  getActiveVectorLayer,
  getAnimations,
} from '../aia/selectors';
import { createDeepEqualSelector } from '../selectors';
import * as _ from 'lodash';
import {
  createSelector,
  createStructuredSelector,
} from 'reselect';

const getState = (state: State) => state.shapeshifter;
const getBlockId = createSelector(getState, s => s.blockId);
const getBlock = createSelector(
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
const getBlockLayerId =
  createSelector(
    getBlock,
    block => block ? block.layerId : undefined,
  );

const getPathBlockFromValue = createSelector(
  getBlock,
  block => block.fromValue,
);

const getPathBlockToValue = createSelector(
  getBlock,
  block => block.toValue,
);

export const isShapeShifterMode = createSelector(getBlockId, blockId => !!blockId);
export const getShapeShifterMode = createSelector(getState, s => s.mode);
export const getPathHover = createDeepEqualSelector(getState, s => s.hover);
const getPathSelections = createSelector(getState, s => s.selections);

const getVectorLayerFromValue = createSelector(
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

const getVectorLayerToValue = createSelector(
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
    block: getBlock,
    hover: getPathHover,
    selections: getPathSelections,
  });

export const getShapeShifterEndState =
  createStructuredSelector({
    vectorLayer: getVectorLayerFromValue,
    block: getBlock,
    hover: getPathHover,
    selections: getPathSelections,
  });

export const getToolbarState =
  createStructuredSelector({
    fromPl: getPathLayerFromValue,
    toPl: getPathLayerToValue,
    mode: getShapeShifterMode,
    selections: getPathSelections,
  });
