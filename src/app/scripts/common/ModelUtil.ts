import * as _ from 'lodash';
import { Animation, AnimationBlock } from '../animations';
import { Layer, VectorLayer } from '../layers';

/**
 * Builds a map where the keys are layer IDs and the values are
 * maps of property names to their corresponding animation blocks.
 */
export function getOrderedBlocksByPropertyByLayer(animation: Animation) {
  const blocksByPropertyByLayer: LayerMap<PropertyMap<AnimationBlock<any>[]>> = {};

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
export function getBlocksByAnimationByProperty(layerId: string, animations: Animation[]) {
  const blocksByAnimationByProperty: PropertyMap<AnimationMap<AnimationBlock<any>[]>> = {};
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
export function getAvailablePropertyNamesForLayer(layer: Layer, animations: Animation[]) {
  const availablePropertyNames = new Set(layer.animatableProperties.keys());
  animations.forEach(animation => {
    const blocksByPropertyByLayer = getOrderedBlocksByPropertyByLayer(animation);
    const blocksByProperty = blocksByPropertyByLayer[layer.id];
    const animatedPropertyNames = new Set(Object.keys(blocksByProperty));
    animatedPropertyNames.forEach(name => availablePropertyNames.delete(name));
  });
  return availablePropertyNames;
}

// TODO: move this somewhere else?
export function getLayerTypeName(layer: Layer) {
  if (layer.isPathLayer()) {
    return 'pathlayer';
  } else if (layer.isClipPathLayer()) {
    return 'clippathlayer';
  } else if (layer.isGroupLayer()) {
    return 'grouplayer';
  } else {
    return 'vectorlayer';
  }
}

interface BlocksByAnimationByProperty {
  [propertyName: string]: BlocksByAnimation;
}

interface BlocksByProperty {
  [propertyName: string]: AnimationBlock<any>[];
}

interface BlocksByAnimation {
  [animationId: string]: AnimationBlock<any>[];
}

interface LayerMap<T> {
  [layerId: string]: T;
}

interface AnimationMap<T> {
  [animationId: string]: T;
}

interface PropertyMap<T> {
  [propertyName: string]: T;
}
