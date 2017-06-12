import {
  LayerMap,
  ModelUtil,
  PropertyMap,
} from 'app/scripts/common';
import { INTERPOLATORS } from 'app/scripts/model/interpolators';
import {
  Layer,
  VectorLayer,
} from 'app/scripts/model/layers';
import {
  Animation,
  AnimationBlock,
} from 'app/scripts/model/timeline';
import * as _ from 'lodash';

const DEFAULT_LAYER_PROPERTY_STATE: PropertyState = {
  activeBlock: undefined,
  interpolatedValue: false,
};

/**
 * A simple class that takes a VectorLayer and an animation and outputs a new
 * rendered VectorLayer given a specific time.
 */
export class AnimationRenderer {
  private readonly renderedVectorLayer: VectorLayer;

  // Keys are layerIds and values are RenderedData objects.
  private readonly animDataByLayer: LayerMap<RendererData> = {};

  constructor(
    readonly originalVectorLayer: VectorLayer,
    readonly activeAnimation: Animation,
  ) {
    // TODO: technically this could be more performant if we only cloned the affected layers
    this.renderedVectorLayer = originalVectorLayer.deepClone();
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

  /**
   * Returns a rendered vector layer given a specific time. The time must be
   * non-negative and must be less than the animation's duration. The returned
   * vector layer should not be mutated externally, as it will be cached and
   * returned on subsequent time frames.
   */
  setAnimationTime(time: number) {
    Object.keys(this.animDataByLayer).forEach(layerId => {
      const animData = this.animDataByLayer[layerId];
      animData.cachedState = animData.cachedState || {} as PropertyState;

      Object.keys(animData.orderedBlocks).forEach(propertyName => {
        const blocks = animData.orderedBlocks[propertyName];
        const _ar = { ...DEFAULT_LAYER_PROPERTY_STATE };

        // Compute the rendered value at the given time.
        const property = animData.originalLayer.animatableProperties.get(propertyName);
        let value = animData.originalLayer[propertyName];
        for (const block of blocks) {
          if (time < block.startTime) {
            break;
          }
          if (time < block.endTime) {
            const fromValue = ('fromValue' in block) ? block.fromValue : value;
            const f = (time - block.startTime) / (block.endTime - block.startTime);
            // TODO: this is a bit hacky... no need to perform a search every time.
            const interpolatorFn =
              _.find(INTERPOLATORS, i => i.value === block.interpolator).interpolateFn;
            value = property.interpolateValue(fromValue, block.toValue, interpolatorFn(f));
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
  readonly orderedBlocks: PropertyMap<AnimationBlock[]>;
  cachedState?: PropertyState;
}

interface PropertyState {
  activeBlock: AnimationBlock;
  interpolatedValue: boolean;
}
