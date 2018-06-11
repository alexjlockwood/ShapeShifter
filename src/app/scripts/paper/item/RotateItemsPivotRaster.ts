import * as paper from 'paper';

export class RotateItemsPivotRaster extends paper.Raster {
  private static instance: RotateItemsPivotRaster;

  static of(position: paper.Point) {
    if (!RotateItemsPivotRaster.instance) {
      RotateItemsPivotRaster.instance = new RotateItemsPivotRaster();
    }
    const raster = RotateItemsPivotRaster.instance.clone(false) as RotateItemsPivotRaster;
    raster.position = position;
    return raster;
  }

  constructor() {
    super('/assets/paper/rotate-items-pivot.png');
  }
}
