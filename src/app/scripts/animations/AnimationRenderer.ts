import * as _ from 'lodash';
import { Animation, AnimationBlock, INTERPOLATORS } from '.';
import { VectorLayer, Layer } from '../layers';
import { ModelUtil, LayerMap, PropertyMap } from '../common';

const DEFAULT_LAYER_PROPERTY_STATE: PropertyState = {
  activeBlock: undefined,
  interpolatedValue: false,
};

// TODO: use this to export svg sprite animations
// TODO: should we 'link selected state' here similar to AIA?
export class AnimationRenderer {
  private readonly renderedVectorLayer: VectorLayer;
  private readonly animDataByLayer: LayerMap<RendererData> = {};

  constructor(
    readonly originalVectorLayer: VectorLayer,
    readonly activeAnimation: Animation,
  ) {
    this.renderedVectorLayer = originalVectorLayer.deepClone();
    // TODO: need to filter out the blocks attached to the 'non active' vector layer
    const animDataByLayer = ModelUtil.getOrderedBlocksByPropertyByLayer(activeAnimation);
    Object.keys(animDataByLayer).forEach(layerId => {
      this.animDataByLayer[layerId] = {
        originalLayer: originalVectorLayer.findLayerById(layerId),
        renderedLayer: this.renderedVectorLayer.findLayerById(layerId),
        orderedBlocks: animDataByLayer[layerId],
      };
    });
    this.setAnimationTime(0);
  }

  setAnimationTime(time: number) {
    Object.keys(this.animDataByLayer).forEach(layerId => {
      const animData = this.animDataByLayer[layerId];
      animData.cachedState = animData.cachedState || {} as PropertyState;

      Object.keys(animData.orderedBlocks).forEach(propertyName => {
        const blocks = animData.orderedBlocks[propertyName];
        const _ar = Object.assign({}, DEFAULT_LAYER_PROPERTY_STATE);

        // Compute the rendered value at the given time.
        const property = animData.originalLayer.animatableProperties.get(propertyName);
        let value = animData.originalLayer[propertyName];
        for (const block of blocks) {
          if (time < block.startTime) {
            break;
          }
          if (time < block.endTime) {
            const fromValue = ('fromValue' in block) ? block.fromValue : value;
            let f = (time - block.startTime) / (block.endTime - block.startTime);
            // TODO: this is a bit hacky... no need to perform a search every time.
            const interpolatorFn =
              _.find(INTERPOLATORS, i => i.value === block.interpolator).interpolateFn;
            f = interpolatorFn(f);
            value = property.interpolateValue(fromValue, block.toValue, f);
            _ar.activeBlock = block;
            _ar.interpolatedValue = true;
            break;
          }
          value = block.toValue;
          _ar.activeBlock = block;
        }

        animData.renderedLayer[propertyName] = value;

        // Cached data.
        animData.cachedState[propertyName] = animData.cachedState[propertyName] || {};
        animData.cachedState[propertyName] = _ar;
      });
    });
    return this.renderedVectorLayer;
  }
}

interface RendererData {
  readonly originalLayer: Layer;
  readonly renderedLayer: Layer;
  readonly orderedBlocks: PropertyMap<AnimationBlock<any>[]>;
  cachedState?: PropertyState;
}

interface PropertyState {
  activeBlock: AnimationBlock<any>;
  interpolatedValue: boolean;
}
