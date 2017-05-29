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
const getPathAnimationBlock = createSelector(
  getAnimations,
  getBlockId,
  (animations, blockId): PathAnimationBlock => {
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

export const isShapeShifterMode = createSelector(getBlockId, blockId => !!blockId);
export const getAppMode = createSelector(getState, s => s.appMode);
export const getHover = createDeepEqualSelector(getState, s => s.hover);
const getSelections = createSelector(getState, s => s.selections);

function createVectorLayerSelector(getBlockValueFn: (block: PathAnimationBlock) => Path) {
  return createSelector(
    getActiveVectorLayer,
    getPathAnimationBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const pathLayer = (vl.findLayerById(block.layerId) as PathLayer).clone();
      pathLayer.pathData = getBlockValueFn(block);
      return LayerUtil.replaceLayerInTree(vl, pathLayer);
    });
}

function createPathLayerSelector(getBlockValueFn: (block: PathAnimationBlock) => Path) {
  return createSelector(
    createVectorLayerSelector(getBlockValueFn),
    getPathAnimationBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      return vl.findLayerById(block.layerId) as PathLayer;
    });
}

function createShapeShifterStateSelector(getBlockValueFn: (block: PathAnimationBlock) => Path) {
  return createStructuredSelector({
    vectorLayer: createVectorLayerSelector(getBlockValueFn),
    block: getPathAnimationBlock,
    hover: getHover,
    selections: getSelections,
  });
}

export const getShapeShifterStartState =
  createShapeShifterStateSelector(block => block.fromValue);
export const getShapeShifterEndState =
  createShapeShifterStateSelector(block => block.toValue);

export const getToolbarState = createStructuredSelector({
  fromPl: createPathLayerSelector(block => block.fromValue),
  toPl: createPathLayerSelector(block => block.toValue),
  appMode: getAppMode,
  selections: getSelections,
});
