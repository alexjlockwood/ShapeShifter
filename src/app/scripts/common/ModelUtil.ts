import { Layer, LayerUtil, VectorLayer } from '../model/layers';
import { Animation, AnimationBlock } from '../model/timeline';
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
export function getAvailablePropertyNamesForLayer(layer: Layer, animation: Animation) {
  const availablePropertyNames = new Set(layer.animatableProperties.keys());
  const blocksByPropertyByLayer = getOrderedBlocksByPropertyByLayer(animation);
  const blocksByProperty = blocksByPropertyByLayer[layer.id];
  if (blocksByProperty) {
    for (const name of Object.keys(blocksByProperty)) {
      availablePropertyNames.delete(name);
    }
  }
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

export function regenerateModelIds(
  vectorLayer: VectorLayer,
  animation: Animation,
  hiddenLayerIds: Set<string>,
) {
  // Create a map of old IDs to new IDs.
  const layerIdMap = new Map<string, string>();
  vectorLayer.walk(layer => layerIdMap.set(layer.id, _.uniqueId()));

  vectorLayer = (function recurseFn(layer: Layer) {
    const clone = layer.clone();
    clone.id = layerIdMap.get(clone.id);
    clone.children = clone.children.map(l => recurseFn(l));
    return clone;
  })(vectorLayer);

  animation = animation.clone();
  animation.id = _.uniqueId();
  animation.blocks = animation.blocks.map(block => {
    const clonedBlock = block.clone();
    clonedBlock.id = _.uniqueId();
    clonedBlock.layerId = layerIdMap.get(clonedBlock.layerId);
    return clonedBlock;
  });

  hiddenLayerIds = new Set(Array.from(hiddenLayerIds).map(id => layerIdMap.get(id)));

  return { vectorLayer, animation, hiddenLayerIds };
}
