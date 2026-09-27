import { getInterpolateFn } from 'app/modules/editor/model/interpolators';
import { Layer, VectorLayer } from 'app/modules/editor/model/layers';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
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
    const animDataByLayer = ModelUtil.getOrderedBlocksByPropertyByLayer(activeAnimation);
    this.renderedVectorLayer = cloneAnimatedLayers(
      originalVectorLayer,
      new Set(Object.keys(animDataByLayer)),
    ) as VectorLayer;
    Object.keys(animDataByLayer).forEach(layerId => {
      const originalLayer = originalVectorLayer.findLayerById(layerId);
      const renderedLayer = this.renderedVectorLayer.findLayerById(layerId);
      if (!originalLayer || !renderedLayer) {
        // Skip blocks for layers that no longer exist.
        return;
      }
      const orderedBlocks = animDataByLayer[layerId];
      const interpolateFns = new Map<AnimationBlock, (fraction: number) => number>();
      Object.values(orderedBlocks).forEach(blocks =>
        blocks.forEach(block => interpolateFns.set(block, getInterpolateFn(block.interpolator))),
      );
      this.animDataByLayer[layerId] = {
        originalLayer,
        renderedLayer,
        orderedBlocks,
        interpolateFns,
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
        if (!property) {
          return;
        }
        let value = (animData.originalLayer as any)[propertyName];
        for (const block of blocks) {
          if (timeMillis < block.startTime) {
            break;
          }
          if (timeMillis < block.endTime) {
            const f = (timeMillis - block.startTime) / (block.endTime - block.startTime);
            const interpolateFn =
              animData.interpolateFns.get(block) ?? getInterpolateFn(block.interpolator);
            value = property.interpolateValue(block.fromValue, block.toValue, interpolateFn(f));
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

// Copies only what setCurrentTime writes to (animated layers and their ancestors), sharing the rest.
function cloneAnimatedLayers(layer: Layer, animatedLayerIds: ReadonlySet<string>): Layer {
  const children = layer.children.map(child => cloneAnimatedLayers(child, animatedLayerIds));
  if (
    !animatedLayerIds.has(layer.id) &&
    children.every((child, i) => child === layer.children[i])
  ) {
    return layer;
  }
  const clone = layer.clone();
  clone.children = children;
  return clone;
}

interface RendererData {
  readonly originalLayer: Layer;
  readonly renderedLayer: Layer;
  // Maps property names to animation block lists.
  readonly orderedBlocks: Dictionary<AnimationBlock[]>;
  // Each block's easing function, resolved once rather than on every frame.
  readonly interpolateFns: ReadonlyMap<AnimationBlock, (fraction: number) => number>;
  cachedState?: PropertyState;
}

interface PropertyState {
  activeBlock: AnimationBlock | undefined;
  interpolatedValue: boolean;
}
