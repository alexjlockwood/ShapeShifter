import { Layer } from './layers';

export interface Animation {
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

export interface Asset {
  /** The ID of the asset. Referenced by other layer's 'refId'. */
  id: string;
  /** The list of layers for this asset. */
  layers: Layer[];
}
