import { Layer, VectorLayer } from 'app/model/layers';
import { Animation, AnimationBlock } from 'app/model/timeline';
import * as _ from 'lodash';

/**
 * Builds a map where the keys are layer IDs and the values are
 * maps of property names to their corresponding animation blocks.
 */
export function getOrderedBlocksByPropertyByLayer(animation: Animation) {
  const blocksByPropertyByLayer: Dictionary<Dictionary<AnimationBlock[]>> = {};

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

export function regenerateModelIds(
  vectorLayer: VectorLayer,
  animation: Animation,
  hiddenLayerIds: Set<string>,
) {
  // Create a map of old IDs to new IDs.
  const layerIdMap: Dictionary<string> = {};
  vectorLayer.walk(layer => (layerIdMap[layer.id] = _.uniqueId()));

  vectorLayer = <VectorLayer>(function recurseFn<T extends Layer>(layer: T) {
    const clone = layer.clone();
    clone.id = layerIdMap[clone.id];
    clone.children = clone.children.map(l => recurseFn(l));
    return clone;
  })(vectorLayer);

  const clonedAnim = animation.clone();
  clonedAnim.id = _.uniqueId();
  clonedAnim.blocks = clonedAnim.blocks.map(block => {
    const clonedBlock = block.clone();
    clonedBlock.id = _.uniqueId();
    clonedBlock.layerId = layerIdMap[clonedBlock.layerId];
    return clonedBlock;
  });
  animation = clonedAnim;

  hiddenLayerIds = new Set(Array.from(hiddenLayerIds).map(id => layerIdMap[id]));

  return { vectorLayer, animation, hiddenLayerIds };
}
