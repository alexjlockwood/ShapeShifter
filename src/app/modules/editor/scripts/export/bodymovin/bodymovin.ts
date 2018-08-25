import { VectorLayer as VectorLayerModel } from 'app/modules/editor/model/layers';
import { Animation as AnimationModel } from 'app/modules/editor/model/timeline';

import { Layer } from './layer';

const bodymovinVersion = '5.2.1';
const framerate = 60;

export function createBodymovin(
  animation: AnimationModel,
  vectorLayer: VectorLayerModel,
): Bodymovin {
  const inPoint = 0;
  const outPoint = (animation.duration * framerate) / 1000;
  // TODO: populate these
  const assets = [] as Asset[];
  const layers = [] as Layer[];
  return {
    v: bodymovinVersion,
    fr: framerate,
    nm: animation.name,
    ip: inPoint,
    op: outPoint,
    w: vectorLayer.width,
    h: vectorLayer.height,
    assets,
    layers,
  };
}

export interface Bodymovin {
  /** The bodymovin version. Always the latest version. */
  v: string;
  /** The framerate of the animation. */
  fr: number;
  /** The name of the animation. */
  nm: string;
  /** The in point of the animation in frames. */
  ip: number;
  /** The out point of the animation in frames. */
  op: number;
  /** The width of the composition. */
  w: number;
  /** The height of the composition. */
  h: number;
  /** The list of assets in the composition. */
  assets: Asset[];
  /** The list of layers in the composition. */
  layers: Layer[];
}

interface Asset {
  /** The ID of the asset. */
  id: string;
  /** The list of layers for this asset. */
  layers: Layer[];
}
