import * as paper from 'paper';

export class SelectionBoundsRaster extends paper.Raster {
  constructor(public readonly type: RasterType, center: paper.Point) {
    super(`/assets/handle.png`, center);
  }
}

export type RasterType =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'rightCenter'
  | 'bottomRight'
  | 'bottomCenter'
  | 'bottomLeft'
  | 'leftCenter';
