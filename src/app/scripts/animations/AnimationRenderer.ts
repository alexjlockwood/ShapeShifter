import * as _ from 'lodash';
import { Animation, AnimationBlock } from '.';
import { VectorLayer, Layer } from '../layers';
import { ModelUtil, LayerMap, PropertyMap } from '../common';
import { INTERPOLATORS } from '.';

const DEFAULT_LAYER_PROPERTY_STATE: PropertyState = {
  activeBlock: undefined,
  interpolatedValue: false
};

export class AnimationRenderer {
  private readonly renderedVectorLayer: VectorLayer;
  private readonly animDataByLayer: LayerMap<RendererData> = {};

  constructor(
    public readonly originalVectorLayer: VectorLayer,
    public readonly animation: Animation,
  ) {
    // TODO: should we 'link selected state' here similar to AIA?
    this.renderedVectorLayer = originalVectorLayer.clone();
    const animDataByLayer = ModelUtil.getOrderedBlocksByPropertyByLayer(animation);
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
      animData._ar = animData._ar || {} as PropertyState;

      Object.keys(animData.orderedBlocks).forEach(propertyName => {
        const blocks = animData.orderedBlocks[propertyName];
        const _ar = Object.assign({}, DEFAULT_LAYER_PROPERTY_STATE);

        // compute rendered value at given time
        const property = animData.originalLayer.animatableProperties[propertyName];
        let value = animData.originalLayer[propertyName];
        for (const block of blocks) {
          if (time < block.startTime) {
            break;
          }
          if (time < block.endTime) {
            const fromValue = ('fromValue' in block) ? block.fromValue : value;
            let f = (time - block.startTime) / (block.endTime - block.startTime);
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
        animData._ar[propertyName] = animData._ar[propertyName] || {};
        animData._ar[propertyName] = _ar;
      });
    });
  }

  private getLayerPropertyValue(layerId: string, propertyName: string) {
    return this.renderedVectorLayer.findLayerById(layerId)[propertyName];
  }

  private getLayerPropertyState(layerId: string, propertyName: string) {
    const layerAnimData = this.animDataByLayer[layerId];
    return layerAnimData
      ? (layerAnimData._ar[propertyName] || {}) as PropertyState
      : Object.assign({}, DEFAULT_LAYER_PROPERTY_STATE);
  }
}

interface RendererData {
  readonly originalLayer: Layer;
  readonly renderedLayer: Layer;
  readonly orderedBlocks: PropertyMap<AnimationBlock<any>[]>;
  _ar?: PropertyState;
}

interface PropertyState {
  activeBlock: AnimationBlock<any>;
  interpolatedValue: boolean;
}
