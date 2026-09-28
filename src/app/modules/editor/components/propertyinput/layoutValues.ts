import { getLayerBounds } from 'app/modules/editor/components/canvas/LayerGeometry';
import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import {
  scalingAround,
  transformLayers,
  translateLayers,
} from 'app/modules/editor/components/canvas/transformLayers';
import { VectorLayer } from 'app/modules/editor/model/layers';
import type { Animation } from 'app/modules/editor/model/timeline';
import type { State } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getAnimatedVectorLayer, getIsPlaying } from 'app/modules/editor/store/playback/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import { round } from 'lodash-es';

/** A layer's bounds in the Layout section, in viewport coordinates, as the select tool shows them. */
export interface LayoutValues {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type LayoutKey = keyof LayoutValues;

/**
 * Returns the bounds of the layer's paths in the vector layer as it's drawn at the current time, or
 * undefined if it has none (e.g. an empty group) or if it's the vector layer, whose size is in the
 * Document section instead.
 */
export function getLayoutValues(rendered: VectorLayer, layerId: string): LayoutValues | undefined {
  if (layerId === rendered.id) {
    return undefined;
  }
  const bounds = getLayerBounds(rendered, layerId);
  return bounds && { x: bounds.l, y: bounds.t, w: bounds.r - bounds.l, h: bounds.b - bounds.t };
}

/**
 * Returns a selector of the layer's layout at the current time, for the Layout section. The
 * section's selector runs on every change to the store, so this one only bounds the layer again
 * when the document or the time changes. Playback changes the time on every frame, and bounding
 * a group of many paths that often would make it stutter, so while it plays, the layout stays
 * as it was until it stops, unless the document itself changes.
 */
export function createLayoutSelector(layerId: string) {
  let last:
    | {
        vectorLayer: VectorLayer;
        animation: Animation;
        // The renderer draws every time into the same vector layer, so this is keyed by the
        // selector's result, which is new for each time.
        animated: ReturnType<typeof getAnimatedVectorLayer>;
        layout: LayoutValues | undefined;
      }
    | undefined;
  return (state: State) => {
    const vectorLayer = getVectorLayer(state);
    const animation = getAnimation(state);
    const isDocumentSame = last?.vectorLayer === vectorLayer && last.animation === animation;
    if (last && isDocumentSame && getIsPlaying(state)) {
      return last.layout;
    }
    const animated = getAnimatedVectorLayer(state);
    if (!last || last.animated !== animated) {
      last = { vectorLayer, animation, animated, layout: getLayoutValues(animated.vl, layerId) };
    }
    return last.layout;
  };
}

/** Whether two layouts show the same, so that playback doesn't redraw fields that don't change. */
export function areLayoutsEqual(a: LayoutValues | undefined, b: LayoutValues | undefined) {
  return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
}

/**
 * Returns the document with the layer moved (X and Y) or resized from its top left corner (W and
 * H) so that its bounds in the rendered vector layer have the value, with its animation moved
 * along, as dragging it on the canvas does. Returns undefined if that can't be done: e.g. it has no
 * bounds, or its width or height is 0, which no scale can change.
 */
export function setLayoutValue(
  document: CanvasDocument,
  rendered: VectorLayer,
  layerId: string,
  key: LayoutKey,
  value: number,
): CanvasDocument | undefined {
  const layout = getLayoutValues(rendered, layerId);
  if (!layout || !Number.isFinite(value)) {
    return undefined;
  }
  if (key === 'x' || key === 'y') {
    const delta = value - layout[key];
    // Rounded like the fields show values, so that a typed value isn't off by a rounding error.
    const dx = key === 'x' ? round(delta, 6) : 0;
    const dy = key === 'y' ? round(delta, 6) : 0;
    return dx || dy ? translateLayers(document, rendered, [layerId], dx, dy) : undefined;
  }
  const size = layout[key];
  if (!size || value <= 0 || value === size) {
    return undefined;
  }
  const scale = value / size;
  const matrix = scalingAround(
    { x: layout.x, y: layout.y },
    key === 'w' ? scale : 1,
    key === 'h' ? scale : 1,
  );
  return transformLayers(document, rendered, [layerId], matrix);
}
