import * as paper from 'paper';

export type PivotType =
  | 'bottomLeft'
  | 'leftCenter'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'rightCenter'
  | 'bottomRight'
  | 'bottomCenter';

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

  private pivotType_: PivotType;
  private oppositePivotType_: PivotType;

  constructor() {
    super(`/assets/handle.png`);
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

// const RESIZE_CURSOR_MAP = new Map<PivotType, Cursor>([
//   ['bottomLeft', Cursor.Resize45],
//   ['leftCenter', Cursor.Resize90],
//   ['topLeft', Cursor.Resize135],
//   ['topCenter', Cursor.Resize0],
//   ['topRight', Cursor.Resize45],
//   ['rightCenter', Cursor.Resize90],
//   ['bottomRight', Cursor.Resize135],
//   ['bottomCenter', Cursor.Resize0],
// ]);

// export function getResizeCursor(index: number) {
//   return RESIZE_CURSOR_MAP.get(getPivotType(index));
// }
