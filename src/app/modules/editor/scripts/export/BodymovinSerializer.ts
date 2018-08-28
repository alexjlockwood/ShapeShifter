import { VectorLayer as VectorLayerModel } from 'app/modules/editor/model/layers';
import { Animation as AnimationModel } from 'app/modules/editor/model/timeline';

import { Animation, Asset, Layer } from './bodymovin';

const bodymovinVersion = '5.2.1';
const framerate = 60;

export function createBodymovin(
  animation: AnimationModel,
  vectorLayer: VectorLayerModel,
): Animation {
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
