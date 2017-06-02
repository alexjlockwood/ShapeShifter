import { Layer, LayerUtil } from '../layers';
import { Animation, AnimationBlock } from '../timeline';
import * as _ from 'lodash';

export function getUniqueAnimationName(
  animations: ReadonlyArray<Animation>,
  prefix: string,
) {
  return getUniqueName(
    prefix || 'anim',
    name => _.find(animations, a => a.name === name),
  );
}

export function getUniqueLayerName(
  layers: ReadonlyArray<Layer>,
  prefix: string,
) {
  return getUniqueName(
    prefix,
    name => LayerUtil.findLayerByName(layers, name),
  );
}

export function getUniqueName(
  prefix = '',
  objectByNameFn = (s: string) => undefined,
) {
  let n = 0;
  const nameFn = () => prefix + (n ? `_${n}` : '');
  while (true) {
    const o = objectByNameFn(nameFn());
    if (!o) {
      break;
    }
    n++;
  }
  return nameFn();
}

/**
 * Builds a map where the keys are layer IDs and the values are
 * maps of property names to their corresponding animation blocks.
 */
export function getOrderedBlocksByPropertyByLayer(animation: Animation) {
  const blocksByPropertyByLayer: LayerMap<PropertyMap<AnimationBlock[]>> = {};

  animation.blocks.forEach(block => {
    let blocksByProperty = blocksByPropertyByLayer[block.layerId];
    if (!blocksByProperty) {
      blocksByProperty = {};
      blocksByPropertyByLayer[block.layerId] = blocksByProperty;
    }
    const propertyName = block.propertyName;
    blocksByProperty[propertyName] = blocksByProperty[propertyName] || [];
    blocksByProperty[propertyName].push(block);
  });

  _.forEach(blocksByPropertyByLayer, blocksByProperty => {
    _.forEach(blocksByProperty, blocks => {
      blocks.sort((a, b) => a.startTime - b.startTime);
    });
  });

  return blocksByPropertyByLayer;
}

/**
 * Builds a map for a given layer ID, where the keys are property names
 * and the values are maps of animation IDs to its corresponding list of
 * animation blocks. In other words, it allows us to find all animation blocks
 * associated with a particular layer ID, property name, and animation ID.
 */
export function getBlocksByAnimationByProperty(
  layerId: string,
  animations: ReadonlyArray<Animation>,
) {
  const blocksByAnimationByProperty: PropertyMap<AnimationMap<AnimationBlock[]>> = {};
  animations.forEach(animation => {
    const blocksByPropertyByLayer = getOrderedBlocksByPropertyByLayer(animation);
    _.forEach(blocksByPropertyByLayer[layerId], (blocksByProperty, propertyName) => {
      let blocksByAnimation = blocksByAnimationByProperty[propertyName];
      if (!blocksByAnimation) {
        blocksByAnimation = {};
        blocksByAnimationByProperty[propertyName] = blocksByAnimation;
      }
      blocksByAnimation[animation.id] = blocksByPropertyByLayer[layerId][propertyName];
    });
  });
  return blocksByAnimationByProperty;
}

/**
 * Returns a set of property names that have not yet been animated.
 */
export function getAvailablePropertyNamesForLayer(
  layer: Layer,
  animations: ReadonlyArray<Animation>,
) {
  if (!animations) {
    throw new Error('animations');
  }
  const availablePropertyNames = new Set(layer.animatableProperties.keys());
  animations.forEach(animation => {
    const blocksByPropertyByLayer = getOrderedBlocksByPropertyByLayer(animation);
    const blocksByProperty = blocksByPropertyByLayer[layer.id];
    if (!blocksByProperty) {
      return;
    }
    const animatedPropertyNames = new Set(Object.keys(blocksByProperty));
    animatedPropertyNames.forEach(name => availablePropertyNames.delete(name));
  });
  return availablePropertyNames;
}

export interface LayerMap<T> {
  [layerId: string]: T;
}

export interface AnimationMap<T> {
  [animationId: string]: T;
}

export interface PropertyMap<T> {
  [propertyName: string]: T;
}
