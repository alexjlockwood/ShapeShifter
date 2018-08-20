import { PivotType } from 'app/modules/editor/scripts/paper/util';
import * as paper from 'paper';

const PIVOT_TYPES: ReadonlyArray<PivotType> = [
  'bottomLeft',
  'leftCenter',
  'topLeft',
  'topCenter',
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
];

export class SelectionBoundsRaster extends paper.Raster {
  private static instance: SelectionBoundsRaster;
  private pivotType_: PivotType;
  private oppositePivotType_: PivotType;

  static of(pivotType: PivotType, center: paper.Point) {
    if (!SelectionBoundsRaster.instance) {
      SelectionBoundsRaster.instance = new SelectionBoundsRaster();
    }
    const raster = SelectionBoundsRaster.instance.clone(false) as SelectionBoundsRaster;
    raster.position = center;
    raster.pivotType_ = pivotType;
    raster.oppositePivotType_ = getOppositePivotType(pivotType);
    return raster;
  }

  constructor() {
    super(`/assets/paper/selection-bounds-segment.png`);
  }

  get pivotType() {
    return this.pivotType_;
  }

  get oppositePivotType() {
    return this.oppositePivotType_;
  }
}

const OPPOSITE_PIVOT_TYPES: ReadonlyArray<PivotType> = ((arr: ReadonlyArray<PivotType>) =>
  arr.map((_, i) => arr[(i + arr.length / 2) % arr.length]))(PIVOT_TYPES);

function getOppositePivotType(pivotType: PivotType) {
  return OPPOSITE_PIVOT_TYPES[PIVOT_TYPES.indexOf(pivotType)];
}
