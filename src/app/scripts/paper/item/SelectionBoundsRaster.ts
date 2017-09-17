import * as paper from 'paper';

export class SelectionBoundsRaster extends paper.Raster {
  readonly oppositePivotType: PivotType;
  constructor(public readonly pivotType: PivotType, center: paper.Point) {
    super(`/assets/handle.png`, center);
    this.oppositePivotType = getOppositePivotType(pivotType);
  }
}

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

const OPPOSITE_PIVOT_TYPES: ReadonlyArray<PivotType> = ((arr: ReadonlyArray<PivotType>) =>
  arr.map((_, i) => arr[(i + arr.length / 2) % arr.length]))(PIVOT_TYPES);

function getOppositePivotType(pivotType: PivotType) {
  return OPPOSITE_PIVOT_TYPES[PIVOT_TYPES.indexOf(pivotType)];
}

// export function getResizeCursor(index: number) {
//   return RESIZE_CURSOR_MAP.get(getPivotType(index));
// }
