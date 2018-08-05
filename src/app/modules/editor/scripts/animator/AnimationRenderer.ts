import { INTERPOLATORS } from 'app/modules/editor/model/interpolators';
import { Layer, VectorLayer } from 'app/modules/editor/model/layers';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { ModelUtil } from 'app/modules/editor/scripts/common';
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
  private readonly animDataByLayer: Dictionary<RendererData> = {};

  constructor(originalVectorLayer: VectorLayer, activeAnimation: Animation) {
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
    this.setCurrentTime(0);
  }

  /**
   * Returns a rendered vector layer given a specific time. The time must be
   * non-negative and must be less than the animation's duration. The returned
   * vector layer should not be mutated externally, as it will be cached and
   * returned on subsequent time frames.
   */
  setCurrentTime(timeMillis: number) {
    Object.keys(this.animDataByLayer).forEach(layerId => {
      const animData = this.animDataByLayer[layerId];
      animData.cachedState = animData.cachedState || ({} as PropertyState);

      Object.keys(animData.orderedBlocks).forEach(propertyName => {
        const blocks = animData.orderedBlocks[propertyName];
        const _ar = { ...DEFAULT_LAYER_PROPERTY_STATE };

        // Compute the rendered value at the given time.
        const property = animData.originalLayer.animatableProperties.get(propertyName);
        let value = (animData.originalLayer as any)[propertyName];
        for (const block of blocks) {
          if (timeMillis < block.startTime) {
            break;
          }
          if (timeMillis < block.endTime) {
            const f = (timeMillis - block.startTime) / (block.endTime - block.startTime);
            // TODO: this is a bit hacky... no need to perform a search every time.
            const interpolatorFn = _.find(INTERPOLATORS, i => i.value === block.interpolator)
              .interpolateFn;
            value = property.interpolateValue(block.fromValue, block.toValue, interpolatorFn(f));
            _ar.activeBlock = block;
            _ar.interpolatedValue = true;
            break;
          }
          value = block.toValue;
          _ar.activeBlock = block;
        }

        (animData.renderedLayer as any)[propertyName] = value;

        // Cached data.
        (animData.cachedState as any)[propertyName] =
          (animData.cachedState as any)[propertyName] || {};
        (animData.cachedState as any)[propertyName] = _ar;
      });
    });
    return this.renderedVectorLayer;
  }
}

interface RendererData {
  readonly originalLayer: Layer;
  readonly renderedLayer: Layer;
  // Maps property names to animation block lists.
  readonly orderedBlocks: Dictionary<AnimationBlock[]>;
  cachedState?: PropertyState;
}

interface PropertyState {
  activeBlock: AnimationBlock;
  interpolatedValue: boolean;
}
